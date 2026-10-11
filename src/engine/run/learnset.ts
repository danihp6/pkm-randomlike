import { learnableBy, levelUpMoves } from '../../data/dex/learnsets';
import { getMove } from '../../data/dex/moves';
import { tmItemIdForMove } from '../../data/tms';
import { randomLevelUpMoves } from '../battle/randomLearnset';
import { MAX_MOVES, type RunPokemon } from './progression';
import { itemCount, updatePokemon, type RunState } from './state';

/**
 * The learnset panel's pure model (`docs/design-spec.md` §5). It answers what a
 * run member may equip right now: every level-up move it has already learned but
 * is **not** holding in one of its four slots, plus every move a TM **in the bag**
 * teaches it. The route HUD only draws what this returns; a drop onto a move slot
 * goes through `equipMove`, so learning is a pure, testable edit.
 *
 * The available moves follow the run's randomized learnset (`D17`), so the moves
 * a species can be taught stay fixed for the whole run, like its level-up moves.
 */

export type LearnSourceKind = 'level' | 'tm';

/** One move the panel offers and where it comes from. */
export type LearnEntry = Readonly<{
  moveId: string;
  source: LearnSourceKind;
  /** The level a level-up move was learned at; null for a TM move. */
  level: number | null;
  /** The bag machine that teaches a TM move; null for a level-up move. */
  tmId: string | null;
}>;

/** The level-up moves a species knows at `level`, oldest first and deduplicated. */
function levelPool(
  speciesId: string,
  level: number,
  learnsetSeed?: string,
): readonly Readonly<{ moveId: string; level: number | null }>[] {
  const source = learnsetSeed
    ? randomLevelUpMoves(speciesId, level, learnsetSeed)
    : levelUpMoves(speciesId, level);
  const seen = new Set<string>();
  const moves: { moveId: string; level: number | null }[] = [];
  for (const entry of source) {
    if (seen.has(entry.moveId)) continue;
    seen.add(entry.moveId);
    moves.push({ moveId: entry.moveId, level: entry.level });
  }
  return moves;
}

/**
 * The moves a species can learn by TM. Unlike the level-up moves this reads the
 * **canon** learnset, not the randomized one: compatibility has to match the real
 * TM items in the bag, and D17's random TM slots name moves that no machine
 * teaches. The randomized learnset still drives level-up moves.
 */
function tmPool(speciesId: string): readonly string[] {
  return learnableBy(speciesId, 'tm');
}

/**
 * Everything `member` may equip: its learned level-up moves and the TM moves the
 * run's bag can teach it, minus the moves already in its four slots. A move that
 * is both (a TM it already learned) appears once, as the free level-up move.
 * Moves whose id the dex cannot resolve drop out.
 */
export function learnsetPool(run: RunState, member: RunPokemon, learnsetSeed?: string): LearnEntry[] {
  const { speciesId, level, moves } = member.fighter;
  const equipped = new Set(moves.map((slot) => slot.moveId));
  const entries: LearnEntry[] = [];
  const seen = new Set<string>();
  const push = (entry: LearnEntry): void => {
    if (equipped.has(entry.moveId) || seen.has(entry.moveId) || !getMove(entry.moveId)) return;
    seen.add(entry.moveId);
    entries.push(entry);
  };
  for (const learned of levelPool(speciesId, level, learnsetSeed)) {
    push({ moveId: learned.moveId, source: 'level', level: learned.level, tmId: null });
  }
  for (const moveId of tmPool(speciesId)) {
    const tmId = tmItemIdForMove(moveId);
    if (!tmId || itemCount(run, tmId) <= 0) continue;
    push({ moveId, source: 'tm', level: null, tmId });
  }
  entries.sort(compareEntries);
  return entries;
}

/** Level-up moves first (oldest first), then TM moves; ties broken by name. */
function compareEntries(a: LearnEntry, b: LearnEntry): number {
  if (a.source !== b.source) return a.source === 'level' ? -1 : 1;
  if (a.source === 'level' && b.source === 'level' && a.level !== b.level) {
    return (a.level ?? 0) - (b.level ?? 0);
  }
  const nameA = getMove(a.moveId)?.name ?? a.moveId;
  const nameB = getMove(b.moveId)?.name ?? b.moveId;
  return nameA.localeCompare(nameB);
}

/** The pool entry for `moveId`, or null when the member cannot equip it. */
export function poolEntry(
  run: RunState,
  member: RunPokemon,
  moveId: string,
  learnsetSeed?: string,
): LearnEntry | null {
  return learnsetPool(run, member, learnsetSeed).find((entry) => entry.moveId === moveId) ?? null;
}

/**
 * Equips a move into a slot, replacing whatever sits there with a fresh PP. Only a
 * move the panel offers may be equipped, so a move already in the slots or one the
 * member cannot learn is a no-op and the run comes back untouched. Pure, like the
 * rest of the run state (D11).
 */
export function equipMove(
  run: RunState,
  memberId: string,
  moveId: string,
  slot: number,
  learnsetSeed?: string,
): RunState {
  const member =
    run.party.find((entry) => entry.fighter.id === memberId) ??
    run.box.find((entry) => entry.fighter.id === memberId);
  if (!member || slot < 0 || slot >= MAX_MOVES) return run;
  if (!poolEntry(run, member, moveId, learnsetSeed)) return run;
  const move = getMove(moveId);
  if (!move) return run;
  const moves = member.fighter.moves.map((entry) => ({ ...entry }));
  const fresh = { moveId: move.id, pp: move.pp, maxPp: move.pp };
  // A drop on the tail (an empty slot past a short moveset) appends; a drop on
  // a real slot replaces it.
  if (slot < moves.length) moves[slot] = fresh;
  else moves.push(fresh);
  return updatePokemon(run, { ...member, fighter: { ...member.fighter, moves } });
}
