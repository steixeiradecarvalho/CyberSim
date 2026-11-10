import type { EventBus } from "./event-bus";
import { clamp, expSmooth, smoothstep } from "./math.ts";
import type { CircuitReport } from "./types";

/**
 * Síntese granular mínima em Web Audio.
 * Janela de Hanning pré-calculada. Frequência do grão: 60 Hz → 2000 Hz com a tensão.
 * Ganhos só mudam via setTargetAtTime, para não estalar.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fund: OscillatorNode | null = null;
  private fundGain: GainNode | null = null;
  private partial: OscillatorNode | null = null;
  private partialGain: GainNode | null = null;
  private noiseGain: GainNode | null = null;
  private grain: AudioBuffer | null = null;
  private hann: Float32Array | null = null;
  private tension = 0.2;
  private harmony = 0.5;
  private resonance = 0;
  private nextGrain = 0;
  private voices = 0;
  muted = false;
  ready = false;

  constructor(bus: EventBus) {
    bus.onReport((report) => this.follow(report));
  }

  unlock(): void {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) {
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.build(this.ctx);
    }
    void this.ctx.resume();
    this.ready = true;
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.pushGains();
  }

  settle(): void {
    this.tension = expSmooth(this.tension, 0.18, 0.1, 2);
    this.harmony = expSmooth(this.harmony, 0.82, 0.1, 2);
    this.pushGains();
  }

  private follow(report: CircuitReport): void {
    if (report.module === "observer") return;
    this.tension = expSmooth(this.tension, report.tension, 0.1, 4);
    this.harmony = expSmooth(this.harmony, report.harmony, 0.1, 3);
    this.resonance = expSmooth(this.resonance, report.resonance, 0.1, 3);
    this.pushGains();
    this.scheduleGrain();
  }

  private build(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    const fundGain = ctx.createGain();
    fundGain.gain.value = 0;
    const fund = ctx.createOscillator();
    fund.type = "sine";
    fund.frequency.value = 110;
    fund.connect(fundGain).connect(master);
    fund.start();
    this.fund = fund;
    this.fundGain = fundGain;

    const partialGain = ctx.createGain();
    partialGain.gain.value = 0;
    const partial = ctx.createOscillator();
    partial.type = "triangle";
    partial.frequency.value = 220;
    partial.connect(partialGain).connect(master);
    partial.start();
    this.partial = partial;
    this.partialGain = partialGain;

    const noiseLen = ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1;
      brown = brown * 0.98 + white * 0.02;
      data[i] = brown * 3.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noise.connect(filter).connect(noiseGain).connect(master);
    noise.start();
    this.noiseGain = noiseGain;

    const hannLen = 512;
    this.hann = new Float32Array(hannLen);
    for (let i = 0; i < hannLen; i++) {
      this.hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (hannLen - 1)));
    }
    const grainLen = 4096;
    const grain = ctx.createBuffer(1, grainLen, ctx.sampleRate);
    const g = grain.getChannelData(0);
    for (let i = 0; i < grainLen; i++) {
      const window = this.hann[Math.floor((i / grainLen) * hannLen)] ?? 0;
      g[i] = window * Math.sin((2 * Math.PI * 220 * i) / ctx.sampleRate);
    }
    this.grain = grain;
    this.pushGains();
  }

  private pushGains(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.fund || !this.fundGain || !this.partial || !this.partialGain || !this.noiseGain) return;
    const now = ctx.currentTime;
    const tau = 0.08;
    const audible = this.muted || !this.ready ? 0 : 0.22;
    this.master.gain.setTargetAtTime(audible, now, 0.05);

    const fundamental = 55 * 2 ** (this.tension * 3.1);
    const consonant = this.harmony > 0.62 ? 2 : 2 + (1 - this.harmony) * 1.37;
    this.fund.frequency.setTargetAtTime(fundamental, now, tau);
    this.partial.frequency.setTargetAtTime(fundamental * consonant, now, tau);
    this.fundGain.gain.setTargetAtTime(0.18 + this.harmony * 0.22, now, tau);
    this.partialGain.gain.setTargetAtTime(0.04 + (1 - this.harmony) * 0.16, now, tau);
    this.noiseGain.gain.setTargetAtTime((1 - this.harmony) * this.tension * 0.18, now, tau);
  }

  private scheduleGrain(): void {
    const ctx = this.ctx;
    if (!ctx || !this.grain || !this.master || this.muted || !this.ready) return;
    const now = ctx.currentTime;
    if (now < this.nextGrain || this.voices > 8) return;
    const tension = clamp(this.tension);
    const curve = smoothstep(0, 1, tension);
    let freq = 60 + curve * 1940;
    if (this.harmony > 0.62) {
      const fundamental = 55 * 2 ** (tension * 3.1);
      const harmonic = Math.max(1, Math.round(freq / fundamental));
      freq = fundamental * harmonic;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.grain;
    source.playbackRate.value = clamp(freq / 220, 0.25, 12);
    const gain = ctx.createGain();
    const amp = (0.05 + (1 - this.harmony) * 0.12) * (0.4 + this.resonance * 0.6);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, amp), now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    source.connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + 0.24);
    this.voices += 1;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.voices = Math.max(0, this.voices - 1);
    };
    const interval = 0.18 - curve * 0.1;
    this.nextGrain = now + interval;
  }
}
