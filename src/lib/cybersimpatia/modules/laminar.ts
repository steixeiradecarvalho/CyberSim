import type { EventBus } from "../event-bus";
import { drawFlowMark, drawMediationMark, drawSecondOrder, drawTensionMark } from "../marks.ts";
import { clamp, lerp } from "../math.ts";
import { PALETTE, RGB } from "../palette.ts";
import type { CircuitReport, FilteredSample } from "../types";

const W = 96;
const H = 54;
const N = W * H;
const BUF = 48;

/**
 * Vórtice laminar. O ponteiro não injeta força.
 * O MediatorProbe lê o campo, gira o erro (o terceiro) e só então empurra o fluido.
 * PhaseResonanceAnalyzer: correlação cruzada com atraso entre o gesto filtrado e a velocidade local.
 */
export class LaminarCircuit {
  readonly id = "laminar_vortex" as const;
  private u = new Float32Array(N);
  private v = new Float32Array(N);
  private u0 = new Float32Array(N);
  private v0 = new Float32Array(N);
  private dens = new Float32Array(N);
  private dens0 = new Float32Array(N);
  private shear = new Float32Array(N);
  private shear0 = new Float32Array(N);
  private curl = new Float32Array(N);
  private p = new Float32Array(N);
  private div = new Float32Array(N);

  private inX = new Float32Array(BUF);
  private inY = new Float32Array(BUF);
  private flX = new Float32Array(BUF);
  private flY = new Float32Array(BUF);
  private cursor = 0;
  private filled = 0;

  private probeX = 0.5;
  private probeY = 0.5;
  private forceX = 0;
  private forceY = 0;
  private emitAcc = 0;
  private time = 0;
  private homeoHold = 0;
  private homeoArmed = false;
  private reading = "O fluido já gira. O mediador ainda não ouviu você.";
  private readingHold = 0;
  private pendingReading = this.reading;
  private qualityFull = true;
  private input: FilteredSample | null = null;

  private image: ImageData | null = null;
  private plate: HTMLCanvasElement | null = null;
  private marks: Int32Array = new Int32Array(8);
  private markScore: Float32Array = new Float32Array(8);

  readonly out: CircuitReport = {
    module: "laminar_vortex",
    resonance: 0,
    phaseOffset: 0,
    tension: 0.15,
    harmony: 0.45,
    complexity: 0.2,
    homeodynamic: false,
    reading: this.reading,
    porosity: 1,
  };

  private bus: EventBus;

  constructor(bus: EventBus) {
    this.bus = bus;
    this.seed();
    bus.onFiltered((_velocity, _acceleration, _lag) => {
      this.input = bus.lastInput;
    });
  }

  setQuality(full: boolean): void {
    this.qualityFull = full;
  }

