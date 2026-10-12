import { describe, expect, it } from 'vitest';
import { getMove, type Stats } from '../../../data/dex';
import { Rng } from '../../rng';
import { createFighter } from '../fighter';
import { activeFighter, createBattle, type BattleEvent, type BattleState } from '../state';
import { takeTurn } from '../turn';
import { movePreview } from '../preview';
import { hiddenPowerType } from '../moveType';
import { getEffect, makeContext, runModifyMoveType } from './registry';
import { hiddenPowerEffects } from './hiddenPower';
// Importing the battle index registers every effect, this module's included.
import '../index';

const hiddenpower = getMove('hiddenpower')!;

const ALL_31: Stats = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
// hp even, atk odd, def even, spe even, spa even, spd odd -> value 34 -> Fire.
const FIRE_IVS: Stats = { hp: 0, atk: 31, def: 0, spa: 0, spd: 31, spe: 0 };

function battle(ivs: Stats): BattleState {
  return createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'charmander',
        level: 30,
        ability: 'Blaze',
        moves: ['hiddenpower'],
        ivs,
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: 'bulbasaur',
        level: 30,
        ability: 'Overgrow',
        moves: ['tackle'],
      }),
    ],
    rng: new Rng(2026),
    isWild: true,
  });
}

function effectivenessOnEnemy(state: BattleState): number {
  const event = state.log.find(
    (entry): entry is Extract<BattleEvent, { kind: 'damage' }> =>
      entry.kind === 'damage' && entry.side === 'enemy',
  );
  if (!event) throw new Error('no damage event for the enemy');
  return event.effectiveness;
}

describe('hiddenpower effect', () => {
  it('registers one move definition through the barrel', () => {
    const defs = hiddenPowerEffects();
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({ id: 'hiddenpower', kind: 'move' });
    expect(getEffect('hiddenpower')?.kind).toBe('move');
  });

  it('publishes the holder IVs as the move type through the registry', () => {
    const state = battle(FIRE_IVS);
    const ctx = makeContext(state, 'player', {
      source: activeFighter(state, 'player'),
      target: activeFighter(state, 'enemy'),
      move: hiddenpower,
    });
    expect(runModifyMoveType(ctx, hiddenpower)).toBe('Fire');
    expect(movePreview(state, 'player', 0)?.type).toBe('Fire');
  });

  it('reads the IVs of the attacking fighter, not the dex type', () => {
    const state = battle(ALL_31);
    const ctx = makeContext(state, 'player', {
      source: activeFighter(state, 'player'),
      target: activeFighter(state, 'enemy'),
      move: hiddenpower,
    });
    expect(hiddenPowerType(ALL_31)).toBe('Dark');
    expect(runModifyMoveType(ctx, hiddenpower)).toBe('Dark');
  });
});

describe('hiddenpower damage (fixed seed)', () => {
  it('a Fire Hidden Power is super-effective where the Dark one is neutral', () => {
    const fire = battle(FIRE_IVS);
    takeTurn(fire, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    const dark = battle(ALL_31);
    takeTurn(dark, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });

    expect(effectivenessOnEnemy(fire)).toBe(2);
    expect(effectivenessOnEnemy(dark)).toBe(1);
  });

  it('replays the same log on a rerun from the same seed', () => {
    const first = battle(FIRE_IVS);
    takeTurn(first, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    const second = battle(FIRE_IVS);
    takeTurn(second, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });

    expect(second.log).toEqual(first.log);
  });
});
