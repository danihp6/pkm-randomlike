import { describe, expect, it } from 'vitest';
import { createRunPokemon } from '../engine/run';
import { createRun, type RunState } from '../engine/run/state';
import type { RunPokemon } from '../engine/run/progression';
import {
  boxCellIndex,
  boxPageCount,
  boxPageForIndex,
  BOX_PAGE_SIZE,
  boxRows,
  dragTo,
  dropGrabbed,
  grabAt,
  initialPartyUi,
  partyInput,
  partyRows,
  stepCursorWithHeader,
  swapAcross,
  windowStart,
  type PartyInput,
  type PartyUiState,
} from './partyScreen';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

function member(id: string, level = 3, speciesId = 'sentret'): RunPokemon {
  return createRunPokemon({ id, speciesId, level });
}

function runWith(partyIds: readonly string[], boxIds: readonly string[] = []): RunState {
  const base = createRun({ seed: 'run-a', starter });
  return {
    ...base,
    party: partyIds.map((id, index) =>
      index === 0 ? { ...starter, fighter: { ...starter.fighter, id } } : member(id),
    ),
    box: boxIds.map((id) => member(id)),
  };
}

function feed(
  run: RunState,
  ui: PartyUiState,
  inputs: readonly PartyInput[],
): { run: RunState; ui: PartyUiState } {
  return inputs.reduce((state, input) => partyInput(state.run, state.ui, input), { run, ui });
}

