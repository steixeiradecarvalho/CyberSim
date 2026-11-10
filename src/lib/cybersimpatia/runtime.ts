import { AudioEngine } from "./audio-engine.ts";
import { EventBus } from "./event-bus.ts";
import { InputFilter } from "./input-filter.ts";
import { LaminarCircuit } from "./modules/laminar.ts";
import { drawObserver } from "./modules/observer.ts";
import { RhizomaCircuit } from "./modules/rhizoma.ts";
import { TensegrityCircuit } from "./modules/tensegrity.ts";
import { StateManager } from "./state-manager.ts";
import type { LensId, ModuleId } from "./types";

export type UnlockNote = { id: string; clarity: number };

export type HudModel = {
  module: ModuleId | null;
  resonance: number;
  phaseOffset: number;
  tension: number;
  harmony: number;
  homeodynamic: boolean;
  depth: number;
  lexicon: { flow: number; tension: number; mediation: number };
  mirror: boolean;
  mirrorDelay: number;
  mirrorRatio: number;
  muted: boolean;
  reading: string;
  porosity: number;
  quality: "pleno" | "contido";
  sessions: number;
  events: { module: string; duration: number; homeodynamic: boolean }[];
  unlock: UnlockNote | null;
  trace: { raw: number[]; filtered: number[]; mirror: number[] };
  audioReady: boolean;
};

/**
 * Hub. Os circuitos não se enxergam: só o barramento.
 * Este orquestrador escolhe quem passo, desenha e sustenta o áudio.
 */
export class Runtime {
  readonly bus = new EventBus();
  readonly state: StateManager;
  readonly input: InputFilter;
  readonly audio: AudioEngine;
  readonly laminar: LaminarCircuit;
  readonly rhizoma: RhizomaCircuit;
  readonly tensegrity: TensegrityCircuit;

  module: ModuleId | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private cssW = 0;
  private cssH = 0;
  private raf = 0;
  private running = false;
  private last = 0;
  private acc = 0;
  private settleAcc = 0;
  private frameEma = 16;
  private observerTime = 0;
  private onVis: (() => void) | null = null;
  private unlock: UnlockNote | null = null;

  constructor() {
    this.state = new StateManager(this.bus);
    this.input = new InputFilter(this.bus);
    this.audio = new AudioEngine(this.bus);
    this.laminar = new LaminarCircuit(this.bus);
    this.rhizoma = new RhizomaCircuit(this.bus);
    this.tensegrity = new TensegrityCircuit(this.bus);
    this.bus.onLexicon((id, clarity) => {
      this.unlock = { id, clarity };
    });
    this.rhizoma.seedMemory(this.state.profile.dialogic_memory, this.state.profile.session_count);
  }

