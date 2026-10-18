import { getSpecies } from '../data/dex';
import { getItem } from '../data/items';
import { restoreFighter, type StatusId } from '../engine/battle/fighter';
import {
  depositToBox,
  moveInBox,
  moveInParty,
  pcMemberEditable,
  swapPartyBox,
  withdrawToParty,
  type RunPokemon,
  type RunState,
} from '../engine/run';
import { statusAbbreviation } from './metrics';

/**
 * The party/PC model and input reducer (Phase 6). The route HUD only draws what
 * this returns and feeds it keys or the pointer, so reordering and moving members
 * between party and box stay pure and testable; the run mutations themselves live
 * in `engine/run/state.ts`.
 */

export type PaneId = 'party' | 'box' | 'rip';

/** The panes `left`/`right` walk with nothing grabbed, in cycle order. */
export const PANE_CYCLE: readonly PaneId[] = ['party', 'box', 'rip'];

/** The pane `delta` steps away from `pane` in `PANE_CYCLE`, wrapping both ways. */
export function cyclePane(pane: PaneId, delta: number): PaneId {
  const found = PANE_CYCLE.indexOf(pane);
  const index = found < 0 ? 0 : found;
  const next = (((index + delta) % PANE_CYCLE.length) + PANE_CYCLE.length) % PANE_CYCLE.length;
  return PANE_CYCLE[next];
}

/** One row: everything the party/PC list shows for a member. */
export type PartyRow = Readonly<{
  id: string;
  speciesId: string;
  /** The nickname when it has one, else the species name: one field, both draw sites. */
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  status: StatusId | null;
  statusLabel: string | null;
  heldItem: string | null;
  heldItemName: string | null;
  shiny: boolean;
}>;

export function partyRow(member: RunPokemon): PartyRow {
  const { fighter } = member;
  const held = fighter.heldItem ? getItem(fighter.heldItem) : undefined;
  return {
    id: fighter.id,
    speciesId: fighter.speciesId,
    name: fighter.nickname ?? getSpecies(fighter.speciesId)?.name ?? fighter.speciesId,
    level: fighter.level,
    hp: fighter.hp,
    maxHp: restoreFighter(fighter).maxHp,
    status: fighter.status,
    statusLabel: statusAbbreviation(fighter.status),
    heldItem: fighter.heldItem,
    heldItemName: held?.name ?? fighter.heldItem,
    shiny: fighter.shiny,
  };
}

export function partyRows(run: RunState): PartyRow[] {
  return run.party.map(partyRow);
}

export function boxRows(run: RunState): PartyRow[] {
  return run.box.map(partyRow);
}

/** One row per fallen member, in `RunState.rip` order, in the party/box row shape. */
export function ripRows(run: RunState): PartyRow[] {
  return run.rip.map(partyRow);
}

/**
 * Where the cursor is: a pane, a slot in it and — while a member is picked up —
 * the slot it started in, so `cancel` can put it back exactly where it was.
 */
export type PartyUiState = Readonly<{
  pane: PaneId;
  index: number;
  grabbed: Readonly<{ pane: PaneId; origin: number }> | null;
}>;

export type PartyInput = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel';

export function initialPartyUi(): PartyUiState {
  return { pane: 'party', index: 0, grabbed: null };
}

export type PartyInputResult = Readonly<{ run: RunState; ui: PartyUiState }>;

function listOf(run: RunState, pane: PaneId): readonly RunPokemon[] {
  if (pane === 'party') return run.party;
  return pane === 'rip' ? run.rip : run.box;
}

/** The member at a pane slot, or undefined for an empty slot. */
function memberAt(run: RunState, pane: PaneId, index: number): RunPokemon | undefined {
  return listOf(run, pane)[index];
}

/**
 * True when a member may be picked up. The party always reorders; a **box**
 * member is only grabbable while the PC is editable (`pcMemberEditable`), so a
 * locked PC cannot be rearranged. The box opens wholesale in the floor's entry
 * room on its first visit, and otherwise only for the route's own catch, while
 * the run still stands in the room it was caught in (`docs/routes-spec.md` §6).
 * The **RIP** pane is never grabbed: the dead are read-only (D5).
 */
