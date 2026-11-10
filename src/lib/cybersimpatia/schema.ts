import type { LexiconProgress, Profile } from "./types";
import { clamp } from "./math.ts";

export const PROFILE_KEY = "cybersimpatia.profile.v2";

export function emptyLexicon(): LexiconProgress {
  return { flow: 0, tension: 0, mediation: 0 };
}

export function freshProfile(): Profile {
  return {
    profile_version: "2.0",
    sessions: [],
    resonance_depth: 0,
    phase_alignment_history: [],
    lexicon_progress: emptyLexicon(),
    mirror_usage_ratio: 0,
    dialogic_memory: [],
    resonance_events: [],
    last_module: null,
    session_count: 0,
  };
}

/**
 * Profundidade não-linear. A média é atenuada quando um eixo dispara sozinho,
 * então "otimizar" um número não aprofunda o circuito.
 */
export function resonanceDepth(phaseVariance: number, homeoRatio: number, complexity: number): number {
  const a = clamp(phaseVariance / 0.08);
  const b = clamp(homeoRatio);
  const c = clamp(complexity);
  const mean = (a + b + c) / 3;
  const variance = ((a - mean) ** 2 + (b - mean) ** 2 + (c - mean) ** 2) / 3;
  const balance = 1 - Math.min(1, Math.sqrt(variance) * 2.2);
  return mean * (0.45 + 0.55 * balance);
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function lexicon(value: unknown): LexiconProgress {
  const src = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    flow: clamp(num(src.flow)),
    tension: clamp(num(src.tension)),
    mediation: clamp(num(src.mediation)),
  };
}

/** Migra perfis antigos (incl. `avg_sympathy`) para o schema 2.0. */
export function migrateProfile(raw: unknown): Profile {
  const base = freshProfile();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;

  if (data.profile_version !== "2.0") {
    base.resonance_depth = clamp(num(data.avg_sympathy ?? data.resonance_depth));
    base.lexicon_progress = lexicon(data.lexicon_progress);
    return base;
  }

  base.resonance_depth = clamp(num(data.resonance_depth));
  base.lexicon_progress = lexicon(data.lexicon_progress);
  base.mirror_usage_ratio = clamp(num(data.mirror_usage_ratio));
  base.session_count = Math.max(0, Math.floor(num(data.session_count)));
  if (data.last_module === "laminar_vortex" || data.last_module === "rhizoma" || data.last_module === "tensegrity_knot" || data.last_module === "observer") {
    base.last_module = data.last_module;
  }
  if (Array.isArray(data.sessions)) {
    base.sessions = data.sessions.slice(-24).filter((item) => item && typeof item === "object") as Profile["sessions"];
  }
  if (Array.isArray(data.phase_alignment_history)) {
    base.phase_alignment_history = data.phase_alignment_history.slice(-180) as Profile["phase_alignment_history"];
  }
  if (Array.isArray(data.resonance_events)) {
    base.resonance_events = data.resonance_events.slice(-40) as Profile["resonance_events"];
  }
  if (Array.isArray(data.dialogic_memory)) {
    base.dialogic_memory = data.dialogic_memory
      .slice(-48)
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const node = item as Record<string, unknown>;
        return {
          x: clamp(num(node.x, 0.5)),
          y: clamp(num(node.y, 0.5)),
          polarity: clamp(num(node.polarity), -1, 1),
          strength: clamp(num(node.strength)),
          session: Math.max(0, Math.floor(num(node.session))),
        };
      });
  }
  return base;
}
