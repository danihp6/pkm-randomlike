import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasArt } from '../../assets/art';
import { playableSpecies } from '../../data/dex/species';

const DIR = fileURLToPath(new URL('.', import.meta.url));

type AnimManifest = Readonly<{
  start: number;
  count: number;
  durationsMs?: readonly number[];
  hitFrame?: number;
}>;

type PairManifest = Readonly<{ cols: number; anims: Readonly<Record<string, AnimManifest>> }>;

type OverworldIndex = Readonly<{
  sprite: number;
  rows: number;
  dirRows: readonly string[];
  files: Readonly<Record<string, number>>;
  missing: readonly string[];
}>;

const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8')) as OverworldIndex;

const readPair = (fileId: number): PairManifest =>
  JSON.parse(readFileSync(join(DIR, `${fileId}.json`), 'utf8')) as PairManifest;

const DIR_ROWS = ['down', 'downright', 'up', 'upright', 'left'];

describe('overworld coverage manifest', () => {
  it('splits exactly the playable dex into files and missing', () => {
    const playable = playableSpecies().map((species) => species.id);
    const covered = Object.keys(index.files);
    const union = [...covered, ...index.missing];

    expect(new Set(union).size).toBe(union.length);
    expect([...union].sort()).toEqual([...playable].sort());
  });

  it.skipIf(!hasArt('pokemon/1.png'))('names a committed PNG and manifest for every covered species', () => {
    for (const fileId of Object.values(index.files)) {
      expect(existsSync(join(DIR, `${fileId}.png`))).toBe(true);
      expect(existsSync(join(DIR, `${fileId}.json`))).toBe(true);
    }
  });

  it('claims no placeholder pair as covered', () => {
    for (const fileId of Object.values(index.files)) {
      const anims = Object.values(readPair(fileId).anims);
      expect(anims.length).toBeGreaterThan(0);
      for (const anim of anims) expect(Array.isArray(anim.durationsMs)).toBe(true);
    }
  });

  it('keeps the frozen frame contract', () => {
    expect(index.sprite).toBe(32);
    expect(index.rows).toBe(5);
    expect(index.dirRows).toEqual(DIR_ROWS);
  });

  it('keeps every pair that shipped before the manifest', () => {
    expect(Object.keys(index.files).length).toBeGreaterThanOrEqual(652);
    expect(index.files['castformsunny']).toBe(35101);
    expect(index.files['castformrainy']).toBe(35102);
    expect(index.files['castformsnowy']).toBe(35103);
  });
});
