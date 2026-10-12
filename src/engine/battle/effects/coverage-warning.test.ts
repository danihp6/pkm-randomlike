import { afterEach, expect, it, vi } from 'vitest';
import { moveCoverage, unportedMoveIds } from '../../../data/moveCoverage';
import { Rng } from '../../rng';
import { createFighter } from '../fighter';
import { createBattle, type BattleState } from '../state';
import { takeTurn } from '../turn';

vi.mock('../../../dev/env', () => ({ ENVIRONMENT: 'develop', IS_DEVELOP: true }));

afterEach(() => {
  vi.restoreAllMocks();
});

const fight = () => ({ type: 'fight', moveIndex: 0 }) as const;

const battleWith = (moveId: string): BattleState =>
  createBattle({
    player: [createFighter({ id: 'p', speciesId: 'charmander', level: 20, moves: [moveId] })],
    enemy: [createFighter({ id: 'e', speciesId: 'bulbasaur', level: 20, moves: [moveId] })],
    rng: new Rng(7),
    isWild: true,
  });

/** The move-kind lines of a `console.warn` spy, in call order. */
const moveLogs = (calls: readonly (readonly unknown[])[]): readonly string[] =>
  calls.map(([message]) => String(message)).filter((message) => message.startsWith('[coverage] move'));

it('warns when a battle meets an unported ability in a develop build', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  createBattle({
    player: [createFighter({ id: 'p', speciesId: 'charmander', level: 5, ability: 'Solar Power' })],
    enemy: [createFighter({ id: 'e', speciesId: 'bulbasaur', level: 5, ability: 'Chlorophyll' })],
    rng: new Rng(1),
    isWild: true,
  });

  expect(warn).toHaveBeenCalledWith(expect.stringContaining('Solar Power'));
});

it('warns once when a battle uses an unported move', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const moveId = unportedMoveIds()[0];

  takeTurn(battleWith(moveId), fight(), fight());

  expect(moveLogs(warn.mock.calls)).toEqual([
    `[coverage] move "${moveId}" has no ported effect (D16).`,
  ]);
});

it('stays silent for a move the engine models', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(moveCoverage('tackle')?.status).toBe('port');

  takeTurn(battleWith('tackle'), fight(), fight());

  expect(moveLogs(warn.mock.calls)).toEqual([]);
});
