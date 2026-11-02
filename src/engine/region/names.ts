import { NAME_ADJECTIVES, NAME_NOUNS } from '../../data/region';
import type { Rng } from '../rng';

function titleCase(word: string): string {
  if (word.length === 0) return word;
  return word[0].toUpperCase() + word.slice(1);
}

/**
 * `count` unique settlement names, `Adjective Noun`, in draw order. A pair already
 * drawn is re-rolled off the same stream, so the result is stable for a stream
 * position and a count (`docs/region-spec.md` §2).
 */
export function settlementNames(rng: Rng, count: number): readonly string[] {
  const wanted = Math.max(0, Math.floor(count));
  const capacity = NAME_ADJECTIVES.length * NAME_NOUNS.length;
  if (wanted > capacity) {
    throw new Error(`cannot draw ${wanted} unique settlement names from ${capacity} pairs`);
  }
  const names: string[] = [];
  const drawn = new Set<string>();
  while (names.length < wanted) {
    const adjective = NAME_ADJECTIVES[rng.int(0, NAME_ADJECTIVES.length - 1)];
    const noun = NAME_NOUNS[rng.int(0, NAME_NOUNS.length - 1)];
    const name = `${titleCase(adjective)} ${titleCase(noun)}`;
    if (drawn.has(name)) continue;
    drawn.add(name);
    names.push(name);
  }
  return names;
}

/** A route's only name: `Route <n>`, numbered in chain order over mains and laterals. */
export function routeName(index: number): string {
  return `Route ${index}`;
}
