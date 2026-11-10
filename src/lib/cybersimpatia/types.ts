export type ModuleId = "laminar_vortex" | "rhizoma" | "tensegrity_knot" | "observer";

export type Vec2 = { x: number; y: number };

/** Retained on the bus. The typed signal itself only carries velocity, acceleration, lag. */
export type FilteredSample = {
  velocity: Vec2;
  acceleration: number;
  mirrorLag: number;
  position: Vec2;
  raw: Vec2;
  filtered: Vec2;
  mirror: Vec2;
  hasPointer: boolean;
};

export type CircuitReport = {
  module: ModuleId;
  resonance: number;
  phaseOffset: number;
  tension: number;
  harmony: number;
  complexity: number;
  homeodynamic: boolean;
  reading: string;
  porosity: number;
};

export type DialogicNode = {
  x: number;
  y: number;
  polarity: number;
  strength: number;
  session: number;
};

export type ResonanceEvent = {
  module: string;
  duration: number;
  homeodynamic: boolean;
  at: number;
};

export type PhaseSample = {
  at: number;
  module: string;
  phase: number;
  resonance: number;
  homeodynamic: boolean;
  complexity: number;
};

export type SessionRecord = {
  module: string;
  startedAt: number;
  endedAt: number;
  mirrorRatio: number;
};

export type LexiconProgress = {
  flow: number;
  tension: number;
  mediation: number;
};

export type Profile = {
  profile_version: "2.0";
  sessions: SessionRecord[];
  resonance_depth: number;
  phase_alignment_history: PhaseSample[];
  lexicon_progress: LexiconProgress;
  mirror_usage_ratio: number;
  dialogic_memory: DialogicNode[];
  resonance_events: ResonanceEvent[];
  last_module: ModuleId | null;
  session_count: number;
};

export type LensId = "flow" | "tension" | "sync";
