import type { EventBus } from "../event-bus";
import { drawFlowMark, drawMediationMark, drawSecondOrder, drawTensionMark } from "../marks.ts";
import { clamp, lerp } from "../math.ts";
import { PALETTE } from "../palette.ts";
import type { CircuitReport, FilteredSample } from "../types";

const NODES = 6;
const MEMBERS = 12;
const HIST = 120;

/**
 * Nó de tensegrity. O gesto é vento sobre um mediador, não uma mão que arrasta nós.
 * TensionAgent cede localmente e restaura o pré-esforço.
 * HarmonicTopology lê coerência de frequência — homeodinâmica, não "nó desatado".
 */
export class TensegrityCircuit {
  readonly id = "tensegrity_knot" as const;

  private x = new Float32Array(NODES);
  private y = new Float32Array(NODES);
  private z = new Float32Array(NODES);
  private vx = new Float32Array(NODES);
  private vy = new Float32Array(NODES);
  private vz = new Float32Array(NODES);
  private fx = new Float32Array(NODES);
  private fy = new Float32Array(NODES);
  private fz = new Float32Array(NODES);

  private a = new Uint8Array(MEMBERS);
  private b = new Uint8Array(MEMBERS);
  private rest = new Float32Array(MEMBERS);
  private rest0 = new Float32Array(MEMBERS);
  private stiff = new Float32Array(MEMBERS);
  private cable = new Uint8Array(MEMBERS);
  private stress = new Float32Array(MEMBERS);

  private energyHist = new Float32Array(HIST);
  private histN = 0;
  private histW = 0;

  private anchorX = 0.5;
  private anchorY = 0.5;
  private anchorZ = 0;
  private input: FilteredSample | null = null;
  private time = 0;
  private emitAcc = 0;
  private homeoHold = 0;
  private homeoArmed = false;
  private analyzeTick = 0;
  private reading = "O nó já nasce tensionado. Perturbe pouco e escute o modo que resta.";
  private readingHold = 0;
  private pending = this.reading;

  readonly out: CircuitReport = {
    module: "tensegrity_knot",
    resonance: 0.25,
    phaseOffset: 0.3,
    tension: 0.35,
    harmony: 0.4,
    complexity: 0.4,
    homeodynamic: false,
    reading: this.reading,
    porosity: 0.5,
  };

  private bus: EventBus;

  constructor(bus: EventBus) {
    this.bus = bus;
    this.build();
    bus.onFiltered(() => {
      this.input = bus.lastInput;
    });
  }

