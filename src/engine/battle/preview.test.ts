import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { createFighter, type BattleFighter } from './fighter';
import { createBattle, type BattleState } from './state';
import { movePreview } from './preview';
// Importing the battle index registers every effect (abilities, items, moves).
import './index';

function player(moves: readonly string[], extra: Partial<Parameters<typeof createFighter>[0]> = {}): BattleFighter {
  return createFighter({ id: 'player', speciesId: 'charmander', level: 20, moves, ...extra });
}

function battle(attacker: BattleFighter, defender = createFighter({ id: 'enemy', speciesId: 'bulbasaur', level: 18 })): BattleState {
  return createBattle({ player: [attacker], enemy: [defender], rng: new Rng(1), isWild: true });
}

describe('movePreview', () => {
  it('folds STAB into the effective power', () => {
    const preview = movePreview(battle(player(['ember'])), 'player', 0);
    expect(preview?.basePower).toBe(40);
    expect(preview?.stab).toBe(true);
    expect(preview?.power).toBe(60);
  });

  it('leaves a non-STAB move at its base power', () => {
    const rufflet = createFighter({ id: 'player', speciesId: 'bulbasaur', level: 20, moves: ['ember'] });
    const preview = movePreview(battle(rufflet), 'player', 0);
    expect(preview?.stab).toBe(false);
    expect(preview?.power).toBe(40);
  });

  it('folds a held type item into the effective power', () => {
    const preview = movePreview(battle(player(['ember'], { heldItem: 'charcoal' })), 'player', 0);
    expect(preview?.powerMultiplier).toBeCloseTo(1.2);
    expect(preview?.power).toBe(72);
  });

  it('folds a pinch ability in only while the holder is low', () => {
    const attacker = player(['ember'], { ability: 'Blaze' });
    const state = battle(attacker);
    expect(movePreview(state, 'player', 0)?.power).toBe(60);
    attacker.hp = Math.floor(attacker.maxHp / 4);
    expect(movePreview(state, 'player', 0)?.power).toBe(90);
  });

  it('reports a status move with no power', () => {
    const preview = movePreview(battle(player(['growl'])), 'player', 0);
    expect(preview?.basePower).toBe(0);
    expect(preview?.power).toBe(0);
    expect(preview?.stab).toBe(false);
  });

  it('reads the net accuracy stage into the hit percentage', () => {
    const attacker = player(['tackle']);
    const state = battle(attacker);
    expect(movePreview(state, 'player', 0)).toMatchObject({ baseAccuracy: 100, accuracy: 100 });
    attacker.boosts.accuracy = -1;
    expect(movePreview(state, 'player', 0)).toMatchObject({ accuracyStage: -1, accuracy: 75 });
  });

  it('reads a never-miss move as no accuracy', () => {
    const preview = movePreview(battle(player(['swift'])), 'player', 0);
    expect(preview?.baseAccuracy).toBeNull();
    expect(preview?.accuracy).toBeNull();
  });

  it('returns null for an empty slot', () => {
    expect(movePreview(battle(player(['tackle'])), 'player', 3)).toBeNull();
  });
});
