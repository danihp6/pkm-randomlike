import { describe, expect, it } from 'vitest';
import { getMove } from '../../data/dex';
import { ITEMS } from '../../data/items';
import { Rng } from '../rng';
import { createFighter } from './fighter';
import { activeFighter, createBattle, type BattleState } from './state';
import { UNMODELLED_ITEMS } from './effects/items';
import { makeContext, runModifyMove } from './effects/registry';
import { effectiveMovePower } from './movePower';

const naturalgift = getMove('naturalgift')!;

/** The eleven hand-authored berries the engine never spends (`NOOP_BERRY_ITEMS`). */
const NOOP_BERRIES: readonly string[] = [
  'custapberry',
  'enigmaberry',
  'jabocaberry',
  'keeberry',
  'lansatberry',
  'leppaberry',
  'marangaberry',
  'persimberry',
  'rowapberry',
  'starfberry',
  'tamatoberry',
];

describe('effectiveMovePower on Natural Gift', () => {
  it("answers the berry's dex power", () => {
    expect(effectiveMovePower('sitrusberry', naturalgift)).toBe(80);
    expect(effectiveMovePower('oranberry', naturalgift)).toBe(80);
    expect(effectiveMovePower('lumberry', naturalgift)).toBe(80);
    expect(effectiveMovePower('cheriberry', naturalgift)).toBe(80);
    expect(effectiveMovePower('figyberry', naturalgift)).toBe(80);
  });

  it('answers the dex power with no item or with an item that has no gift pair', () => {
    expect(effectiveMovePower(null, naturalgift)).toBe(0);
    expect(effectiveMovePower(undefined, naturalgift)).toBe(0);
    expect(effectiveMovePower('', naturalgift)).toBe(0);
    expect(effectiveMovePower('charcoal', naturalgift)).toBe(0);
    expect(effectiveMovePower('flameplate', naturalgift)).toBe(0);
    expect(effectiveMovePower('not-an-item', naturalgift)).toBe(0);
  });

  it('leaves the eleven unmodelled berries on the dex power, because the engine skips them', () => {
    for (const id of NOOP_BERRIES) {
      expect(UNMODELLED_ITEMS, id).toContain(id);
      expect(effectiveMovePower(id, naturalgift), id).toBe(naturalgift.basePower);
    }
  });

  it('accepts the IV pair without changing an item-driven answer', () => {
    expect(effectiveMovePower('sitrusberry', naturalgift, { hp: 0, atk: 0 })).toBe(80);
    expect(effectiveMovePower('sitrusberry', naturalgift, null)).toBe(80);
    expect(effectiveMovePower(null, naturalgift, null)).toBe(0);
  });
});

describe('effectiveMovePower on every other move', () => {
  it('keeps the dex basePower, for a berry holder and for no item', () => {
    for (const id of [
      'tackle',
      'ember',
      'surf',
      'vinewhip',
      'judgment',
      'multiattack',
      'technoblast',
      'hiddenpower',
      'flail',
    ]) {
      const move = getMove(id)!;
      expect(effectiveMovePower(null, move), id).toBe(move.basePower);
      expect(effectiveMovePower('sitrusberry', move), id).toBe(move.basePower);
      expect(effectiveMovePower('charcoal', move), id).toBe(move.basePower);
    }
  });

  it('answers a variable-power move its dex number, never a berry one', () => {
    const flail = getMove('flail')!;
    expect(flail.basePower).toBe(0);
    expect(effectiveMovePower('sitrusberry', flail)).toBe(0);
    expect(effectiveMovePower('custapberry', flail)).toBe(0);
  });
});

describe('the panel and the battle read one rule (D37)', () => {
  const named = ['sitrusberry', 'oranberry', 'lumberry', 'cheriberry', ...NOOP_BERRIES];

  it('agrees on Natural Gift for the named berries and for no item', () => {
    for (const itemId of [null, ...named]) {
      expect(effectiveMovePower(itemId, naturalgift), String(itemId)).toBe(battlePower(itemId));
    }
    expect(battlePower('sitrusberry')).toBe(80);
    expect(battlePower('custapberry')).toBe(0);
    expect(battlePower(null)).toBe(0);
  });

  it('agrees on Natural Gift for every catalogue item', () => {
    for (const item of ITEMS) {
      const itemId = item.kind === 'held' ? item.id : null;
      expect(effectiveMovePower(itemId, naturalgift), item.id).toBe(battlePower(itemId));
    }
  });
});

/** The power the battle uses the move at, through the registry's own `onModifyMove`. */
function battlePower(itemId: string | null): number {
  const state = holderState(itemId ?? undefined);
  const ctx = makeContext(state, 'player', {
    source: activeFighter(state, 'player'),
    target: activeFighter(state, 'enemy'),
  });
  return runModifyMove(ctx, naturalgift).basePower;
}

function holderState(heldItem?: string): BattleState {
  return createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'charmander',
        level: 20,
        ability: 'Blaze',
        moves: ['naturalgift'],
        ...(heldItem ? { heldItem } : {}),
      }),
    ],
    enemy: [createFighter({ id: 'enemy', speciesId: 'bulbasaur', level: 18, moves: ['tackle'] })],
    rng: new Rng(1),
    isWild: true,
  });
}
