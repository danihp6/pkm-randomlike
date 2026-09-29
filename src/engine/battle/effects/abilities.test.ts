import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { createFighter, type BattleFighter } from '../fighter';
import { activeFighter, createBattle, opponentOf, type BattleState, type SideId } from '../state';
import {
  getEffect,
  makeContext,
  runAfterMove,
  runBoost,
  runModifyDamage,
  runResidual,
  runTryHit,
  type EffectContext,
} from './registry';
import { applyStatusEffect } from './apply';
import { abilityEffects } from './abilities';

function fighter(id: string, speciesId: string, ability: string, moves?: readonly string[]): BattleFighter {
  return createFighter({
    id,
    speciesId,
    level: 20,
    ability,
    ...(moves ? { moves } : {}),
  });
}

function makeBattle(player: BattleFighter, enemy: BattleFighter, seed = 1234): BattleState {
  return createBattle({ player: [player], enemy: [enemy], rng: new Rng(seed), isWild: true });
}

function ctxOf(state: BattleState, side: SideId): EffectContext {
  return makeContext(state, side, {
    source: activeFighter(state, side),
    target: activeFighter(state, opponentOf(side)),
  });
}

describe('ability registration', () => {
  it('registers the batch 1 abilities', () => {
    const ids = abilityEffects().map((def) => def.id);
    expect(ids).toContain('intimidate');
    expect(ids).toContain('levitate');
    expect(ids).toContain('sturdy');
    for (const id of ids) expect(getEffect(id)?.kind).toBe('ability');
  });
});

describe('entry and immunity abilities', () => {
  it('Intimidate lowers the foe Attack on switch-in', () => {
    const state = makeBattle(
      fighter('player', 'growlithe', 'Intimidate'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    expect(activeFighter(state, 'enemy').boosts.atk).toBe(-1);
    expect(activeFighter(state, 'player').boosts.atk).toBe(0);
  });

  it('Levitate blocks Ground moves but nothing else', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'gastly', 'Levitate'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runTryHit(ctx, getMove('earthquake')!)).toBe(false);
    expect(runTryHit(ctx, getMove('tackle')!)).toBe(true);
  });

  it('Sturdy leaves the holder at 1 HP from full', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'geodude', 'Sturdy'),
    );
    const geodude = activeFighter(state, 'enemy');
    const ctx = ctxOf(state, 'player');

    expect(runModifyDamage(ctx, getMove('tackle')!, geodude.maxHp)).toBe(geodude.hp - 1);

    geodude.hp -= 1;
    expect(runModifyDamage(ctx, getMove('tackle')!, geodude.maxHp)).toBe(geodude.maxHp);
  });
});

describe('contact punish abilities', () => {
  it('Static eventually paralyzes a contact attacker', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['tackle']),
      fighter('enemy', 'pikachu', 'Static'),
      11,
    );
    const ctx = ctxOf(state, 'player');
    const move = getMove('tackle')!;
    for (let i = 0; i < 50 && activeFighter(state, 'player').status === null; i++) {
      runAfterMove(ctx, move);
    }
    expect(activeFighter(state, 'player').status).toBe('par');
  });

  it('Static ignores non-contact moves', () => {
    const state = makeBattle(
      fighter('player', 'charmander', 'Blaze', ['ember']),
      fighter('enemy', 'pikachu', 'Static'),
      11,
    );
    const ctx = ctxOf(state, 'player');
    const move = getMove('ember')!;
    for (let i = 0; i < 50; i++) runAfterMove(ctx, move);
    expect(activeFighter(state, 'player').status).toBeNull();
  });

  it('Flame Body burns a contact attacker', () => {
    const state = makeBattle(
      fighter('player', 'bulbasaur', 'Overgrow', ['tackle']),
      fighter('enemy', 'magmar', 'Flame Body'),
      12,
    );
    const ctx = ctxOf(state, 'player');
    const move = getMove('tackle')!;
    for (let i = 0; i < 50 && activeFighter(state, 'player').status === null; i++) {
      runAfterMove(ctx, move);
    }
    expect(activeFighter(state, 'player').status).toBe('brn');
  });
});

