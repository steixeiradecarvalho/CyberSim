import { drawFlowMark, drawMediationMark, drawTensionMark } from "../marks.ts";
import { PALETTE } from "../palette.ts";
import type { Profile } from "../types";

const MODULE_COLOR: Record<string, string> = {
  laminar_vortex: PALETTE.flow,
  rhizoma: PALETTE.mediate,
  tensegrity_knot: PALETTE.tension,
};

/** O terceiro não simula os circuitos. Lê o que eles já disseram. */
export function drawObserver(ctx: CanvasRenderingContext2D, w: number, h: number, profile: Profile, time: number): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.52;
  const radius = Math.min(w, h) * 0.3;

  ctx.save();
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, radius * 0.86, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius * 0.62, radius * 0.53, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const history = profile.phase_alignment_history;
  if (history.length > 1) {
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const sample = history[i]!;
      const ang = (i / history.length) * Math.PI * 2 - Math.PI / 2 + time * 0.05;
      const rad = radius * (0.42 + sample.resonance * 0.5);
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad * 0.86;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = PALETTE.bone;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const last = history[history.length - 1]!;
    const ang = Math.PI * 2 - Math.PI / 2 + time * 0.05;
    const rad = radius * (0.42 + last.resonance * 0.5);
    ctx.fillStyle = MODULE_COLOR[last.module] ?? PALETTE.bone;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.86, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const lex = profile.lexicon_progress;
  const marks: [number, number, number, "flow" | "tension" | "mediation"][] = [
    [cx, cy - radius * 0.15, lex.flow, "flow"],
    [cx - radius * 0.22, cy + radius * 0.16, lex.tension, "tension"],
    [cx + radius * 0.22, cy + radius * 0.16, lex.mediation, "mediation"],
  ];
  for (const [x, y, clarity, id] of marks) {
    const size = 8 + clarity * 16;
    const alpha = 0.25 + clarity * 0.75;
    if (id === "flow") drawFlowMark(ctx, x, y, size, alpha);
    else if (id === "tension") drawTensionMark(ctx, x, y, size, alpha);
    else drawMediationMark(ctx, x, y, size, alpha);
  }

  const events = profile.resonance_events.slice(-16);
  if (events.length) {
    ctx.save();
    const y = h - 28;
    const gap = Math.min(28, (w - 48) / events.length);
    events.forEach((event, i) => {
      const x = 24 + i * gap;
      ctx.fillStyle = event.homeodynamic ? PALETTE.flow : PALETTE.mute;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y - Math.min(18, event.duration * 4), 3, Math.min(18, 4 + event.duration * 4));
    });
    ctx.restore();
  }
}
