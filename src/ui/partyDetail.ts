import {
  getAbility,
  getMove,
  getNature,
  getSpecies,
  type MoveCategory,
  type StatId,
  type Stats,
} from '../data/dex';
import { getBiome } from '../data/biomes';
import { abilityText } from '../data/abilityText';
import { t, type TranslationKey } from '../i18n';
import {
  restoreFighter,
  type BattleFighter,
  type MoveSlot,
  type StatusId,
} from '../engine/battle/fighter';
import { effectiveMoveType } from '../engine/battle/moveType';
import { getItem } from '../data/items';
import { moveMoves, type CatchLocation, type RunPokemon, type RunState } from '../engine/run';
import { statusAbbreviation } from './metrics';
import { evolutionGraph, type FamilyNode } from './evolutionGraph';

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
  desc: string;
  /** Printed power (0 for a status move), the same for its base. */
  power: number;
  basePower: number;
  /** Printed hit chance, or null when the move never misses. */
  accuracy: number | null;
  baseAccuracy: number | null;
  /** Primary status the move inflicts, for the info popup badge. */
  status: string | null;
}>;

/**
 * Which way a nature pushes a stat: `up` (+10%), `down` (-10%) or `neutral`. HP
 * is never affected, so a nature always reads neutral on it.
 */
export type NatureEffect = 'up' | 'down' | 'neutral';

export function natureEffect(nature: string, stat: StatId): NatureEffect {
  const entry = getNature(nature);
  if (!entry) return 'neutral';
  if (entry.plus === stat) return 'up';
  if (entry.minus === stat) return 'down';
  return 'neutral';
}

/** The tints the STATS tab paints a nature-boosted or nature-lowered stat. */
export const NATURE_UP_TINT = 0x2f9e44;
export const NATURE_DOWN_TINT = 0xd6453f;

/** Everything the panel shows for one member, in the shape the tabs draw. */
export type MemberDetail = Readonly<{
  id: string;
  speciesId: string;
  name: string;
  /** The member's nickname, or null when it shows its species name. */
  nickname: string | null;
  level: number;
  types: readonly string[];
  nature: string;
  ability: string;
  /**
   * The ability's one-line description: the hand-authored override in
   * `src/data/abilityText.ts` when the id has one, else the dex's text read from
   * `dex/abilities.ts` (`shortDesc`, falling back to `desc`), or null when the
   * id is unknown.
   */
  abilityDesc: string | null;
  hp: number;
  maxHp: number;
  status: StatusId | null;
  statusLabel: string | null;
  heldItemName: string | null;
  stats: Readonly<Record<StatId, number>>;
  moves: readonly MoveDetail[];
  /** Where the member was caught ("Deep Forest · Map 1 · Route 2"), or null. */
  caughtLabel: string | null;
  /** The member's evolution family as a graph, for the STATS tab. */
  evolutions: readonly FamilyNode[];
}>;

/** The battle stats the STATS tab lists, in draw order (HP is the bar). */
export const DETAIL_STATS: readonly StatId[] = ['atk', 'def', 'spa', 'spd', 'spe'];

/** The stat rows' labels, keyed: the panel resolves them as it draws each row. */
export const STAT_LABELS: Readonly<Record<StatId, TranslationKey>> = {
  hp: 'detail.stat.hp',
  atk: 'detail.stat.atk',
  def: 'detail.stat.def',
  spa: 'detail.stat.spa',
  spd: 'detail.stat.spd',
  spe: 'detail.stat.spe',
};

/** The stat label in the current locale, resolved as the row is drawn. */
export function statLabel(stat: StatId): string {
  return t(STAT_LABELS[stat]);
}

export { typeColor, typeTint } from './typeColors';

// The first match is the only match: `nextMemberId` (src/engine/run/state.ts) keeps ids unique.
function memberById(run: RunState, id: string): RunPokemon | undefined {
  return (
    run.party.find((member) => member.fighter.id === id) ??
    run.box.find((member) => member.fighter.id === id) ??
    run.rip.find((member) => member.fighter.id === id)
  );
}

function moveDetails(
  slots: readonly MoveSlot[],
  ability: string,
  heldItem: string | null,
  ivs: Partial<Stats> | null | undefined,
): MoveDetail[] {
  return slots.map((slot) => {
    const move = getMove(slot.moveId);
    const accuracy = move && move.accuracy !== true ? move.accuracy : null;
    const basePower = move?.basePower ?? 0;
    return {
      moveId: slot.moveId,
      name: move?.name ?? slot.moveId,
      type: move ? effectiveMoveType(ability, heldItem, move, ivs) : '',
      category: move?.category ?? 'Status',
      pp: slot.pp,
      maxPp: slot.maxPp,
      desc: move?.shortDesc ?? move?.desc ?? '',
      power: basePower,
      basePower,
      accuracy,
      baseAccuracy: accuracy,
      status: move?.status ?? null,
    };
  });
}