function canGrab(run: RunState, pane: PaneId, index: number): boolean {
  if (pane === 'rip') return false;
  const member = memberAt(run, pane, index);
  if (!member) return false;
  return pane === 'party' || pcMemberEditable(run, member.fighter.id);
}

/** True when a grabbed member may cross between the party and the PC. */
function canSwapAcross(run: RunState, pane: PaneId, member: RunPokemon | undefined): boolean {
  if (pane === 'rip') return false;
  return member !== undefined && pcMemberEditable(run, member.fighter.id);
}

function reorder(run: RunState, pane: PaneId, from: number, to: number): RunState {
  if (pane === 'rip') return run;
  return pane === 'party' ? moveInParty(run, from, to) : moveInBox(run, from, to);
}

/** The first row a window of `rows` shows, kept around the cursor. */
export function windowStart(length: number, index: number, rows: number): number {
  if (rows <= 0 || length <= rows) return 0;
  const start = index - Math.floor(rows / 2);
  return Math.max(0, Math.min(length - rows, start));
}

/**
 * The whole screen as a reducer: a key in, the run and the cursor out. Picking a
 * member up (`confirm`) and moving it reorders its pane live; `left`/`right`
 * moves it to the other pane when the rules allow it (`deposit`/`withdraw`), and
 * `cancel` restores it to where the grab started. With nothing grabbed the
 * cursor wraps, `left`/`right` cycle party → box → RIP and `confirm` starts a grab.
 */
export function partyInput(run: RunState, ui: PartyUiState, input: PartyInput): PartyInputResult {
  const list = listOf(run, ui.pane);

  if (ui.grabbed) {
    const { pane, origin } = ui.grabbed;
    if (input === 'up' || input === 'down') {
      const to = ui.index + (input === 'up' ? -1 : 1);
      const next = reorder(run, pane, ui.index, to);
      return next === run ? { run, ui } : { run: next, ui: { ...ui, index: to } };
    }
    if (input === 'left' || input === 'right') {
      const toOther = pane === 'party' ? input === 'right' : input === 'left';
      if (!toOther) return { run, ui };
      if (!canSwapAcross(run, pane, memberAt(run, pane, ui.index))) return { run, ui };
      if (pane === 'party') {
        const next = depositToBox(run, ui.index);
        return next === run
          ? { run, ui }
          : { run: next, ui: { pane: 'box', index: run.box.length, grabbed: null } };
      }
      const next = withdrawToParty(run, ui.index);
      return next === run
        ? { run, ui }
        : { run: next, ui: { pane: 'party', index: run.party.length, grabbed: null } };
    }
    if (input === 'confirm') return { run, ui: { ...ui, grabbed: null } };
    return {
      run: reorder(run, pane, ui.index, origin),
      ui: { ...ui, pane, index: origin, grabbed: null },
    };
  }

  if (input === 'up' || input === 'down') {
    if (list.length === 0) return { run, ui };
    const delta = input === 'up' ? -1 : 1;
    const index = (ui.index + delta + list.length) % list.length;
    return { run, ui: { ...ui, index } };
  }

  if (input === 'left' || input === 'right') {
    const pane = cyclePane(ui.pane, input === 'left' ? -1 : 1);
    return {
      run,
      ui: { pane, index: Math.min(ui.index, Math.max(0, listOf(run, pane).length - 1)), grabbed: null },
    };
  }

  if (input === 'confirm' && list.length > 0 && canGrab(run, ui.pane, ui.index)) {
    return { run, ui: { ...ui, grabbed: { pane: ui.pane, origin: ui.index } } };
  }

  return { run, ui };
}

/**
 * A pointer press on `pane` at `index`: moves the cursor there and picks the
 * member up, so a drag can reorder it. An empty slot is a no-op.
 */
