import abilitiesData from './abilities.json';
import { CUSTOM_ABILITIES, type CustomAbility } from './customAbilities';

/** The dex's own ability row: the id, its name and the two description fields. */
export type Ability = Readonly<{
  id: string;
  name: string;
  /** The long description; may be absent in the generated row. */
  desc: string;
  /** The one-line description; may be absent in the generated row. */
  shortDesc: string;
}>;

type GeneratedAbility = Readonly<{ id: string; name: string; desc?: string; shortDesc?: string }>;

function normalizeAbilityId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// The generated JSON is cast once here; `dex.test.ts` guards the row count. Both
// description fields are absent on some rows, so they are coerced to '' once and
// a consumer can read them without a guard.
const ALL_ABILITIES: readonly Ability[] = (
  abilitiesData as unknown as readonly GeneratedAbility[]
).map((ability) => ({
  id: ability.id,
  name: ability.name,
  desc: ability.desc ?? '',
  shortDesc: ability.shortDesc ?? '',
}));

const BY_ID = new Map<string, Ability>(ALL_ABILITIES.map((ability) => [ability.id, ability]));

// The hand-authored rows join at lookup, never in the generated set: `meta.json`
// counts them apart (`counts.customAbilities`), so a regeneration cannot lose one
// and the dex's own count of 311 keeps its meaning.
const CUSTOM_BY_ID = new Map<string, CustomAbility>(
  CUSTOM_ABILITIES.map((ability) => [normalizeAbilityId(ability.id), ability]),
);

const ALL_WITH_CUSTOM: readonly Ability[] = [...ALL_ABILITIES, ...CUSTOM_ABILITIES];

/** The generated row wins if an id ever appears in both sets. */
export function getAbility(id: string): Ability | undefined {
  const key = normalizeAbilityId(id);
  return BY_ID.get(key) ?? CUSTOM_BY_ID.get(key);
}

export function getCustomAbility(id: string): CustomAbility | undefined {
  return CUSTOM_BY_ID.get(normalizeAbilityId(id));
}

export function allAbilities(): readonly Ability[] {
  return ALL_ABILITIES;
}

export function allAbilitiesWithCustom(): readonly Ability[] {
  return ALL_WITH_CUSTOM;
}
