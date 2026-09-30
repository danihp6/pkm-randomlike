import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../scripts/legacy-art/png-codec.mjs';
import {
  MOVE_FX_COLUMNS,
  MOVE_FX_FRAME_SIZE,
  MOVE_FX_FRAMES,
  MOVE_FX_IDS,
  MOVE_FX_ROW,
  moveFxFor,
  moveFxFrames,
  moveFxFrame,
} from './moveFx';

// The atlas is a committed artifact (`scripts/legacy-art/extract-move-fx.mjs`),
// so the registry's row order and frame counts are measured here instead of
// trusted: a re-extract that shifts a strip fails this test rather than
// rendering the wrong animation.
function atlas() {
  const url = new URL('../assets/moves.png', import.meta.url);
  return decodePng(readFileSync(fileURLToPath(url)));
}

function stripFrames(png: { width: number; height: number; data: Uint8Array }, row: number): number {
  let last = 0;
  for (let x = 0; x < png.width; x++) {
    for (let y = 0; y < MOVE_FX_FRAME_SIZE; y++) {
      const alpha = png.data[((row * MOVE_FX_FRAME_SIZE + y) * png.width + x) * 4 + 3];
      if (alpha > 0) {
        last = Math.floor(x / MOVE_FX_FRAME_SIZE) + 1;
        break;
      }
    }
  }
  return last;
}

describe('move fx atlas', () => {
  const png = atlas();

  it('holds one strip per registered fx, in registry order', () => {
    expect(png.height / MOVE_FX_FRAME_SIZE).toBe(MOVE_FX_IDS.length);
    MOVE_FX_IDS.forEach((fx, index) => {
      expect(MOVE_FX_ROW[fx]).toBe(index);
    });
  });

  it('keeps the measured frame counts', () => {
    for (const fx of MOVE_FX_IDS) {
      const row = MOVE_FX_ROW[fx];
      expect(stripFrames(png, row), fx).toBe(MOVE_FX_FRAMES[fx]);
      expect(MOVE_FX_FRAMES[fx]).toBeLessThanOrEqual(MOVE_FX_COLUMNS);
    }
  });

  it('maps a strip frame onto its atlas row', () => {
    expect(moveFxFrame('ember', 0)).toBe(0);
    expect(moveFxFrame('ember', 5)).toBe(5);
    expect(moveFxFrame('fire_punch', 0)).toBe(3 * MOVE_FX_COLUMNS);
    expect(moveFxFrames('rock_slide')).toEqual([
      4 * MOVE_FX_COLUMNS,
      4 * MOVE_FX_COLUMNS + 1,
      4 * MOVE_FX_COLUMNS + 2,
      4 * MOVE_FX_COLUMNS + 3,
      4 * MOVE_FX_COLUMNS + 4,
    ]);
  });
});

describe('moveFxFor', () => {
  it('picks the burn body for Fire moves and the punch sequence for punches', () => {
    expect(moveFxFor('ember', 'Fire', {})).toBe('ember');
    expect(moveFxFor('flamethrower', 'Fire', {})).toBe('ember');
    expect(moveFxFor('firepunch', 'Fire', { punch: 1 })).toBe('fire_punch');
  });

  it('picks the cloud for Poison Gas and the Cross Poison hits for Poison moves', () => {
    expect(moveFxFor('poisongas', 'Poison', {})).toBe('poison_gas');
    expect(moveFxFor('poisonpowder', 'Poison', {})).toBe('poison_gas');
    expect(moveFxFor('sludgebomb', 'Poison', {})).toBe('cross_poison');
  });

  it('never returns a missing row for any type', () => {
    const types = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];
    for (const type of types) expect(MOVE_FX_IDS).toContain(moveFxFor('tackle', type, {}));
  });
});
