import { getLocale } from './index';
import { getAbility, getCustomAbility, allAbilitiesWithCustom } from '../data/dex/abilities';
import { getMove } from '../data/dex/moves';
import { getItem } from '../data/items';
import abilitiesEs from '../data/i18n/es/abilities.json';
import itemsEs from '../data/i18n/es/items.json';
import meta from '../data/i18n/es/meta.json';
import movesEs from '../data/i18n/es/moves.json';

/**
 * The content localisation layer (`D43`, amended by `Task-112` and `Task-209`):
 * the UI chrome stays in `src/i18n/en.ts`/`es.ts`, while the dex's move and
 * ability copy - the official Spanish names and descriptions - lives in the
 * generated tables under `src/data/i18n/es/`, and the item bodies the run hands
 * the player live in the hand-authored `itemsEs` beside them. The dex itself
 * keeps its English strings, so the engine and every fixed-seed log stay
 * language-independent; only the surfaces that print a move, an ability or an
 * item read through this module.
 */

type ContentRow = Readonly<{ name: string; description: string; shortDescription: string }>;

const MOVES: Readonly<Record<string, ContentRow>> = movesEs;
const ABILITIES: Readonly<Record<string, ContentRow>> = abilitiesEs;
// Item names stay English (`D43`), so the table is a flat id -> body map with no
// `name` column; a hand-authored row because the generator has no item pass.
const ITEMS: Readonly<Record<string, string>> = itemsEs;

const ABILITY_BY_NAME = new Map(
  allAbilitiesWithCustom().map((ability) => [ability.name, ability] as const),
);

const MISSING_NAMES = new Set<string>([...meta.moves.missingNames, ...meta.abilities.missingNames]);

/** Every id the source could not translate, for the audit and the tests. */
export const MISSING_ES: readonly string[] = [
  ...MISSING_NAMES,
  ...meta.moves.missingDescriptions.filter((id) => !MISSING_NAMES.has(id)),
  ...meta.abilities.missingDescriptions.filter((id) => !MISSING_NAMES.has(id)),
];

function englishMove(id: string): string | null {
  const move = getMove(id);
  return move ? move.name : null;
}

function englishAbility(id: string): string | null {
  const ability = getAbility(id);
  return ability ? ability.name : null;
}

function spanishMove(id: string): ContentRow | null {
  return MOVES[id] ?? null;
}

function spanishAbility(id: string): ContentRow | null {
  const generated = ABILITIES[id];
  if (generated) return generated;
  // A hand-authored row carries its own Spanish copy, since the generated table
  // only covers the 311 rows `allAbilities()` exposes.
  const custom = getCustomAbility(id);
  if (!custom) return null;
  return {
    name: custom.nameEs,
    description: custom.descEs,
    shortDescription: custom.shortDescEs,
  };
}

/** A move's display name in the current locale, or the raw id when unknown. */
export function moveName(id: string): string {
  if (getLocale() === 'es') return spanishMove(id)?.name ?? englishMove(id) ?? id;
  return englishMove(id) ?? id;
}

/** A move's long description in the current locale, or '' when unknown. */
export function moveDescription(id: string): string {
  const move = getMove(id);
  if (!move) return '';
  if (getLocale() === 'es') return spanishMove(id)?.description || move.desc || move.shortDesc || '';
  return move.desc || move.shortDesc || '';
}

/** A move's one-line description in the current locale, or '' when unknown. */
export function moveShortDescription(id: string): string {
  const move = getMove(id);
  if (!move) return '';
  if (getLocale() === 'es') {
    return spanishMove(id)?.shortDescription || move.shortDesc || move.desc || '';
  }
  return move.shortDesc || move.desc || '';
}

/** An ability's display name in the current locale, or the raw id when unknown. */
export function abilityName(id: string): string {
  if (getLocale() === 'es') return spanishAbility(id)?.name ?? englishAbility(id) ?? id;
  return englishAbility(id) ?? id;
}

/** An ability's description in the current locale, or '' when unknown. */
export function abilityDescription(id: string): string {
  const ability = getAbility(id);
  if (!ability) return '';
  if (getLocale() === 'es') {
    return spanishAbility(id)?.description || ability.shortDesc || ability.desc || '';
  }
  return ability.shortDesc || ability.desc || '';
}

/** The dex's English ability name as a localised display name. */
export function abilityNameFromEnglish(name: string): string {
  const ability = ABILITY_BY_NAME.get(name);
  return ability ? abilityName(ability.id) : name;
}

/** The dex's English ability name as a localised description, or ''. */
export function abilityDescriptionFromEnglish(name: string): string {
  const ability = ABILITY_BY_NAME.get(name);
  return ability ? abilityDescription(ability.id) : '';
}

/**
 * An item's description in the current locale: the Spanish table's row when it has one,
 * the catalogue's own English `shortDesc` otherwise, `''` for an id the catalogue does
 * not know. Names stay English (`D43`): this returns the body only.
 */
export function itemText(id: string): string {
  const item = getItem(id);
  if (item === undefined) return '';
  const english = item.shortDesc;
  if (getLocale() === 'es') {
    const spanish = ITEMS[id];
    if (typeof spanish === 'string' && spanish.trim().length > 0) return spanish;
  }
  return english;
}
