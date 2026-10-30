import { describe, expect, it } from 'vitest';
import { FIELD_ICON_IDS, FIELD_ICONS, fieldIcon, type FieldIconId } from './fieldIcons';

const SHAPES = ['sun', 'drop', 'swirl', 'flake', 'bolt', 'blades', 'mist', 'rings'];
const GLYPH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\- ]+$/;

describe('the field icon table', () => {
  it('names the eight conditions in its own order', () => {
    expect([...FIELD_ICON_IDS]).toStrictEqual([
      'sun',
      'rain',
      'sand',
      'snow',
      'electric',
      'grassy',
      'misty',
      'psychic',
    ]);
  });

  it('carries one row per id and no ninth', () => {
    expect(Object.keys(FIELD_ICONS).sort()).toStrictEqual([...FIELD_ICON_IDS].sort());
  });

  it('keys every row by its own id and draws on a 24-unit square', () => {
    for (const id of FIELD_ICON_IDS) {
      const row = FIELD_ICONS[id];
      expect(row.id).toBe(id);
      expect(row.viewBox).toBe(24);
    }
  });

  it('draws a filled path every time, in the commands a solid glyph may use', () => {
    for (const id of FIELD_ICON_IDS) {
      const { path } = FIELD_ICONS[id];
      expect(path.length).toBeGreaterThan(0);
      expect(path.startsWith('M') || path.startsWith('m')).toBe(true);
      expect(GLYPH.test(path)).toBe(true);
    }
  });

  it('gives every condition its own silhouette and its own path', () => {
    const shapes = FIELD_ICON_IDS.map((id) => FIELD_ICONS[id].shape);
    const paths = FIELD_ICON_IDS.map((id) => FIELD_ICONS[id].path);
    expect([...shapes].sort()).toStrictEqual([...SHAPES].sort());
    expect(new Set(paths).size).toBe(FIELD_ICON_IDS.length);
  });

  it('splits the weathers from the terrains', () => {
    expect(FIELD_ICON_IDS.slice(0, 4).map((id) => FIELD_ICONS[id].kind)).toStrictEqual([
      'weather',
      'weather',
      'weather',
      'weather',
    ]);
    expect(FIELD_ICON_IDS.slice(4).map((id) => FIELD_ICONS[id].kind)).toStrictEqual([
      'terrain',
      'terrain',
      'terrain',
      'terrain',
    ]);
  });

  it('reads the label keys of the retired window, one per chip', () => {
    for (const id of FIELD_ICON_IDS.slice(0, 4)) {
      expect(FIELD_ICONS[id].labelKey.startsWith('battle.info.weather.')).toBe(true);
    }
    for (const id of FIELD_ICON_IDS.slice(4)) {
      expect(FIELD_ICONS[id].labelKey.startsWith('battle.info.terrain.')).toBe(true);
    }
    expect(new Set(FIELD_ICON_IDS.map((id) => FIELD_ICONS[id].labelKey)).size).toBe(8);
  });

  it('answers the row itself, not a copy', () => {
    expect(fieldIcon('rain')).toBe(FIELD_ICONS.rain);
    expect(fieldIcon('psychic')).toBe(FIELD_ICONS.psychic);
  });

  it('is exhaustive by its type: every weather and terrain id is a row', () => {
    const ids: readonly FieldIconId[] = [...FIELD_ICON_IDS];
    expect(ids).toHaveLength(8);
    expect(FIELD_ICONS.electric.shape).toBe('bolt');
    expect(Object.keys(FIELD_ICONS)).not.toContain('grass');
    expect(FIELD_ICONS.grassy.shape).toBe('blades');
  });
});
