import abilitiesData from './abilities.json';

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

export function getAbility(id: string): Ability | undefined {
  return BY_ID.get(id.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

export function allAbilities(): readonly Ability[] {
  return ALL_ABILITIES;
}
