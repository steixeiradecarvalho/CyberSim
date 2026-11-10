import type { EventBus } from "../event-bus";
import { drawSecondOrder } from "../marks.ts";
import { clamp, lerp } from "../math.ts";
import { PALETTE } from "../palette.ts";
import type { CircuitReport, DialogicNode, FilteredSample, LensId } from "../types";

const AGENTS = 64;
const BRANCHES = 380;
const FW = 36;
const FH = 20;
const FN = FW * FH;

type Memory = { x: number; y: number; polarity: number; strength: number; prior: boolean };

/**
 * Rizoma. Quatro espécies negociam localmente.
 * O gesto não planta: o FieldNegotiator aceita só uma porosidade do nutriente sugerido.
 * DialogicMemory de sessões anteriores continua atraindo ou repelindo.
 */
export class RhizomaCircuit {
  readonly id = "rhizoma" as const;
  lens: LensId = "flow";

  private x = new Float32Array(AGENTS);
  private y = new Float32Array(AGENTS);
  private vx = new Float32Array(AGENTS);
  private vy = new Float32Array(AGENTS);
  private kind = new Uint8Array(AGENTS);
  private energy = new Float32Array(AGENTS);
  private phase = new Float32Array(AGENTS);
  private rate = new Float32Array(AGENTS);
  private cool = new Float32Array(AGENTS);

  private bx0 = new Float32Array(BRANCHES);
  private by0 = new Float32Array(BRANCHES);
  private bx1 = new Float32Array(BRANCHES);
  private by1 = new Float32Array(BRANCHES);
  private blife = new Float32Array(BRANCHES);
  private bcount = 0;

  private field = new Float32Array(FN);
  private field0 = new Float32Array(FN);
  private occupy = new Float32Array(FN);

  private memories: Memory[] = [];
  private linkA = new Int16Array(24);
  private linkB = new Int16Array(24);
  private links = 0;
  private memoryCool = 0;
  private input: FilteredSample | null = null;
  private time = 0;
  private emitAcc = 0;
  private homeoHold = 0;
  private homeoArmed = false;
  private reading = "O enxame já negocia. Sua mão, se vier, será só uma pergunta.";
  private readingHold = 0;
  private pending = this.reading;
  private sessionIndex = 1;

  readonly out: CircuitReport = {
    module: "rhizoma",
    resonance: 0.2,
    phaseOffset: 0.2,
    tension: 0.3,
    harmony: 0.4,
    complexity: 0.35,
    homeodynamic: false,
    reading: this.reading,
    porosity: 0.7,
  };

  private bus: EventBus;

  constructor(bus: EventBus) {
    this.bus = bus;
    this.seedField();
    this.seedAgents();
    bus.onFiltered(() => {
      this.input = bus.lastInput;
    });
  }

  seedMemory(nodes: DialogicNode[], sessionIndex: number): void {
    this.sessionIndex = sessionIndex + 1;
    this.memories = nodes.slice(-32).map((node) => ({
      x: node.x,
      y: node.y,
      polarity: node.polarity,
      strength: node.strength,
      prior: true,
    }));
  }

  private seedField(): void {
    const blobs = [
      [0.28, 0.36, 0.7],
      [0.7, 0.32, 0.55],
      [0.55, 0.68, 0.8],
      [0.22, 0.72, 0.4],
    ];
    for (let j = 0; j < FH; j++) {
      for (let i = 0; i < FW; i++) {
        const nx = i / (FW - 1);
        const ny = j / (FH - 1);
        let v = 0;
        for (const [bx, by, amp] of blobs) {
          const dx = nx - bx!;
          const dy = ny - by!;
          v += amp! * Math.exp(-(dx * dx + dy * dy) * 18);
        }
        this.field[i + j * FW] = v;
      }
    }
  }

