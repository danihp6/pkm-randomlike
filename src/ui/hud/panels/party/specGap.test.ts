import { describe, expect, it } from 'vitest';
import screen from '../../../../../design/screens/03c-panels-compress.json';
import { DEFAULT_KEYBINDS } from '../../../../data/keybinds';
import {
  STRIP_CHIP_ORDER,
  STRIP_CHIP_SIZE,
  stripView,
  type StripChipId,
  type StripSlot,
} from '../hud';
import { GAP_TOLERANCE, gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';
import { buildView, slug } from '../../specGap.views/compress';
import type { HudState } from '../../state';
import { partyPanelView } from './view';

const DESKTOP = { width: 1280, height: 800 } as const;

const SPEC: ScreenSpec = screen;

/** The four docks `defaultHudDock` gives at 1280×800, every card collapsed. */
const SLOTS: readonly StripSlot[] = [
  { id: 'header', x: 8, y: 8, dx: 0, dy: 0, collapsed: true },
  { id: 'box', x: 928, y: 76, dx: 0, dy: 0, collapsed: true },
  { id: 'bag', x: 928, y: 42, dx: 0, dy: 0, collapsed: true },
  { id: 'party', x: 928, y: 8, dx: 0, dy: 0, collapsed: true },
];

/** The frame's name for each badge's board chip. */
const BOARD_CHIP: Readonly<Record<StripChipId, string>> = {
  header: 'key map',
  box: 'key pc',
  party: 'key party',
  bag: 'key bag',
};

const EMPTY: HudState = { party: [], bag: [], money: null, route: null, battle: null, notice: null };

function rectOf(box: SpecBox): Readonly<{ x: number; y: number; w: number; h: number }> {
  return { x: box.x, y: box.y, w: box.width, h: box.height };
}

function frameBox(name: string): SpecBox {
  const found = SPEC.boxes.find((box) => box.name === name);
  if (found === undefined) throw new Error(`the frame draws no ${name}`);
  return found;
}

function drawnChips(): ReturnType<typeof stripView>['chips'] {
  return stripView({ open: true, slots: SLOTS, keybinds: DEFAULT_KEYBINDS }, DESKTOP).chips;
}

describe('the compressed state’s spec gap', () => {
  it('keys to the compress frame, whose 6 boxes, 5 strings and 5 colours it measures', () => {
    expect(slug).toBe('03c-panels-compress');
    expect(SPEC.slug).toBe(slug);
    expect(SPEC.boxes).toHaveLength(6);
    expect(SPEC.text).toHaveLength(5);
    expect(SPEC.colours).toHaveLength(5);
  });

  it('claims the strip’s four letters and neither a box nor a colour', () => {
    expect(buildView(SPEC)).toStrictEqual({ boxes: [], strings: ['M', 'C', 'P', 'I'], colours: [] });
    expect(gapIsEmpty(gapFor(buildView(SPEC), SPEC))).toBe(true);
    expect(buildView(SPEC)).toStrictEqual(buildView(SPEC));
  });

  it('rests on the board’s five chips, 12 px inside the corners of the open cards', () => {
    expect(rectOf(frameBox('key bag'))).toStrictEqual({ x: 36, y: 36, w: 24, h: 24 });
    expect(rectOf(frameBox('key map'))).toStrictEqual({ x: 942.59, y: 36, w: 29.18, h: 24 });
    expect(rectOf(frameBox('key party'))).toStrictEqual({ x: 940, y: 320, w: 26, h: 26 });
    expect(rectOf(frameBox('key pc'))).toStrictEqual({ x: 36, y: 360, w: 24, h: 24 });
    expect(rectOf(frameBox('key stats'))).toStrictEqual({ x: 460, y: 100, w: 24, h: 24 });
    expect(SPEC.text.map((line) => line.characters)).toStrictEqual(['I', 'M', 'P', 'C', 'S']);
  });

  it('paints four 26 px badges at the panel docks, none of them a board chip', () => {
    expect(STRIP_CHIP_SIZE).toBe(26);
    expect(STRIP_CHIP_ORDER).toHaveLength(4);
    const chips = drawnChips();
    expect(chips.map((chip) => ({ id: chip.id, box: chip.box }))).toStrictEqual([
      { id: 'header', box: { x: 8, y: 8, w: 26, h: 26 } },
      { id: 'box', box: { x: 928, y: 76, w: 26, h: 26 } },
      { id: 'party', box: { x: 928, y: 8, w: 26, h: 26 } },
      { id: 'bag', box: { x: 928, y: 42, w: 26, h: 26 } },
    ]);
    for (const chip of chips) {
      const frame = frameBox(BOARD_CHIP[chip.id]);
      const deltas = [
        chip.box.x - frame.x,
        chip.box.y - frame.y,
        chip.box.w - frame.width,
        chip.box.h - frame.height,
      ];
      const outside = deltas.filter((delta) => Math.abs(delta) > GAP_TOLERANCE);
      expect(outside.length, chip.id).toBeGreaterThan(0);
    }
    const party = frameBox('key party');
    expect([928 - party.x, 8 - party.y, 26 - party.width, 26 - party.height]).toStrictEqual([
      -12, -312, 0, 0,
    ]);
  });

  it('has no badge for the detail card: the frame’s fifth chip, `S`, is never printed', () => {
    const ids: readonly string[] = STRIP_CHIP_ORDER;
    expect(ids).not.toContain('detail');
    expect(ids).not.toContain('stats');
    expect(SPEC.text.map((line) => line.characters)).toContain('S');
    expect(drawnChips().map((chip) => chip.letter)).not.toContain('S');
  });

  it('draws the party card’s own chip at the top of the rail, 312 px above the board’s', () => {
    const view = partyPanelView(EMPTY, { cursor: 0 }, DESKTOP);
    expect(view.chip).toStrictEqual({ letter: 'P', box: { x: 0, y: 0, w: 26, h: 26 } });
    const cornerY = view.box.y + view.chip.box.y;
    expect(view.box.x + view.chip.box.x).toBe(928);
    expect(cornerY).toBe(8);
    expect(frameBox('key party').y - cornerY).toBe(312);
  });
});