export function grabAt(run: RunState, ui: PartyUiState, pane: PaneId, index: number): PartyInputResult {
  if (!canGrab(run, pane, index)) return { run, ui };
  return { run, ui: { pane, index, grabbed: { pane, origin: index } } };
}

/**
 * A pointer drag to `to`: while a member is grabbed, reorders it straight to
 * that slot in its own pane (the same move `up`/`down` makes one step at a
 * time). Out-of-range targets are clamped; a no-op with nothing grabbed.
 */
export function dragTo(run: RunState, ui: PartyUiState, to: number): PartyInputResult {
  if (!ui.grabbed) return { run, ui };
  const { pane } = ui.grabbed;
  // The dead are never dragged: a rip grab cannot happen, and a stray one moves nothing.
  if (pane === 'rip') return { run, ui };
  const list = listOf(run, pane);
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === ui.index) return { run, ui };
  return { run: reorder(run, pane, ui.index, target), ui: { ...ui, index: target } };
}

/** Drops whatever is grabbed, leaving it where it stands. */
export function dropGrabbed(ui: PartyUiState): PartyUiState {
  return ui.grabbed ? { ...ui, grabbed: null } : ui;
}

/**
 * A pointer drop of the grabbed member onto the member at `index` of the other
 * pane: the two trade places, so a boxed member can replace a party member even
 * when the party is full (the member it replaces takes the box slot). The cursor
 * follows the moved member. A grab-less call, or a drop on a slot with no
 * member, is a no-op.
 */
export function swapAcross(run: RunState, ui: PartyUiState, index: number): PartyInputResult {
  const grabbed = ui.grabbed;
  if (!grabbed) return { run, ui };
  if (grabbed.pane === 'rip' || ui.pane === 'rip') return { run, ui };
  if (!canSwapAcross(run, grabbed.pane, memberAt(run, grabbed.pane, ui.index))) return { run, ui };
  const toPane: PaneId = grabbed.pane === 'party' ? 'box' : 'party';
  if (!listOf(run, toPane)[index]) return { run, ui };
  const next =
    grabbed.pane === 'party' ? swapPartyBox(run, ui.index, index) : swapPartyBox(run, index, ui.index);
  return next === run ? { run, ui } : { run: next, ui: { pane: toPane, index, grabbed: null } };
}

/**
 * The PC box is shown as a grid of avatar cells, `BOX_PAGE_SIZE` per page. The
 * run's box is a flat list, so a cell maps to `page * BOX_PAGE_SIZE + row * COLS
 * + col`; an index past the end is an empty slot.
 */
export const BOX_COLS = 4;
export const BOX_ROWS = 4;
export const BOX_PAGE_SIZE = BOX_COLS * BOX_ROWS;

/** How many pages a box of `length` members needs (at least one). */
export function boxPageCount(length: number): number {
  return Math.max(1, Math.ceil(Math.max(0, length) / BOX_PAGE_SIZE));
}

/** The flat box index of a page cell; may be past the end (an empty slot). */
export function boxCellIndex(page: number, col: number, row: number): number {
  return page * BOX_PAGE_SIZE + row * BOX_COLS + col;
}

/** The PC box page a flat box index is shown on: the page follows the cursor. */
export function boxPageForIndex(index: number): number {
  return Math.floor(Math.max(0, index) / BOX_PAGE_SIZE);
}

/**
 * The cursor over a pane that has a header stop: `rows` member rows numbered 0..rows-1
 * and the header at -1. Steps `delta` (up = -1, down = +1), wrapping through the whole
 * ring (-1 -> 0 -> ... -> rows-1 -> -1). `stepCursorWithHeader(cursor, d, 0)` returns -1.
 */
export function stepCursorWithHeader(cursor: number, delta: number, rows: number): number {
  const count = Math.max(1, rows + 1);
  const from = Number.isFinite(cursor) ? Math.trunc(cursor) : 0;
  const current = Math.min(Math.max(-1, from), rows - 1) + 1;
  const next = (((current + delta) % count) + count) % count;
  return next - 1;
}
