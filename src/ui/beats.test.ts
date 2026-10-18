import { describe, expect, it } from 'vitest';
import type { RunPokemon } from '../engine/run';
import {
  ENTRY_FADE_MS,
  ENTRY_FLASH_MS,
  ENTRY_FOE_APPEAR_MS,
  ENTRY_FOE_DROP,
  ENTRY_SENDOUT_MS,
  ENTRY_TRAINER_APPEAR_MS,
  ENTRY_TRAINER_WALK,
  entryBeat,
  levelUpBeats,
} from './beats';

function member(
  id: string,
  level: number,
  options: Readonly<{ speciesId?: string; moves?: readonly string[] }> = {},
): RunPokemon {
  return {
    fighter: {
      id,
      speciesId: options.speciesId ?? 'charmander',
      level,
      nature: 'Hardy',
      ability: 'Blaze',
      gender: 'male',
      shiny: false,
      heldItem: null,
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      moves: (options.moves ?? ['ember']).map((moveId) => ({ moveId, pp: 10, maxPp: 10 })),
      hp: 20,
      status: null,
      statusCounter: 0,
    },
  };
}

describe('levelUpBeats', () => {
  it('reports the level range of a member that grew', () => {
    const before = [member('a', 5)];
    const after = [member('a', 7)];
    expect(levelUpBeats(before, after)).toEqual([
      {
        id: 'a',
        fromLevel: 5,
        toLevel: 7,
        evolvedInto: null,
        learned: [],
        forgotten: [],
      },
    ]);
  });

  it('ignores members that did not change level', () => {
    const before = [member('a', 5)];
    const after = [{ ...member('a', 5), fighter: { ...member('a', 5).fighter, hp: 5 } }];
    expect(levelUpBeats(before, after)).toEqual([]);
  });

  it('ignores a released member and a fresh catch', () => {
    const before = [member('a', 5), member('b', 4)];
    const after = [member('a', 6), member('caught', 4)];
    expect(levelUpBeats(before, after).map((beat) => beat.id)).toEqual(['a']);
  });

  it('flags the species it evolved into', () => {
    const before = [member('a', 15, { speciesId: 'charmander' })];
    const after = [member('a', 16, { speciesId: 'charmeleon' })];
    expect(levelUpBeats(before, after)[0].evolvedInto).toBe('charmeleon');
  });

  it('lists the moves learned and forgotten across the level-up', () => {
    const before = [member('a', 5, { moves: ['scratch', 'growl', 'ember', 'smokescreen'] })];
    const after = [member('a', 6, { moves: ['growl', 'ember', 'smokescreen', 'dragonbreath'] })];
    const beat = levelUpBeats(before, after)[0];
    expect(beat.learned).toEqual(['dragonbreath']);
    expect(beat.forgotten).toEqual(['scratch']);
  });

  it('keeps the party order of the survivors', () => {
    const before = [member('a', 5), member('b', 5), member('c', 5)];
    const after = [member('c', 6), member('a', 7), member('b', 5)];
    expect(levelUpBeats(before, after).map((beat) => beat.id)).toEqual(['c', 'a']);
  });
});

describe('entryBeat', () => {
  it('opens a wild battle with the fade, one flash and the foe dropping in', () => {
    expect(entryBeat('wild', false)).toEqual([
      { kind: 'fade', ms: ENTRY_FADE_MS },
      { kind: 'flash', ms: ENTRY_FLASH_MS },
      { kind: 'foe-appear', ms: ENTRY_FOE_APPEAR_MS },
    ]);
  });

  it('walks the trainer in before the send-out in a trainer battle', () => {
    expect(entryBeat('trainer', false)).toEqual([
      { kind: 'fade', ms: ENTRY_FADE_MS },
      { kind: 'flash', ms: ENTRY_FLASH_MS },
      { kind: 'trainer-appear', ms: ENTRY_TRAINER_APPEAR_MS },
      { kind: 'sendout', ms: ENTRY_SENDOUT_MS },
    ]);
  });

  it('drops the flash and keeps the rest under reduce flashing', () => {
    for (const kind of ['wild', 'trainer'] as const) {
      const steps = entryBeat(kind, true);
      expect(steps.some((step) => step.kind === 'flash')).toBe(false);
      expect(steps).toEqual(entryBeat(kind, false).filter((step) => step.kind !== 'flash'));
    }
  });

  it('keeps the fade first and the appearing step last in both flavours', () => {
    for (const reducedFlash of [false, true]) {
      for (const kind of ['wild', 'trainer'] as const) {
        const steps = entryBeat(kind, reducedFlash);
        expect(steps[0]).toEqual({ kind: 'fade', ms: ENTRY_FADE_MS });
        expect(steps[steps.length - 1].kind).toBe(kind === 'wild' ? 'foe-appear' : 'sendout');
      }
    }
  });

  it("states each step with the module's own timing", () => {
    expect([
      ENTRY_FADE_MS,
      ENTRY_FLASH_MS,
      ENTRY_FOE_APPEAR_MS,
      ENTRY_TRAINER_APPEAR_MS,
      ENTRY_SENDOUT_MS,
      ENTRY_FOE_DROP,
      ENTRY_TRAINER_WALK,
    ]).toEqual([320, 220, 300, 280, 260, 26, 22]);
    expect(entryBeat('wild', false).map((step) => step.ms)).toEqual([
      ENTRY_FADE_MS,
      ENTRY_FLASH_MS,
      ENTRY_FOE_APPEAR_MS,
    ]);
    expect(entryBeat('trainer', false).map((step) => step.ms)).toEqual([
      ENTRY_FADE_MS,
      ENTRY_FLASH_MS,
      ENTRY_TRAINER_APPEAR_MS,
      ENTRY_SENDOUT_MS,
    ]);
  });
});
