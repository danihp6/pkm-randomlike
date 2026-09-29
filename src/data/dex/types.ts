import typesData from './types.json';
import { normalizeId } from './species';

export type TypeName = string;

const TYPES = typesData as unknown as readonly Readonly<{
  id: string;
  name: string;
  damageTaken: Readonly<Record<string, number>>;
}>[];

const NON_BATTLE_TYPES = new Set(['stellar']);

export const TYPE_NAMES: readonly TypeName[] = TYPES.filter(
  (type) => !NON_BATTLE_TYPES.has(type.id),
).map((type) => type.name);

const TYPE_IDS = new Set(TYPE_NAMES.map(normalizeId));

// Showdown stores the defensive chart as 0 = neutral, 1 = 2x, 2 = 0.5x, 3 = 0x.
const MULTIPLIER_BY_DAMAGE_TAKEN: Readonly<Record<number, number>> = {
  0: 1,
  1: 2,
  2: 0.5,
  3: 0,
};

// Defender id -> (attacking type id -> damage-taken code), both normalized.
const CHART = new Map<string, Map<string, number>>(
  TYPES.map((type) => [
    normalizeId(type.id),
    new Map(
      Object.entries(type.damageTaken).map(([attacker, code]) => [normalizeId(attacker), code]),
    ),
  ]),
);

export function isTypeName(name: string): boolean {
  return TYPE_IDS.has(normalizeId(name));
}

export function effectiveness(attackType: TypeName, defenderTypes: readonly TypeName[]): number {
  const attack = normalizeId(attackType);
  let multiplier = 1;
  for (const defenderType of defenderTypes) {
    const code = CHART.get(normalizeId(defenderType))?.get(attack);
    multiplier *= code === undefined ? 1 : (MULTIPLIER_BY_DAMAGE_TAKEN[code] ?? 1);
  }
  return multiplier;
}