  private seed(): void {
    for (let j = 1; j < H - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        const idx = i + j * W;
        const x = i / W - 0.5;
        const y = j / H - 0.48;
        this.u[idx] = -y * 46;
        this.v[idx] = x * 62;
        const r = x * x + y * y;
        this.dens[idx] = Math.exp(-r * 10) * 0.85;
        this.shear[idx] = Math.exp(-((x + 0.18) ** 2 + (y - 0.08) ** 2) * 18) * 0.45;
      }
    }
    this.project(this.u, this.v);
  }

  step(dt: number): void {
    this.time += dt;
    const input = this.input;
    const targetX = input?.position.x ?? 0.5;
    const targetY = input?.position.y ?? 0.5;
    this.probeX = lerp(this.probeX, targetX, 1 - Math.exp(-dt * 2.4));
    this.probeY = lerp(this.probeY, targetY, 1 - Math.exp(-dt * 2.4));

    const local = this.sampleVelocity(this.probeX, this.probeY);
    const desiredX = (input?.velocity.x ?? 0) * W * 0.55;
    const desiredY = (input?.velocity.y ?? 0) * H * 0.55;
    const errX = desiredX - local.x;
    const errY = desiredY - local.y;
    const ang = 0.9 + 0.45 * Math.sin(this.time * 0.7);
    const rotX = errX * Math.cos(ang) - errY * Math.sin(ang);
    const rotY = errX * Math.sin(ang) + errY * Math.cos(ang);
    const follow = 1 - Math.exp(-dt * 3.2);
    this.forceX = lerp(this.forceX, rotX, follow);
    this.forceY = lerp(this.forceY, rotY, follow);

    this.splat(this.u, this.probeX, this.probeY, this.forceX * dt * 8, 5.5);
    this.splat(this.v, this.probeX, this.probeY, this.forceY * dt * 8, 5.5);
    const push = Math.hypot(this.forceX, this.forceY);
    this.splat(this.dens, this.probeX, this.probeY, Math.min(0.45, push * 0.004), 4.2);
    const speed = Math.hypot(input?.velocity.x ?? 0, input?.velocity.y ?? 0);
    if ((input?.hasPointer ?? false) && speed > 0.015) {
      this.splat(this.dens, this.probeX, this.probeY, Math.min(0.4, speed * dt * 6), 3.6);
    }

    if (this.averageSpeed() < 8) {
      this.splat(this.u, 0.5, 0.42, -18 * dt, 10);
      this.splat(this.v, 0.62, 0.5, 18 * dt, 10);
    }

    this.advect(this.u0, this.u, this.u, this.v, dt, 1);
    this.advect(this.v0, this.v, this.u, this.v, dt, 1);
    this.swapVel();
    this.project(this.u, this.v);
    this.curlField();
    if (this.qualityFull) this.confinement(dt);
    this.project(this.u, this.v);
    this.advect(this.dens0, this.dens, this.u, this.v, dt, 0.997);
    this.swapDens();
    this.advect(this.shear0, this.shear, this.u, this.v, dt, 0.994);
    const shearTmp = this.shear;
    this.shear = this.shear0;
    this.shear0 = shearTmp;
    this.depositShear();
    this.analyze(local, desiredX, desiredY, dt);
    this.emitAcc += dt;
    if (this.emitAcc >= 0.1) {
      this.emitAcc = 0;
      this.publish();
    }
  }

  private analyze(local: { x: number; y: number }, desiredX: number, desiredY: number, dt: number): void {
    this.inX[this.cursor] = desiredX;
    this.inY[this.cursor] = desiredY;
    this.flX[this.cursor] = local.x;
    this.flY[this.cursor] = local.y;
    this.cursor = (this.cursor + 1) % BUF;
    this.filled = Math.min(BUF, this.filled + 1);

    const n = this.filled;
    if (n < 16) return;
    let mx = 0;
    let my = 0;
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < n; i++) {
      const ia = (this.cursor - n + i + BUF) % BUF;
      mx += this.inX[ia]!;
      my += this.inY[ia]!;
      fx += this.flX[ia]!;
      fy += this.flY[ia]!;
    }
    mx /= n;
    my /= n;
    fx /= n;
    fy /= n;
    let best = -2;
    let bestLag = 0;
    const maxLag = Math.max(1, Math.floor(n / 2));
    for (let lag = 0; lag < maxLag; lag++) {
      let s = 0;
      let sa = 0;
      let sb = 0;
      for (let i = 0; i < n - lag; i++) {
        const ia = (this.cursor - n + i + BUF) % BUF;
        const ib = (this.cursor - n + i + lag + BUF) % BUF;
        const ax = this.inX[ia]! - mx;
        const ay = this.inY[ia]! - my;
        const bx = this.flX[ib]! - fx;
        const by = this.flY[ib]! - fy;
        s += ax * bx + ay * by;
        sa += ax * ax + ay * ay;
        sb += bx * bx + by * by;
      }
      const c = s / Math.sqrt(sa * sb + 1e-8);
      if (c > best) {
        best = c;
        bestLag = lag;
      }
    }
    const targetRes = clamp((best + 1) / 2);
    const energy = Math.hypot(desiredX, desiredY);
    const heard = energy < 8 ? targetRes * 0.15 : targetRes;
    this.out.resonance = lerp(this.out.resonance, heard, 0.12);
    this.out.phaseOffset = lerp(this.out.phaseOffset, bestLag / n, 0.12);

    let curlSum = 0;
    let curlSq = 0;
    let count = 0;
    const cx = Math.floor(clamp(this.probeX, 0.05, 0.95) * (W - 1));
    const cy = Math.floor(clamp(this.probeY, 0.05, 0.95) * (H - 1));
    const i0 = Math.max(1, cx - 6);
    const i1 = Math.min(W - 2, cx + 6);
    const j0 = Math.max(1, cy - 6);
    const j1 = Math.min(H - 2, cy + 6);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const c = this.curl[i + j * W]!;
        curlSum += Math.abs(c);
        curlSq += c * c;
        count++;
      }
    }
    const meanAbs = curlSum / (count || 1);
    const std = Math.sqrt(Math.max(0, curlSq / (count || 1)));
    this.out.tension = lerp(this.out.tension, clamp(meanAbs / 28), 0.08);
    this.out.complexity = lerp(this.out.complexity, clamp(std / 22), 0.08);
    const aligned = 1 - clamp(this.out.phaseOffset * 2);
    this.out.harmony = lerp(this.out.harmony, clamp(this.out.resonance * aligned * (1 - this.out.tension * 0.35)), 0.08);
    const living = this.out.tension > 0.08 && this.out.tension < 0.62;
    const locked = this.out.resonance > 0.64 && living;
    this.out.homeodynamic = locked;
    if (locked) this.homeoHold += dt;
    else {
      if (this.homeoArmed && this.homeoHold > 1.2) {
        this.bus.emitResonance(this.id, this.homeoHold, true);
      }
      this.homeoHold = 0;
      this.homeoArmed = false;
    }
    if (this.homeoHold > 1.2) this.homeoArmed = true;
    this.chooseReading(dt);
  }

  private chooseReading(dt: number): void {
    const lag = this.input?.mirrorLag ?? 0;
    let next = "Força só entra depois da rotação do mediador. Fluxo e cisalhamento são leituras.";
    if (lag > 0.2) next = "O espelho segura o gesto. O vórtice conversa com o atraso, não com a mão.";
    else if (this.out.homeodynamic) next = "Fase estável e vórtice vivo. Homeodinâmica aqui é um redemoinho que se reconhece.";
    else if (this.out.resonance > 0.68) next = "A correlação encostou. Não é acerto: o campo e o gesto passaram a se medir.";
    else if (this.out.resonance < 0.38) next = "O mediador traduz. O vórtice ainda não reconhece o ritmo do gesto.";
    if (next !== this.pendingReading) {
      this.pendingReading = next;
      this.readingHold = 0;
    } else this.readingHold += dt;
    if (this.readingHold > 0.45) this.reading = this.pendingReading;
    this.out.reading = this.reading;
  }

  private publish(): void {
    this.bus.emitSympathy(this.id, this.out.resonance, this.out.phaseOffset);
    this.bus.emitReport(this.out);
  }

  report(): CircuitReport {
    return this.out;
  }

  flushEpisode(): void {
    if (this.homeoArmed && this.homeoHold > 1.2) this.bus.emitResonance(this.id, this.homeoHold, true);
    this.homeoHold = 0;
    this.homeoArmed = false;
  }

  private sampleVelocity(nx: number, ny: number): { x: number; y: number } {
    const x = clamp(nx, 0, 0.999) * (W - 1);
    const y = clamp(ny, 0, 0.999) * (H - 1);
    const i0 = Math.floor(x);
    const j0 = Math.floor(y);
    const i1 = Math.min(W - 1, i0 + 1);
    const j1 = Math.min(H - 1, j0 + 1);
    const sx = x - i0;
    const sy = y - j0;
    const u = this.bilerp(this.u, i0, j0, i1, j1, sx, sy);
    const v = this.bilerp(this.v, i0, j0, i1, j1, sx, sy);
    return { x: u, y: v };
  }

  private bilerp(f: Float32Array, i0: number, j0: number, i1: number, j1: number, sx: number, sy: number): number {
    const a = f[i0 + j0 * W]!;
    const b = f[i1 + j0 * W]!;
    const c = f[i0 + j1 * W]!;
    const d = f[i1 + j1 * W]!;
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  }

  private splat(field: Float32Array, nx: number, ny: number, amount: number, radius: number): void {
    if (amount === 0) return;
    const cx = nx * (W - 1);
    const cy = ny * (H - 1);
    const r2 = radius * radius;
    const i0 = Math.max(1, Math.floor(cx - radius));
    const i1 = Math.min(W - 2, Math.ceil(cx + radius));
    const j0 = Math.max(1, Math.floor(cy - radius));
    const j1 = Math.min(H - 2, Math.ceil(cy + radius));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i - cx;
        const dy = j - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) field[i + j * W]! += amount * Math.exp(-d2 / (r2 * 0.45));
      }
    }
  }

  private advect(dest: Float32Array, src: Float32Array, u: Float32Array, v: Float32Array, dt: number, dissip: number): void {
    for (let j = 1; j < H - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        const idx = i + j * W;
        let x = i - dt * u[idx]!;
        let y = j - dt * v[idx]!;
        if (x < 0.5) x = 0.5;
        if (x > W - 1.5) x = W - 1.5;
        if (y < 0.5) y = 0.5;
        if (y > H - 1.5) y = H - 1.5;
        const i0 = Math.floor(x);
        const j0 = Math.floor(y);
        const i1 = i0 + 1;
        const j1 = j0 + 1;
        const s1 = x - i0;
        const s0 = 1 - s1;
        const t1 = y - j0;
        const t0 = 1 - t1;
        dest[idx] =
          dissip *
          (s0 * (t0 * src[i0 + j0 * W]! + t1 * src[i0 + j1 * W]!) +
            s1 * (t0 * src[i1 + j0 * W]! + t1 * src[i1 + j1 * W]!));
      }
    }
  }

  private swapVel(): void {
    const tu = this.u;
    this.u = this.u0;
    this.u0 = tu;
    const tv = this.v;
    this.v = this.v0;
    this.v0 = tv;
  }

  private swapDens(): void {
    const t = this.dens;
    this.dens = this.dens0;
    this.dens0 = t;
  }

  private project(u: Float32Array, v: Float32Array): void {
    const { div, p } = this;
    const iters = this.qualityFull ? 16 : 8;
    for (let j = 1; j < H - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        const idx = i + j * W;
        div[idx] = -0.5 * (u[idx + 1]! - u[idx - 1]! + v[idx + W]! - v[idx - W]!);
        p[idx] = 0;
      }
    }
    for (let k = 0; k < iters; k++) {
      for (let j = 1; j < H - 1; j++) {
        for (let i = 1; i < W - 1; i++) {
          const idx = i + j * W;
          p[idx] = (div[idx]! + p[idx - 1]! + p[idx + 1]! + p[idx - W]! + p[idx + W]!) / 4;
        }
      }
    }
    for (let j = 1; j < H - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        const idx = i + j * W;
        u[idx]! -= 0.5 * (p[idx + 1]! - p[idx - 1]!);
        v[idx]! -= 0.5 * (p[idx + W]! - p[idx - W]!);
        const sp = Math.hypot(u[idx]!, v[idx]!);
        if (sp > 220) {
          u[idx]! *= 220 / sp;
          v[idx]! *= 220 / sp;
        }
      }
    }
  }

  private curlField(): void {
    for (let j = 1; j < H - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        const idx = i + j * W;
        this.curl[idx] = 0.5 * (this.v[idx + 1]! - this.v[idx - 1]! - (this.u[idx + W]! - this.u[idx - W]!));
      }
    }
  }

  private confinement(dt: number): void {
    const eps = 1.2;
    for (let j = 2; j < H - 2; j++) {
      for (let i = 2; i < W - 2; i++) {
        const idx = i + j * W;
        const cL = Math.abs(this.curl[idx - 1]!);
        const cR = Math.abs(this.curl[idx + 1]!);
        const cB = Math.abs(this.curl[idx - W]!);
        const cT = Math.abs(this.curl[idx + W]!);
        let gx = 0.5 * (cR - cL);
        let gy = 0.5 * (cT - cB);
        const mag = Math.hypot(gx, gy) + 1e-6;
        gx /= mag;
        gy /= mag;
        this.u[idx]! += dt * eps * gy * this.curl[idx]!;
        this.v[idx]! -= dt * eps * gx * this.curl[idx]!;
      }
    }
  }

  private depositShear(): void {
    for (let j = 1; j < H - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        const idx = i + j * W;
        const c = Math.abs(this.curl[idx]!);
        if (c > 3) this.shear[idx]! = Math.min(1.4, this.shear[idx]! + c * 0.0016);
      }
    }
  }

  private averageSpeed(): number {
    let s = 0;
    let n = 0;
    for (let i = 0; i < N; i += 7) {
      s += Math.hypot(this.u[i]!, this.v[i]!);
      n++;
    }
    return s / n;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.plate || !this.image) {
      this.plate = document.createElement("canvas");
      this.plate.width = W;
      this.plate.height = H;
      this.image = new ImageData(W, H);
    }
    const data = this.image.data;
    const [ir, ig, ib] = RGB.ink;
    const [fr, fg, fb] = RGB.flow;
    const [tr, tg, tb] = RGB.tension;
    for (let i = 0; i < 8; i++) this.markScore[i] = -1;
    for (let p = 0; p < N; p++) {
      const d = this.dens[p]!;
      const s = this.shear[p]!;
      const c = Math.abs(this.curl[p]!);
      const f = d / (d + 0.32);
      const sh = s / (s + 0.28);
      const curlN = c / (c + 10);
      let r = ir + (fr - ir) * f + (tr - ir) * sh * 0.8 + curlN * 30;
      let g = ig + (fg - ig) * f + (tg - ig) * sh * 0.75 + curlN * 26;
      let b = ib + (fb - ib) * f + (tb - ib) * sh * 0.45 + curlN * 18;
      if (r > 255) r = 255;
      if (g > 255) g = 255;
      if (b > 255) b = 255;
      const o = p * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
      if ((p & 15) === 0) this.considerMark(p, c * (0.35 + f));
    }
    const plateCtx = this.plate.getContext("2d");
    if (plateCtx) plateCtx.putImageData(this.image, 0, 0);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.plate, 0, 0, w, h);

    if (this.qualityFull) {
      ctx.save();
      ctx.strokeStyle = PALETTE.bone;
      ctx.globalAlpha = 0.15 + this.out.resonance * 0.55;
      ctx.lineWidth = 1;
      const step = 6;
      for (let j = 2; j < H - 2; j += step) {
        for (let i = 2; i < W - 2; i += step) {
          const idx = i + j * W;
          const vx = this.u[idx]!;
          const vy = this.v[idx]!;
          const mag = Math.hypot(vx, vy);
          if (mag < 6) continue;
          const x = (i / (W - 1)) * w;
          const y = (j / (H - 1)) * h;
          const scale = Math.min(16, mag * 0.12);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (vx / mag) * scale, y + (vy / mag) * scale);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const alpha = 0.2 + this.out.resonance * 0.75;
    for (let m = 0; m < 8; m++) {
      const idx = this.marks[m]!;
      if (this.markScore[m]! < 0 || idx < 0) continue;
      const i = idx % W;
      const j = (idx / W) | 0;
      const x = (i / (W - 1)) * w;
      const y = (j / (H - 1)) * h;
      const kind = idx % 3;
      if (kind === 0) drawFlowMark(ctx, x, y, 8, alpha);
      else if (kind === 1) drawTensionMark(ctx, x, y, 8, alpha);
      else drawMediationMark(ctx, x, y, 7, alpha);
    }

    drawSecondOrder(ctx, this.input, w, h);
    ctx.save();
    ctx.strokeStyle = PALETTE.mediate;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.25;
    const px = this.probeX * w;
    const py = this.probeY * h;
    ctx.beginPath();
    ctx.arc(px, py, 16 + Math.sin(this.time * 2) * 1.5, this.time * 0.8, this.time * 0.8 + 4.2);
    ctx.stroke();
    ctx.restore();
  }

  private considerMark(idx: number, score: number): void {
    if (score < 2) return;
    let slot = 0;
    for (let i = 1; i < 8; i++) {
      if (this.markScore[i]! < this.markScore[slot]!) slot = i;
    }
    if (score > this.markScore[slot]!) {
      this.markScore[slot] = score;
      this.marks[slot] = idx;
    }
  }
}