  private build(): void {
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2;
      this.x[i] = 0.5 + Math.cos(ang) * 0.2;
      this.y[i] = 0.56 + Math.sin(ang) * 0.17;
      this.z[i] = -0.22;
      const top = i + 3;
      const twist = ang + 0.85;
      this.x[top] = 0.5 + Math.cos(twist) * 0.15;
      this.y[top] = 0.42 + Math.sin(twist) * 0.13;
      this.z[top] = 0.26;
    }
    this.vx[1] = 0.22;
    this.vy[4] = -0.12;
    const cables: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 4],
      [4, 5],
      [5, 3],
      [0, 3],
      [1, 4],
      [2, 5],
    ];
    const struts: [number, number][] = [
      [0, 4],
      [1, 5],
      [2, 3],
    ];
    let m = 0;
    for (const [i, j] of cables) this.addMember(m++, i, j, true);
    for (const [i, j] of struts) this.addMember(m++, i, j, false);
    this.anchorX = this.mean(this.x);
    this.anchorY = this.mean(this.y);
    this.anchorZ = this.mean(this.z);
  }

  private addMember(index: number, i: number, j: number, isCable: boolean): void {
    this.a[index] = i;
    this.b[index] = j;
    this.cable[index] = isCable ? 1 : 0;
    const len = this.length(i, j);
    const rest = len * (isCable ? 0.9 : 1.1);
    this.rest[index] = rest;
    this.rest0[index] = rest;
    this.stiff[index] = isCable ? 11 : 8;
  }

  private length(i: number, j: number): number {
    return Math.hypot(this.x[j]! - this.x[i]!, this.y[j]! - this.y[i]!, this.z[j]! - this.z[i]!);
  }

  private mean(arr: Float32Array): number {
    let s = 0;
    for (let i = 0; i < NODES; i++) s += arr[i]!;
    return s / NODES;
  }

  step(dt: number): void {
    this.time += dt;
    this.fx.fill(0);
    this.fy.fill(0);
    this.fz.fill(0);
    let strainSum = 0;
    let pe = 0;
    for (let m = 0; m < MEMBERS; m++) {
      const i = this.a[m]!;
      const j = this.b[m]!;
      const dx = this.x[j]! - this.x[i]!;
      const dy = this.y[j]! - this.y[i]!;
      const dz = this.z[j]! - this.z[i]!;
      const len = Math.hypot(dx, dy, dz) || 1e-5;
      const rest = this.rest[m]!;
      const delta = len - rest;
      const strain = delta / rest;
      this.stress[m] = strain;
      strainSum += Math.abs(strain);
      const isCable = this.cable[m] === 1;
      let force = 0;
      if (!isCable || delta > 0) force = this.stiff[m]! * delta;
      pe += 0.5 * this.stiff[m]! * delta * delta;
      const nx = dx / len;
      const ny = dy / len;
      const nz = dz / len;
      this.fx[i]! += nx * force;
      this.fy[i]! += ny * force;
      this.fz[i]! += nz * force;
      this.fx[j]! -= nx * force;
      this.fy[j]! -= ny * force;
      this.fz[j]! -= nz * force;

      const give = strain * 0.35 * dt;
      let nextRest = rest + give * rest;
      nextRest = lerp(nextRest, this.rest0[m]!, 1 - Math.exp(-dt * 0.35));
      const lo = this.rest0[m]! * (isCable ? 0.78 : 0.9);
      const hi = this.rest0[m]! * (isCable ? 1.12 : 1.22);
      this.rest[m] = clamp(nextRest, lo, hi);
    }

    const input = this.input;
    if (input?.hasPointer) {
      const wx = input.velocity.x * 2.4;
      const wy = input.velocity.y * 2.4;
      for (let i = 0; i < NODES; i++) {
        const dx = this.x[i]! - input.position.x;
        const dy = this.y[i]! - input.position.y;
        const infl = Math.exp(-(dx * dx + dy * dy) * 5.5);
        this.fx[i]! += wx * infl * 3.2;
        this.fy[i]! += wy * infl * 3.2;
      }
    }

    const damp = Math.exp(-dt * 1.35);
    for (let i = 0; i < NODES; i++) {
      this.vx[i] = (this.vx[i]! + this.fx[i]! * dt) * damp;
      this.vy[i] = (this.vy[i]! + this.fy[i]! * dt) * damp;
      this.vz[i] = (this.vz[i]! + this.fz[i]! * dt) * damp;
      const sp = Math.hypot(this.vx[i]!, this.vy[i]!, this.vz[i]!);
      if (sp > 0.85) {
        const s = 0.85 / sp;
        this.vx[i]! *= s;
        this.vy[i]! *= s;
        this.vz[i]! *= s;
      }
      this.x[i]! += this.vx[i]! * dt;
      this.y[i]! += this.vy[i]! * dt;
      this.z[i]! += this.vz[i]! * dt;
    }
    const cx = this.mean(this.x);
    const cy = this.mean(this.y);
    const cz = this.mean(this.z);
    const pull = 1 - Math.exp(-dt * 1.4);
    for (let i = 0; i < NODES; i++) {
      this.x[i]! += (this.anchorX - cx) * pull;
      this.y[i]! += (this.anchorY - cy) * pull;
      this.z[i]! += (this.anchorZ - cz) * pull;
    }

    this.energyHist[this.histW] = pe;
    this.histW = (this.histW + 1) % HIST;
    this.histN = Math.min(HIST, this.histN + 1);

    const tension = strainSum / MEMBERS;
    this.out.tension = lerp(this.out.tension, clamp(tension / 0.45), 0.12);
    this.out.porosity = lerp(this.out.porosity, clamp(1 - this.out.tension), 0.08);

    this.analyzeTick++;
    if (this.analyzeTick % 4 === 0) this.analyze(dt * 4, pe);
    else this.house(dt);

    this.emitAcc += dt;
    if (this.emitAcc >= 0.1) {
      this.emitAcc = 0;
      this.bus.emitSympathy(this.id, this.out.resonance, this.out.phaseOffset);
      this.bus.emitReport(this.out);
    }
  }

  private house(dt: number): void {
    if (this.out.homeodynamic) this.homeoHold += dt;
    else if (this.homeoArmed) {
      if (this.homeoHold > 1.2) this.bus.emitResonance(this.id, this.homeoHold, true);
      this.homeoHold = 0;
      this.homeoArmed = false;
    }
    if (this.homeoHold > 1.2) this.homeoArmed = true;
  }

  private analyze(dt: number, pe: number): void {
    let coherence = 0;
    let bestLag = 8;
    const n = this.histN;
    if (n > 40) {
      const start = (this.histW - n + HIST) % HIST;
      let mean = 0;
      for (let i = 0; i < n; i++) mean += this.energyHist[(start + i) % HIST]!;
      mean /= n;
      let var0 = 0;
      for (let i = 0; i < n; i++) {
        const d = this.energyHist[(start + i) % HIST]! - mean;
        var0 += d * d;
      }
      const maxLag = Math.min(60, n - 8);
      for (let lag = 8; lag < maxLag; lag++) {
        let s = 0;
        let count = 0;
        for (let i = 0; i < n - lag; i++) {
          const a = this.energyHist[(start + i) % HIST]! - mean;
          const b = this.energyHist[(start + i + lag) % HIST]! - mean;
          s += a * b;
          count++;
        }
        const c = s / (var0 + 1e-8);
        if (c > coherence) {
          coherence = c;
          bestLag = lag;
        }
      }
      coherence = clamp(coherence);
      this.out.phaseOffset = lerp(this.out.phaseOffset, bestLag / HIST, 0.2);
      const variance = var0 / n;
      const alive = variance > 1e-6 && variance < 0.08;
      this.out.homeodynamic = coherence > 0.55 && alive && this.out.tension > 0.06 && this.out.tension < 0.55;
    }
    this.out.resonance = lerp(this.out.resonance, clamp(coherence * 0.75 + (this.out.homeodynamic ? 0.25 : 0)), 0.3);
    const mid = 1 - Math.min(1, Math.abs(this.out.tension - 0.22) / 0.22);
    this.out.complexity = lerp(this.out.complexity, clamp(mid * (0.35 + coherence)), 0.3);
    this.out.harmony = lerp(this.out.harmony, this.out.homeodynamic ? 0.86 : clamp(0.28 + coherence * 0.35), 0.3);
    this.house(dt);

    let next = "Cada segmento cede um pouco e o pré-esforço puxa de volta. Isso é a negociação.";
    if ((this.input?.mirrorLag ?? 0) > 0.2) next = "O vento chega atrasado. O nó responde a um gesto que a mão já deixou.";
    else if (this.out.homeodynamic) next = "A energia encontrou um período. Homeodinâmica: o nó continua tenso e coerente.";
    else if (this.out.tension > 0.5) next = "Esforço alto demais para um modo estável. Afrouxe o vento e deixe os agentes cederem.";
    else if (pe < 0.002) next = "Quase sem energia potencial. Um toque leve reacende o modo — sem desatar.";
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

  private project(i: number, w: number, h: number): { x: number; y: number } {
    const persp = 1 + this.z[i]! * 0.7;
    return {
      x: w * (0.5 + (this.x[i]! - 0.5) * persp),
      y: h * (0.5 + (this.y[i]! - 0.5) * persp) - this.z[i]! * h * 0.06,
    };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, w, h);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < NODES; i++) pts.push(this.project(i, w, h));

    for (let pass = 0; pass < 2; pass++) {
      for (let m = 0; m < MEMBERS; m++) {
        const isCable = this.cable[m] === 1;
        if ((pass === 0 && isCable) || (pass === 1 && !isCable)) continue;
        const i = this.a[m]!;
        const j = this.b[m]!;
        ctx.save();
        ctx.lineWidth = isCable ? 1.15 : 3.2;
        ctx.lineCap = "round";
        if (!isCable) ctx.strokeStyle = PALETTE.tension;
        else ctx.strokeStyle = this.out.homeodynamic ? PALETTE.flow : PALETTE.bone;
        ctx.globalAlpha = isCable ? 0.45 + Math.min(0.5, Math.abs(this.stress[m]!) * 2) : 0.9;
        ctx.beginPath();
        ctx.moveTo(pts[i]!.x, pts[i]!.y);
        ctx.lineTo(pts[j]!.x, pts[j]!.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    for (let i = 0; i < NODES; i++) {
      const p = pts[i]!;
      ctx.fillStyle = i < 3 ? PALETTE.bone : PALETTE.mediate;
      ctx.beginPath();
      ctx.arc(p.x, p.y, i < 3 ? 4 : 3.4, 0, Math.PI * 2);
      ctx.fill();
      if (this.out.resonance > 0.32) this.junction(ctx, i, p.x, p.y);
    }
    drawSecondOrder(ctx, this.input, w, h);
  }

  private junction(ctx: CanvasRenderingContext2D, index: number, x: number, y: number): void {
    const alpha = clamp((this.out.resonance - 0.28) / 0.6);
    const kind = index % 3;
    if (kind === 0) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = PALETTE.bone;
      ctx.lineWidth = 1;
      for (let m = 0; m < MEMBERS; m++) {
        if (this.a[m] !== index && this.b[m] !== index) continue;
        const other = this.a[m] === index ? this.b[m]! : this.a[m]!;
        const ang = Math.atan2(this.y[other]! - this.y[index]!, this.x[other]! - this.x[index]!);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * 11, y + Math.sin(ang) * 11);
        ctx.stroke();
      }
      ctx.restore();
    } else if (kind === 1) {
      let best = -1;
      let bestStress = -1;
      for (let m = 0; m < MEMBERS; m++) {
        if (this.a[m] !== index && this.b[m] !== index) continue;
        const s = Math.abs(this.stress[m]!);
        if (s > bestStress) {
          bestStress = s;
          best = m;
        }
      }
      if (best >= 0) {
        const other = this.a[best]! === index ? this.b[best]! : this.a[best]!;
        const ang = Math.atan2(this.y[other]! - this.y[index]!, this.x[other]! - this.x[index]!);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = PALETTE.tension;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(ang) * 16, y + Math.sin(ang) * 16);
        ctx.stroke();
        ctx.restore();
      }
    } else if (index % 2 === 0) drawFlowMark(ctx, x, y, 9, alpha);
    else if (this.out.tension > 0.3) drawTensionMark(ctx, x, y, 9, alpha);
    else drawMediationMark(ctx, x, y, 8, alpha);
  }
}
