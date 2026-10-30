import { afterEach, describe, expect, it } from 'vitest';
import { FIELD_ICONS, FIELD_ICON_IDS } from '../../../../data/fieldIcons';
import { en, es, setLocale } from '../../../../i18n';
import { battleHpBox, battleHpLayout, battleStage } from '../battle-hp/view';
import { battleMovesBox, fitsInside } from '../battle-moves/view';
import {
  FIELD_CHIP,
  FIELD_CHIP_CLEARANCE,
  FIELD_CHIP_GAP,
  FIELD_CHIP_INSET,
  battleFieldView,
  fieldChipRow,
  type BattleFieldInput,
  type Rect,
  type Viewport,
} from './view';

const DESKTOP: Viewport = { width: 1280, height: 800 };
const PHONE: Viewport = { width: 390, height: 844 };
const SQUARE: Viewport = { width: 900, height: 900 };
const SINGLE = { enemy: false, player: false };
const DOUBLE = { enemy: true, player: true };

function inputOf(overrides: Partial<BattleFieldInput> = {}): BattleFieldInput {
  return {
    viewport: DESKTOP,
    doubles: SINGLE,
    weather: null,
    weatherTurns: 0,
    terrain: null,
    terrainTurns: 0,
    ...overrides,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

afterEach(() => {
  setLocale('en');
});

describe('the field chip geometry', () => {
  it('pins the cell, the gutter and the insets', () => {
    expect(FIELD_CHIP).toBe(32);
    expect(FIELD_CHIP_GAP).toBe(8);
    expect(FIELD_CHIP_INSET).toBe(16);
    expect(FIELD_CHIP_CLEARANCE).toBe(8);
  });

  it('clamps the count to 0…2 and answers no row for none', () => {
    expect(fieldChipRow(DESKTOP, SINGLE, 0)).toBeNull();
    expect(fieldChipRow(DESKTOP, SINGLE, 1)).toStrictEqual({ x: 992, y: 16, w: 32, h: 32 });
    expect(fieldChipRow(DESKTOP, SINGLE, 2)).toStrictEqual({ x: 952, y: 16, w: 72, h: 32 });
    expect(fieldChipRow(DESKTOP, SINGLE, 9)).toStrictEqual({ x: 952, y: 16, w: 72, h: 32 });
    expect(fieldChipRow(DESKTOP, SINGLE, -3)).toBeNull();
    expect(fieldChipRow(DESKTOP, SINGLE, Number.NaN)).toBeNull();
  });

  it('drops under the foe card on a phone and holds the corner on a desk', () => {
    expect(fieldChipRow(PHONE, SINGLE, 1)).toStrictEqual({ x: 342, y: 104, w: 32, h: 32 });
    expect(fieldChipRow(PHONE, DOUBLE, 1)).toStrictEqual({ x: 342, y: 192, w: 32, h: 32 });
    expect(fieldChipRow(DESKTOP, DOUBLE, 1)).toStrictEqual({ x: 992, y: 16, w: 32, h: 32 });
    expect(fieldChipRow(SQUARE, SINGLE, 2)).toStrictEqual({ x: 812, y: 16, w: 72, h: 32 });
  });
});

describe('battleFieldView', () => {
  it('paints nothing at all under a clear sky', () => {
    expect(battleFieldView(inputOf())).toStrictEqual({ chips: [], row: null });
    expect(battleFieldView(inputOf({ viewport: PHONE }))).toStrictEqual({ chips: [], row: null });
  });

  it('paints the weather alone in the corner cell', () => {
    const view = battleFieldView(inputOf({ weather: 'sun', weatherTurns: 5 }));
    expect(view.chips).toHaveLength(1);
    const [chip] = view.chips;
    expect(chip!.id).toBe('sun');
    expect(chip!.kind).toBe('weather');
    expect(chip!.turns).toBe('5');
    expect(chip!.label).toBe('Sun · 5');
    expect(chip!.box).toStrictEqual({ x: 992, y: 16, w: 32, h: 32 });
    expect(view.row).toStrictEqual({ x: 992, y: 16, w: 32, h: 32 });
  });

  it('paints the terrain alone in the very same corner cell', () => {
    const view = battleFieldView(inputOf({ terrain: 'grassy', terrainTurns: 3 }));
    expect(view.chips.map((chip) => chip.id)).toStrictEqual(['grassy']);
    expect(view.chips[0]!.box).toStrictEqual({ x: 992, y: 16, w: 32, h: 32 });
  });

  it('puts the terrain to the weather s left when both are up at 1280×800', () => {
    const view = battleFieldView(
      inputOf({ weather: 'sun', weatherTurns: 5, terrain: 'grassy', terrainTurns: 3 }),
    );
    expect(view.chips.map((chip) => [chip.id, chip.box.x])).toStrictEqual([
      ['grassy', 952],
      ['sun', 992],
    ]);
    expect(view.chips.map((chip) => chip.box.y)).toStrictEqual([16, 16]);
    expect(view.row).toStrictEqual({ x: 952, y: 16, w: 72, h: 32 });
  });

  it('keeps that order and the phone row under the foe card at 390×844', () => {
    const view = battleFieldView(
      inputOf({
        viewport: PHONE,
        weather: 'sun',
        weatherTurns: 5,
        terrain: 'grassy',
        terrainTurns: 3,
      }),
    );
    expect(view.chips.map((chip) => [chip.id, chip.box.x])).toStrictEqual([
      ['grassy', 302],
      ['sun', 342],
    ]);
    expect(view.chips.map((chip) => chip.box.y)).toStrictEqual([104, 104]);
    expect(view.row).toStrictEqual({ x: 302, y: 104, w: 72, h: 32 });
    expect(
      battleFieldView(inputOf({ viewport: PHONE, weather: 'sun', weatherTurns: 5 })).chips[0]!.box,
    ).toStrictEqual({ x: 342, y: 104, w: 32, h: 32 });
  });

  it('drops the phone row under the foe s partner in a double', () => {
    const view = battleFieldView(
      inputOf({ viewport: PHONE, doubles: DOUBLE, weather: 'rain', weatherTurns: 2 }),
    );
    expect(view.row).toStrictEqual({ x: 342, y: 192, w: 32, h: 32 });
  });

  it('reads the stored count, clamped to a whole number and never below zero', () => {
    const turnsOf = (weatherTurns: number): string =>
      battleFieldView(inputOf({ weather: 'sand', weatherTurns })).chips[0]!.turns;
    expect(turnsOf(-1)).toBe('0');
    expect(turnsOf(4.7)).toBe('4');
    expect(turnsOf(Number.NaN)).toBe('0');
    expect(turnsOf(Number.POSITIVE_INFINITY)).toBe('0');
    expect(battleFieldView(inputOf({ weather: 'sand', weatherTurns: 4.7 })).chips[0]!.label).toBe(
      'Sandstorm · 4',
    );
  });

  it('resolves the glyph off the data table, already drawn', () => {
    for (const id of FIELD_ICON_IDS) {
      const row = FIELD_ICONS[id];
      const weather = row.kind === 'weather';
      const chip = battleFieldView(
        inputOf({
          weather: weather ? (id as BattleFieldInput['weather']) : null,
          weatherTurns: 1,
          terrain: weather ? null : (id as BattleFieldInput['terrain']),
          terrainTurns: 1,
        }),
      ).chips[0]!;
      expect(chip.path).toBe(row.path);
      expect(chip.viewBox).toBe(row.viewBox);
      expect(chip.shape).toBe(row.shape);
      expect(chip.kind).toBe(row.kind);
    }
  });

  it('is pure: the same input deep-equals and is left untouched', () => {
    const input = inputOf({ weather: 'snow', weatherTurns: 2, terrain: 'electric', terrainTurns: 1 });
    const snapshot = { ...input };
    const first = battleFieldView(input);
    const second = battleFieldView(input);
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
    expect(input).toStrictEqual(snapshot);
  });

  it('reads the chip s accessible name in the active locale', () => {
    const input = inputOf({ weather: 'sun', weatherTurns: 5 });
    setLocale('es');
    expect(battleFieldView(input).chips[0]!.label).toBe('Sol · 5');
    setLocale('en');
    expect(battleFieldView(input).chips[0]!.label).toBe('Sun · 5');
  });
});

describe('the chips clear the rest of the battle', () => {
  const VIEWPORTS: readonly Viewport[] = [DESKTOP, PHONE, SQUARE];

  it('never meets an HP box, the command card or the stage edge', () => {
    for (const viewport of VIEWPORTS) {
      for (const doubles of [SINGLE, DOUBLE]) {
        const view = battleFieldView(
          inputOf({
            viewport,
            doubles,
            weather: 'sand',
            weatherTurns: 4,
            terrain: 'psychic',
            terrainTurns: 2,
          }),
        );
        expect(view.chips).toHaveLength(2);
        const stage = battleStage(viewport);
        const card = battleMovesBox(viewport);
        for (const chip of view.chips) {
          expect(fitsInside(chip.box, stage)).toBe(true);
          expect(overlaps(chip.box, card)).toBe(false);
          // The boxes the battle actually fields: an unfielded partner's rect is
          // where the phone row sits, so it is not a box on screen.
          for (const entry of battleHpLayout(viewport, doubles)) {
            expect(overlaps(chip.box, entry.box)).toBe(false);
          }
        }
      }
    }
  });

  it('keeps the row 16 px inside the stage s right edge, and its top on a wide viewport', () => {
    for (const viewport of [DESKTOP, SQUARE]) {
      for (const doubles of [SINGLE, DOUBLE]) {
        const row = fieldChipRow(viewport, doubles, 2)!;
        const stage = battleStage(viewport);
        expect(row.x + row.w).toBe(stage.x + stage.w - FIELD_CHIP_INSET);
        expect(row.y).toBe(stage.y + FIELD_CHIP_INSET);
        expect(row.h).toBe(FIELD_CHIP);
        expect(row.w).toBe(FIELD_CHIP * 2 + FIELD_CHIP_GAP);
      }
    }
  });

  it('keeps the phone row the same right edge, 8 px under the foe s lowest box', () => {
    const row = fieldChipRow(PHONE, DOUBLE, 2)!;
    const lowest = battleHpBox(PHONE, 'enemy', 1);
    expect(row.y).toBe(lowest.y + lowest.h + FIELD_CHIP_CLEARANCE);
    expect(row.x + row.w).toBe(battleStage(PHONE).x + battleStage(PHONE).w - FIELD_CHIP_INSET);
  });
});

describe('the surviving battle.info keys', () => {
  const LABEL_KEYS = FIELD_ICON_IDS.map((id) => FIELD_ICONS[id].labelKey).sort();

  it('keeps exactly the eight chip labels in the English table', () => {
    const keys = Object.keys(en)
      .filter((key) => key.startsWith('battle.info'))
      .sort();
    expect(keys).toStrictEqual(LABEL_KEYS);
    expect(keys).toHaveLength(8);
    expect('battle.infoControl' in en).toBe(false);
  });

  it('keeps the same eight in the Spanish table', () => {
    const keys = Object.keys(es)
      .filter((key) => key.startsWith('battle.info'))
      .sort();
    expect(keys).toStrictEqual(LABEL_KEYS);
    expect('battle.infoControl' in es).toBe(false);
  });
});
