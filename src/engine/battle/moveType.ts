import { MAX_IV, type Move, type StatId, type Stats } from '../../data/dex';
import { getItem } from '../../data/items';

/**
 * Ability- and item-driven move-type changes, as one pure rule the battle engine
 * and the HUD both read, so a move's badge matches whether it is in the FIGHT
 * menu or the party panel (`D17` retypes level moves; this retypes the show).
 *
 *  - the `-ate` abilities (Aerilate, Galvanize, Pixilate, Refrigerate) turn a
 *    Normal-type move into theirs;
 *  - Liquid Voice turns a sound move into Water;
 *  - Normalize turns every move into Normal;
 *  - **Hidden Power** is used as the type its holder's IVs encode (`D37`): the
 *    Gen 6+ rule reads the six IVs and picks from `HIDDEN_POWER_TYPES`, so the
 *    battle, the FIGHT menu and the party panel agree on its type;
 *  - the base type is read before the ability: Normalize still forces Normal, but
 *    an `-ate` ability only retypes a move whose *base* is Normal, so it leaves
 *    Hidden Power (never Normal in Gen 6+) alone;
 *  - a held **Plate** gives Judgment its type (`item.plate`).
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

/** The 16 Hidden Power types, in the dex's own order (Gen 6+; never Normal, never Fairy). */
export const HIDDEN_POWER_TYPES: readonly string[] = [
  'Fighting',
  'Flying',
  'Poison',
  'Ground',
  'Rock',
  'Bug',
  'Ghost',
  'Steel',
  'Fire',
  'Water',
  'Grass',
  'Electric',
  'Psychic',
  'Ice',
  'Dragon',
  'Dark',
];

/** The type Hidden Power is used as for a holder with these IVs. Missing stats read as `MAX_IV` (31). */
export function hiddenPowerType(ivs?: Partial<Stats> | null): string {
  const iv = (stat: StatId): number => ivs?.[stat] ?? MAX_IV;
  const value =
    (iv('hp') % 2) +
    (iv('atk') % 2) * 2 +
    (iv('def') % 2) * 4 +
    (iv('spe') % 2) * 8 +
    (iv('spa') % 2) * 16 +
    (iv('spd') % 2) * 32;
  return HIDDEN_POWER_TYPES[Math.floor((value * 15) / 63)];
}

/** The type a move starts from: its dexed type, except Hidden Power, which reads the holder's IVs. */
export function baseMoveType(move: Move, ivs?: Partial<Stats> | null): string {
  return move.id === 'hiddenpower' ? hiddenPowerType(ivs) : move.type;
}

/** Normalizes an ability id the way the effect registry keys it. */
function normalizeAbility(ability: string): string {
  return ability.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The type a move is used as once the user's ability is applied. */
export function abilityMoveType(
  ability: string | null | undefined,
  move: Move,
  ivs?: Partial<Stats> | null,
): string {
  const base = baseMoveType(move, ivs);
  const id = normalizeAbility(ability ?? '');
  if (id === 'normalize') return 'Normal';
  if (id === 'liquidvoice' && move.flags.sound) return 'Water';
  const ate = ATE_TYPES[id];
  if (ate && base === 'Normal') return ate;
  return base;
}

/** The type a Plate confers on Judgment, or null when none is held. */
function judgeType(itemId: string | null | undefined): string | null {
  const plate = itemId ? getItem(itemId)?.plate : undefined;
  return plate ?? null;
}

/**
 * The type a move is used as once the user's ability **and** held item are
 * applied. This is what the party panel shows; the battle reads the same rules
 * through the effect registry (the item's own `onModifyMoveType`).
 */
export function effectiveMoveType(
  ability: string | null | undefined,
  itemId: string | null | undefined,
  move: Move,
  ivs?: Partial<Stats> | null,
): string {
  if (move.id === 'judgment') {
    const plate = judgeType(itemId);
    if (plate) return plate;
  }
  return abilityMoveType(ability, move, ivs);
}
