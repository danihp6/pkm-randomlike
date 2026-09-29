import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { ITEMS, type ItemDef } from '../../../data/items';
import { Rng } from '../../rng';
import { createFighter, type BattleFighter } from '../fighter';
import { activeFighter, createBattle, type BattleState } from '../state';
import { takeTurn } from '../turn';
import {
  getEffect,
  makeContext,
  runModifyDamage,
  runResidual,
  type EffectContext,
} from './registry';
import { itemEffects } from './items';

function fighter(id: string, speciesId: string, heldItem?: string): BattleFighter {
  return createFighter({
    id,
    speciesId,
    level: 20,
    ...(heldItem ? { heldItem } : {}),
  });
}

function battle(playerHeld?: string, rngSeed = 99): BattleState {
  return createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'charmander',
        level: 20,
        moves: ['ember'],
        ...(playerHeld ? { heldItem: playerHeld } : {}),
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: 'bulbasaur',
        level: 18,
        moves: ['tackle'],
      }),
    ],
    rng: new Rng(rngSeed),
    isWild: true,
  });
}

function playerContext(state: BattleState): EffectContext {
  return makeContext(state, 'player', {
    source: activeFighter(state, 'player'),
    target: activeFighter(state, 'enemy'),
  });
}

const held = (id: string): ItemDef => {
  const item = ITEMS.find((entry) => entry.id === id);
  if (!item) throw new Error(`missing item ${id}`);
  return item;
};

describe('held item effects', () => {
  it('registers every held item in the catalogue', () => {
    const defs = itemEffects();
    const expected = ITEMS.filter((item) => item.kind === 'held').map((item) => item.id);
    expect(defs.map((def) => def.id).sort()).toEqual(expected.sort());
    for (const id of expected) expect(getEffect(id)?.kind).toBe('item');
  });

  it('restores 1/16 max HP each residual with Leftovers', () => {
    const state = battle('leftovers');
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 4);
    const before = player.hp;

    runResidual(playerContext(state));

    expect(player.hp).toBe(before + Math.floor(player.maxHp / 16));
    expect(player.heldItem).toBe('leftovers');
  });

  it('does not fire Leftovers at full HP', () => {
    const state = battle('leftovers');
    const player = activeFighter(state, 'player');
    runResidual(playerContext(state));
    expect(player.hp).toBe(player.maxHp);
    expect(player.heldItem).toBe('leftovers');
  });

  it('heals a berry only below half and consumes it once', () => {
    const state = battle('sitrusberry');
    const player = activeFighter(state, 'player');
    player.hp = Math.floor(player.maxHp / 2) + 1;

    runResidual(playerContext(state));
    expect(player.heldItem).toBe('sitrusberry');

    player.hp = Math.floor(player.maxHp / 2);
    const before = player.hp;
    runResidual(playerContext(state));

    expect(player.hp).toBe(before + Math.floor(player.maxHp / 4));
    expect(player.heldItem).toBeNull();
  });

  it('cures a status with Lum Berry and is consumed', () => {
    const state = battle('lumberry');
    const player = activeFighter(state, 'player');
    player.status = 'brn';

    runResidual(playerContext(state));

    expect(player.status).toBeNull();
    expect(player.heldItem).toBeNull();
  });

  it('leaves Lum Berry alone when there is nothing to cure', () => {
    const state = battle('lumberry');
    runResidual(playerContext(state));
    expect(activeFighter(state, 'player').heldItem).toBe('lumberry');
  });
});

describe('type-boost items', () => {
  it("multiplies only the holder's moves of the matching type", () => {
    const state = battle('charcoal');
    const ctx = playerContext(state);

    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(120);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(100);
  });

  it('ignores a defender-held type item', () => {
    const state = createBattle({
      player: [fighter('player', 'charmander')],
      enemy: [fighter('enemy', 'bulbasaur', 'charcoal')],
      rng: new Rng(7),
      isWild: true,
    });

    expect(runModifyDamage(playerContext(state), getMove('ember')!, 100)).toBe(100);
  });
});

describe('held items in the turn loop', () => {
  it('leftovers heal lands at the end of a real turn', () => {
    const control = battle();
    takeTurn(control, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    const controlHp = activeFighter(control, 'player').hp;

    const state = battle('leftovers');
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    const player = activeFighter(state, 'player');

    expect(player.hp - controlHp).toBe(Math.floor(player.maxHp / 16));
  });

  it('rejects a held item used from the Bag', () => {
    const state = battle('leftovers');
    state.bag.push({ item: held('leftovers'), count: 1 });
    expect(() =>
      takeTurn(state, { type: 'bag', itemId: 'leftovers' }, { type: 'fight', moveIndex: 0 }),
    ).toThrow(/Held items/);
  });
});
