import { PALETTE } from "./palette.ts";
import type { FilteredSample } from "./types";

export function drawFlowMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = PALETTE.flow;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(x, y, size, 0.4, 5.4);
  ctx.stroke();
  ctx.restore();
}

export function drawTensionMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = PALETTE.tension;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x - size * 0.12, y);
  ctx.moveTo(x + size * 0.18, y - size * 0.45);
  ctx.lineTo(x + size, y + size * 0.2);
  ctx.stroke();
  ctx.restore();
}

export function drawMediationMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PALETTE.mediate;
  const points: [number, number][] = [
    [0, -size],
    [-size * 0.86, size * 0.5],
    [size * 0.86, size * 0.5],
  ];
  for (const [dx, dy] of points) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, Math.max(1.4, size * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Gesto, filtro e mediador — a observação da observação, desenhada no campo. */
export function drawSecondOrder(ctx: CanvasRenderingContext2D, sample: FilteredSample | null, w: number, h: number): void {
  if (!sample?.hasPointer) return;
  const rawX = sample.raw.x * w;
  const rawY = sample.raw.y * h;
  const filtX = sample.filtered.x * w;
  const filtY = sample.filtered.y * h;
  const medX = sample.position.x * w;
  const medY = sample.position.y * h;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
  ctx.strokeStyle = PALETTE.line;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(rawX, rawY);
  ctx.lineTo(filtX, filtY);
  ctx.lineTo(medX, medY);
  ctx.stroke();

  ctx.strokeStyle = PALETTE.mute;
  ctx.strokeRect(rawX - 4, rawY - 4, 8, 8);
  ctx.fillStyle = PALETTE.mute;
  ctx.fillText("gesto", rawX + 8, rawY - 6);

  ctx.strokeStyle = PALETTE.bone;
  ctx.beginPath();
  ctx.arc(filtX, filtY, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.bone;
  ctx.fillText("filtro", filtX + 10, filtY + 14);

  drawMediationMark(ctx, medX, medY, 9, 0.95);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = PALETTE.mediate;
  ctx.fillText("mediador", medX + 12, medY - 8);
  ctx.restore();
}
