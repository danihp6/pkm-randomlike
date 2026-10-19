/**
 * The **no-heal** room's own table (`docs/maps-spec.md` §7, D47): the first floor
 * that may hang the leaf, the chance it does, the archetype its trainer fields and
 * the move ids the room bars **for the player**. Pure data: the map generator
 * rolls the leaf off its own stream and the battle engine reads the list, so the
 * room's whole balance surface is one table a later pass re-tunes here.
 */

export type NoHealRoomConfig = Readonly<{
  /** The first map whose floor may hang the leaf. */
  fromMap: number;
  /** Chance the floor hangs it, drawn on the map stream. */
  chance: number;
  /** The room trainer's archetype id (`src/data/trainers.ts`). */
  archetypeId: string;
}>;

export const NO_HEAL_ROOM: NoHealRoomConfig = {
  fromMap: 3,
  chance: 0.2,
  archetypeId: 'psychic',
};

/**
 * The move ids the room bars for the player, in three groups: the six self-heals,
 * the effect-handled heals (the sunny/weather percentage heals, Shore Up, Rest,
 * Jungle Healing, Lunar Blessing and Swallow) and the draining attacks. A move
 * that restores no HP in this engine (`wish`, `leechseed`, `healbell`…) is left
 * out on purpose: the room bars what it can actually refuse.
 */
export const BARRED_HEALING_MOVES: readonly string[] = [
  'recover',
  'softboiled',
  'slackoff',
  'milkdrink',
  'roost',
  'lifedew',
  'synthesis',
  'moonlight',
  'morningsun',
  'shoreup',
  'rest',
  'junglehealing',
  'lunarblessing',
  'swallow',
  'absorb',
  'megadrain',
  'gigadrain',
  'drainpunch',
  'drainingkiss',
  'dreameater',
  'hornleech',
  'leechlife',
  'oblivionwing',
  'paraboliccharge',
];

const BARRED: ReadonlySet<string> = new Set(BARRED_HEALING_MOVES);

/** True when the room refuses `moveId` for the player. */
export function isBarredHealingMove(moveId: string): boolean {
  return BARRED.has(moveId);
}
