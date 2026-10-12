import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('./env');
});

describe('coverage warnings', () => {
  it('is silent outside a develop build', async () => {
    const { warnUnportedEffect } = await import('./warnings');
    warnUnportedEffect('ability', 'plus');
    warnUnportedEffect('move', 'steamroller');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('warns once per unported effect in a develop build', async () => {
    vi.doMock('./env', () => ({ ENVIRONMENT: 'develop', IS_DEVELOP: true }));
    const { warnUnportedEffect } = await import('./warnings');

    warnUnportedEffect('ability', 'plus');
    warnUnportedEffect('ability', 'plus');
    warnUnportedEffect('item', 'leftovers');
    warnUnportedEffect('move', 'steamroller');
    warnUnportedEffect('move', 'steamroller');

    expect(console.warn).toHaveBeenCalledTimes(3);
  });

  it('names the kind and the id in the message', async () => {
    vi.doMock('./env', () => ({ ENVIRONMENT: 'develop', IS_DEVELOP: true }));
    const { warnUnportedEffect } = await import('./warnings');

    warnUnportedEffect('move', 'steamroller');

    expect(console.warn).toHaveBeenCalledWith(
      '[coverage] move "steamroller" has no ported effect (D16).',
    );
  });
});