  private seedAgents(): void {
    for (let i = 0; i < AGENTS; i++) {
      this.kind[i] = i % 4;
      const ang = i * 2.399;
      const rad = 0.08 + (i % 9) * 0.035;
      this.x[i] = clamp(0.5 + Math.cos(ang) * rad, 0.06, 0.94);
      this.y[i] = clamp(0.5 + Math.sin(ang) * rad * 0.85, 0.06, 0.94);
      this.energy[i] = 0.45 + (i % 5) * 0.08;
      this.phase[i] = (i * 0.37) % (Math.PI * 2);
      this.rate[i] = 0.6 + (i % 4) * 0.35;
      this.cool[i] = (i % 7) * 0.05;
    }
  }

  step(dt: number): void {
    this.time += dt;
    this.memoryCool = Math.max(0, this.memoryCool - dt);
    this.links = 0;
    this.diffuse(dt);
    this.rebuildOccupy();
    this.deposit();
    this.negotiate(dt);
    this.integrate(dt);
    this.ageBranches(dt);
    this.analyze(dt);
    this.emitAcc += dt;
    if (this.emitAcc >= 0.1) {
      this.emitAcc = 0;
      this.bus.emitSympathy(this.id, this.out.resonance, this.out.phaseOffset);
      this.bus.emitReport(this.out);
    }
  }

  private diffuse(dt: number): void {
    const regen = [
      [10, 7],
      [24, 6],
      [20, 14],
      [8, 15],
    ];
    for (const [i, j] of regen) this.field[i! + j! * FW]! += dt * 0.08;
    for (let j = 1; j < FH - 1; j++) {
      for (let i = 1; i < FW - 1; i++) {
        const idx = i + j * FW;
        const avg =
          this.field[idx - 1]! + this.field[idx + 1]! + this.field[idx - FW]! + this.field[idx + FW]!;
        this.field0[idx] = (this.field[idx]! * 0.62 + avg * 0.095) * (1 - dt * 0.12);
      }
    }
    const swap = this.field;
    this.field = this.field0;
    this.field0 = swap;
    for (let i = 0; i < FN; i++) {
      if (this.field[i]! < 0) this.field[i] = 0;
      if (this.field[i]! > 1.6) this.field[i] = 1.6;
    }
  }

  private rebuildOccupy(): void {
    this.occupy.fill(0);
    for (let a = 0; a < AGENTS; a++) {
      const i = clamp(Math.floor(this.x[a]! * (FW - 1)), 0, FW - 1);
      const j = clamp(Math.floor(this.y[a]! * (FH - 1)), 0, FH - 1);
      this.occupy[i + j * FW]! += this.kind[a] === 1 ? 0.22 : 0.12;
    }
  }

  private deposit(): void {
    const input = this.input;
    if (!input?.hasPointer) return;
    const speed = Math.hypot(input.velocity.x, input.velocity.y);
    if (speed < 0.04) return;
    const i = clamp(Math.floor(input.position.x * (FW - 1)), 1, FW - 2);
    const j = clamp(Math.floor(input.position.y * (FH - 1)), 1, FH - 2);
    const idx = i + j * FW;
    const porosity = clamp(1 - this.occupy[idx]! * 1.35, 0.06, 1);
    const amount = Math.min(0.22, speed * 0.05) * porosity;
    this.field[idx]! += amount;
    this.out.porosity = porosity;
  }

  private cell(nx: number, ny: number): number {
    const i = clamp(Math.floor(nx * (FW - 1)), 0, FW - 1);
    const j = clamp(Math.floor(ny * (FH - 1)), 0, FH - 1);
    return i + j * FW;
  }

  private gradient(nx: number, ny: number): { x: number; y: number } {
    const i = clamp(Math.floor(nx * (FW - 1)), 1, FW - 2);
    const j = clamp(Math.floor(ny * (FH - 1)), 1, FH - 2);
    const idx = i + j * FW;
    return {
      x: (this.field[idx + 1]! - this.field[idx - 1]!) * 0.5,
      y: (this.field[idx + FW]! - this.field[idx - FW]!) * 0.5,
    };
  }

