import gmaxesData from './gmaxes.json';
import { normalizeId, type Species } from './species';

/** A generated G-Max forme: a battle-only `Species` plus the species it changes from. */
export type GmaxForm = Species & Readonly<{ baseSpeciesId: string }>;

export const GMAX_FORMES: readonly GmaxForm[] = gmaxesData as unknown as readonly GmaxForm[];

const BY_ID = new Map<string, GmaxForm>(GMAX_FORMES.map((form) => [form.id, form]));
// One G-Max forme per species (`scripts/build-dex.mjs` refuses a duplicate base),
// which is what `gmaxFormForBase` promises.
const BY_BASE = new Map<string, GmaxForm>(
  GMAX_FORMES.map((form) => [form.baseSpeciesId, form] as const),
);

/** The G-Max forme whose id is `speciesId`, or undefined. */
export function gmaxFormOf(speciesId: string): GmaxForm | undefined {
  return BY_ID.get(normalizeId(speciesId));
}

/** The G-Max forme the species `baseId` may take, or undefined (one per species). */
export function gmaxFormForBase(baseId: string): GmaxForm | undefined {
  return BY_BASE.get(normalizeId(baseId));
}

/** True when the id names a G-Max forme rather than a playable species. */
export function isGmaxSpecies(speciesId: string): boolean {
  return BY_ID.has(normalizeId(speciesId));
}
