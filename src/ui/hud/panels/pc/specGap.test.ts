import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03p-panels-pc-rip.json';
import screenSpec from '../../../../../design/screens/03p-panels-pc-rip.json';
import { t } from '../../../../i18n';
import { GAP_TOLERANCE, gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/pc';
import { PC_CELL, pcPanelBox, pcPanelView, type PcPanelUi, type PcRow } from './view';

/**
 * The `03p Panels · pc rip` frame measured against the panel's own view model: the adapter
 * that answers for this slug, the seven strings it claims on the RIP tab, the lines the card
 * cannot claim, and the geometry that keeps the empty box claim honest.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

/** The card's copy on the RIP tab, in draw order. */
const STRINGS: readonly string[] = [
  'RIP',
  'PSYDUCK',
  'MACHOP',
  'RATICATE',
  'GLOOM',
  'ZUBAT',
  'DODUO',
];

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const rectOf = (box: SpecBox): Readonly<{ x: number; y: number; width: number; height: number }> => ({
  x: box.x,
  y: box.y,
  width: box.width,
  height: box.height,
});

const view = (): ReturnType<typeof pcPanelView> =>
  pcPanelView(
    fixture.pc.rows as unknown as readonly PcRow[],
    fixture.ui as unknown as PcPanelUi,
    fixture.pc.pageCount,
    DESKTOP,
  );

describe('the 03p adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03p-panels-pc-rip');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(33);
    expect(TEXT).toHaveLength(20);
    expect(SPEC.colours).toHaveLength(19);
  });

  it('claims the RIP tab and its six names, and no box and no colour', () => {
    expect(buildView(SPEC)).toStrictEqual({ boxes: [], strings: STRINGS, colours: [] });
    expect(STRINGS).toHaveLength(7);
  });

  it('claims the six names the frame draws, in the card’s draw order', () => {
    const names = TEXT.filter((node) => node.name.startsWith('rip name ')).map(
      (node) => node.characters,
    );
    expect(names).toStrictEqual(STRINGS.slice(1));
    expect(buildView(SPEC).strings.slice(1)).toStrictEqual(names);
  });

  it('prints nothing the board does not carry', () => {
    const carried = new Set(SPEC.text.map((node) => fold(node.characters)));
    for (const line of buildView(SPEC).strings) expect(carried.has(fold(line)), line).toBe(true);
  });

  it('reports an empty gap against its own spec', () => {
    expect(gapFor(buildView(SPEC), SPEC)).toStrictEqual({
      missing: [],
      moved: [],
      strings: [],
      colours: [],
    });
    expect(gapIsEmpty(gapFor(buildView(SPEC), SPEC))).toBe(true);
  });

  it('builds the same view twice: no clock, no rng, no store', () => {
    expect(buildView(SPEC)).toStrictEqual(buildView(SPEC));
  });
});

describe('the geometry the empty box claim rests on', () => {
  it('draws the board card at 24, 348, 304, 243 and the shipped card 552 right and 276 up', () => {
    expect(rectOf(frameBox('pc panel'))).toStrictEqual({
      x: 24,
      y: 348,
      width: 304,
      height: 243,
    });
    const shipped = pcPanelBox(DESKTOP);
    expect(shipped).toStrictEqual({ x: 576, y: 72, w: 344, h: 378 });
    const frame = frameBox('pc panel');
    const delta = {
      dx: shipped.x - frame.x,
      dy: shipped.y - frame.y,
      dw: shipped.w - frame.width,
      dh: shipped.h - frame.height,
    };
    expect(delta).toStrictEqual({ dx: 552, dy: -276, dw: 40, dh: 135 });
    for (const [axis, value] of Object.entries(delta)) {
      expect(Math.abs(value), axis).toBeGreaterThan(GAP_TOLERANCE);
    }
  });

  it('draws the board RIP list as six rows at a 44 px pitch inside a 280 × 183 viewport', () => {
    expect(rectOf(frameBox('rip viewport'))).toStrictEqual({
      x: 36,
      y: 396,
      width: 280,
      height: 183,
    });
    const rows = [0, 1, 2, 3, 4, 5].map((n) => frameBox(`rip row ${n}`));
    expect(rows.map((row) => row.width)).toStrictEqual([280, 280, 280, 280, 280, 280]);
    expect(rows.map((row) => row.height)).toStrictEqual([38, 38, 38, 38, 38, 38]);
    expect(rows.map((row) => row.y)).toStrictEqual([1, 45, 89, 133, 177, 221]);
    expect(rows.slice(1).map((row, index) => row.y - rows[index]!.y)).toStrictEqual([
      44, 44, 44, 44, 44,
    ]);
  });

  it('draws the RIP tag six times, one per row', () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => textOf(`rip tag ${n}`))).toStrictEqual([
      'RIP',
      'RIP',
      'RIP',
      'RIP',
      'RIP',
      'RIP',
    ]);
  });

  it('insets the board highlight 12 px where the card hangs it at its own corner', () => {
    expect(rectOf(frameBox('pc panel highlight'))).toStrictEqual({
      x: 36,
      y: 360,
      width: 280,
      height: 1,
    });
    const shipped = view();
    expect({
      x: shipped.box.x + shipped.highlight.x,
      y: shipped.box.y + shipped.highlight.y,
      width: shipped.highlight.w,
      height: shipped.highlight.h,
    }).toStrictEqual({ x: 588, y: 84, width: 320, height: 1 });
    expect(rectOf(frameBox('key pc'))).toStrictEqual({ x: 36, y: 360, width: 24, height: 24 });
    expect({
      x: shipped.box.x + shipped.chip.box.x,
      y: shipped.box.y + shipped.chip.box.y,
      width: shipped.chip.box.w,
      height: shipped.chip.box.h,
    }).toStrictEqual({ x: 576, y: 72, width: 24, height: 24 });
  });
});