describe('rows', () => {
  it('resolves names, HP and status for each member', () => {
    const hurt = {
      ...starter,
      fighter: { ...starter.fighter, hp: 7, status: 'par' as const },
    };
    const rows = partyRows({ ...runWith(['starter']), party: [hurt] });
    expect(rows[0]).toMatchObject({
      name: 'Charmander',
      level: 5,
      hp: 7,
      maxHp: 20,
      statusLabel: 'PAR',
    });
  });

  it('reads the box in order', () => {
    const rows = boxRows(runWith(['starter'], ['a', 'b']));
    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('shows the nickname when a member has one, in the party and in the box', () => {
    const named = { ...starter, fighter: { ...starter.fighter, nickname: 'Sparky' } };
    expect(partyRows({ ...runWith(['starter']), party: [named] })[0].name).toBe('Sparky');
    expect(boxRows({ ...runWith(['starter'], []), box: [named] })[0].name).toBe('Sparky');
  });
});

describe('windowStart', () => {
  it('centres the cursor and clamps at both ends', () => {
    expect(windowStart(3, 1, 8)).toBe(0);
    expect(windowStart(20, 10, 8)).toBe(6);
    expect(windowStart(20, 0, 8)).toBe(0);
    expect(windowStart(20, 19, 8)).toBe(12);
  });
});

describe('partyInput cursor', () => {
  it('wraps within the pane', () => {
    const run = runWith(['a', 'b', 'c']);
    const up = partyInput(run, initialPartyUi(), 'up');
    expect(up.ui.index).toBe(2);
    const down = partyInput(run, { pane: 'party', index: 2, grabbed: null }, 'down');
    expect(down.ui.index).toBe(0);
  });

  it('switches panes and clamps the index to the shorter list', () => {
    const run = runWith(['a', 'b', 'c'], ['x']);
    const toBox = partyInput(run, { pane: 'party', index: 2, grabbed: null }, 'right');
    expect(toBox.ui).toMatchObject({ pane: 'box', index: 0 });
    const toParty = partyInput(run, toBox.ui, 'left');
    expect(toParty.ui).toMatchObject({ pane: 'party', index: 0 });
  });

  it('does not move the cursor in an empty pane', () => {
    const run = runWith(['a']);
    const ui = { pane: 'box' as const, index: 0, grabbed: null };
    expect(partyInput(run, ui, 'down').ui).toBe(ui);
    expect(partyInput(run, ui, 'confirm').ui.grabbed).toBeNull();
  });
});

describe('partyInput managing', () => {
  it('reorders the party while grabbed and drops on confirm', () => {
    const run = runWith(['a', 'b', 'c']);
    const picked = feed(run, initialPartyUi(), ['confirm', 'down', 'down']);
    expect(picked.run.party.map((m) => m.fighter.id)).toEqual(['b', 'c', 'a']);
    expect(picked.ui.grabbed).not.toBeNull();
    const dropped = feed(picked.run, picked.ui, ['confirm']);
    expect(dropped.ui.grabbed).toBeNull();
    expect(dropped.run.party.map((m) => m.fighter.id)).toEqual(['b', 'c', 'a']);
  });

  it('will not drag the grabbed member past either end', () => {
    const run = runWith(['a', 'b']);
    const picked = feed(run, initialPartyUi(), ['confirm', 'up', 'up']);
    expect(picked.run.party.map((m) => m.fighter.id)).toEqual(['a', 'b']);
    expect(picked.ui.index).toBe(0);
  });

  it('deposits a grabbed party member with right, cursor following it into the box', () => {
    const run = runWith(['a', 'b'], ['x']);
    const moved = feed(run, initialPartyUi(), ['confirm', 'right']);
    expect(moved.run.party.map((m) => m.fighter.id)).toEqual(['b']);
    expect(moved.run.box.map((m) => m.fighter.id)).toEqual(['x', 'a']);
    expect(moved.ui).toEqual({ pane: 'box', index: 1, grabbed: null });
  });

  it('keeps the grab when the deposit is refused (last member)', () => {
    const run = runWith(['a']);
    const moved = feed(run, initialPartyUi(), ['confirm', 'right']);
    expect(moved.run).toBe(run);
    expect(moved.ui.grabbed).not.toBeNull();
  });

  it('withdraws a grabbed box member with left', () => {
    const run = runWith(['a'], ['x', 'y']);
    const grabbed = feed(run, { pane: 'box', index: 1, grabbed: null }, ['confirm', 'left']);
    expect(grabbed.run.party.map((m) => m.fighter.id)).toEqual(['a', 'y']);
    expect(grabbed.run.box.map((m) => m.fighter.id)).toEqual(['x']);
    expect(grabbed.ui).toEqual({ pane: 'party', index: 1, grabbed: null });
  });

  it('keeps the grab when the party is full', () => {
    const run = runWith(['a', 'b', 'c', 'd', 'e', 'f'], ['x']);
    const grabbed = feed(run, { pane: 'box', index: 0, grabbed: null }, ['confirm', 'left']);
    expect(grabbed.run).toBe(run);
    expect(grabbed.ui.grabbed).not.toBeNull();
  });

  it('restores the member to where the grab started on cancel', () => {
    const run = runWith(['a', 'b', 'c']);
    const order = run.party.map((m) => m.fighter.id);
    const cancelled = feed(run, initialPartyUi(), ['confirm', 'down', 'down', 'cancel']);
    expect(cancelled.run.party.map((m) => m.fighter.id)).toEqual(order);
    expect(cancelled.ui).toEqual({ pane: 'party', index: 0, grabbed: null });
    expect(cancelled.run).not.toBe(run);
  });

  it('ignores left and right while it would move the member to its own pane', () => {
    const run = runWith(['a', 'b'], ['x']);
    const picked = feed(run, initialPartyUi(), ['confirm', 'left']);
    expect(picked.ui).toEqual({ pane: 'party', index: 0, grabbed: { pane: 'party', origin: 0 } });
  });
});

describe('pointer drag', () => {
  it('grabs the pressed row and reorders straight to the drop slot', () => {
    const run = runWith(['a', 'b', 'c', 'd']);
    const grabbed = grabAt(run, initialPartyUi(), 'party', 0);
    expect(grabbed.ui).toEqual({ pane: 'party', index: 0, grabbed: { pane: 'party', origin: 0 } });
    const moved = dragTo(grabbed.run, grabbed.ui, 2);
    expect(moved.run.party.map((m) => m.fighter.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(moved.ui.index).toBe(2);
    expect(dropGrabbed(moved.ui)).toEqual({ pane: 'party', index: 2, grabbed: null });
  });

  it('drags a box member within the box', () => {
    const run = runWith(['a'], ['x', 'y', 'z']);
    const grabbed = grabAt(run, { pane: 'box', index: 2, grabbed: null }, 'box', 2);
    const moved = dragTo(grabbed.run, grabbed.ui, 0);
    expect(moved.run.box.map((m) => m.fighter.id)).toEqual(['z', 'x', 'y']);
  });

  it('clamps an out-of-range drop and ignores an empty slot', () => {
    const run = runWith(['a', 'b', 'c']);
    const grabbed = grabAt(run, initialPartyUi(), 'party', 0);
    expect(dragTo(grabbed.run, grabbed.ui, 99).ui.index).toBe(2);
    expect(dragTo(grabbed.run, grabbed.ui, -5).ui.index).toBe(0);
    expect(grabAt(run, initialPartyUi(), 'party', 9).run).toBe(run);
  });

  it('is a no-op when nothing is grabbed', () => {
    const run = runWith(['a', 'b']);
    expect(dragTo(run, initialPartyUi(), 1)).toEqual({ run, ui: initialPartyUi() });
    expect(dropGrabbed(initialPartyUi())).toEqual(initialPartyUi());
  });

  it('swaps a grabbed box member into a full party, cursor crossing over', () => {
    const run = runWith(['a', 'b', 'c', 'd', 'e', 'f'], ['x', 'y']);
    const grabbed = grabAt(run, { pane: 'box', index: 1, grabbed: null }, 'box', 1);
    const swapped = swapAcross(grabbed.run, grabbed.ui, 3);
    expect(swapped.run.party.map((m) => m.fighter.id)).toEqual(['a', 'b', 'c', 'y', 'e', 'f']);
    expect(swapped.run.box.map((m) => m.fighter.id)).toEqual(['x', 'd']);
    expect(swapped.ui).toEqual({ pane: 'party', index: 3, grabbed: null });
  });

  it('swaps a grabbed party member into the box', () => {
    const run = runWith(['a', 'b'], ['x', 'y']);
    const grabbed = grabAt(run, initialPartyUi(), 'party', 1);
    const swapped = swapAcross(grabbed.run, grabbed.ui, 1);
    expect(swapped.run.party.map((m) => m.fighter.id)).toEqual(['a', 'y']);
    expect(swapped.run.box.map((m) => m.fighter.id)).toEqual(['x', 'b']);
    expect(swapped.ui).toEqual({ pane: 'box', index: 1, grabbed: null });
  });

  it('ignores a swap over an empty slot or with nothing grabbed', () => {
    const run = runWith(['a'], ['x']);
    const grabbed = grabAt(run, initialPartyUi(), 'party', 0);
    expect(swapAcross(grabbed.run, grabbed.ui, 9)).toEqual({ run, ui: grabbed.ui });
    expect(swapAcross(run, initialPartyUi(), 0)).toEqual({ run, ui: initialPartyUi() });
  });
});

describe('box grid', () => {
  it('needs at least one page and grows by BOX_PAGE_SIZE', () => {
    expect(boxPageCount(0)).toBe(1);
    expect(boxPageCount(1)).toBe(1);
    expect(boxPageCount(BOX_PAGE_SIZE)).toBe(1);
    expect(boxPageCount(BOX_PAGE_SIZE + 1)).toBe(2);
    expect(boxPageCount(BOX_PAGE_SIZE * 3)).toBe(3);
  });

  it('maps a page cell to a flat box index', () => {
    expect(boxCellIndex(0, 0, 0)).toBe(0);
    expect(boxCellIndex(0, 3, 0)).toBe(3);
    expect(boxCellIndex(0, 0, 1)).toBe(4);
    expect(boxCellIndex(1, 0, 0)).toBe(BOX_PAGE_SIZE);
  });

  it('shows a flat index on the page the cursor sits on', () => {
    expect(boxPageForIndex(0)).toBe(0);
    expect(boxPageForIndex(15)).toBe(0);
    expect(boxPageForIndex(16)).toBe(1);
    expect(boxPageForIndex(31)).toBe(1);
    expect(boxPageForIndex(32)).toBe(2);
    expect(boxPageForIndex(-3)).toBe(0);
  });
});

describe('cursor with a header stop', () => {
  it('wraps through the header and every member row', () => {
    expect(stepCursorWithHeader(-1, 1, 3)).toBe(0);
    expect(stepCursorWithHeader(0, 1, 3)).toBe(1);
    expect(stepCursorWithHeader(2, 1, 3)).toBe(-1);
    expect(stepCursorWithHeader(0, -1, 3)).toBe(-1);
    expect(stepCursorWithHeader(-1, -1, 3)).toBe(2);
  });

  it('reads the header for an empty pane', () => {
    expect(stepCursorWithHeader(-1, 1, 0)).toBe(-1);
    expect(stepCursorWithHeader(-1, -1, 0)).toBe(-1);
    expect(stepCursorWithHeader(0, 0, 0)).toBe(-1);
  });

  it('is the identity for a zero step', () => {
    expect(stepCursorWithHeader(1, 0, 3)).toBe(1);
    expect(stepCursorWithHeader(-1, 0, 3)).toBe(-1);
  });
});
