import { getLocale } from './index';
import { getAbility, allAbilities } from '../data/dex/abilities';
import { getMove } from '../data/dex/moves';
import abilitiesEs from '../data/i18n/es/abilities.json';
import meta from '../data/i18n/es/meta.json';
import movesEs from '../data/i18n/es/moves.json';

/**
 * The content localisation layer (`D43`, amended by `Task-112`): the UI chrome
 * stays in `src/i18n/en.ts`/`es.ts`, while the dex's move and ability copy -
 * the official Spanish names and descriptions - lives in the generated tables
 * under `src/data/i18n/es/`. The dex itself keeps its English strings, so the
 * engine and every fixed-seed log stay language-independent; only the surfaces
 * that print a move or an ability read through this module.
 */

type ContentRow = Readonly<{ name: string; description: string; shortDescription: string }>;

const MOVES: Readonly<Record<string, ContentRow>> = movesEs;
const ABILITIES: Readonly<Record<string, ContentRow>> = abilitiesEs;

const ABILITY_BY_NAME = new Map(allAbilities().map((ability) => [ability.name, ability] as const));

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
  return ABILITIES[id] ?? null;
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
