export function clamp(v: number, min = 0, max = 1): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
}

export function expSmooth(current: number, target: number, dt: number, rate: number): number {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}

export function hypot(x: number, y: number): number {
  return Math.hypot(x, y);
}
