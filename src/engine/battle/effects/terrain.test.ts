import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { computeDamage } from '../damage';
import { createFighter, isGrounded, type BattleFighter } from '../fighter';
import { activeFighter, createBattle, type BattleState } from '../state';
import { takeTurn } from '../turn';
import { applyStatusEffect } from './apply';
import { TERRAIN_TURNS, terrainBlocksStatus, terrainFromMove, terrainHeal } from './terrain';

function fighter(
  id: string,
  speciesId: string,
  ability: string,
  moves?: readonly string[],
): BattleFighter {
  return createFighter({ id, speciesId, level: 20, ability, ...(moves ? { moves } : {}) });
}

function battle(player: BattleFighter, enemy: BattleFighter, seed = 5): BattleState {
  return createBattle({ player: [player], enemy: [enemy], rng: new Rng(seed), isWild: true });
}

function growlTurn(state: BattleState): void {
  takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
}

describe('terrain', () => {
  it('maps the terrain moves to terrain ids', () => {
    expect(terrainFromMove(getMove('electricterrain')!)).toBe('electric');
    expect(terrainFromMove(getMove('grassyterrain')!)).toBe('grassy');
    expect(terrainFromMove(getMove('mistyterrain')!)).toBe('misty');
    expect(terrainFromMove(getMove('psychicterrain')!)).toBe('psychic');
    expect(terrainFromMove(getMove('tackle')!)).toBeNull();
  });

  it('a surge ability sets it on switch-in', () => {
    const state = battle(
      fighter('player', 'pincurchin', 'Electric Surge', ['growl']),
      fighter('enemy', 'bulbasaur', 'Overgrow', ['growl']),
    );
    expect(state.terrain).toBe('electric');
    expect(state.terrainTurns).toBe(TERRAIN_TURNS);
  });

  it('a terrain move sets it', () => {
    const state = battle(
      fighter('player', 'charmander', 'Blaze', ['grassyterrain']),
      fighter('enemy', 'bulbasaur', 'Overgrow', ['growl']),
    );
    growlTurn(state);
    expect(state.terrain).toBe('grassy');
  });

  it('Grassy Terrain heals grounded Pokémon at the end of the turn', () => {
    const charmander = fighter('player', 'charmander', 'Blaze', ['growl']);
    const state = battle(charmander, fighter('enemy', 'bulbasaur', 'Overgrow', ['growl']));
    state.terrain = 'grassy';
    state.terrainTurns = TERRAIN_TURNS;
    charmander.hp = 10;

    growlTurn(state);

    expect(activeFighter(state, 'player').hp).toBe(10 + Math.floor(charmander.maxHp / 16));
    expect(terrainHeal(fighter('x', 'charizard', 'Blaze'), 'grassy')).toBe(0);
  });

  it('Electric Terrain stops grounded Pokémon falling asleep; Misty stops any status', () => {
    const state = battle(
      fighter('player', 'charmander', 'Blaze'),
      fighter('enemy', 'bulbasaur', 'Overgrow'),
    );
    const enemy = activeFighter(state, 'enemy');

    expect(terrainBlocksStatus('electric', enemy, 'slp')).not.toBeNull();
    expect(terrainBlocksStatus('electric', enemy, 'brn')).toBeNull();
    expect(terrainBlocksStatus('misty', enemy, 'brn')).not.toBeNull();

    state.terrain = 'electric';
    applyStatusEffect(state, 'enemy', enemy, 'slp');
    expect(enemy.status).toBeNull();

    state.terrain = 'misty';
    applyStatusEffect(state, 'enemy', enemy, 'brn');
    expect(enemy.status).toBeNull();
  });

  it('terrain does not protect an ungrounded Pokémon', () => {
    expect(isGrounded(fighter('x', 'charizard', 'Blaze'))).toBe(false);
    expect(isGrounded(fighter('x', 'charmander', 'Blaze'))).toBe(true);

    const charizard = fighter('player', 'charizard', 'Blaze');
    const state = battle(charizard, fighter('enemy', 'bulbasaur', 'Overgrow'));
    state.terrain = 'electric';

    applyStatusEffect(state, 'player', charizard, 'slp');
    expect(charizard.status).toBe('slp');
  });

  it('modifies damage: Electric boosted, Misty Dragon halved, Grassy Earthquake halved', () => {
    const attacker = fighter('a', 'charmander', 'Blaze');
    const defender = fighter('d', 'bulbasaur', 'Overgrow');
    const roll = () => new Rng(42);

    const electric = getMove('thunderbolt')!;
    expect(
      computeDamage(attacker, defender, electric, roll(), { critical: false, terrain: 'electric' })
        .damage,
    ).toBeGreaterThan(computeDamage(attacker, defender, electric, roll(), { critical: false }).damage);

    const dragon = getMove('dragonclaw')!;
    expect(
      computeDamage(attacker, defender, dragon, roll(), { critical: false, terrain: 'misty' }).damage,
    ).toBeLessThan(computeDamage(attacker, defender, dragon, roll(), { critical: false }).damage);

    const quake = getMove('earthquake')!;
    expect(
      computeDamage(attacker, defender, quake, roll(), { critical: false, terrain: 'grassy' }).damage,
    ).toBeLessThan(computeDamage(attacker, defender, quake, roll(), { critical: false }).damage);
  });

  it('an ungrounded attacker gets no terrain boost', () => {
    const flyer = fighter('a', 'charizard', 'Blaze');
    const defender = fighter('d', 'bulbasaur', 'Overgrow');
    const electric = getMove('thunderbolt')!;

    expect(
      computeDamage(flyer, defender, electric, new Rng(7), { critical: false, terrain: 'electric' })
        .damage,
    ).toBe(computeDamage(flyer, defender, electric, new Rng(7), { critical: false }).damage);
  });
});