  unlockAudio(): void {
    this.audio.unlock();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.onVis = () => {
      if (document.visibilityState === "visible") this.audio.resume();
    };
    document.addEventListener("visibilitychange", this.onVis);
    this.raf = requestAnimationFrame(this.frame);
    const probe = window as unknown as { __cyber?: { snapshot: () => HudModel } };
    probe.__cyber = { snapshot: () => this.snapshot() };
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.onVis) document.removeEventListener("visibilitychange", this.onVis);
    this.active()?.flushEpisode();
    this.state.endSession();
    this.state.flush();
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();
  }

  resize(): void {
    const canvas = this.canvas;
    const parent = canvas?.parentElement;
    if (!canvas || !parent || !this.ctx) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssW = w;
    this.cssH = h;
  }

  point(x: number, y: number): void {
    this.input.setPointer(x, y);
  }

  setModule(id: ModuleId): void {
    if (this.module === id) return;
    this.active()?.flushEpisode();
    this.state.endSession();
    this.module = id;
    if (id === "rhizoma") this.rhizoma.seedMemory(this.state.profile.dialogic_memory, this.state.profile.session_count);
    if (id !== "observer") this.state.beginSession(id);
    else this.state.profile.last_module = "observer";
    const circuit = this.active();
    if (circuit) this.bus.emitReport(circuit.report());
  }

  setLens(lens: LensId): void {
    this.rhizoma.lens = lens;
  }

  lens(): LensId {
    return this.rhizoma.lens;
  }

  toggleMirror(): void {
    this.input.setMirror(!this.input.mirror);
  }

  setDelay(seconds: number): void {
    this.input.setDelay(seconds);
  }

  toggleMute(): void {
    this.audio.setMuted(!this.audio.muted);
  }

  exportJson(): void {
    this.state.flush();
    download("cybersimpatia-perfil.json", new Blob([this.state.exportJson()], { type: "application/json" }));
  }

  exportPng(): void {
    const source = this.canvas;
    if (!source || this.cssW < 2) return;
    const footer = 112;
    const plate = document.createElement("canvas");
    plate.width = Math.floor(this.cssW);
    plate.height = Math.floor(this.cssH + footer);
    const ctx = plate.getContext("2d");
    if (!ctx) return;
    const snap = this.snapshot();
    ctx.fillStyle = "#07090c";
    ctx.fillRect(0, 0, plate.width, plate.height);
    ctx.drawImage(source, 0, 0, plate.width, this.cssH);
    ctx.fillStyle = "#e7e2d4";
    ctx.font = "500 28px Fraunces, Palatino, serif";
    ctx.fillText("CyberSimpatia", 28, this.cssH + 42);
    ctx.font = "13px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.fillStyle = "#8d968c";
    const line = `${label(snap.module)}  ·  profundidade ${snap.depth.toFixed(2)}  ·  ressonância ${snap.resonance.toFixed(2)}  ·  fase ${snap.phaseOffset.toFixed(2)}`;
    ctx.fillText(line, 28, this.cssH + 72);
    ctx.fillText(snap.homeodynamic ? "homeodinâmica" : "deriva", 28, this.cssH + 94);
    plate.toBlob((blob) => {
      if (blob) download(`cybersimpatia-${Date.now()}.png`, blob);
    });
  }

  snapshot(): HudModel {
    const report = this.bus.lastReport;
    const active = this.module === "observer" || this.module === null ? null : report?.module === this.module ? report : this.active()?.report();
    return {
      module: this.module,
      resonance: active?.resonance ?? 0,
      phaseOffset: active?.phaseOffset ?? 0,
      tension: active?.tension ?? 0,
      harmony: active?.harmony ?? 0,
      homeodynamic: active?.homeodynamic ?? false,
      depth: this.state.profile.resonance_depth,
      lexicon: { ...this.state.profile.lexicon_progress },
      mirror: this.input.mirror,
      mirrorDelay: this.input.delay,
      mirrorRatio: this.state.profile.mirror_usage_ratio,
      muted: this.audio.muted,
      reading: this.module === "observer" ? observerReading(this.state.profile.resonance_depth, this.state.profile.mirror_usage_ratio) : (active?.reading ?? "Escolha um circuito. O observador espera."),
      porosity: active?.porosity ?? 0,
      quality: this.frameEma > 30 ? "contido" : "pleno",
      sessions: this.state.profile.session_count,
      events: this.state.profile.resonance_events.slice(-5).map((event) => ({
        module: event.module,
        duration: event.duration,
        homeodynamic: event.homeodynamic,
      })),
      unlock: this.unlock,
      trace: this.input.copyTraces(),
      audioReady: this.audio.ready,
    };
  }

  private active(): LaminarCircuit | RhizomaCircuit | TensegrityCircuit | null {
    if (this.module === "laminar_vortex") return this.laminar;
    if (this.module === "rhizoma") return this.rhizoma;
    if (this.module === "tensegrity_knot") return this.tensegrity;
    return null;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.frameEma = this.frameEma * 0.92 + dt * 1000 * 0.08;
    this.laminar.setQuality(this.frameEma < 30);
    this.input.step(dt);
    this.state.tick(dt);
    const circuit = this.active();
    if (circuit) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= 1 / 60 && steps < 3) {
        circuit.step(1 / 60);
        this.acc -= 1 / 60;
        steps++;
      }
    } else {
      this.acc = 0;
      this.settleAcc += dt;
      if (this.settleAcc >= 0.1) {
        this.audio.settle();
        this.settleAcc = 0;
      }
      this.observerTime += dt;
    }
    if (this.ctx && this.cssW > 1 && this.cssH > 1 && this.module) {
      if (this.module === "observer") drawObserver(this.ctx, this.cssW, this.cssH, this.state.profile, this.observerTime);
      else circuit?.draw(this.ctx, this.cssW, this.cssH);
    }
    this.raf = requestAnimationFrame(this.frame);
  };
}

function label(module: ModuleId | null): string {
  if (module === "laminar_vortex") return "vórtice laminar";
  if (module === "rhizoma") return "rizoma";
  if (module === "tensegrity_knot") return "nó tensegrity";
  if (module === "observer") return "observador";
  return "atlas";
}

function observerReading(depth: number, mirror: number): string {
  if (depth < 0.08) return "Ainda não há profundidade. Ela pede fase que caminha, tempo em homeodinâmica e complexidade no meio — não um eixo no máximo.";
  if (mirror > 0.35) return "O espelho ocupou boa parte da escuta. O atraso está virando hábito de leitura, não castigo.";
  return "O observador não corrige os circuitos. Mostra como eles andaram se medindo.";
}

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function moduleLabel(module: string): string {
  return label(module as ModuleId);
}
