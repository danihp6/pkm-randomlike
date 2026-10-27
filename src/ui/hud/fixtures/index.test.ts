import { describe, expect, it, vi } from 'vitest';
import type { HudSink, HudState } from '../state';
import {
  fixtureFor,
  fixtureScreen,
  fixtureSlugs,
  holdForFixture,
  installFixture,
  isHudState,
  type FixtureModules,
  type HudFixture,
} from './index';

const MINIMAL: HudState = { party: [], bag: [], money: 0, route: null, battle: null, notice: null };

const LIVE: HudState = { ...MINIMAL, money: 42 };

const FIXTURE: HudFixture = { slug: '02-options', screen: 'options', state: MINIMAL };

function modules(entries: Readonly<Record<string, unknown>>): FixtureModules {
  return entries;
}

describe('isHudState', () => {
  it('accepts a minimal state and a full one', () => {
    expect(isHudState(MINIMAL)).toBe(true);
    expect(
      isHudState({
        party: [{ id: 'f1' }],
        bag: [{ itemId: 'potion' }],
        money: null,
        route: { biomeName: 'Añil' },
        battle: { turn: 2 },
        notice: { kind: 'item' },
      }),
    ).toBe(true);
  });

  it('rejects anything that is not a plain object', () => {
    for (const value of [null, undefined, 3, 'state', [], [{ party: [] }], new Map()]) {
      expect(isHudState(value), String(value)).toBe(false);
    }
  });

  it('rejects a missing or an extra key', () => {
    const withoutMoney = {
      party: MINIMAL.party,
      bag: MINIMAL.bag,
      route: MINIMAL.route,
      battle: MINIMAL.battle,
      notice: MINIMAL.notice,
    };
    expect(isHudState(withoutMoney)).toBe(false);
    expect(isHudState({ ...MINIMAL, extra: 1 })).toBe(false);
  });

  it('rejects a wrong kind on any of the six keys', () => {
    expect(isHudState({ ...MINIMAL, money: '3' })).toBe(false);
    expect(isHudState({ ...MINIMAL, money: Number.NaN })).toBe(false);
    expect(isHudState({ ...MINIMAL, money: Infinity })).toBe(false);
    expect(isHudState({ ...MINIMAL, party: null })).toBe(false);
    expect(isHudState({ ...MINIMAL, bag: {} })).toBe(false);
    expect(isHudState({ ...MINIMAL, route: [] })).toBe(false);
    expect(isHudState({ ...MINIMAL, battle: 'battle' })).toBe(false);
    expect(isHudState({ ...MINIMAL, notice: 0 })).toBe(false);
  });

  it('rejects a row without a non-empty id', () => {
    expect(isHudState({ ...MINIMAL, party: [null] })).toBe(false);
    expect(isHudState({ ...MINIMAL, party: ['f1'] })).toBe(false);
    expect(isHudState({ ...MINIMAL, party: [{ id: '' }] })).toBe(false);
    expect(isHudState({ ...MINIMAL, party: [{ name: 'Bulbasaur' }] })).toBe(false);
    expect(isHudState({ ...MINIMAL, bag: [{ id: 'potion' }] })).toBe(false);
    expect(isHudState({ ...MINIMAL, bag: [{ itemId: 4 }] })).toBe(false);
  });

  it('mutates nothing', () => {
    const state = { ...MINIMAL, party: [{ id: 'f1' }] };
    const copy = JSON.parse(JSON.stringify(state)) as unknown;
    expect(isHudState(state)).toBe(true);
    expect(state).toEqual(copy);
  });
});

describe('fixtureSlugs', () => {
  it('is ascending and skips non-JSON paths', () => {
    const map = modules({
      '../../../design/fixtures/03b-panels-row-view.json': {},
      '../../../design/fixtures/README.md': 'text',
      '../../../design/fixtures/02-options.json': {},
      '../../../design/fixtures/tokens': {},
    });
    expect(fixtureSlugs(map)).toEqual(['02-options', '03b-panels-row-view']);
  });

  it('is empty — never a throw — without any fixture', () => {
    expect(fixtureSlugs({})).toEqual([]);
    expect(fixtureSlugs(modules({ 'design/fixtures/notes.txt': 'x' }))).toEqual([]);
  });
});

