import { afterEach, describe, expect, it } from 'vitest';
import { Rng } from '../engine/rng';
import { createFighter } from '../engine/battle/fighter';
import {
  createBattle,
  emptyFieldConditions,
  emptySideConditions,
  type BattleState,
} from '../engine/battle/state';
import { setLocale } from '../i18n';
import {
  FIELD_CONDITION_IDS,
  SIDE_CONDITION_IDS,
  battleInfoLines,
  battleInfoRows,
  type BattleInfoGroup,
} from './battleInfo';

afterEach(() => {
  setLocale('en');
});

function battle(): BattleState {
  return createBattle({
    player: [createFighter({ id: 'player', speciesId: 'charmander', level: 20, nature: 'serious' })],
    enemy: [createFighter({ id: 'enemy', speciesId: 'bulbasaur', level: 18, nature: 'serious' })],
    rng: new Rng(2026),
    isWild: true,
  });
}

function groupOf(state: BattleState, index: number): BattleInfoGroup {
  return battleInfoRows(state)[index];
}

const FIELD = 0;
const YOU = 1;
const FOE = 2;

describe('battleInfoRows', () => {
  it('opens on three empty groups, with the nothing line in the field one', () => {
    const state = battle();
    const groups = battleInfoRows(state);
    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.heading)).toEqual(['FIELD', 'YOUR SIDE', 'FOE SIDE']);
    expect(groups[FIELD].rows).toEqual([{ label: 'Nothing is up.', value: '' }]);
    expect(groups[YOU].rows).toEqual([]);
    expect(groups[FOE].rows).toEqual([]);
    expect(battleInfoLines(groups)).toEqual(['FIELD', 'Nothing is up.']);
  });

  it('lists the weather, the terrain and the field conditions with their counts', () => {
    const state = battle();
    state.weather = 'sun';
    state.weatherTurns = 5;
    state.terrain = 'grassy';
    state.terrainTurns = 3;
    state.field.trickroom = 2;
    state.field.gravity = 0;
    expect(groupOf(state, FIELD).rows).toEqual([
      { label: 'WEATHER', value: 'Sun · 5' },
      { label: 'TERRAIN', value: 'Grassy · 3' },
      { label: 'Trick Room · 2', value: '' },
    ]);
    expect(groupOf(state, YOU).rows).toEqual([]);
  });

  it('lists the side conditions, then the stat stages in BOOST_IDS order, then the status', () => {
    const state = battle();
    state.sides.player.sideConditions.reflect = 4;
    state.sides.player.sideConditions.lightscreen = 0;
    const player = state.sides.player.party[0];
    player.boosts.atk = 2;
    player.boosts.spe = -1;
    player.status = 'brn';
    expect(groupOf(state, YOU).rows).toEqual([
      { label: 'Reflect · 4', value: '' },
      { label: 'ATTACK', value: '+2' },
      { label: 'SPEED', value: '-1' },
      { label: 'STATUS', value: 'BRN' },
    ]);
  });

  it('walks the stats in BOOST_IDS order, skipping the zero stages and keeping the extremes', () => {
    const state = battle();
    const player = state.sides.player.party[0];
    player.boosts.atk = 6;
    player.boosts.def = 0;
    player.boosts.spa = 3;
    player.boosts.spd = 0;
    player.boosts.spe = -6;
    player.boosts.accuracy = 1;
    player.boosts.evasion = -2;
    expect(groupOf(state, YOU).rows.map((row) => row.label)).toEqual([
      'ATTACK',
      'SP. ATK',
      'SPEED',
      'ACCURACY',
      'EVASION',
    ]);
    expect(groupOf(state, YOU).rows.map((row) => row.value)).toEqual(['+6', '+3', '-6', '+1', '-2']);
  });

  it('never lists the volatiles, the wish or the entry hazards', () => {
    const state = battle();
    const clean = groupOf(state, FOE).rows;
    const enemy = state.sides.enemy.party[0];
    enemy.volatiles.confusion = 3;
    enemy.volatiles.leechSeed = true;
    enemy.volatiles.substitute = 1;
    enemy.volatiles.taunt = 2;
    state.sides.enemy.wishTurns = 2;
    state.sides.enemy.batonPassBoosts = { atk: 2 };
    expect(groupOf(state, FOE).rows).toEqual(clean);
    expect(groupOf(state, FOE).rows).toEqual([]);
  });

  it('reports each side from its own active fighter', () => {
    const state = battle();
    state.sides.enemy.sideConditions.auroraveil = 3;
    state.sides.enemy.party[0].boosts.def = 1;
    state.sides.enemy.party[0].status = 'par';
    expect(groupOf(state, FOE).rows).toEqual([
      { label: 'Aurora Veil · 3', value: '' },
      { label: 'DEFENSE', value: '+1' },
      { label: 'STATUS', value: 'PAR' },
    ]);
    expect(groupOf(state, YOU).rows).toEqual([]);
  });

  it('lists every condition the engine can set, in the engine’s own order', () => {
    const state = battle();
    for (const id of FIELD_CONDITION_IDS) state.field[id] = 1;
    for (const id of SIDE_CONDITION_IDS) state.sides.player.sideConditions[id] = 1;
    expect(groupOf(state, FIELD).rows).toHaveLength(FIELD_CONDITION_IDS.length);
    expect(groupOf(state, YOU).rows).toHaveLength(SIDE_CONDITION_IDS.length);
  });

  it('keeps the condition lists a permutation of the engine’s own tables', () => {
    expect([...FIELD_CONDITION_IDS].sort()).toEqual(Object.keys(emptyFieldConditions()).sort());
    expect([...SIDE_CONDITION_IDS].sort()).toEqual(Object.keys(emptySideConditions()).sort());
  });
});

describe('battleInfoLines', () => {
  it('joins a row with two spaces, a valueless row as its label alone', () => {
    expect(
      battleInfoLines([
        {
          heading: 'FIELD',
          rows: [
            { label: 'A', value: '1' },
            { label: 'B', value: '' },
          ],
        },
        { heading: 'EMPTY', rows: [] },
      ]),
    ).toEqual(['FIELD', 'A  1', 'B']);
  });

  it('draws the whole state as one list', () => {
    const state = battle();
    state.weather = 'rain';
    state.weatherTurns = 2;
    state.sides.player.sideConditions.tailwind = 1;
    expect(battleInfoLines(battleInfoRows(state))).toEqual([
      'FIELD',
      'WEATHER  Rain · 2',
      'YOUR SIDE',
      'Tailwind · 1',
    ]);
  });

  it('yields nothing for no groups', () => {
    expect(battleInfoLines([])).toEqual([]);
  });
});

describe('locale', () => {
  it('renders the Spanish table when the locale is Spanish', () => {
    const state = battle();
    state.weather = 'sun';
    state.weatherTurns = 4;
    setLocale('es');
    const groups = battleInfoRows(state);
    expect(groups[FIELD].heading).toBe('CAMPO');
    expect(groups[FIELD].rows[0]).toEqual({ label: 'CLIMA', value: 'Sol · 4' });
    expect(groups[YOU].heading).toBe('TU LADO');
    expect(groups[FOE].heading).toBe('LADO RIVAL');
  });

  it('renders the Spanish nothing line and resets with the locale', () => {
    setLocale('es');
    expect(battleInfoLines(battleInfoRows(battle()))).toEqual(['CAMPO', 'No hay nada activo.']);
  });
});
