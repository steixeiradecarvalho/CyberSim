import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EventBus } from "./event-bus.ts";
import { InputFilter } from "./input-filter.ts";
import { LaminarCircuit } from "./modules/laminar.ts";
import { RhizomaCircuit } from "./modules/rhizoma.ts";
import { TensegrityCircuit } from "./modules/tensegrity.ts";
import { migrateProfile, resonanceDepth } from "./schema.ts";
import type { FilteredSample } from "./types.ts";

function sample(x: number, vx = 0.4): FilteredSample {
  return {
    velocity: { x: vx, y: 0.1 },
    acceleration: 0,
    mirrorLag: 0,
    position: { x, y: 0.5 },
    raw: { x, y: 0.5 },
    filtered: { x, y: 0.5 },
    mirror: { x, y: 0.5 },
    hasPointer: true,
  };
}

describe("resonance depth", () => {
  it("stays at zero when nothing is happening", () => {
    assert.equal(resonanceDepth(0, 0, 0), 0);
  });

  it("reaches one only when phase, homeodynamics and complexity are all full", () => {
    assert.ok(Math.abs(resonanceDepth(0.08, 1, 1) - 1) < 1e-9);
  });

  it("does not treat a single spiked axis as depth", () => {
    const spiked = resonanceDepth(0.08, 0, 0);
    const balanced = resonanceDepth(0.048, 0.6, 0.6);
    assert.ok(spiked < 0.2);
    assert.ok(balanced > spiked);
  });
});

describe("profile migration", () => {
  it("maps a legacy average into depth and drops unknown shape", () => {
    const profile = migrateProfile({ profile_version: "1.0", avg_sympathy: 0.42, score: 99 });
    assert.equal(profile.profile_version, "2.0");
    assert.equal(profile.resonance_depth, 0.42);
    assert.equal(profile.lexicon_progress.flow, 0);
    assert.equal("score" in profile, false);
  });

  it("keeps a v2 lexicon", () => {
    const profile = migrateProfile({
      profile_version: "2.0",
      lexicon_progress: { flow: 0.4, tension: 1.2, mediation: -1 },
      dialogic_memory: [{ x: 0.2, y: 0.3, polarity: 0.5, strength: 0.4, session: 1 }],
    });
    assert.equal(profile.lexicon_progress.flow, 0.4);
    assert.equal(profile.lexicon_progress.tension, 1);
    assert.equal(profile.lexicon_progress.mediation, 0);
    assert.equal(profile.dialogic_memory.length, 1);
  });
});

describe("event bus", () => {
  it("routes the typed signals and keeps the retained sample", () => {
    const bus = new EventBus();
    const heard: string[] = [];
    bus.onSympathy((module, resonance) => heard.push(`${module}:${resonance}`));
    bus.onFiltered((velocity, _acceleration, lag) => heard.push(`in:${velocity.x}:${lag}`));
    bus.onMirror((enabled) => heard.push(`mirror:${enabled}`));
    bus.onResonance((module, duration, flag) => heard.push(`ep:${module}:${duration}:${flag}`));
    bus.onLexicon((id, clarity) => heard.push(`lex:${id}:${clarity}`));
    bus.emitSympathy("laminar_vortex", 0.5, 0.2);
    bus.emitFiltered(sample(0.3));
    bus.emitMirror(true);
    bus.emitResonance("tensegrity_knot", 1.4, true);
    bus.emitLexicon("flow", 0.25);
    assert.deepEqual(heard, [
      "laminar_vortex:0.5",
      "in:0.4:0",
      "mirror:true",
      "ep:tensegrity_knot:1.4:true",
      "lex:flow:0.25",
    ]);
    assert.equal(bus.lastInput?.position.x, 0.3);
    const counts = bus.counts();
    for (const count of Object.values(counts)) assert.ok(count >= 0);
    assert.ok(counts.sympathy_state_changed > 0);
    assert.ok(counts.filtered_input > 0);
  });
});

describe("mirror pipeline", () => {
  it("lags the mediated position behind the filtered one", () => {
    const bus = new EventBus();
    const input = new InputFilter(bus);
    input.setMirror(true);
    input.setDelay(0.6);
    for (let i = 0; i < 90; i++) {
      input.setPointer(i / 120, 0.4);
      input.step(1 / 60);
    }
    const last = bus.lastInput;
    assert.ok(last);
    assert.ok(last.mirrorLag > 0.4);
    assert.ok(last.mirror.x < last.filtered.x - 0.05);
  });
});

describe("circuits stay finite", () => {
  it("advects the vortex without blowing up", () => {
    const bus = new EventBus();
    const circuit = new LaminarCircuit(bus);
    for (let i = 0; i < 90; i++) {
      bus.emitFiltered(sample(0.3 + Math.sin(i / 12) * 0.15, Math.cos(i / 8)));
      circuit.step(1 / 60);
    }
    const report = circuit.report();
    assert.ok(Number.isFinite(report.resonance));
    assert.ok(report.resonance >= 0 && report.resonance <= 1);
    assert.ok(Number.isFinite(report.tension));
    assert.ok(Number.isFinite(report.phaseOffset));
  });

  it("lets the rhizome negotiate without NaN", () => {
    const bus = new EventBus();
    const circuit = new RhizomaCircuit(bus);
    circuit.seedMemory([{ x: 0.4, y: 0.4, polarity: 0.8, strength: 0.6, session: 1 }], 1);
    for (let i = 0; i < 80; i++) {
      bus.emitFiltered(sample(0.45 + Math.sin(i / 10) * 0.1, 0.6));
      circuit.step(1 / 60);
    }
    const report = circuit.report();
    assert.ok(Number.isFinite(report.resonance));
    assert.ok(Number.isFinite(report.porosity));
  });

  it("keeps the tensegrity knot bounded", () => {
    const bus = new EventBus();
    const circuit = new TensegrityCircuit(bus);
    for (let i = 0; i < 180; i++) {
      bus.emitFiltered(sample(0.5 + Math.sin(i / 20) * 0.08, Math.sin(i / 15) * 0.3));
      circuit.step(1 / 60);
    }
    const report = circuit.report();
    assert.ok(Number.isFinite(report.resonance));
    assert.ok(Number.isFinite(report.tension));
    assert.ok(report.tension < 5);
  });
});
