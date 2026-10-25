import { describe, expect, it } from 'vitest';
import { getMove } from '../../data/dex';
import { Rng } from '../rng';
import { FOG_ACCURACY_PENALTY, accuracyChance, rollHit } from './accuracy';
import { createFighter } from './fighter';
import { hitChance } from './modifiers';
import { createBattle } from './state';

const make = (speciesId: string) =>
  createFighter({ id: speciesId, speciesId, level: 20, nature: 'serious' });

describe('accuracyChance', () => {
  it('always hits when the move cannot miss', () => {
    expect(accuracyChance(true, make('charmander'), make('sentret'))).toBe(1);
  });

  it('ignores the defender evasion stage for a Mind’s Eye second ability', () => {
    const attacker = createFighter({
      id: 'a',
      speciesId: 'charmander',
      level: 20,
      nature: 'serious',
      ability: 'Blaze',
      secondAbility: "Mind's Eye",
    });
    const defender = make('sentret');
    defender.boosts.evasion = 1;
    expect(accuracyChance(60, attacker, defender)).toBeCloseTo(0.6);
    attacker.ability = 'Blaze';
    delete attacker.secondAbility;
    expect(accuracyChance(60, attacker, defender)).toBeCloseTo(0.45);
  });

  it('multiplies by the net accuracy/evasion stage', () => {
    const attacker = make('charmander');
    const defender = make('sentret');
    expect(accuracyChance(60, attacker, defender)).toBeCloseTo(0.6);

    attacker.boosts.accuracy = 1;
    expect(accuracyChance(60, attacker, defender)).toBeCloseTo(0.8);

    attacker.boosts.accuracy = 0;
    defender.boosts.evasion = 1;
    expect(accuracyChance(60, attacker, defender)).toBeCloseTo(0.45);
  });

  it('caps a boosted chance at a guaranteed hit', () => {
    const attacker = make('charmander');
    const defender = make('sentret');
    attacker.boosts.accuracy = 6;
    expect(accuracyChance(95, attacker, defender)).toBe(1);
  });
});

describe('accuracyChance under dense fog', () => {
  it('costs a move 20 of its own accuracy', () => {
    expect(FOG_ACCURACY_PENALTY).toBe(20);
    const attacker = make('charmander');
    const defender = make('sentret');
    expect(accuracyChance(95, attacker, defender, { fog: true })).toBeCloseTo(0.75);
    expect(accuracyChance(95, attacker, defender)).toBeCloseTo(0.95);
  });

  it('clamps a move that cannot pay the penalty at no chance at all', () => {
    const attacker = make('charmander');
    const defender = make('sentret');
    expect(accuracyChance(10, attacker, defender, { fog: true })).toBe(0);
    expect(accuracyChance(20, attacker, defender, { fog: true })).toBe(0);
  });

  it('leaves a move that cannot miss untouched', () => {
    expect(accuracyChance(true, make('charmander'), make('sentret'), { fog: true })).toBe(1);
  });

  it('takes the penalty before the stage multiplier scales it', () => {
    const attacker = make('charmander');
    const defender = make('sentret');
    attacker.boosts.accuracy = 1;
    // The +1 stage multiplier is 4/3, so fog scales the reduced 40, not the printed 60.
    expect(accuracyChance(60, attacker, defender, { fog: true })).toBeCloseTo(
      ((60 - FOG_ACCURACY_PENALTY) / 100) * (4 / 3),
    );
    expect(accuracyChance(60, attacker, defender, { fog: true })).toBeCloseTo(
      accuracyChance(40, attacker, defender),
    );
  });

  it('still bends the aim under Gravity afterwards', () => {
    const attacker = make('charmander');
    const defender = make('sentret');
    expect(accuracyChance(60, attacker, defender, { fog: true, gravity: true })).toBeCloseTo(
      (0.4 * 5) / 3,
    );
  });
});

describe('the fog flag on the battle path', () => {
  it('lowers the rolled hit chance and the preview by the same 20', () => {
    const move = getMove('tackle');
    expect(move?.accuracy).toBe(100);
    const state = createBattle({
      player: [createFighter({ id: 'player', speciesId: 'charmander', level: 20, moves: ['tackle'] })],
      enemy: [createFighter({ id: 'enemy', speciesId: 'sentret', level: 18 })],
      rng: new Rng(7),
      isWild: true,
      fog: true,
    });
    const fogged = hitChance(state, 'player', move!);
    state.fog = false;
    const clear = hitChance(state, 'player', move!);
    expect(clear).toBe(1);
    expect(clear - fogged).toBeCloseTo(0.2, 10);
  });
});

describe('rollHit', () => {
  it('cannot miss an unlimited-accuracy move', () => {
    expect(rollHit(new Rng(1), true, make('charmander'), make('sentret'))).toBe(true);
  });

  it('is a pure function of the rng stream', () => {
    const attacker = make('charmander');
    const defender = make('sentret');
    const rolls = () => Array.from({ length: 20 }, () => rollHit(new Rng(4), 75, attacker, defender));
    expect(rolls()).toEqual(rolls());
  });
});
