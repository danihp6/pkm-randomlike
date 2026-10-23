import { afterEach, describe, expect, it } from 'vitest';
import { scriptedBattle } from '../engine/battle/harness';
import type { BattleEvent, BattleTextKey } from '../engine/battle/state';
import { abilityNameFromEnglish, moveName } from '../i18n/content';
import { setLocale, t } from '../i18n';
import { battleFrames, battleMessage, frameMessage } from './feed';

afterEach(() => {
  setLocale('en');
});

/** The golden battle's own teams and seed (`golden.test.ts`). */
const GOLDEN = (): readonly BattleEvent[] =>
  scriptedBattle({
    player: [{ id: 'player', speciesId: 'charmander', level: 20, moves: ['ember', 'growl'] }],
    enemy: [{ id: 'enemy', speciesId: 'bulbasaur', level: 18, moves: ['vinewhip', 'tackle'] }],
  }).log;

const messageOf = (key: BattleTextKey, params?: Readonly<Record<string, string | number>>): string =>
  battleMessage(params === undefined ? { key } : { key, params });

describe('battle feed frames', () => {
  it('groups the events before each message into one frame', () => {
    const events: BattleEvent[] = [
      { kind: 'turn', turn: 1 },
      { kind: 'move', side: 'player', moveId: 'tackle' },
      { kind: 'text', key: 'battle.log.used', params: { name: 'Charmander', move: 'tackle' } },
      { kind: 'damage', side: 'enemy', amount: 5, hp: 15, maxHp: 20, effectiveness: 1, crit: false },
      { kind: 'text', key: 'battle.log.enduredHit', params: { name: 'Charmander' } },
    ];
    const frames = battleFrames(events);
    expect(frames).toHaveLength(2);
    expect(frames[0].message).toBe('Charmander used Tackle!');
    expect(frames[0].events.map((event) => event.kind)).toEqual(['turn', 'move', 'text']);
    expect(frames[1].message).toBe('Charmander endured the hit!');
    expect(frames[1].events.map((event) => event.kind)).toEqual(['damage', 'text']);
  });

  it('collects events after the last message into a silent frame', () => {
    const events: BattleEvent[] = [
      { kind: 'text', key: 'battle.log.sendOut', params: { name: 'Player', target: 'Pikachu' } },
      { kind: 'turn', turn: 1 },
      { kind: 'damage', side: 'player', amount: 3, hp: 7, maxHp: 10, effectiveness: 1, crit: false },
    ];
    const frames = battleFrames(events);
    expect(frames).toHaveLength(2);
    expect(frames[0].message).toBe('Player sent out Pikachu!');
    expect(frames[1].message).toBeNull();
    expect(frameMessage(frames[1])).toBeNull();
    expect(frames[1].events.map((event) => event.kind)).toEqual(['turn', 'damage']);
  });

  it('returns nothing for an empty log', () => {
    expect(battleFrames([])).toEqual([]);
  });
});

describe('battleMessage', () => {
  it('inserts a plain param verbatim', () => {
    expect(messageOf('battle.log.fainted', { name: 'Bulbasaur' })).toBe('Bulbasaur fainted!');
    expect(messageOf('battle.log.fail')).toBe('But it failed!');
  });

  it('resolves the move param through the move table', () => {
    expect(messageOf('battle.log.used', { name: 'Charmander', move: 'ember' })).toBe(
      'Charmander used Ember!',
    );
    setLocale('es');
    expect(messageOf('battle.log.used', { name: 'Charmander', move: 'ember' })).toBe(
      t('battle.log.used', { name: 'Charmander', move: moveName('ember') }),
    );
  });

  it('resolves the ability param through the ability table', () => {
    setLocale('es');
    expect(
      messageOf('battle.log.ability.typeImmunity', { name: 'Vaporeon', ability: 'Water Absorb' }),
    ).toBe(
      t('battle.log.ability.typeImmunity', {
        name: 'Vaporeon',
        ability: abilityNameFromEnglish('Water Absorb'),
      }),
    );
  });

  it('resolves the item param to its English name, and leaves the type param alone', () => {
    expect(messageOf('battle.log.usedItem', { name: 'Player', item: 'potion' })).toBe(
      'Player used Potion.',
    );
    expect(messageOf('battle.log.typeChanged', { name: 'Ditto', type: 'Water' })).toBe(
      'Ditto transformed into the Water type!',
    );
  });

  it('reads the locale when the frame is built, not at module load', () => {
    const frame = (): string | null =>
      battleFrames([{ kind: 'text', key: 'battle.log.fainted', params: { name: 'Eevee' } }])[0]
        ?.message ?? null;
    expect(frame()).toBe('Eevee fainted!');
    setLocale('es');
    expect(frame()).toBe(t('battle.log.fainted', { name: 'Eevee' }));
    expect(frame()).not.toBe('Eevee fainted!');
  });
});

describe('the golden battle in both locales', () => {
  for (const locale of ['en', 'es'] as const) {
    it(`draws every gate as ${locale} text with no unresolved token`, () => {
      setLocale(locale);
      const frames = battleFrames(GOLDEN());
      // The trailing `end` event is the one beat with no line of its own.
      const spoken = frames.filter((frame) => frame.events.some((event) => event.kind === 'text'));
      expect(spoken.length).toBeGreaterThan(0);
      for (const frame of spoken) {
        expect(frame.message).not.toBeNull();
        expect(frame.message).not.toBe('');
        expect(frame.message).not.toContain('{');
        expect(frame.message).not.toContain('}');
      }
    });
  }

  it('draws the used line in Spanish, with the localised move name', () => {
    setLocale('es');
    const frames = battleFrames(GOLDEN());
    const used = frames.filter(
      (frame) => frame.message === t('battle.log.used', { name: 'Charmander', move: moveName('ember') }),
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used[0].message).toContain('Ascuas');
    expect(used[0].message).not.toContain('Ember');
  });

  it('keeps the English log the sentences it already printed', () => {
    expect(messageOf('battle.log.used', { name: 'Charmander', move: 'ember' })).toBe(
      'Charmander used Ember!',
    );
    expect(messageOf('battle.log.hitSuper', { name: 'Bulbasaur', move: 'ember' })).toBe(
      "Ember hit Bulbasaur! It's super effective!",
    );
    expect(messageOf('battle.log.fainted', { name: 'Bulbasaur' })).toBe('Bulbasaur fainted!');
  });
});
