/**
 * The **banned-species** room's own table (`docs/maps-spec.md` §7, D47): the first
 * floor that may hang the leaf, the chance it does and the archetype its trainer
 * fields. Pure data: the map generator rolls the leaf off its own stream, and the
 * ban itself is a read over the run's own `battlesUsed` counters, never a table.
 */

export type BannedRoomConfig = Readonly<{
  /** The first map whose floor may hang the leaf. */
  fromMap: number;
  /** Chance the floor hangs it, drawn on the leaf's own minted stream. */
  chance: number;
  /** The room trainer's archetype id (`src/data/trainers.ts`). */
  archetypeId: string;
}>;

export const BANNED_ROOM: BannedRoomConfig = {
  fromMap: 3,
  chance: 0.2,
  archetypeId: 'blackbelt',
};
