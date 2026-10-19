import { describe, expect, it } from 'vitest';
import {
  BOSS_BATTLEFIELD_CHANCE,
  ROOM_BATTLEFIELDS,
  ROOM_BATTLEFIELD_CHANCE,
  type RoomBattlefield,
} from './battlefields';

const EXPECTED: readonly RoomBattlefield[] = [
  { id: 'sun', kind: 'weather', tint: 0xf0a83c, alpha: 0.22 },
  { id: 'rain', kind: 'weather', tint: 0x3c6ea5, alpha: 0.22 },
  { id: 'sand', kind: 'weather', tint: 0xc7a26a, alpha: 0.22 },
  { id: 'snow', kind: 'weather', tint: 0xd8e6ef, alpha: 0.22 },
  { id: 'electric', kind: 'terrain', tint: 0xf0d23c, alpha: 0.2 },
  { id: 'grassy', kind: 'terrain', tint: 0x4fae52, alpha: 0.2 },
  { id: 'misty', kind: 'terrain', tint: 0xe08fc0, alpha: 0.2 },
  { id: 'psychic', kind: 'terrain', tint: 0xb45ad0, alpha: 0.2 },
  { id: 'fog', kind: 'field', tint: 0xb8c2cc, alpha: 0.3 },
  { id: 'gravity', kind: 'field', tint: 0x5a4a8a, alpha: 0.24 },
  { id: 'trickroom', kind: 'field', tint: 0x8a4ad0, alpha: 0.24 },
];

describe('ROOM_BATTLEFIELDS', () => {
  it('is the eleven rows, in the order the roll draws from', () => {
    expect(ROOM_BATTLEFIELDS).toEqual(EXPECTED);
  });

  it('names every id once', () => {
    const ids = ROOM_BATTLEFIELDS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stacks four weathers, four terrains and three field conditions', () => {
    const counts = ROOM_BATTLEFIELDS.reduce<Record<string, number>>((acc, row) => {
      acc[row.kind] = (acc[row.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ weather: 4, terrain: 4, field: 3 });
  });

  it('paints every overlay with a real colour and a readable alpha', () => {
    for (const row of ROOM_BATTLEFIELDS) {
      expect(Number.isInteger(row.tint)).toBe(true);
      expect(row.tint).toBeGreaterThanOrEqual(0x000000);
      expect(row.tint).toBeLessThanOrEqual(0xffffff);
      expect(row.alpha).toBeGreaterThan(0);
      expect(row.alpha).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the two roll chances at their tuned values', () => {
    expect(ROOM_BATTLEFIELD_CHANCE).toBe(0.15);
    expect(BOSS_BATTLEFIELD_CHANCE).toBe(0.3);
  });
});
