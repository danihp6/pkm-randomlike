import { learnableBy, levelUpMoves } from '../../data/dex/learnsets';
import { getMove } from '../../data/dex/moves';
import { tmItemIdForMove } from '../../data/tms';
import { randomLevelUpMoves } from '../battle/randomLearnset';
import { MAX_MOVES, type RunPokemon } from './progression';
import { itemCount, updatePokemon, type RunState } from './state';

/**
 * The learnset panel's pure model (`docs/design-spec.md` §5). It answers what a
 * run member may equip right now: every level-up move it has already learned
 * (even one it has since dropped for a fourth slot) plus every move a TM **in the
 * bag** teaches it. The route HUD only draws what this returns; a drop onto a
 * move slot goes through `equipMove`, so learning is a pure, testable edit.
 *
 * The available moves follow the run's randomized learnset (`D17`), so the moves
 * a species can be taught stay fixed for the whole run, like its level-up moves.
 */

export type LearnSourceKind = 'level' | 'tm';

/** One move the panel offers: where it comes from and whether it is slotted. */
export type LearnEntry = Readonly<{
  moveId: string;
  source: LearnSourceKind;
  /** The level a level-up move was learned at; null for a TM move. */
  level: number | null;
  /** The bag machine that teaches a TM move; null for a level-up move. */
  tmId: string | null;
  /** The move slot it sits in (0..3), or null when it is on the bench. */
  slot: number | null;
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
 * run's bag can teach it. A move that is both (a TM it already learned) appears
 * once, as the free level-up move. Moves whose id the dex cannot resolve drop out.
 */
export function learnsetPool(run: RunState, member: RunPokemon, learnsetSeed?: string): LearnEntry[] {
  const { speciesId, level, moves } = member.fighter;
  const inSlot = new Map<string, number>();
  moves.forEach((slot, index) => inSlot.set(slot.moveId, index));
  const entries: LearnEntry[] = [];
  const seen = new Set<string>();
  const push = (entry: LearnEntry): void => {
    if (seen.has(entry.moveId) || !getMove(entry.moveId)) return;
    seen.add(entry.moveId);
    entries.push(entry);
  };
  for (const learned of levelPool(speciesId, level, learnsetSeed)) {
    push({
      moveId: learned.moveId,
      source: 'level',
      level: learned.level,
      tmId: null,
      slot: inSlot.get(learned.moveId) ?? null,
    });
  }
  for (const moveId of tmPool(speciesId)) {
    const tmId = tmItemIdForMove(moveId);
    if (!tmId || itemCount(run, tmId) <= 0) continue;
    push({ moveId, source: 'tm', level: null, tmId, slot: inSlot.get(moveId) ?? null });
  }
  // Every move the member already holds is offered too, even one the learnset
  // no longer covers (an old save, a since-sold TM), so a swap can always be
  // undone. Its level comes from the learnset when known, else null.
  for (const slot of moves) {
    const learned = learnedLevel(speciesId, level, slot.moveId, learnsetSeed);
    push({
      moveId: slot.moveId,
      source: 'level',
      level: learned,
      tmId: null,
      slot: inSlot.get(slot.moveId) ?? null,
    });
  }
  entries.sort(compareEntries);
  return entries;
}

/** The level a member learned `moveId` at, or null when the learnset cannot say. */
function learnedLevel(
  speciesId: string,
  level: number,
  moveId: string,
  learnsetSeed?: string,
): number | null {
  const source = learnsetSeed
    ? randomLevelUpMoves(speciesId, level, learnsetSeed)
    : levelUpMoves(speciesId, level);
  return source.find((entry) => entry.moveId === moveId)?.level ?? null;
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
 * Equips a move into a slot. Dropping a benched or TM move onto a slot makes that
 * slot the new move (fresh PP); dropping a move already in **another** slot swaps
 * the two, so the four slots never hold a duplicate. A move the member cannot
 * equip, an unknown member or an out-of-range slot is a no-op, so the run comes
 * back untouched. Pure, like the rest of the run state (D11).
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
  const moves = member.fighter.moves.map((entry) => ({ ...entry }));
  const current = moves.findIndex((entry) => entry.moveId === moveId);
  if (current === slot) return run;
  if (current >= 0) {
    const swap = moves[slot];
    moves[slot] = moves[current];
    moves[current] = swap;
  } else {
    const move = getMove(moveId);
    if (!move) return run;
    const fresh = { moveId: move.id, pp: move.pp, maxPp: move.pp };
    // A drop on the tail (an empty slot past a short moveset) appends; a drop on
    // a real slot replaces it.
    if (slot < moves.length) moves[slot] = fresh;
    else moves.push(fresh);
  }
  return updatePokemon(run, { ...member, fighter: { ...member.fighter, moves } });
}
