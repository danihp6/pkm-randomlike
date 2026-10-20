import type { GateKind } from './gates';

/**
 * The **static-species** room's own table (`docs/maps-spec.md` §7): the first
 * floor that may hang the leaf, the chance it does, its legendary variant's own
 * roll, the property that opens each seal and the two species lists. Pure data:
 * the map generator rolls the leaf off its own stream and
 * `src/engine/routes/staticSpecies.ts` reads the rest, so the room's whole balance
 * surface is this table.
 */

/** What opens a static leaf's seal: a party **type** or a party **feature** (an ability). */
export type StaticGateKind = 'type' | 'feature';

/**
 * One row of the gate table: the property, and the ids one party member may carry to
 * satisfy it (a **list**, so "Bug or Grass" is data, never a branch).
 */
export type StaticGate = Readonly<{ kind: StaticGateKind; values: readonly string[] }>;

/** The first floor that may hang the leaf, and the chance it does. */
export type StaticRoomConfig = Readonly<{ fromMap: number; chance: number }>;

/** The leaf's own roll, on its `${seed}:map:<floor>:static-room` stream. */
export const STATIC_ROOM: StaticRoomConfig = { fromMap: 3, chance: 0.25 };

/** The variant's conditional roll, on its `${seed}:map:<floor>:static-variant:<room>` stream. */
export const LEGENDARY_ROOM: StaticRoomConfig = { fromMap: 4, chance: 0.25 };

/**
 * The seal's row, keyed by the kind the shipped carve chose (`gateKindFor`). The two
 * type rows pair with the gated leaf's art (a bush yields to Bug or Grass, a boulder
 * to Rock or Fighting); the pond is the **feature** row, opened by an ability.
 */
export const STATIC_GATES: Readonly<Record<GateKind, StaticGate>> = {
  bush: { kind: 'type', values: ['Bug', 'Grass'] },
  rock: { kind: 'type', values: ['Rock', 'Fighting'] },
  water: { kind: 'feature', values: ['Water Absorb', 'Swift Swim', 'Storm Drain'] },
};

/** The first stage of each pseudo-legendary line: a real long-term investment. */
export const STATIC_SPECIES: readonly string[] = [
  'dratini',
  'larvitar',
  'bagon',
  'gible',
  'deino',
  'goomy',
  'dreepy',
  'frigibax',
];

/**
 * The legendary variant's own list, **never** `speciesPool`: this is the documented
 * bypass of `WILD_BANNED_TAGS`, so it must not widen the ordinary wild pool by one
 * species (`src/engine/run/pool.ts`).
 */
export const LEGENDARY_SPECIES: readonly string[] = ['articuno', 'zapdos', 'moltres', 'mewtwo'];
