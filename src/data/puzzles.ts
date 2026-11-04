/**
 * The **puzzle** room's own table (`docs/maps-spec.md` §7, D47): the first floor
 * that may hang the leaf, the chance it does, and one row per switch sequence —
 * how many switches the room holds, the catalogue item a solve pays and the first
 * floor that may carry that row. Pure data: the retired floor plan rolled the leaf
 * off its own minted stream, and the row's layout and press rule read these rows
 * (`src/engine/routes/puzzle.ts`), so a re-tuned or added puzzle is a row here and
 * never an engine branch.
 */

/**
 * The **region's** gym puzzle table (`docs/region-spec.md` §7.4): one row per puzzle
 * a gym may carry, its room and the first badge that may roll it. `PUZZLES` below is
 * the retired floor room's table, kept until the sweep deletes it.
 */

/** One entry in a gym's puzzle stack: the puzzle and the room it fills. */
export type PuzzleStackEntry = Readonly<{
  /** The entry's only name. The stack's first entry is `'ice'`. */
  id: string;
  /** The gym room its floor takes over. A gym's rooms are `entrance`, `trainer`, `puzzle`, `leader`. */
  room: 'puzzle';
  /** The first badge whose gym may carry it (1-8). */
  fromBadge: number;
  /** How many holes the room's floor holds. */
  holes: number;
  /** The gym room a wrong step drops the player into, by index: `0` is `entrance`. */
  dropsInto: number;
}>;

/** A gym's puzzles, in stack order: the first eligible entry is the one a gym rolls first. */
export const PUZZLE_STACK: readonly PuzzleStackEntry[] = [
  { id: 'ice', room: 'puzzle', fromBadge: 1, holes: 3, dropsInto: 0 },
];

export type PuzzleRow = Readonly<{
  /** The row's id; also the plan's `rowId`. */
  id: string;
  /** How many switches the room holds (2..5). */
  switches: number;
  /** The catalogue id (`src/data/items.ts`) the solved room pays. */
  reward: string;
  /** The first map whose floor may carry the row. */
  fromMap: number;
  /** A wrong press sends the sequence back to 0 (the only shipped value is `true`). */
  wrongResets: boolean;
}>;

/** The leaf's own placement: the first floor that may hang it and its chance. */
export const PUZZLE_ROOM: Readonly<{ fromMap: number; chance: number }> = {
  fromMap: 2,
  chance: 0.2,
};

/**
 * One row per puzzle, in table order: the `three` row pays a Nugget on the
 * on-ramp, the `four` row a Big Nugget from the deep floors on. Both rewards are
 * existing `valuable` catalogue rows, so the room names no new item.
 */
export const PUZZLES: readonly PuzzleRow[] = [
  { id: 'three', switches: 3, reward: 'nugget', fromMap: 2, wrongResets: true },
  { id: 'four', switches: 4, reward: 'bignugget', fromMap: 5, wrongResets: true },
];

/** The rows `mapIndex` may carry, in table order. */
export function puzzleRowsForMap(mapIndex: number): readonly PuzzleRow[] {
  return PUZZLES.filter((row) => row.fromMap <= mapIndex);
}