describe('what the view cannot claim', () => {
  it('marks the RIP pane active and locked, and the tab 32 × 26 at the strip’s right end', () => {
    const shipped = view();
    expect(shipped.rip).toStrictEqual({
      active: true,
      locked: true,
      box: { x: 292, y: 16, w: 32, h: 26 },
    });
    expect(rectOf(frameBox('pc rip button'))).toStrictEqual({
      x: 264,
      y: 360,
      width: 24,
      height: 24,
    });
    expect({
      x: shipped.box.x + shipped.rip.box.x,
      y: shipped.box.y + shipped.rip.box.y,
      width: shipped.rip.box.w,
      height: shipped.rip.box.h,
    }).toStrictEqual({ x: 868, y: 88, width: 32, height: 26 });
  });

  it('draws 16 cells of 76 × 76 in a 14, 50, 316, 316 band: six named, ten empty', () => {
    const shipped = view();
    expect(shipped.cells).toHaveLength(16);
    expect(shipped.grid.band).toStrictEqual({ x: 14, y: 50, w: 316, h: 316 });
    expect(shipped.cells.map((cell) => [cell.box.w, cell.box.h])).toStrictEqual(
      Array.from({ length: 16 }, () => [PC_CELL, PC_CELL]),
    );
    expect(shipped.cells.filter((cell) => cell.memberId !== null)).toHaveLength(6);
    expect(shipped.cells.filter((cell) => cell.memberId === null)).toHaveLength(10);
  });

  it('draws no per-row box, so the board’s rip rows have no claimant', () => {
    const frameRows = [0, 1, 2, 3, 4, 5].map((n) => frameBox(`rip row ${n}`));
    expect(frameRows.every((row) => row.width === 280 && row.height === 38)).toBe(true);
    expect(view().cells.some((cell) => cell.box.w === 280 || cell.box.h === 38)).toBe(false);
    expect(buildView(SPEC).boxes).toStrictEqual([]);
  });

  it('prints the level without the board’s space, so the meta line is not claimed', () => {
    const first = view().cells[0]!;
    expect(first.name).toBe('PSYDUCK');
    expect(first.level).toBe(30);
    expect(t('hud.level', { level: first.level })).toBe('Lv30');
    expect(textOf('rip meta 0')).toBe('LV 30 · ROUTE 3');
    expect(fold(t('hud.level', { level: first.level }))).not.toBe(fold(textOf('rip meta 0')));
    expect(first.hpText).toBe('0/92');
    const strings = buildView(SPEC).strings;
    expect(strings).not.toContain('Lv30');
    expect(strings).not.toContain('0/92');
    expect(gapFor(buildView(SPEC), SPEC).strings).toStrictEqual([]);
  });

  it('prints a page number the frame never draws', () => {
    expect(fixture.pc.pageCount).toBe(1);
    expect(view().tabs.map((tab) => tab.label)).toStrictEqual(['1']);
    expect(TEXT.some((node) => fold(node.characters) === '1')).toBe(false);
    expect(buildView(SPEC).strings).not.toContain('1');
  });
});
