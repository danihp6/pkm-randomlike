import { describe, expect, it } from 'vitest';
import { hasArt } from '../../assets/art';
import { AUDIO_CUE_IDS } from '../../audio/cues';
import { allMoves, getSpecies, playableSpecies } from '../dex';
import { CRY_ROW_COUNT, MOVE_SOUND_ROW_COUNT, cryCueFor, moveSoundCueFor } from './index';
import criesData from './cries.json';
import moveSoundsData from './moveSounds.json';

// The two tables are generated artifacts (`scripts/frlg/render-frlg-audio.mjs`),
// so they are measured against the dex and the cue vocabulary that ship instead
// of trusted: a row that names a cue the build does not carry, or a species the
// decompilation has no cry for, fails here rather than at runtime.

const CRY_MAX_NUM = 386;

const CUES = new Set<string>(AUDIO_CUE_IDS);
const CRY_CUES = criesData as Readonly<Record<string, string>>;
const MOVE_SOUND_CUES = moveSoundsData as Readonly<Record<string, string>>;

describe.skipIf(!hasArt('audio'))('the cry table', () => {
  it('carries one row per species the decompilation has a cry for', () => {
    expect(CRY_ROW_COUNT).toBe(455);
    const expected = playableSpecies()
      .filter((species) => species.num >= 1 && species.num <= CRY_MAX_NUM)
      .map((species) => species.id)
      .sort();
    expect(Object.keys(CRY_CUES).sort()).toEqual(expected);
  });

  it('has no row for a species the decompilation never carried a sample for', () => {
    for (const species of playableSpecies()) {
      if (species.num >= 1 && species.num <= CRY_MAX_NUM) continue;
      expect(cryCueFor(species.id), species.id).toBeNull();
    }
    expect(cryCueFor('turtwig')).toBeNull();
    expect(cryCueFor('not-a-species')).toBeNull();
  });

  it('points every row at a committed cry cue', () => {
    for (const [speciesId, cue] of Object.entries(CRY_CUES)) {
      expect(cue, speciesId).toMatch(/^cry-/);
      expect(CUES.has(cue), cue).toBe(true);
    }
  });

  it('pins the names the normalization has to survive', () => {
    expect(cryCueFor('bulbasaur')).toBe('cry-bulbasaur');
    expect(cryCueFor('mrmime')).toBe('cry-mr-mime');
    expect(cryCueFor('nidoranf')).toBe('cry-nidoran-f');
    expect(cryCueFor('hooh')).toBe('cry-ho-oh');
    // A forme resolves through its raw base species: Raichu-Alola -> Cry_Raichu.
    expect(cryCueFor('raichualola')).toBe('cry-raichu');
    expect(getSpecies('raichualola')?.num).toBe(26);
    // The accessor normalizes like the dex does, so a display name still lands.
    expect(cryCueFor('Pikachu')).toBe('cry-pikachu');
  });
});

describe.skipIf(!hasArt('audio'))('the move-sound table', () => {
  it('carries one row per move whose own animation plays a sound', () => {
    expect(MOVE_SOUND_ROW_COUNT).toBe(295);
    const moveIds = new Set(allMoves().map((move) => move.id));
    for (const moveId of Object.keys(MOVE_SOUND_CUES)) {
      expect(moveIds.has(moveId), moveId).toBe(true);
    }
  });

  it('points every row at a committed move cue', () => {
    for (const [moveId, cue] of Object.entries(MOVE_SOUND_CUES)) {
      expect(cue, moveId).toMatch(/^move-/);
      expect(CUES.has(cue), cue).toBe(true);
    }
    // The vocabulary is the family, not the table: more move sounds ship than
    // the table points at, so a later mapping is a row here, not an asset.
    expect(AUDIO_CUE_IDS.filter((id) => id.startsWith('move-')).length).toBe(130);
  });

  it('pins the moves a player will actually press, and the cartridge renames', () => {
    expect(moveSoundCueFor('absorb')).toBe('move-absorb');
    expect(moveSoundCueFor('tackle')).toBe('move-comet-punch');
    // The cartridge's own labels for these three are not our move ids.
    expect(moveSoundCueFor('visegrip')).toBe('move-vicegrip');
    expect(moveSoundCueFor('feintattack')).toBe('move-faint-attack');
    expect(moveSoundCueFor('highjumpkick')).toBe('move-jump-kick');
    // The accessor is keyed by our move id, so the cartridge's spelling is not a
    // row at all — the alias table lives in the generator.
    expect(moveSoundCueFor('vicegrip')).toBeNull();
  });

  it('answers null for a move the decompilation has no sound for', () => {
    // A move whose animation block plays no `SE_M_*` of its own: the battle
    // falls back to the shared `hit` cue for these.
    expect(moveSoundCueFor('splash')).toBeNull();
    expect(moveSoundCueFor('not-a-move')).toBeNull();
  });
});
