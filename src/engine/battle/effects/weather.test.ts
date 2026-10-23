import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { createFighter, type BattleFighter } from '../fighter';
import { activeFighter, createBattle, type BattleState } from '../state';
import { takeTurn } from '../turn';
import { WEATHER_TURNS, weatherChip, weatherFromMove, weatherImmune } from './weather';

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

describe('weather', () => {
  it('maps the weather moves to weather ids', () => {
    expect(weatherFromMove(getMove('sunnyday')!)).toBe('sun');
    expect(weatherFromMove(getMove('raindance')!)).toBe('rain');
    expect(weatherFromMove(getMove('sandstorm')!)).toBe('sand');
    expect(weatherFromMove(getMove('snowscape')!)).toBe('snow');
    expect(weatherFromMove(getMove('tackle')!)).toBeNull();
  });

  it('a weather ability sets it on switch-in', () => {
    const state = battle(
      fighter('player', 'politoed', 'Drizzle', ['growl']),
      fighter('enemy', 'bulbasaur', 'Overgrow', ['growl']),
    );
    expect(state.weather).toBe('rain');
    expect(state.weatherTurns).toBe(WEATHER_TURNS);
  });

  it('a weather move sets it and fails while it is already up', () => {
    const state = battle(
      fighter('player', 'charmander', 'Blaze', ['raindance', 'growl']),
      fighter('enemy', 'bulbasaur', 'Overgrow', ['growl']),
    );
    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(state.weather).toBe('rain');

    takeTurn(state, { type: 'fight', moveIndex: 0 }, { type: 'fight', moveIndex: 0 });
    expect(state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.fail')).toBe(
      true,
    );
  });

  it('sand chips non-immune Pokémon and spares Rock/Ground/Steel', () => {
    const charmander = fighter('player', 'charmander', 'Blaze', ['growl']);
    const bulbasaur = fighter('enemy', 'bulbasaur', 'Overgrow', ['growl']);
    const state = battle(charmander, bulbasaur);
    state.weather = 'sand';
    state.weatherTurns = WEATHER_TURNS;

    growlTurn(state);

    expect(activeFighter(state, 'player').hp).toBe(charmander.maxHp - Math.floor(charmander.maxHp / 16));
    expect(weatherChip(fighter('x', 'geodude', 'Sturdy'), 'sand')).toBe(0);
    expect(weatherImmune(fighter('x', 'geodude', 'Sturdy'), 'sand')).toBe(true);
    expect(weatherChip(fighter('x', 'charmander', 'Blaze'), 'sun')).toBe(0);
  });

  it('lasts five turns and then clears', () => {
    const state = battle(
      fighter('player', 'politoed', 'Drizzle', ['growl']),
      fighter('enemy', 'bulbasaur', 'Overgrow', ['growl']),
    );
    expect(state.weather).toBe('rain');

    for (let turn = 0; turn < WEATHER_TURNS; turn++) growlTurn(state);

    expect(state.weather).toBeNull();
    expect(
      state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.weather.end'),
    ).toBe(true);
  });
});
