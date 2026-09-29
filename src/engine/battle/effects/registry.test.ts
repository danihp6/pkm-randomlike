import { afterEach, describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { createFighter } from '../fighter';
import { activeFighter, createBattle, type BattleState } from '../state';
import { takeTurn } from '../turn';
import {
  clearEffects,
  getEffect,
  makeContext,
  normalizeEffectId,
  registerEffect,
  runBoost,
  runModifyDamage,
  runResidual,
  runStatus,
  runTryHit,
  type EffectDefinition,
  type EffectHandlers,
} from './registry';

function effect(id: string, handlers: EffectHandlers, kind: EffectDefinition['kind'] = 'ability'): EffectDefinition {
  return { id, kind, handlers };
}

function battle(rngSeed = 4242): BattleState {
  return createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'charmander',
        level: 20,
        ability: 'Blaze',
        moves: ['ember'],
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: 'bulbasaur',
        level: 18,
        ability: 'Overgrow',
        moves: ['tackle'],
      }),
    ],
    rng: new Rng(rngSeed),
    isWild: true,
  });
}

afterEach(() => clearEffects());

describe('effect registry', () => {
  it('registers by normalized id and rejects duplicates', () => {
    registerEffect(effect('Overgrow', { onStart: () => {} }));
    expect(getEffect('over grow')).toBeDefined();
    expect(normalizeEffectId('Over-Grow!')).toBe('overgrow');
    expect(() => registerEffect(effect('overgrow', {}))).toThrow(/already registered/);
  });

  it('is empty again after clearEffects', () => {
    registerEffect(effect('overgrow', {}));
    clearEffects();
    expect(getEffect('overgrow')).toBeUndefined();
  });

  it('dispatches switch-in and start hooks for the source ability', () => {
    const seen: string[] = [];
    registerEffect(
      effect('overgrow', {
        onStart: () => seen.push('start'),
        onSwitchIn: () => seen.push('switch'),
      }),
    );

    battle();

    expect(seen).toEqual(['start', 'switch']);
  });

  it('threads damage through source then target handlers', () => {
    registerEffect(effect('blaze', { onModifyDamage: (_ctx, payload) => payload.damage + 10 }));
    registerEffect(effect('overgrow', { onModifyDamage: (_ctx, payload) => payload.damage * 2 }));

    const state = battle();
    const ctx = makeContext(state, 'player', {
      source: activeFighter(state, 'player'),
      target: activeFighter(state, 'enemy'),
    });

    expect(runModifyDamage(ctx, getMove('ember')!, 20)).toBe(60);
  });

  it('stops a boolean hook on the first block', () => {
    const calls: string[] = [];
    registerEffect(
      effect('blaze', {
        onTryHit: () => {
          calls.push('blaze');
          return false;
        },
      }),
    );
    registerEffect(
      effect('overgrow', {
        onTryHit: () => {
          calls.push('overgrow');
          return true;
        },
      }),
    );

    const state = battle();
    const ctx = makeContext(state, 'player', {
      source: activeFighter(state, 'player'),
      target: activeFighter(state, 'enemy'),
    });

    expect(runTryHit(ctx, getMove('ember')!)).toBe(false);
    expect(calls).toEqual(['blaze']);
  });

  it('dispatches the remaining hooks', () => {
    const calls: string[] = [];
    registerEffect(
      effect('blaze', {
        onResidual: () => calls.push('residual'),
        onStatus: () => {
          calls.push('status');
          return true;
        },
        onBoost: () => {
          calls.push('boost');
          return true;
        },
      }),
    );

    const state = battle();
    const ctx = makeContext(state, 'player', { source: activeFighter(state, 'player') });
    runResidual(ctx);
    runStatus(ctx, 'brn');
    runBoost(ctx, 'atk', 1);

    expect(calls).toEqual(['residual', 'status', 'boost']);
  });
});

describe('effect registry in the turn loop', () => {
  it('applies an ability damage modifier during a real turn', () => {
    const control = battle();
    takeTurn(control, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    const controlHp = activeFighter(control, 'enemy').hp;

    clearEffects();
    registerEffect(effect('blaze', { onModifyDamage: (_ctx, payload) => payload.damage + 5 }));
    const buffed = battle();
    takeTurn(buffed, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });

    expect(controlHp - activeFighter(buffed, 'enemy').hp).toBe(5);
  });

  it('skips damage when the move is blocked on try-hit', () => {
    registerEffect(effect('overgrow', { onTryHit: () => false }));

    const state = battle();
    const enemy = activeFighter(state, 'enemy');
    const before = enemy.hp;
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });

    expect(enemy.hp).toBe(before);
    expect(state.log.some((event) => event.kind === 'damage' && event.side === 'enemy')).toBe(false);
  });
});
