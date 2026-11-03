import { PUZZLE_STACK, type PuzzleStackEntry } from '../../../data/puzzles';

/**
 * A gym's **puzzle stack** (`docs/region-spec.md` §7.4): the rows of `PUZZLE_STACK`, in
 * table order, that a gym of a given badge may carry. The stack is data
 * (`src/data/puzzles.ts`), so adding a puzzle is a row plus its own module and never a
 * branch here; every accessor is a pure read of the table.
 */

/** Every entry a gym of `badge` may carry, in stack order. */
export function gymPuzzlesFor(badge: number): readonly PuzzleStackEntry[] {
  return PUZZLE_STACK.filter((entry) => entry.fromBadge <= badge);
}

/** The entries' ids, in stack order (`['ice']` today). */
export function puzzleStackIds(): readonly string[] {
  return PUZZLE_STACK.map((entry) => entry.id);
}