  private negotiate(dt: number): void {
    for (let a = 0; a < AGENTS; a++) {
      this.phase[a] = (this.phase[a]! + this.rate[a]! * dt) % (Math.PI * 2);
      this.cool[a] = Math.max(0, this.cool[a]! - dt);
      const g = this.gradient(this.x[a]!, this.y[a]!);
      for (const mem of this.memories) {
        const dx = mem.x - this.x[a]!;
        const dy = mem.y - this.y[a]!;
        const fall = Math.exp(-(dx * dx + dy * dy) * 10) * mem.strength;
        const sign = this.kind[a] === 3 ? -1 : 1;
        this.vx[a]! += dx * fall * mem.polarity * sign * 0.35;
        this.vy[a]! += dy * fall * mem.polarity * sign * 0.35;
      }
      const k = this.kind[a]!;
      if (k === 0) {
        this.vx[a]! += g.x * 1.4;
        this.vy[a]! += g.y * 1.4;
        const idx = this.cell(this.x[a]!, this.y[a]!);
        const bite = Math.min(this.field[idx]!, 0.25);
        this.field[idx]! -= bite;
        this.energy[a] = clamp(this.energy[a]! + bite * 0.5, 0, 1.4);
      } else if (k === 1) {
        this.vx[a]! += g.x * 0.25;
        this.vy[a]! += -g.y * 0.05;
        if (this.cool[a]! <= 0 && this.energy[a]! > 0.35 && this.bcount < BRANCHES) {
          const idx = this.cell(this.x[a]!, this.y[a]!);
          const refusal = this.occupy[idx]!;
          if (refusal > 0.85) {
            this.cool[a] = 0.45;
          } else {
            const toward = Math.atan2(g.y, g.x);
            const wander = Math.sin(this.phase[a]!) * 0.9;
            const ang = Math.abs(g.x) + Math.abs(g.y) > 0.02 ? toward * 0.65 + wander : wander + this.phase[a]!;
            const len = 0.028 + this.energy[a]! * 0.018;
            const nx = clamp(this.x[a]! + Math.cos(ang) * len, 0.04, 0.96);
            const ny = clamp(this.y[a]! + Math.sin(ang) * len, 0.04, 0.96);
            const b = this.bcount++;
            this.bx0[b] = this.x[a]!;
            this.by0[b] = this.y[a]!;
            this.bx1[b] = nx;
            this.by1[b] = ny;
            this.blife[b] = 9;
            this.x[a] = nx;
            this.y[a] = ny;
            this.energy[a]! *= 0.78;
            this.cool[a] = 0.28;
          }
        }
      } else if (k === 2) {
        let best = -1;
        let bestD = 0.09;
        for (let o = 0; o < AGENTS; o++) {
          if (o === a || this.kind[o] === 2) continue;
          const dx = this.x[o]! - this.x[a]!;
          const dy = this.y[o]! - this.y[a]!;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD) {
            bestD = d2;
            best = o;
          }
        }
        if (best >= 0) {
          const dx = this.x[best]! - this.x[a]!;
          const dy = this.y[best]! - this.y[a]!;
          this.vx[a]! += dx * 1.6;
          this.vy[a]! += dy * 1.6;
          if (this.links < 24) {
            this.linkA[this.links] = a;
            this.linkB[this.links] = best;
            this.links++;
          }
          const diff = Math.atan2(Math.sin(this.phase[best]! - this.phase[a]!), Math.cos(this.phase[best]! - this.phase[a]!));
          this.phase[a] = (this.phase[a]! + diff * 0.15) % (Math.PI * 2);
          this.energy[a] = clamp(this.energy[a]! + dt * 0.15, 0, 1.4);
          this.energy[best] = clamp(this.energy[best]! + dt * 0.08, 0, 1.4);
          if (this.memoryCool <= 0 && Math.abs(diff) < 0.45 && this.memories.length < 40) {
            this.sproutMemory(a, best);
          }
        } else {
          this.vx[a]! += g.x * 0.4;
          this.vy[a]! += g.y * 0.4;
        }
      } else {
        let hot = this.cell(this.x[a]!, this.y[a]!);
        let bestOcc = this.occupy[hot]!;
        const i0 = hot % FW;
        const j0 = (hot / FW) | 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const i = clamp(i0 + di, 0, FW - 1);
            const j = clamp(j0 + dj, 0, FH - 1);
            const occ = this.occupy[i + j * FW]!;
            if (occ > bestOcc) {
              bestOcc = occ;
              hot = i + j * FW;
            }
          }
        }
        const tx = (hot % FW) / (FW - 1);
        const ty = ((hot / FW) | 0) / (FH - 1);
        this.vx[a]! += (tx - this.x[a]!) * 0.8;
        this.vy[a]! += (ty - this.y[a]!) * 0.8;
        const here = this.cell(this.x[a]!, this.y[a]!);
        this.field[here]! *= 1 - dt * 0.8;
        this.energy[a] = clamp(this.energy[a]! + dt * 0.05, 0, 1.2);
      }
    }

    for (let a = 0; a < AGENTS; a++) {
      for (let o = a + 1; o < AGENTS; o++) {
        const dx = this.x[o]! - this.x[a]!;
        const dy = this.y[o]! - this.y[a]!;
        const d2 = dx * dx + dy * dy;
        if (d2 < 0.0009 && d2 > 1e-6) {
          const inv = 0.012 / d2;
          this.vx[a]! -= dx * inv;
          this.vy[a]! -= dy * inv;
          this.vx[o]! += dx * inv;
          this.vy[o]! += dy * inv;
        }
      }
    }
  }

  private sproutMemory(a: number, b: number): void {
    const node = {
      x: (this.x[a]! + this.x[b]!) * 0.5,
      y: (this.y[a]! + this.y[b]!) * 0.5,
      polarity: this.kind[b] === 3 ? -0.6 : 0.85,
      strength: 0.55,
      session: this.sessionIndex,
    };
    this.memories.push({ ...node, prior: false });
    this.bus.emitMemory(node);
    this.memoryCool = 1.6;
  }

  private integrate(dt: number): void {
    const damp = Math.exp(-dt * 1.7);
    for (let a = 0; a < AGENTS; a++) {
      this.vx[a]! *= damp;
      this.vy[a]! *= damp;
      const sp = Math.hypot(this.vx[a]!, this.vy[a]!);
      if (sp > 0.45) {
        this.vx[a]! *= 0.45 / sp;
        this.vy[a]! *= 0.45 / sp;
      }
      this.x[a] = clamp(this.x[a]! + this.vx[a]! * dt, 0.03, 0.97);
      this.y[a] = clamp(this.y[a]! + this.vy[a]! * dt, 0.03, 0.97);
    }
  }

  private ageBranches(dt: number): void {
    for (let i = 0; i < this.bcount; i++) {
      this.blife[i]! -= dt;
      if (this.blife[i]! <= 0) {
        const last = this.bcount - 1;
        this.bx0[i] = this.bx0[last]!;
        this.by0[i] = this.by0[last]!;
        this.bx1[i] = this.bx1[last]!;
        this.by1[i] = this.by1[last]!;
        this.blife[i] = this.blife[last]!;
        this.bcount--;
        i--;
      }
    }
  }

  private analyze(dt: number): void {
    let mx = 0;
    let my = 0;
    let sin = 0;
    let cos = 0;
    let sym = 0;
    let kinds = 0;
    const seen = [0, 0, 0, 0];
    for (let a = 0; a < AGENTS; a++) {
      if (this.kind[a] !== 3) {
        mx += this.vx[a]!;
        my += this.vy[a]!;
      }
      if (this.kind[a] === 2) {
        sin += Math.sin(this.phase[a]!);
        cos += Math.cos(this.phase[a]!);
        sym++;
      }
      seen[this.kind[a]!]++;
    }
    for (const n of seen) if (n > 0) kinds++;
    const coherence = sym > 0 ? Math.hypot(sin, cos) / sym : 0;
    const input = this.input;
    const ivx = input?.velocity.x ?? 0;
    const ivy = input?.velocity.y ?? 0;
    const ispeed = Math.hypot(ivx, ivy);
    const mspeed = Math.hypot(mx, my);
    const align = ispeed > 0.05 && mspeed > 1e-4 ? clamp((ivx * mx + ivy * my) / (ispeed * mspeed) * 0.5 + 0.5) : coherence;
    this.out.resonance = lerp(this.out.resonance, clamp(align * 0.55 + coherence * 0.45), 0.08);
    const meanPhase = Math.atan2(sin, cos);
    this.out.phaseOffset = lerp(this.out.phaseOffset, (meanPhase + Math.PI) / (Math.PI * 2), 0.1);
    this.out.tension = lerp(this.out.tension, clamp(this.links / 10), 0.1);
    this.out.complexity = lerp(this.out.complexity, clamp((kinds / 4) * (0.35 + this.links / 12)), 0.08);
    this.out.harmony = lerp(this.out.harmony, clamp(coherence * (0.5 + this.out.porosity * 0.5)), 0.08);
    const nuanced = this.out.porosity > 0.22 && this.out.porosity < 0.88;
    this.out.homeodynamic = coherence > 0.72 && sym >= 4 && nuanced && this.links >= 2;
    if (this.out.homeodynamic) this.homeoHold += dt;
    else {
      if (this.homeoArmed && this.homeoHold > 1.2) this.bus.emitResonance(this.id, this.homeoHold, true);
      this.homeoHold = 0;
      this.homeoArmed = false;
    }
    if (this.homeoHold > 1.2) this.homeoArmed = true;

    let next = "Crescimento é negociação. A estrutura só avança onde a ocupação deixa porosidade.";
    if (this.memories.some((m) => m.prior)) next = "A sessão anterior ainda puxa o enxame. Memória aqui é um campo, não um fantasma.";
    if ((input?.mirrorLag ?? 0) > 0.2) next = "O nutriente cai no lugar atrasado. Os agentes respondem ao espelho.";
    else if (this.out.porosity < 0.35 && input?.hasPointer) next = "Porosidade baixa. O campo recusou parte da pergunta — e isso também é relação.";
    else if (this.out.homeodynamic) next = "Fases da simbiose encostaram. Não é uma colheita: é um acordo temporário.";
    if (next !== this.pending) {
      this.pending = next;
      this.readingHold = 0;
    } else this.readingHold += dt;
    if (this.readingHold > 0.45) this.reading = next;
    this.out.reading = this.reading;
  }

  flushEpisode(): void {
    if (this.homeoArmed && this.homeoHold > 1.2) this.bus.emitResonance(this.id, this.homeoHold, true);
    this.homeoHold = 0;
    this.homeoArmed = false;
  }

  report(): CircuitReport {
    return this.out;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, w, h);

    if (this.lens === "tension") this.drawSdf(ctx, w, h);
    else if (this.lens === "flow") this.drawNutrient(ctx, w, h);

    ctx.save();
    ctx.lineWidth = 1;
    for (const mem of this.memories) {
      ctx.strokeStyle = mem.prior ? PALETTE.mediate : PALETTE.flow;
      ctx.globalAlpha = mem.prior ? 0.45 : 0.3;
      ctx.setLineDash(mem.prior ? [3, 4] : []);
      ctx.beginPath();
      ctx.arc(mem.x * w, mem.y * h, 14 + mem.strength * 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = PALETTE.bone;
    ctx.lineWidth = 1;
    for (let i = 0; i < this.bcount; i++) {
      ctx.globalAlpha = clamp(this.blife[i]! / 9, 0.15, 0.85);
      ctx.beginPath();
      ctx.moveTo(this.bx0[i]! * w, this.by0[i]! * h);
      ctx.lineTo(this.bx1[i]! * w, this.by1[i]! * h);
      ctx.stroke();
    }
    ctx.restore();

    if (this.lens === "sync") {
      ctx.save();
      ctx.strokeStyle = PALETTE.mediate;
      for (let i = 0; i < this.links; i++) {
        const a = this.linkA[i]!;
        const b = this.linkB[i]!;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.moveTo(this.x[a]! * w, this.y[a]! * h);
        ctx.lineTo(this.x[b]! * w, this.y[b]! * h);
        ctx.stroke();
      }
      ctx.restore();
    } else if (this.links) {
      ctx.save();
      ctx.strokeStyle = PALETTE.mediate;
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < this.links; i++) {
        const a = this.linkA[i]!;
        const b = this.linkB[i]!;
        ctx.beginPath();
        ctx.moveTo(this.x[a]! * w, this.y[a]! * h);
        ctx.lineTo(this.x[b]! * w, this.y[b]! * h);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (let a = 0; a < AGENTS; a++) {
      const px = this.x[a]! * w;
      const py = this.y[a]! * h;
      const k = this.kind[a]!;
      ctx.save();
      if (this.lens === "sync") {
        const hue = (this.phase[a]! / (Math.PI * 2)) * 0.5 + 0.5;
        ctx.globalAlpha = 0.35 + hue * 0.65;
      }
      if (k === 0) {
        ctx.fillStyle = PALETTE.flow;
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.flow;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(this.phase[a]!) * 8, py + Math.sin(this.phase[a]!) * 8);
        ctx.stroke();
      } else if (k === 1) {
        ctx.strokeStyle = PALETTE.bone;
        ctx.strokeRect(px - 3, py - 3, 6, 6);
      } else if (k === 2) {
        ctx.strokeStyle = PALETTE.mediate;
        ctx.beginPath();
        ctx.arc(px - 2, py, 3, 0, Math.PI * 2);
        ctx.arc(px + 2, py, 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = PALETTE.tension;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0.4, 5.6);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawSecondOrder(ctx, this.input, w, h);
  }

  private drawNutrient(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.fillStyle = PALETTE.flow;
    for (let j = 0; j < FH; j++) {
      for (let i = 0; i < FW; i++) {
        const v = this.field[i + j * FW]!;
        if (v < 0.12) continue;
        ctx.globalAlpha = Math.min(0.35, v * 0.22);
        ctx.beginPath();
        ctx.arc((i / (FW - 1)) * w, (j / (FH - 1)) * h, 10 + v * 16, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawSdf(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const cols = 28;
    const rows = 16;
    ctx.save();
    ctx.fillStyle = PALETTE.tension;
    const cap = Math.min(this.bcount, 80);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const nx = (i + 0.5) / cols;
        const ny = (j + 0.5) / rows;
        let d = 0.2;
        for (let b = 0; b < cap; b++) {
          d = Math.min(d, distToSeg(nx, ny, this.bx0[b]!, this.by0[b]!, this.bx1[b]!, this.by1[b]!));
        }
        if (d > 0.075) continue;
        ctx.globalAlpha = (1 - d / 0.075) * 0.45;
        ctx.fillRect(nx * w - 1, ny * h - 1, 2, 2);
      }
    }
    ctx.restore();
  }
}

function distToSeg(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1e-6;
  let t = ((px - x0) * dx + (py - y0) * dy) / l2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const qx = x0 + t * dx;
  const qy = y0 + t * dy;
  return Math.hypot(px - qx, py - qy);
}
