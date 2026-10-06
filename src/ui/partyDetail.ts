import { getMove, getSpecies, type MoveCategory, type StatId } from '../data/dex';
import { restoreFighter, type BattleFighter, type MoveSlot } from '../engine/battle/fighter';
import { getItem } from '../data/items';
import { moveMoves, type RunPokemon, type RunState } from '../engine/run';
import { statusAbbreviation } from './metrics';

/**
 * The party detail panel (Phase 6): a click on a party or PC-box member opens a
 * window with two tabs — STATS and MOVES — and the moves can be dragged to
 * reorder them. The view model and the tab/grab state are pure so the route
 * scene only draws what these return (like `partyScreen`).
 */

export type DetailTab = 'stats' | 'moves';

/** One move row: what the MOVES tab lists, with its type for colour-coding. */
export type MoveDetail = Readonly<{
  moveId: string;
  name: string;
  type: string;
  category: MoveCategory;
  pp: number;
  maxPp: number;
}>;

/** Everything the panel shows for one member, in the shape the tabs draw. */
export type MemberDetail = Readonly<{
  id: string;
  speciesId: string;
  name: string;
  level: number;
  types: readonly string[];
  nature: string;
  ability: string;
  hp: number;
  maxHp: number;
  statusLabel: string | null;
  xp: number;
  heldItemName: string | null;
  stats: Readonly<Record<StatId, number>>;
  moves: readonly MoveDetail[];
}>;

/** The battle stats the STATS tab lists, in draw order (HP is the bar). */
export const DETAIL_STATS: readonly StatId[] = ['atk', 'def', 'spa', 'spd', 'spe'];

export const STAT_LABELS: Readonly<Record<StatId, string>> = {
  hp: 'HP',
  atk: 'ATTACK',
  def: 'DEFENSE',
  spa: 'SP. ATK',
  spd: 'SP. DEF',
  spe: 'SPEED',
};

export { typeColor, typeTint } from './typeColors';

function memberById(run: RunState, id: string): RunPokemon | undefined {
  return run.party.find((member) => member.fighter.id === id) ?? run.box.find((member) => member.fighter.id === id);
}

function moveDetails(slots: readonly MoveSlot[]): MoveDetail[] {
  return slots.map((slot) => {
    const move = getMove(slot.moveId);
    return {
      moveId: slot.moveId,
      name: move?.name ?? slot.moveId,
      type: move?.type ?? '',
      category: move?.category ?? 'Status',
      pp: slot.pp,
      maxPp: slot.maxPp,
    };
  });
}

/** The member's panel data, or null when the id matches no party/box member. */
export function memberDetail(run: RunState, memberId: string): MemberDetail | null {
  const member = memberById(run, memberId);
  if (!member) return null;
  return fighterDetail(restoreFighter(member.fighter), member.xp);
}

/**
 * The panel data for a live fighter and the XP it carries. The HUD resolves it
 * through `memberDetail`; the battle passes its own party fighters straight in,
 * so both draw the same STATS / MOVES window.
 */
export function fighterDetail(fighter: BattleFighter, xp: number): MemberDetail {
  const species = getSpecies(fighter.speciesId);
  const held = fighter.heldItem ? getItem(fighter.heldItem) : undefined;
  return {
    id: fighter.id,
    speciesId: fighter.speciesId,
    name: species?.name ?? fighter.speciesId,
    level: fighter.level,
    types: species?.types ?? fighter.types,
    nature: fighter.nature,
    ability: fighter.ability,
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    statusLabel: statusAbbreviation(fighter.status),
    xp,
    heldItemName: held?.name ?? fighter.heldItem,
    stats: fighter.stats,
    moves: moveDetails(fighter.moves),
  };
}

/**
 * Which member the panel is showing (null when closed), which tab is active and
 * the move slot held while dragging a move to reorder it.
 */
export type DetailState = Readonly<{
  memberId: string | null;
  tab: DetailTab;
  grab: number | null;
}>;

export const CLOSED_DETAIL: DetailState = { memberId: null, tab: 'stats', grab: null };

export function openDetail(memberId: string, tab: DetailTab = 'stats'): DetailState {
  return { memberId, tab, grab: null };
}

export function closeDetail(state: DetailState): DetailState {
  return state.memberId === null ? state : CLOSED_DETAIL;
}

/** Switches tab and drops any move in hand, so a drag never survives a tab change. */
export function setDetailTab(state: DetailState, tab: DetailTab): DetailState {
  return state.tab === tab && state.grab === null ? state : { ...state, tab, grab: null };
}

export function grabMove(state: DetailState, index: number): DetailState {
  return state.grab === index ? state : { ...state, grab: index };
}

export function dropMove(state: DetailState): DetailState {
  return state.grab === null ? state : { ...state, grab: null };
}

/**
 * A drag of the held move to slot `to`: reorders the member's moves straight to
 * that slot. Out-of-range targets clamp; a no-op with no move in hand.
 */
export function reorderMoves(
  run: RunState,
  state: DetailState,
  to: number,
): Readonly<{ run: RunState; state: DetailState }> {
  const { memberId, grab } = state;
  if (memberId === null || grab === null) return { run, state };
  const member = memberById(run, memberId);
  if (!member) return { run, state };
  const target = Math.max(0, Math.min(member.fighter.moves.length - 1, to));
  if (target === grab) return { run, state };
  const next = moveMoves(run, memberId, grab, target);
  return next === run ? { run, state } : { run: next, state: { ...state, grab: target } };
}
