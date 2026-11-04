/** Clamps a level into `1..cap`. */
export function clampToCap(level: number, cap: number): number {
  return Math.max(1, Math.min(Math.floor(level), Math.floor(cap)));
}

export function reachedCap(level: number, cap: number): boolean {
  return Math.floor(level) >= Math.floor(cap);
}
