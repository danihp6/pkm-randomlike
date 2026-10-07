import abilitiesData from './abilities.json';

export type Ability = Readonly<{
  id: string;
  name: string;
}>;

// The generated JSON is cast once here; `dex.test.ts` guards the row count.
const ALL_ABILITIES = abilitiesData as unknown as readonly Readonly<{
  id: string;
  name: string;
}>[];

const BY_ID = new Map<string, Ability>(
  ALL_ABILITIES.map((ability) => [ability.id, { id: ability.id, name: ability.name }]),
);

export function getAbility(id: string): Ability | undefined {
  return BY_ID.get(id.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

export function allAbilities(): readonly Ability[] {
  return ALL_ABILITIES;
}