/** The member's panel data, or null when the id matches no party/box member. */
export function memberDetail(run: RunState, memberId: string): MemberDetail | null {
  const member = memberById(run, memberId);
  if (!member) return null;
  return {
    ...fighterDetail(restoreFighter(member.fighter)),
    caughtLabel: catchLabel(member.caughtAt),
    evolutions: evolutionGraph(member.fighter.speciesId, member.fighter.level),
  };
}

/** "Deep Forest · Map 1 · Route 2" for a caught member, or null for the starter. */
function catchLabel(caughtAt: CatchLocation | undefined): string | null {
  if (!caughtAt) return null;
  return t('detail.caught', {
    biome: getBiome(caughtAt.biomeId).name,
    map: caughtAt.mapIndex,
    route: caughtAt.routeInMap + 1,
  });
}

/**
 * The ability's one-line text: the hand-authored override first, then the dex,
 * or null when the id is unknown or both dex halves are blank.
 */
function abilityDescription(id: string): string | null {
  const override = abilityText(id);
  if (override) return override;
  const ability = getAbility(id);
  if (!ability) return null;
  return ability.shortDesc || ability.desc || null;
}

/**
 * The panel data for a live fighter. The HUD resolves it through `memberDetail`;
 * the battle passes its own party fighters straight in, so both draw the same
 * STATS / MOVES window. The level shown is the squad's shared level.
 */
export function fighterDetail(fighter: BattleFighter): MemberDetail {
  const species = getSpecies(fighter.speciesId);
  const held = fighter.heldItem ? getItem(fighter.heldItem) : undefined;
  return {
    id: fighter.id,
    speciesId: fighter.speciesId,
    name: fighter.nickname ?? species?.name ?? fighter.speciesId,
    nickname: fighter.nickname,
    level: fighter.level,
    types: species?.types ?? fighter.types,
    nature: fighter.nature,
    ability: fighter.ability,
    abilityDesc: abilityDescription(fighter.ability),
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    status: fighter.status,
    statusLabel: statusAbbreviation(fighter.status),
    heldItemName: held?.name ?? fighter.heldItem,
    stats: fighter.stats,
    moves: moveDetails(fighter.moves, fighter.ability, fighter.heldItem, fighter.ivs),
    caughtLabel: null,
    // A live battle fighter has no run around it to evolve from; the in-battle
    // panel only reads stats and moves, so the branch list stays empty.
    evolutions: [],
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

export const DETAIL_TABS: readonly DetailTab[] = ['stats', 'moves'];

/** The tab `delta` steps away from `tab`, wrapping. */
export function nextDetailTab(tab: DetailTab, delta: number): DetailTab {
  const index = DETAIL_TABS.indexOf(tab);
  const next = (((index + delta) % DETAIL_TABS.length) + DETAIL_TABS.length) % DETAIL_TABS.length;
  return DETAIL_TABS[next];
}

/** What a keyboard stop of the open detail panel points at. */
export type DetailStopKind = 'name' | 'ability' | 'evolution' | 'search' | 'slot' | 'pool';

export type DetailStop = Readonly<{ kind: DetailStopKind; index: number }>;

/**
 * The ordered stops of a tab:
 *  - `stats`: one `name`, one `ability`, then one `evolution` per ready branch
 *    (`counts.evolutions`).
 *  - `moves`: one `search`, then `counts.slots` `slot` stops, then `counts.pool` `pool` stops.
 */
export function detailStops(
  tab: DetailTab,
  counts: Readonly<{ evolutions: number; slots: number; pool: number }>,
): readonly DetailStop[] {
  const stops: DetailStop[] = [];
  if (tab === 'stats') {
    stops.push({ kind: 'name', index: 0 }, { kind: 'ability', index: 0 });
    for (let i = 0; i < Math.max(0, Math.trunc(counts.evolutions)); i++) {
      stops.push({ kind: 'evolution', index: i });
    }
    return stops;
  }
  stops.push({ kind: 'search', index: 0 });
  for (let i = 0; i < Math.max(0, Math.trunc(counts.slots)); i++) stops.push({ kind: 'slot', index: i });
  for (let i = 0; i < Math.max(0, Math.trunc(counts.pool)); i++) stops.push({ kind: 'pool', index: i });
  return stops;
}

/** The stop `delta` away from `index`, wrapping; 0 for an empty list. */
export function stepStop(stops: readonly DetailStop[], index: number, delta: number): number {
  const count = stops.length;
  if (count === 0) return 0;
  const from = Number.isFinite(index) ? Math.trunc(index) : 0;
  const current = Math.min(Math.max(0, from), count - 1);
  return (((current + delta) % count) + count) % count;
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
