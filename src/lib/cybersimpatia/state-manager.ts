import type { EventBus } from "./event-bus";
import { clamp } from "./math.ts";
import { freshProfile, migrateProfile, PROFILE_KEY, resonanceDepth } from "./schema.ts";
import type { CircuitReport, DialogicNode, ModuleId, Profile, ResonanceEvent } from "./types";

const WINDOW_MS = 10_000;
const LEVELS = [0.25, 0.5, 0.75, 1];

type WindowSample = {
  at: number;
  phase: number;
  homeo: number;
  complexity: number;
};

/**
 * Persistência do perfil. O flush vai para o localStorage fora do quadro
 * de simulação (timer), nunca no meio do passo.
 */
export class StateManager {
  profile: Profile;
  private window: WindowSample[] = [];
  private mirrorOn = false;
  private mirrorTime = 0;
  private openTime = 0;
  private sessionStart = 0;
  private sessionModule: ModuleId | null = null;
  private sessionMirror = 0;
  private sessionOpen = 0;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private lexiconMarks: Record<string, number> = { flow: 0, tension: 0, mediation: 0 };
  lastUnlock: { id: string; clarity: number } | null = null;

  private bus: EventBus;

  constructor(bus: EventBus) {
    this.bus = bus;
    this.profile = this.load();
    this.lexiconMarks = { ...this.profile.lexicon_progress };
    bus.onSympathy((module, resonance, phaseOffset) => {
      this.notePhase(module, phaseOffset, resonance);
    });
    bus.onReport((report) => this.absorbReport(report));
    bus.onResonance((module, duration, homeodynamic) => {
      const event: ResonanceEvent = { module, duration, homeodynamic, at: Date.now() };
      this.profile.resonance_events.push(event);
      if (this.profile.resonance_events.length > 40) this.profile.resonance_events.shift();
      this.touch();
    });
    bus.onMirror((enabled) => {
      this.mirrorOn = enabled;
    });
    bus.onMemory((node) => this.remember(node));
    bus.onLexicon((symbolId, clarity) => {
      this.lastUnlock = { id: symbolId, clarity };
    });
  }

  private load(): Profile {
    try {
      if (typeof localStorage === "undefined") return freshProfile();
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return freshProfile();
      return migrateProfile(JSON.parse(raw) as unknown);
    } catch {
      return freshProfile();
    }
  }

  beginSession(module: ModuleId): void {
    this.endSession();
    this.sessionModule = module;
    this.sessionStart = Date.now();
    this.sessionMirror = 0;
    this.sessionOpen = 0;
    this.profile.last_module = module;
    this.touch();
  }

  endSession(): void {
    if (!this.sessionModule || this.sessionModule === "observer") {
      this.sessionModule = null;
      return;
    }
    const open = this.sessionOpen || 0.001;
    this.profile.sessions.push({
      module: this.sessionModule,
      startedAt: this.sessionStart,
      endedAt: Date.now(),
      mirrorRatio: clamp(this.sessionMirror / open),
    });
    if (this.profile.sessions.length > 24) this.profile.sessions.shift();
    this.profile.session_count += 1;
    this.sessionModule = null;
    this.touch();
  }

  /** Chamado pelo orquestrador uma vez por quadro. Não escreve disco aqui. */
  tick(dt: number): void {
    this.openTime += dt;
    if (this.mirrorOn) this.mirrorTime += dt;
    if (this.sessionModule && this.sessionModule !== "observer") {
      this.sessionOpen += dt;
      if (this.mirrorOn) this.sessionMirror += dt;
    }
    this.profile.mirror_usage_ratio = this.openTime > 0 ? clamp(this.mirrorTime / this.openTime) : this.profile.mirror_usage_ratio;
  }

  private notePhase(module: string, phase: number, resonance: number): void {
    this.profile.phase_alignment_history.push({
      at: Date.now(),
      module,
      phase,
      resonance,
      homeodynamic: false,
      complexity: 0,
    });
    if (this.profile.phase_alignment_history.length > 180) {
      this.profile.phase_alignment_history.splice(0, this.profile.phase_alignment_history.length - 180);
    }
  }

  private absorbReport(report: CircuitReport): void {
    const now = Date.now();
    this.window.push({
      at: now,
      phase: report.phaseOffset,
      homeo: report.homeodynamic ? 1 : 0,
      complexity: report.complexity,
    });
    const cutoff = now - WINDOW_MS;
    while (this.window.length && this.window[0]!.at < cutoff) this.window.shift();

    const history = this.profile.phase_alignment_history;
    const last = history[history.length - 1];
    if (last && last.module === report.module) {
      last.homeodynamic = report.homeodynamic;
      last.complexity = report.complexity;
      last.resonance = report.resonance;
      last.phase = report.phaseOffset;
    }

    this.profile.resonance_depth = this.computeDepth();
    this.growLexicon(report, 0.1);
    this.touch();
  }

  private computeDepth(): number {
    const samples = this.window;
    if (samples.length < 4) return this.profile.resonance_depth;
    let mean = 0;
    let homeo = 0;
    let complexity = 0;
    for (const sample of samples) {
      mean += sample.phase;
      homeo += sample.homeo;
      complexity += sample.complexity;
    }
    mean /= samples.length;
    homeo /= samples.length;
    complexity /= samples.length;
    let variance = 0;
    for (const sample of samples) {
      const d = sample.phase - mean;
      variance += d * d;
    }
    variance /= samples.length;
    const next = resonanceDepth(variance, homeo, complexity);
    return this.profile.resonance_depth + (next - this.profile.resonance_depth) * 0.35;
  }

  private growLexicon(report: CircuitReport, dt: number): void {
    const lex = this.profile.lexicon_progress;
    if (report.module === "laminar_vortex") lex.flow = clamp(lex.flow + report.resonance * dt * 0.016);
    if (report.module === "tensegrity_knot") {
      lex.tension = clamp(lex.tension + (report.homeodynamic ? 0.022 : report.resonance * 0.004) * dt);
    }
    if (report.module === "rhizoma") lex.mediation = clamp(lex.mediation + (0.006 + report.porosity * 0.012) * dt * (0.4 + report.resonance));
    if (this.mirrorOn && report.resonance > 0.22 && report.resonance < 0.9) {
      lex.mediation = clamp(lex.mediation + dt * 0.018);
    }
    this.cross("flow", lex.flow);
    this.cross("tension", lex.tension);
    this.cross("mediation", lex.mediation);
  }

  private cross(id: string, clarity: number): void {
    const prev = this.lexiconMarks[id] ?? 0;
    for (const level of LEVELS) {
      if (prev < level && clarity >= level) {
        this.bus.emitLexicon(id, clarity);
      }
    }
    this.lexiconMarks[id] = clarity;
  }

  private remember(node: DialogicNode): void {
    this.profile.dialogic_memory.push(node);
    if (this.profile.dialogic_memory.length > 48) this.profile.dialogic_memory.shift();
    this.touch();
  }

  private touch(): void {
    this.dirty = true;
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => this.flush(), 800);
  }

  flush(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
    } catch {
      /* disco cheio ou privado: a sessão segue em memória */
    }
  }

  exportJson(): string {
    return JSON.stringify(this.profile, null, 2);
  }
}
