/**
 * Seeded RNG. Every run, route layout, encounter table and trainer roster goes
 * through it so that "same seed + same inputs = same run" holds.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return min >= max ? min : Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * A stream derived from this one's current position under `salt`: a roll that
   * must not shift the parent's sequence gets its own (`D11`). Never advances
   * this stream, and the same position and salt give the same sequence.
   */
  split(salt: string): Rng {
    return new Rng(hashSeed(`${this.state >>> 0}:${salt}`));
  }
}

export function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * A fresh run seed. It is the run's *name*, not a roll: every draw after it comes
 * from the seeded `Rng` streams (D11), so this only has to be unpredictable and
 * never collides. `crypto` keeps it off `Math.random`, which has no business
 * inside the engine even here.
 */
export function randomSeed(): string {
  const words = new Uint32Array(1);
  crypto.getRandomValues(words);
  return words[0]!.toString(36);
}

export function dailySeed(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `daily-${y}-${m}-${d}`;
}

export function rngFromSeed(seed: string): Rng {
  return new Rng(hashSeed(seed));
}