describe('fixtureFor', () => {
  it('returns the fixture for a matching key, from either glob shape', () => {
    const direct = modules({ '../../../design/fixtures/02-options.json': FIXTURE });
    expect(fixtureFor(direct, '02-options')).toEqual(FIXTURE);
    const namespaced = modules({ '../../../design/fixtures/02-options.json': { default: FIXTURE } });
    expect(fixtureFor(namespaced, '02-options')).toEqual(FIXTURE);
  });

  it('is null for a slug the map does not carry', () => {
    const map = modules({ '../../../design/fixtures/02-options.json': FIXTURE });
    expect(fixtureFor(map, '03-route-hud')).toBeNull();
    expect(fixtureFor({}, '02-options')).toBeNull();
  });

  it('rejects a mismatched inner slug, an invalid state and a non-object value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(
        fixtureFor(
          modules({ '../../../design/fixtures/slug-mismatch.json': { ...FIXTURE, slug: 'other' } }),
          'slug-mismatch',
        ),
      ).toBeNull();
      expect(
        fixtureFor(
          modules({
            '../../../design/fixtures/bad-state.json': {
              slug: 'bad-state',
              state: { ...MINIMAL, money: '3' },
            },
          }),
          'bad-state',
        ),
      ).toBeNull();
      expect(
        fixtureFor(modules({ '../../../design/fixtures/not-object.json': 'oops' }), 'not-object'),
      ).toBeNull();
      expect(
        fixtureFor(modules({ '../../../design/fixtures/no-slug.json': MINIMAL }), 'no-slug'),
      ).toBeNull();
      expect(warn).toHaveBeenCalledTimes(4);
    } finally {
      warn.mockRestore();
    }
  });

  it('ignores a key whose basename is not the slug JSON', () => {
    const map = modules({ '../../../design/fixtures/02-options.txt': FIXTURE });
    expect(fixtureFor(map, '02-options')).toBeNull();
  });
});

describe('fixtureFor and the frame’s screen', () => {
  it('reads the screen beside the state, never inside it', () => {
    const framed = fixtureFor(
      modules({
        '../../../design/fixtures/03d-route-shop-buy.json': {
          slug: '03d-route-shop-buy',
          screen: 'shop',
          state: MINIMAL,
        },
      }),
      '03d-route-shop-buy',
    );
    expect(framed).toEqual({ slug: '03d-route-shop-buy', screen: 'shop', state: MINIMAL });
    expect(Object.keys(framed?.state ?? {})).toEqual([
      'party',
      'bag',
      'money',
      'route',
      'battle',
      'notice',
    ]);
  });

  it('is null for a frame that names no screen', () => {
    const framed = fixtureFor(
      modules({ '../../../design/fixtures/02-options.json': { slug: '02-options', state: MINIMAL } }),
      '02-options',
    );
    expect(framed?.screen).toBeNull();
  });

  it('yields a null screen for a malformed one instead of rejecting the frame', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(fixtureScreen('options')).toBe('options');
      expect(fixtureScreen('battle-switch')).toBe('battle-switch');
      for (const screen of [
        '',
        'Options',
        'o p',
        'a'.repeat(65),
        7,
        null,
        ['options'],
        { id: 'options' },
      ]) {
        expect(fixtureScreen(screen), String(screen)).toBeNull();
        const framed = fixtureFor(
          modules({
            '../../../design/fixtures/02-options.json': { slug: '02-options', screen, state: MINIMAL },
          }),
          '02-options',
        );
        expect(framed, String(screen)).toEqual({ slug: '02-options', screen: null, state: MINIMAL });
      }
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps rejecting a state that carries a seventh key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(
        fixtureFor(
          modules({
            '../../../design/fixtures/02-options.json': {
              slug: '02-options',
              screen: 'options',
              state: { ...MINIMAL, screen: 'options' },
            },
          }),
          '02-options',
        ),
      ).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('installFixture', () => {
  const map = modules({ '../../../design/fixtures/02-options.json': FIXTURE });

  it('is null without the DOM flag, without a slug, and for an unknown slug', () => {
    expect(installFixture({ dom: false, fixture: '02-options' }, map)).toBeNull();
    expect(installFixture({ dom: true, fixture: null }, map)).toBeNull();
    expect(installFixture({ dom: true, fixture: '03-route-hud' }, map)).toBeNull();
  });

  it('returns the fixture when both are present', () => {
    expect(installFixture({ dom: true, fixture: '02-options' }, map)).toEqual(FIXTURE);
  });
});

describe('holdForFixture', () => {
  it('returns the sink itself when there is no fixture', () => {
    const sink: HudSink = () => undefined;
    expect(holdForFixture(null, sink)).toBe(sink);
  });

  it('emits the fixture state once and drops every live emission after it', () => {
    const seen: HudState[] = [];
    const sink: HudSink = (state) => {
      seen.push(state);
    };
    const held = holdForFixture(FIXTURE, sink);
    expect(held).not.toBe(sink);
    expect(seen).toEqual([]);
    held(LIVE);
    held(LIVE);
    held(MINIMAL);
    expect(seen).toEqual([MINIMAL]);
    expect(seen[0]).toBe(FIXTURE.state);
  });
});

describe('a rejected fixture file warns once per page load', () => {
  it('names the path and the reason, and never throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const map = modules({
        '../../../design/fixtures/09-warn-once.json': { slug: 'nope', state: MINIMAL },
      });
      expect(fixtureFor(map, '09-warn-once')).toBeNull();
      expect(fixtureFor(map, '09-warn-once')).toBeNull();
      expect(fixtureFor(map, '09-warn-once')).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      const message = String(warn.mock.calls[0]?.[0]);
      expect(message).toContain('09-warn-once.json');
      expect(message).toContain('nope');
    } finally {
      warn.mockRestore();
    }
  });

  it('stays silent for an unknown slug and for an empty map', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(
        fixtureFor(modules({ '../../../design/fixtures/02-options.json': FIXTURE }), 'unknown'),
      ).toBeNull();
      expect(fixtureFor({}, 'unknown')).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
