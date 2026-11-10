import type { EventBus } from "./event-bus";
import { clamp } from "./math.ts";
import type { FilteredSample } from "./types";

const CAP = 480;

/**
 * Kalman 2D simplificado (posição) + pipeline MirrorMode.
 * Atraso triádico: 0.5s–2s, média em torno do instante atrasado, ruído senoidal controlado.
 * Nenhum módulo deve ler o ponteiro fora daqui.
 */
export class InputFilter {
  mirror = false;
  delay = 1.1;

  private sample: FilteredSample = {
    velocity: { x: 0, y: 0 },
    acceleration: 0,
    mirrorLag: 0,
    position: { x: 0.5, y: 0.5 },
    raw: { x: 0.5, y: 0.5 },
    filtered: { x: 0.5, y: 0.5 },
    mirror: { x: 0.5, y: 0.5 },
    hasPointer: false,
  };

  private estX = 0.5;
  private estY = 0.5;
  private pX = 1;
  private pY = 1;
  private readonly q = 0.02;
  private readonly r = 0.08;

  private measX = 0.5;
  private measY = 0.5;
  private prevX = 0.5;
  private prevY = 0.5;
  private prevSpeed = 0;
  private seen = false;

  private histX = new Float32Array(CAP);
  private histY = new Float32Array(CAP);
  private histT = new Float32Array(CAP);
  private write = 0;
  private count = 0;
  private time = 0;

  readonly traceRaw = new Float32Array(96);
  readonly traceFiltered = new Float32Array(96);
  readonly traceMirror = new Float32Array(96);
  private traceWrite = 0;

  private bus: EventBus;

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  setPointer(x: number, y: number): void {
    this.measX = clamp(x);
    this.measY = clamp(y);
    this.sample.raw.x = this.measX;
    this.sample.raw.y = this.measY;
    this.seen = true;
    this.sample.hasPointer = true;
  }

  setMirror(enabled: boolean): void {
    if (this.mirror === enabled) return;
    this.mirror = enabled;
    this.bus.emitMirror(enabled);
  }

  setDelay(seconds: number): void {
    this.delay = clamp(seconds, 0.5, 2);
  }

  step(dt: number): void {
    this.time += dt;
    const kX = this.kalman(this.estX, this.pX, this.measX);
    const kY = this.kalman(this.estY, this.pY, this.measY);
    this.estX = kX.x;
    this.pX = kX.p;
    this.estY = kY.x;
    this.pY = kY.p;

    const vx = dt > 1e-5 ? (this.estX - this.prevX) / dt : 0;
    const vy = dt > 1e-5 ? (this.estY - this.prevY) / dt : 0;
    this.prevX = this.estX;
    this.prevY = this.estY;

    const speed = Math.hypot(vx, vy);
    const acceleration = dt > 1e-5 ? (speed - this.prevSpeed) / dt : 0;
    this.prevSpeed = speed;

    this.pushHistory(this.time, this.estX, this.estY);
    const delayed = this.readDelayed(this.delay);
    const wobble = this.mirror ? Math.sin(this.time * 3.1) * 0.012 * this.delay + Math.sin(this.time * 5.7) * 0.006 * this.delay : 0;
    const mirrorX = clamp(delayed.x + wobble);
    const mirrorY = clamp(delayed.y + Math.cos(this.time * 2.4) * wobble);

    const useMirror = this.mirror && this.count > 8;
    this.sample.filtered.x = this.estX;
    this.sample.filtered.y = this.estY;
    this.sample.mirror.x = mirrorX;
    this.sample.mirror.y = mirrorY;
    this.sample.position.x = useMirror ? mirrorX : this.estX;
    this.sample.position.y = useMirror ? mirrorY : this.estY;
    this.sample.velocity.x = vx;
    this.sample.velocity.y = vy;
    this.sample.acceleration = acceleration;
    this.sample.mirrorLag = useMirror ? delayed.lag : 0;

    this.traceRaw[this.traceWrite] = this.sample.raw.x;
    this.traceFiltered[this.traceWrite] = this.estX;
    this.traceMirror[this.traceWrite] = mirrorX;
    this.traceWrite = (this.traceWrite + 1) % this.traceRaw.length;

    if (this.seen) this.bus.emitFiltered(this.sample);
  }

  private kalman(estimate: number, covariance: number, measure: number): { x: number; p: number } {
    const pPred = covariance + this.q;
    const k = pPred / (pPred + this.r);
    return { x: estimate + k * (measure - estimate), p: (1 - k) * pPred };
  }

  private pushHistory(t: number, x: number, y: number): void {
    this.histT[this.write] = t;
    this.histX[this.write] = x;
    this.histY[this.write] = y;
    this.write = (this.write + 1) % CAP;
    this.count = Math.min(CAP, this.count + 1);
  }

  private readDelayed(delay: number): { x: number; y: number; lag: number } {
    if (this.count < 2) return { x: this.estX, y: this.estY, lag: 0 };
    const newest = (this.write - 1 + CAP) % CAP;
    const oldestIndex = (this.write - this.count + CAP) % CAP;
    const covered = this.histT[newest]! - this.histT[oldestIndex]!;
    const lag = Math.min(delay, Math.max(0, covered));
    const target = this.histT[newest]! - lag;
    let newer = newest;
    let older = newest;
    for (let k = 0; k < this.count; k++) {
      const idx = (newest - k + CAP) % CAP;
      if (this.histT[idx]! <= target) {
        older = idx;
        newer = k === 0 ? idx : (newest - (k - 1) + CAP) % CAP;
        break;
      }
      older = idx;
    }
    const t0 = this.histT[older]!;
    const t1 = this.histT[newer]!;
    const span = t1 - t0;
    const u = span > 1e-5 ? clamp((target - t0) / span) : 0;
    return {
      x: this.histX[older]! + (this.histX[newer]! - this.histX[older]!) * u,
      y: this.histY[older]! + (this.histY[newer]! - this.histY[older]!) * u,
      lag,
    };
  }

  copyTraces(): { raw: number[]; filtered: number[]; mirror: number[] } {
    const raw: number[] = [];
    const filtered: number[] = [];
    const mirror: number[] = [];
    for (let i = 0; i < this.traceRaw.length; i++) {
      const idx = (this.traceWrite + i) % this.traceRaw.length;
      raw.push(this.traceRaw[idx]!);
      filtered.push(this.traceFiltered[idx]!);
      mirror.push(this.traceMirror[idx]!);
    }
    return { raw, filtered, mirror };
  }
}
