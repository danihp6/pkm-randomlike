import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasArt } from '../assets/art';
import { decodePng } from '../../scripts/legacy-art/png-codec.mjs';
import manifest from './frlg/status-icons.json';
import { STATUS_ICON_H, STATUS_ICON_W, statusIconFrame } from './statusIcons';

// The atlas is a committed crop of Añil's own `Graphics/UI/statuses.png`
// (`scripts/frlg/build-status-icons.mjs`), so its frozen geometry and the fact
// every frame carries art are measured here rather than trusted: a repack that
// shifts the grid or drops a badge fails instead of drawing an invisible one.
const COLS = manifest.cols;
const ROWS = manifest.rows;

/** Every status id the run can show (`src/engine/battle/fighter.ts`). */
const STATUS_IDS = ['brn', 'psn', 'tox', 'par', 'slp', 'frz'] as const;

function atlas() {
  if (!hasArt('frlg/status-icons.png')) return { width: 0, height: 0, data: new Uint8Array() };
  const url = new URL('../assets/frlg/status-icons.png', import.meta.url);
  return decodePng(readFileSync(fileURLToPath(url)));
}

function frameHasArt(png: { width: number; data: Uint8Array }, frame: number): boolean {
  const col = frame % COLS;
  const row = Math.floor(frame / COLS);
  for (let y = 0; y < STATUS_ICON_H; y++) {
    for (let x = 0; x < STATUS_ICON_W; x++) {
      const alpha = png.data[((row * STATUS_ICON_H + y) * png.width + col * STATUS_ICON_W + x) * 4 + 3];
      if (alpha > 0) return true;
    }
  }
  return false;
}

describe.skipIf(!hasArt('frlg/status-icons.png'))('Añil status badges', () => {
  const png = atlas();

  it('keeps the 32x8 frames and 4-column atlas, so every draw site keeps its geometry', () => {
    expect(STATUS_ICON_W).toBe(32);
    expect(STATUS_ICON_H).toBe(8);
    expect(COLS).toBe(4);
    expect(png.width).toBe(STATUS_ICON_W * COLS);
    expect(png.height).toBe(STATUS_ICON_H * ROWS);
  });

  it('has a non-empty badge for every status the run can show', () => {
    for (const status of STATUS_IDS) {
      const frame = statusIconFrame(status);
      expect(frame, status).not.toBeNull();
      if (frame === null) continue;
      expect(frame, status).toBeLessThan(COLS * ROWS);
      expect(frameHasArt(png, frame), status).toBe(true);
    }
  });

  it('shares the poison badge for bad poison: Añil ships no separate tox badge', () => {
    expect(Object.keys(manifest.statuses)).not.toContain('tox');
    expect(statusIconFrame('tox')).toBe(statusIconFrame('psn'));
  });

  it('returns null for a status the map does not know', () => {
    expect(statusIconFrame('not-a-status')).toBeNull();
  });
});
