import type { CircuitReport, DialogicNode, FilteredSample, Vec2 } from "./types";

type Off = () => void;

/**
 * Barramento estritamente tipado. Não há emit genérico.
 * `lastInput` / `lastReport` são a retenção do próprio barramento para
 * assinantes que precisam da amostra completa no mesmo turno do sinal.
 */
export class EventBus {
  private sympathy = new Set<(module: string, resonance: number, phaseOffset: number) => void>();
  private resonance = new Set<(module: string, duration: number, homeodynamicFlag: boolean) => void>();
  private filtered = new Set<(velocity: Vec2, acceleration: number, mirrorLag: number) => void>();
  private mirror = new Set<(enabled: boolean) => void>();
  private lexicon = new Set<(symbolId: string, clarity: number) => void>();
  private report = new Set<(report: CircuitReport) => void>();
  private memory = new Set<(node: DialogicNode) => void>();

  lastInput: FilteredSample | null = null;
  lastReport: CircuitReport | null = null;

  onSympathy(handler: (module: string, resonance: number, phaseOffset: number) => void): Off {
    this.sympathy.add(handler);
    return () => this.sympathy.delete(handler);
  }

  onResonance(handler: (module: string, duration: number, homeodynamicFlag: boolean) => void): Off {
    this.resonance.add(handler);
    return () => this.resonance.delete(handler);
  }

  onFiltered(handler: (velocity: Vec2, acceleration: number, mirrorLag: number) => void): Off {
    this.filtered.add(handler);
    return () => this.filtered.delete(handler);
  }

  onMirror(handler: (enabled: boolean) => void): Off {
    this.mirror.add(handler);
    return () => this.mirror.delete(handler);
  }

  onLexicon(handler: (symbolId: string, clarity: number) => void): Off {
    this.lexicon.add(handler);
    return () => this.lexicon.delete(handler);
  }

  onReport(handler: (report: CircuitReport) => void): Off {
    this.report.add(handler);
    return () => this.report.delete(handler);
  }

  onMemory(handler: (node: DialogicNode) => void): Off {
    this.memory.add(handler);
    return () => this.memory.delete(handler);
  }

  emitSympathy(module: string, resonance: number, phaseOffset: number): void {
    for (const handler of this.sympathy) handler(module, resonance, phaseOffset);
  }

  emitResonance(module: string, duration: number, homeodynamicFlag: boolean): void {
    for (const handler of this.resonance) handler(module, duration, homeodynamicFlag);
  }

  emitFiltered(sample: FilteredSample): void {
    this.lastInput = sample;
    for (const handler of this.filtered) {
      handler(sample.velocity, sample.acceleration, sample.mirrorLag);
    }
  }

  emitMirror(enabled: boolean): void {
    for (const handler of this.mirror) handler(enabled);
  }

  emitLexicon(symbolId: string, clarity: number): void {
    for (const handler of this.lexicon) handler(symbolId, clarity);
  }

  emitReport(report: CircuitReport): void {
    this.lastReport = report;
    for (const handler of this.report) handler(report);
  }

  emitMemory(node: DialogicNode): void {
    for (const handler of this.memory) handler(node);
  }

  counts(): Record<string, number> {
    return {
      sympathy_state_changed: this.sympathy.size,
      resonance_event: this.resonance.size,
      filtered_input: this.filtered.size,
      mirror_mode_toggled: this.mirror.size,
      lexicon_unlocked: this.lexicon.size,
      circuit_report: this.report.size,
      dialogic_memory_recorded: this.memory.size,
    };
  }
}
