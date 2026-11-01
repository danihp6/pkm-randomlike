import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03m-panels-pokemon-moves.json';
import screenSpec from '../../../../../design/screens/03m-panels-pokemon-moves.json';
import type { MemberDetail } from '../../../partyDetail';
import { gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/detail';
import { detailPanelBox, detailPanelView, type DetailPanelUi, type DetailPoolRow } from './view';

/**
 * The `03m Panels · pokemon moves` frame measured against the panel's own view model:
 * the adapter that answers for this slug, the copy it claims on the MOVES tab, the one
 * line it cannot claim, and the geometry that keeps the empty box claim honest.
 */

const SPEC = screenSpec as ScreenSpec;
const DESKTOP = { width: 1280, height: 800 };

/** The card's copy on the MOVES tab, in the card's own order and its own case. */
const STRINGS: readonly string[] = [
  'CHARIZARD',
  'FLAMETHROWER',
  'PP 15/15',
  'PWR 90',
  'ACC 100',
  'AIR SLASH',
  'PP 15/15',
  'PWR 75',
  'ACC 95',
  'DRAGON CLAW',
  'PP 10/10',
  'PWR 80',
  'ACC 100',
  'EARTHQUAKE',
  'PP 10/10',
  'PWR 100',
  'ACC 100',
  'search moves...',
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

const view = (): ReturnType<typeof detailPanelView> =>
  detailPanelView(
    fixture.detail as unknown as MemberDetail,
    fixture.pool as unknown as readonly DetailPoolRow[],
    fixture.ui as unknown as DetailPanelUi,
    DESKTOP,
  );

describe('the 03m adapter', () => {
  it('answers for the board frame it is named after', () => {
    expect(slug).toBe('03m-panels-pokemon-moves');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(47);
  });

  it('claims no box and no colour over the shipped card', () => {
    expect(buildView(SPEC).boxes).toStrictEqual([]);
    expect(buildView(SPEC).colours).toStrictEqual([]);
  });

  it('emits the copy the card prints on the moves tab, in draw order', () => {
    expect(buildView(SPEC).strings).toStrictEqual(STRINGS);
    expect(STRINGS).toHaveLength(18);
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

describe('the level line the card cannot claim', () => {
  it('types it without the space the board draws', () => {
    expect(view().level).toBe('Lv36');
    expect(textOf('detail lv')).toBe('LV 36');
    expect(fold(view().level)).not.toBe(fold(textOf('detail lv')));
  });

  it('leaves it out of the claim rather than opening a string gap', () => {
    expect(buildView(SPEC).strings).not.toContain(view().level);
    expect(gapFor(buildView(SPEC), SPEC).strings).toStrictEqual([]);
  });
});

describe('the geometry the empty box claim rests on', () => {
  it('docks the shipped card at 108, 72, 460, 560', () => {
    expect(detailPanelBox(DESKTOP)).toStrictEqual({ x: 108, y: 72, w: 460, h: 560 });
  });

  it('draws the board card at 448, 88, 360, 508: dx -340, dy -16, dw +100, dh +52', () => {
    const frame = frameBox('detail panel');
    expect({ x: frame.x, y: frame.y, width: frame.width, height: frame.height }).toStrictEqual({
      x: 448,
      y: 88,
      width: 360,
      height: 508,
    });
    const shipped = detailPanelBox(DESKTOP);
    expect({
      dx: shipped.x - frame.x,
      dy: shipped.y - frame.y,
      dw: shipped.w - frame.width,
      dh: shipped.h - frame.height,
    }).toStrictEqual({ dx: -340, dy: -16, dw: 100, dh: 52 });
  });

  it('draws two tabs 70 and 76 wide where the card ships three of 137/137/138', () => {
    expect([frameBox('tab stats').width, frameBox('tab moves').width]).toStrictEqual([70, 76]);
    expect([frameBox('tab stats').y, frameBox('tab moves').y]).toStrictEqual([176, 176]);
    const card = view();
    expect(card.tabs.map((tab) => tab.box.w)).toStrictEqual([137, 137, 138]);
    expect(card.tabs.map((tab) => tab.box.y + card.box.y)).toStrictEqual([144, 144, 144]);
  });
});
