import { afterEach, expect, it, vi } from 'vitest';
import { moveCoverage } from '../../../data/moveCoverage';
import { Rng } from '../../rng';
import { createFighter } from '../fighter';
import { createBattle, type BattleState } from '../state';
import { takeTurn } from '../turn';

vi.mock('../../../dev/env', () => ({ ENVIRONMENT: 'develop', IS_DEVELOP: true }));

// The manifest no longer has a real gap to warn about, so the move warning is
// exercised by making one move look unported.
vi.mock('../../../data/moveCoverage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/moveCoverage')>();
  return { ...actual, isUnportedMove: (id: string) => id === 'tackle' };
});

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

it('warns when a battle meets an ability the registry does not know', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  createBattle({
    player: [createFighter({ id: 'p', speciesId: 'charmander', level: 5, ability: 'Ball Fetch' })],
    enemy: [createFighter({ id: 'e', speciesId: 'bulbasaur', level: 5, ability: 'Chlorophyll' })],
    rng: new Rng(1),
    isWild: true,
  });

  expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ball Fetch'));
});

it('warns once when a battle uses a move the manifest calls unported', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  takeTurn(battleWith('tackle'), fight(), fight());

  expect(moveLogs(warn.mock.calls)).toEqual([`[coverage] move "tackle" has no ported effect (D16).`]);
});

it('stays silent for a move the engine models', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(moveCoverage('ember')?.status).toBe('port');

  takeTurn(battleWith('ember'), fight(), fight());

  expect(moveLogs(warn.mock.calls)).toEqual([]);
});
