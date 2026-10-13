/**
 * Hand-authored ability text for the ids whose dex blurb is competitive-play
 * boilerplate while this engine ports the ability (`docs/balance/effect-coverage.md`
 * carries the same ability as `port`). Read by `abilityDescription`
 * (`src/ui/partyDetail.ts`) **before** the dex's own `shortDesc`/`desc`, so one
 * table fixes every ⓘ that floats an ability's text.
 */

/**
 * Keyed by the normalised ability id — lowercase, no separators — the form
 * `getAbility` (`dex/abilities.ts`) resolves. Keys stay in ascending order so the
 * table reads as a list and diffs cleanly.
 */
export const OVERRIDES: Readonly<Record<string, string>> = {
  runaway: 'Always escapes from a wild Pokémon. A trapping effect still stops it.',
};

/** The engine's id normalisation, the same one `getAbility` uses. */
function normalise(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The override for an ability id, or null when the id has no override or is not
 * an ability at all. Never reads the dex and never falls back: the dex read stays
 * in `abilityDescription`, the one place that decides.
 */
export function abilityText(id: string): string | null {
  return OVERRIDES[normalise(id)] ?? null;
}
