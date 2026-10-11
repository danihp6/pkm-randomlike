import type { Move } from '../../data/dex';

/**
 * Ability-driven move-type changes, as one pure rule the battle engine and the
 * HUD both read, so a move's badge matches whether it is in the FIGHT menu or
 * the party panel (`D17` retypes level moves; this retypes the show).
 *
 *  - the `-ate` abilities (Aerilate, Galvanize, Pixilate, Refrigerate) turn a
 *    Normal-type move into theirs;
 *  - Liquid Voice turns a sound move into Water;
 *  - Normalize turns every move into Normal.
 *
 * Field effects that would retype for a turn (Plasma Fists, Electrify, Ion
 * Deluge) do not exist in the Gen 9 dex this build ships, so nothing else hooks
 * in; an effect that did would register its own `onModifyMoveType` handler.
 */
const ATE_TYPES: Readonly<Record<string, string>> = {
  aerilate: 'Flying',
  galvanize: 'Electric',
  pixilate: 'Fairy',
  refrigerate: 'Ice',
};

/** Normalizes an ability id the way the effect registry keys it. */
function normalizeAbility(ability: string): string {
  return ability.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The type a move is used as once the user's ability is applied. */
export function abilityMoveType(ability: string | null | undefined, move: Move): string {
  const id = normalizeAbility(ability ?? '');
  if (id === 'normalize') return 'Normal';
  if (id === 'liquidvoice' && move.flags.sound) return 'Water';
  const ate = ATE_TYPES[id];
  if (ate && move.type === 'Normal') return ate;
  return move.type;
}
