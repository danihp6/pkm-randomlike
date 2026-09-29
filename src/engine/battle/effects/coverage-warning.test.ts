import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('../../../dev/env');
});

it('warns when a battle meets an unported ability in a develop build', async () => {
  vi.doMock('../../../dev/env', () => ({ ENVIRONMENT: 'develop', IS_DEVELOP: true }));

  const { Rng } = await import('../../rng');
  const { createFighter } = await import('../fighter');
  const { createBattle } = await import('../state');

  createBattle({
    player: [createFighter({ id: 'p', speciesId: 'charmander', level: 5, ability: 'Solar Power' })],
    enemy: [createFighter({ id: 'e', speciesId: 'bulbasaur', level: 5, ability: 'Chlorophyll' })],
    rng: new Rng(1),
    isWild: true,
  });

  expect(console.warn).toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Solar Power'));
});
