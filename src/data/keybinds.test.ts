import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KEYBINDS,
  KEYBIND_ACTIONS,
  KEYBIND_LABELS,
  KEY_ALIASES,
  MOVE_ACTIONS,
  MOVE_ALIASES,
  actionForKey,
  isKeyName,
  keyLabel,
  keysForAction,
  sanitizeKeybinds,
  withBinding,
  type Keybinds,
} from './keybinds';

describe('defaults', () => {
  it('binds every action, each to its own key bar the shared accept key', () => {
    for (const action of KEYBIND_ACTIONS) expect(DEFAULT_KEYBINDS[action]).toBeTruthy();
    expect(DEFAULT_KEYBINDS.interact).toBe(DEFAULT_KEYBINDS.confirm);
    const keys = KEYBIND_ACTIONS.filter((action) => action !== 'interact').map(
      (action) => DEFAULT_KEYBINDS[action],
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every action a display label and lists the four move keys', () => {
    for (const action of KEYBIND_ACTIONS) expect(KEYBIND_LABELS[action]).toBeTruthy();
    expect(MOVE_ACTIONS).toEqual(['up', 'down', 'left', 'right']);
  });

  it('gives each direction WASD beside its arrow, and no other action an alias', () => {
    expect(MOVE_ALIASES.up).toEqual(['W']);
    expect(MOVE_ALIASES.down).toEqual(['S']);
    expect(MOVE_ALIASES.left).toEqual(['A']);
    expect(MOVE_ALIASES.right).toEqual(['D']);
    for (const action of KEYBIND_ACTIONS) {
      if (MOVE_ACTIONS.includes(action)) continue;
      expect(MOVE_ALIASES[action]).toBeUndefined();
    }
  });
});

describe('keysForAction', () => {
  it('returns the binding first, then the movement aliases', () => {
    expect(keysForAction(DEFAULT_KEYBINDS, 'up')).toEqual(['UP', 'W']);
    expect(keysForAction(DEFAULT_KEYBINDS, 'right')).toEqual(['RIGHT', 'D']);
  });

  it('returns only the binding for an action with no aliases', () => {
    expect(keysForAction(DEFAULT_KEYBINDS, 'confirm')).toEqual(['E']);
    expect(keysForAction(DEFAULT_KEYBINDS, 'hud')).toEqual(['I']);
  });

  it('keeps every key it is given distinct', () => {
    const rebound = withBinding(DEFAULT_KEYBINDS, 'up', 'W');
    expect(keysForAction(rebound, 'up')).toEqual(['W']);
  });
});

describe('actionForKey', () => {
  it('resolves every binding', () => {
    expect(actionForKey(DEFAULT_KEYBINDS, 'E')).toBe('confirm');
    expect(actionForKey(DEFAULT_KEYBINDS, 'Q')).toBe('cancel');
    expect(actionForKey(DEFAULT_KEYBINDS, 'UP')).toBe('up');
    expect(actionForKey(DEFAULT_KEYBINDS, 'I')).toBe('hud');
    expect(actionForKey(DEFAULT_KEYBINDS, 'P')).toBeNull();
    expect(actionForKey(DEFAULT_KEYBINDS, 'O')).toBe('settings');
    expect(actionForKey(DEFAULT_KEYBINDS, 'Z')).toBeNull();
  });

  it('answers the always-on confirm/cancel aliases', () => {
    for (const [key, action] of Object.entries(KEY_ALIASES)) {
      expect(actionForKey(DEFAULT_KEYBINDS, key)).toBe(action);
    }
    expect(actionForKey(DEFAULT_KEYBINDS, 'Y')).toBeNull();
  });

  it('lets an explicit binding win over an alias', () => {
    const rebound = withBinding(DEFAULT_KEYBINDS, 'settings', 'ESC');
    expect(actionForKey(rebound, 'ESC')).toBe('settings');
  });
});

describe('withBinding', () => {
  it('rebinds one action to a free key', () => {
    const next = withBinding(DEFAULT_KEYBINDS, 'confirm', 'K');
    expect(next.confirm).toBe('K');
    expect(next.cancel).toBe('Q');
    expect(DEFAULT_KEYBINDS.confirm).toBe('E');
  });

  it('swaps when the new key was taken, so no key is ambiguous', () => {
    const next = withBinding(DEFAULT_KEYBINDS, 'up', 'Q');
    expect(next.up).toBe('Q');
    expect(next.cancel).toBe('UP');
  });

  it('keeps a rebind to its own current key a no-op', () => {
    expect(withBinding(DEFAULT_KEYBINDS, 'confirm', 'E')).toEqual(DEFAULT_KEYBINDS);
  });
});

describe('sanitizeKeybinds', () => {
  it('fills a missing, malformed or non-record value with the defaults', () => {
    expect(sanitizeKeybinds(undefined)).toEqual(DEFAULT_KEYBINDS);
    expect(sanitizeKeybinds({})).toEqual(DEFAULT_KEYBINDS);
    expect(sanitizeKeybinds('nope')).toEqual(DEFAULT_KEYBINDS);
    expect(sanitizeKeybinds({ confirm: 42, cancel: '' })).toEqual(DEFAULT_KEYBINDS);
  });

  it('keeps the bindings it can read', () => {
    const parsed = sanitizeKeybinds({ confirm: 'Q', up: 'W' });
    expect(parsed.confirm).toBe('Q');
    expect(parsed.up).toBe('W');
    expect(parsed.cancel).toBe(DEFAULT_KEYBINDS.cancel);
  });

  it('resolves a duplicate key by keeping the first action and defaulting the rest', () => {
    const parsed = sanitizeKeybinds({ confirm: 'Z', cancel: 'Z' });
    expect(parsed.confirm).toBe('Z');
    expect(parsed.cancel).toBe(DEFAULT_KEYBINDS.cancel);
  });

  it('casts a stale binding style to the current single-key map', () => {
    const parsed = sanitizeKeybinds({ confirm: ['Z', 'SPACE'] } as unknown);
    expect(parsed).toEqual(DEFAULT_KEYBINDS);
  });
});

describe('labels', () => {
  it('prints arrows and named keys, and falls back to the name', () => {
    expect(keyLabel('UP')).toBe('\u2191');
    expect(keyLabel('ESC')).toBe('Esc');
    expect(keyLabel('SPACE')).toBe('Space');
    expect(keyLabel('Z')).toBe('Z');
  });

  it('accepts only plausible key names', () => {
    expect(isKeyName('Z')).toBe(true);
    expect(isKeyName('NUMPAD_ONE')).toBe(true);
    expect(isKeyName('')).toBe(false);
    expect(isKeyName('not a key')).toBe(false);
    expect(isKeyName(7)).toBe(false);
  });
});

describe('round trips', () => {
  it('rebinding to a displaced action and back returns the original map', () => {
    const swapped = withBinding(DEFAULT_KEYBINDS, 'up', 'X');
    const back = withBinding(swapped, 'up', 'UP');
    const original: Keybinds = DEFAULT_KEYBINDS;
    expect(back).toEqual(original);
  });
});
