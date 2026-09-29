import { afterEach, expect, it, vi } from 'vitest';
import { Rng } from '../../rng';
import { createFighter } from '../fighter';
import { createBattle } from '../state';

vi.mock('../../../dev/env', () => ({ ENVIRONMENT: 'develop', IS_DEVELOP: true }));

afterEach(() => {
  vi.restoreAllMocks();
});

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
