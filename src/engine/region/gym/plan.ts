import type { PuzzleStackEntry } from '../../../data/puzzles';
import { planInterior, type InteriorPlan } from '../interior';
import { nodeOf, type RegionPlan } from '../plan';
import { nodeStreams } from '../streams';
import { planIceRoom, type IceRoom } from './ice';
import { gymPuzzlesFor } from './stack';

/**
 * The gym a city node holds (`docs/region-spec.md` §7.4): its four rooms from the
 * interior generator, the puzzle its badge's stack lets it roll, and the one
 * `pickedItems` key a solved room is remembered by.
 *
 * Everything the puzzle needs is rolled off the gym's **own sub-key** — `<cityKey>/gym`
 * for the stack row and `<cityKey>/gym/puzzle` for the floor — so a gym never moves the
 * city's content pass and a revisit replays the same room (`D11`, `D60`). The solved
 * state is a read of the run, never a regenerated flag: `planGym` is deep-equal on every
 * call, and `gymSolved` only asks whether the run carries its key.
 */

/** The puzzle a gym carries. */
export type GymPuzzlePlan = Readonly<{
  /** The stack entry the node rolled. */
  entry: PuzzleStackEntry;
  /** The ice floor, when the entry is `'ice'`; `null` for a future entry with no floor yet. */
  ice: IceRoom | null;
}>;

export type GymPlan = Readonly<{
  /** The gym city's node key, `city:<n>`. */
  cityKey: string;
  /** The gym's four rooms, exactly as `planInterior(plan, 'gym', cityKey)` emits them. */
  interior: InteriorPlan;
  puzzle: GymPuzzlePlan;
  /** The mark a solved room leaves in `RunState.pickedItems`: `gym-solved:<cityKey>`. */
  solvedKey: string;
}>;

/** `gym-solved:<cityKey>` — the one key a solved gym is remembered by. */
export function gymSolvedKey(cityKey: string): string {
  return `gym-solved:${cityKey}`;
}

/** The floor the entry's own module lays, or `null` for an entry with no floor yet. */
function planFloor(
  plan: RegionPlan,
  cityKey: string,
  interior: InteriorPlan,
  entry: PuzzleStackEntry,
): IceRoom | null {
  if (entry.id !== 'ice') return null;
  const rooms = interior.rooms ?? [];
  const puzzleRoom = rooms[2];
  const landingRoom = rooms[entry.dropsInto];
  // A gym's rooms 1-3 all carry a `doorIn`; the entrance's own entry is the fallback a
  // total plan keeps, and it only moves the hole sites, never the room's geometry.
  if (puzzleRoom === undefined || landingRoom === undefined) return null;

  return planIceRoom(
    {
      rect: puzzleRoom.rect,
      entry: puzzleRoom.doorIn ?? interior.entry,
      landingRoom: entry.dropsInto,
      landingRect: landingRoom.rect,
      holes: entry.holes,
    },
    nodeStreams(plan.seed, `${cityKey}/gym/puzzle`).content,
  );
}

/** The gym a city node holds, or a throw when the key is not a gym city. */
export function planGym(plan: RegionPlan, cityKey: string): GymPlan {
  const node = nodeOf(plan, cityKey);
  if (node === undefined || !node.gym) throw new Error(`not a gym: ${cityKey}`);

  const eligible = gymPuzzlesFor(node.badge);
  if (eligible.length === 0) throw new Error(`no gym puzzle for badge ${node.badge}: ${cityKey}`);
  const entry = eligible[nodeStreams(plan.seed, `${cityKey}/gym`).content.int(0, eligible.length - 1)];

  const interior = planInterior(plan, 'gym', cityKey);
  return {
    cityKey,
    interior,
    puzzle: { entry, ice: planFloor(plan, cityKey, interior, entry) },
    solvedKey: gymSolvedKey(cityKey),
  };
}

/** True when the run's marks already carry this gym's `solvedKey`. Never re-rolls anything. */
export function gymSolved(run: Readonly<{ pickedItems: readonly string[] }>, gym: GymPlan): boolean {
  return run.pickedItems.includes(gym.solvedKey);
}
