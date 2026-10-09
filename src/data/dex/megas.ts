import megasData from './megas.json';
import { getSpecies, normalizeId, type Species } from './species';

/** A generated Mega forme: a battle-only `Species` plus its base and its stone. */
export type MegaForm = Species &
  Readonly<{
    baseSpeciesId: string;
    stoneId: string;
    stoneName: string;
  }>;

export const MEGA_FORMES: readonly MegaForm[] = megasData as unknown as readonly MegaForm[];

const BY_ITEM = new Map<string, MegaForm>(MEGA_FORMES.map((mega) => [mega.stoneId, mega]));
const BY_ID = new Map<string, MegaForm>(MEGA_FORMES.map((mega) => [mega.id, mega]));

const BY_BASE = new Map<string, MegaForm[]>();
for (const mega of MEGA_FORMES) {
  const list = BY_BASE.get(mega.baseSpeciesId);
  if (list) list.push(mega);
  else BY_BASE.set(mega.baseSpeciesId, [mega]);
}

/** The Mega a held stone triggers, keyed by the stone's item id. */
export function megaFormForItem(itemId: string): MegaForm | undefined {
  return BY_ITEM.get(normalizeId(itemId));
}

/** The Mega forme of the species with that id, or undefined if it has none. */
export function megaFormOf(speciesId: string): MegaForm | undefined {
  return BY_ID.get(normalizeId(speciesId));
}

/** Every Mega of a base species, in dex order (Charizard has two). */
export function megaFormsForBase(baseId: string): readonly MegaForm[] {
  return BY_BASE.get(normalizeId(baseId)) ?? [];
}

/** True when the id names a Mega forme rather than a playable species. */
export function isMegaSpecies(speciesId: string): boolean {
  return BY_ID.has(normalizeId(speciesId));
}

/** Resolves a stone's item id to its base species id, or undefined. */
export function megaBaseForItem(itemId: string): string | undefined {
  return BY_ITEM.get(normalizeId(itemId))?.baseSpeciesId;
}

/** Guards that the Mega entry's base species is really the one holding the stone. */
export function megaMatchesSpecies(itemId: string, speciesId: string): boolean {
  const mega = megaFormForItem(itemId);
  if (!mega) return false;
  const species = getSpecies(speciesId);
  return species !== undefined && species.id === mega.baseSpeciesId;
}