describe('status immune abilities', () => {
  it('Immunity blocks poison but not paralysis', () => {
    const state = makeBattle(
      fighter('player', 'snorlax', 'Immunity'),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const snorlax = activeFighter(state, 'player');

    applyStatusEffect(state, 'player', snorlax, 'psn');
    expect(snorlax.status).toBeNull();

    applyStatusEffect(state, 'player', snorlax, 'par');
    expect(snorlax.status).toBe('par');
  });

  it('Limber blocks paralysis', () => {
    const state = makeBattle(fighter('player', 'ditto', 'Limber'), fighter('enemy', 'charmander', 'Blaze'));
    const ditto = activeFighter(state, 'player');
    applyStatusEffect(state, 'player', ditto, 'par');
    expect(ditto.status).toBeNull();
  });
});

describe('pinch, guts and technician', () => {
  it('Overgrow boosts Grass only while at or below one third HP', () => {
    const state = makeBattle(
      fighter('player', 'bulbasaur', 'Overgrow', ['vinewhip', 'tackle']),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const bulbasaur = activeFighter(state, 'player');
    const ctx = ctxOf(state, 'player');

    expect(runModifyDamage(ctx, getMove('vinewhip')!, 100)).toBe(100);
    bulbasaur.hp = Math.floor(bulbasaur.maxHp / 3);
    expect(runModifyDamage(ctx, getMove('vinewhip')!, 100)).toBe(150);
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(100);
  });

  it('Guts boosts physical moves while statused, ignoring burn', () => {
    const state = makeBattle(
      fighter('player', 'heracross', 'Guts', ['tackle', 'ember']),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const heracross = activeFighter(state, 'player');
    const ctx = ctxOf(state, 'player');

    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(100);
    heracross.status = 'par';
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(150);
    expect(runModifyDamage(ctx, getMove('ember')!, 100)).toBe(100);
    heracross.status = 'brn';
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(300);
  });

  it('Technician boosts moves of 60 power or less', () => {
    const state = makeBattle(
      fighter('player', 'meowth', 'Technician', ['tackle', 'flamethrower']),
      fighter('enemy', 'charmander', 'Blaze'),
    );
    const ctx = ctxOf(state, 'player');
    expect(runModifyDamage(ctx, getMove('tackle')!, 100)).toBe(150);
    expect(runModifyDamage(ctx, getMove('flamethrower')!, 100)).toBe(100);
  });
});

describe('stat guard abilities', () => {
  it('Hyper Cutter blocks Attack drops but not Defence drops or self drops', () => {
    const state = makeBattle(fighter('player', 'gligar', 'Hyper Cutter'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(state, 'player');
    expect(runBoost(ctx, 'atk', -1, false)).toBe(false);
    expect(runBoost(ctx, 'def', -1, false)).toBe(true);
    expect(runBoost(ctx, 'atk', 1, false)).toBe(true);
    expect(runBoost(ctx, 'atk', -1, true)).toBe(true);
  });

  it('Keen Eye blocks accuracy drops only', () => {
    const state = makeBattle(fighter('player', 'hitmonchan', 'Keen Eye'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(state, 'player');
    expect(runBoost(ctx, 'accuracy', -1, false)).toBe(false);
    expect(runBoost(ctx, 'evasion', -1, false)).toBe(true);
  });

  it('Clear Body blocks every opposing drop', () => {
    const state = makeBattle(fighter('player', 'tentacool', 'Clear Body'), fighter('enemy', 'charmander', 'Blaze'));
    const ctx = ctxOf(state, 'player');
    expect(runBoost(ctx, 'spe', -2, false)).toBe(false);
  });
});

describe('residual abilities', () => {
  it('Shed Skin eventually cures a status', () => {
    const state = makeBattle(
      fighter('player', 'ekans', 'Shed Skin'),
      fighter('enemy', 'charmander', 'Blaze'),
      13,
    );
    const ekans = activeFighter(state, 'player');
    ekans.status = 'brn';
    for (let i = 0; i < 50 && ekans.status !== null; i++) {
      runResidual(ctxOf(state, 'player'));
    }
    expect(ekans.status).toBeNull();
  });
});
