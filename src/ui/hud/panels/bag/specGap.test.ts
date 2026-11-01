import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03b-panels-row-view.json';
import screenSpec from '../../../../../design/screens/03b-panels-row-view.json';
import { gapFor, gapIsEmpty, GAP_TOLERANCE, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/bag';
import type { HudState } from '../../state';
import { bagPanelBox, bagPanelView, type BagPanelUi } from './view';

/**
 * The `03b Panels · row view` frame measured against the bag's own view model: the adapter
 * that answers for this slug, the empty claim it can honestly make, the geometry that keeps
 * that claim empty, and the copy `gapFor`'s fold cannot reach.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

type FrameText = Readonly<{ name: string; characters: string }>;

const TEXT = screenSpec.text as unknown as readonly FrameText[];
const FIXTURE = fixture as unknown as Readonly<{ state: HudState; ui: BagPanelUi }>;

const fold = (line: string): string => line.trim().toUpperCase();

const textOf = (name: string): string => TEXT.find((node) => node.name === name)?.characters ?? '';

const frameBox = (name: string): SpecBox => {
  const box = SPEC.boxes.find((entry) => entry.name === name);
  if (box === undefined) throw new Error(`the frame draws no box named "${name}"`);
  return box;
};

const frameRects = (pattern: RegExp): readonly SpecBox[] =>
  SPEC.boxes.filter((entry) => entry.name !== null && pattern.test(entry.name));

const view = (): ReturnType<typeof bagPanelView> =>
  bagPanelView(FIXTURE.state, FIXTURE.ui, DESKTOP, () => null);

describe('the 03b adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03b-panels-row-view');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(136);
    expect(SPEC.text).toHaveLength(15);
    expect(SPEC.colours).toHaveLength(25);
  });

  it('claims no box, no string and no colour over the shipped grid card', () => {
    expect(buildView(SPEC)).toStrictEqual({ boxes: [], strings: [], colours: [] });
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
  it('docks the shipped card at 928, 422, 344, 308 where the board draws 24, 24, 304, 130', () => {
    expect(bagPanelBox(DESKTOP)).toStrictEqual({ x: 928, y: 422, w: 344, h: 308 });
    const frame = frameBox('bag panel');
    expect({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }).toStrictEqual({
      x: 24,
      y: 24,
      width: 304,
      height: 130,
    });
    const shipped = bagPanelBox(DESKTOP);
    const delta = {
      dx: shipped.x - frame.x,
      dy: shipped.y - frame.y,
      dw: shipped.w - frame.width,
      dh: shipped.h - frame.height,
    };
    expect(delta).toStrictEqual({ dx: 904, dy: 398, dw: 40, dh: 178 });
    for (const step of [delta.dx, delta.dy, delta.dw, delta.dh]) {
      expect(Math.abs(step)).toBeGreaterThan(GAP_TOLERANCE);
    }
  });

  it('draws a 280 × 60 row viewport of eight 64 × 60 tiles at a 72 px pitch', () => {
    const viewport = frameBox('bag row viewport');
    expect({
      x: viewport.x,
      y: viewport.y,
      width: viewport.width,
      height: viewport.height,
    }).toStrictEqual({ x: 36, y: 72, width: 280, height: 60 });
    const tiles = frameRects(/^bag tile \d+$/);
    expect(tiles).toHaveLength(8);
    expect(tiles.map((tile) => tile.x)).toStrictEqual([0, 72, 144, 216, 288, 360, 432, 504]);
    expect(tiles.map((tile) => tile.width)).toStrictEqual(Array.from({ length: 8 }, () => 64));
    expect(tiles.map((tile) => tile.height)).toStrictEqual(Array.from({ length: 8 }, () => 60));
  });

  it('lays the shipped cards out as a 5 × 3 grid of 56 px cells in a 20, 82, 304, 180 band', () => {
    const panel = view();
    expect(panel.grid).toStrictEqual({
      band: { x: 20, y: 82, w: 304, h: 180 },
      columns: 5,
      gap: 6,
      cell: 56,
    });
    expect(panel.tiles.map((tile) => tile.box)).toStrictEqual([
      { x: 20, y: 82, w: 56, h: 56 },
      { x: 82, y: 82, w: 56, h: 56 },
      { x: 144, y: 82, w: 56, h: 56 },
      { x: 206, y: 82, w: 56, h: 56 },
      { x: 268, y: 82, w: 56, h: 56 },
      { x: 20, y: 144, w: 56, h: 56 },
    ]);
  });

  it('fills the grid with the fixture’s six consumable stacks and their counts', () => {
    expect(view().tiles.map((tile) => [tile.name, tile.count])).toStrictEqual([
      ['Potion', 'x3'],
      ['Super Potion', 'x1'],
      ['Hyper Potion', 'x2'],
      ['Full Heal', 'x1'],
      ['Antidote', 'x5'],
      ['Awakening', 'x2'],
    ]);
  });

  it('draws the row and the grid far enough apart that no tile is the board’s tile', () => {
    const shipped = view().tiles[0]!.box;
    const frame = frameBox('bag tile 1');
    expect(Math.abs(shipped.x - frame.x)).toBeGreaterThan(GAP_TOLERANCE);
    expect(Math.abs(shipped.y - frame.y)).toBeGreaterThan(GAP_TOLERANCE);
    expect(Math.abs(shipped.w - frame.width)).toBeGreaterThan(GAP_TOLERANCE);
    expect(Math.abs(shipped.h - frame.height)).toBeGreaterThan(GAP_TOLERANCE);
  });

  it('keeps the party’s and the PC’s cards out of this row’s claim', () => {
    const party = frameBox('party panel');
    const pc = frameBox('pc panel');
    expect({ x: party.x, y: party.y, width: party.width, height: party.height }).toStrictEqual({
      x: 928,
      y: 536,
      width: 304,
      height: 124,
    });
    expect({ x: pc.x, y: pc.y, width: pc.width, height: pc.height }).toStrictEqual({
      x: 24,
      y: 208,
      width: 304,
      height: 112,
    });
  });
});

describe('the copy it cannot claim', () => {
  it('prints x3 where the board draws ×3', () => {
    expect(textOf('bag qty 1')).toBe('×3');
    expect(view().tiles[0]!.count).toBe('x3');
    expect(fold(view().tiles[0]!.count)).not.toBe(fold(textOf('bag qty 1')));
  });

  it('prints MONEY and 2480 where the board draws one line, $ 2,480', () => {
    expect(textOf('money')).toBe('$ 2,480');
    const footer = view().footer;
    expect([footer.label, footer.value]).toStrictEqual(['MONEY', '2480']);
    expect(fold(footer.label)).not.toBe(fold(textOf('money')));
    expect(fold(footer.value)).not.toBe(fold(textOf('money')));
  });

  it('prints search items... where the board draws SEARCH ITEM', () => {
    expect(textOf('bag search placeholder')).toBe('SEARCH ITEM');
    expect(view().search.placeholder).toBe('search items...');
    expect(fold(view().search.placeholder)).not.toBe(fold(textOf('bag search placeholder')));
  });
});
