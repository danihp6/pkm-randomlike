import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KEYBINDS } from '../../../../data/keybinds';
import { t } from '../../../../i18n';
import {
  STRIP_CHIP_ACTIONS,
  STRIP_CHIP_LETTERS,
  STRIP_CHIP_ORDER,
  STRIP_CHIP_SIZE,
  STRIP_NARROW,
  STRIP_PHONE_SLOTS,
  stripView,
  type StripInput,
  type StripSlot,
} from './index';

vi.mock('../../../../scenes/BootScene', () => ({ PANEL_ICON_SIZE: 24 }));

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

/** The shipped layout: PARTY open, the other four collapsed at their docks. */
const DEFAULT_SLOTS: readonly StripSlot[] = [
  { id: 'header', x: 8, y: 8, collapsed: true },
  { id: 'party', x: 38, y: 8, collapsed: false },
  { id: 'bag', x: 38, y: 422, collapsed: true },
  { id: 'box', x: 576, y: 72, collapsed: true },
  { id: 'detail', x: 8, y: 8, collapsed: true },
];

function input(overrides: Partial<StripInput> = {}): StripInput {
  return { open: true, slots: DEFAULT_SLOTS, keybinds: DEFAULT_KEYBINDS, ...overrides };
}

/** The same five docks, every panel collapsed. */
const ALL_COLLAPSED: readonly StripSlot[] = DEFAULT_SLOTS.map((slot) => ({ ...slot, collapsed: true }));

describe('the strip’s pinned board values', () => {
  it('pins the badge size, the breakpoint and the rail order', () => {
    expect(STRIP_CHIP_SIZE).toBe(26);
    expect(STRIP_NARROW).toBe(600);
    expect([...STRIP_CHIP_ORDER]).toEqual(['header', 'box', 'party', 'bag']);
  });

  it('pins the letters as the panels’ initials and the actions as their quick keys', () => {
    expect(STRIP_CHIP_LETTERS).toEqual({ header: 'M', box: 'C', party: 'P', bag: 'I' });
    expect(STRIP_CHIP_ACTIONS).toEqual({ header: 'map', box: 'box', party: 'party', bag: 'bag' });
  });

  it('pins the phone slots to the frame’s own chip nodes', () => {
    expect(STRIP_PHONE_SLOTS).toEqual({
      header: { x: 8, y: 55 },
      box: { x: 8, y: 119 },
      party: { x: 38, y: 55 },
      bag: { x: 38, y: 551 },
    });
  });
});

describe('stripView', () => {
  it('gives a phone the board’s slots, one chip per collapsed panel', () => {
    const view = stripView(input(), PHONE);
    expect(view.open).toBe(true);
    expect(view.viewport).toEqual(PHONE);
    expect(view.chips.map(({ id, letter, box }) => ({ id, letter, box }))).toEqual([
      { id: 'header', letter: 'M', box: { x: 8, y: 55, w: 26, h: 26 } },
      { id: 'box', letter: 'C', box: { x: 8, y: 119, w: 26, h: 26 } },
      { id: 'bag', letter: 'I', box: { x: 38, y: 551, w: 26, h: 26 } },
    ]);
  });

  it('places a wide chip at its own panel’s dock', () => {
    const view = stripView(input(), DESKTOP);
    expect(view.chips.map((chip) => [chip.id, chip.box])).toEqual([
      ['header', { x: 8, y: 8, w: 26, h: 26 }],
      ['box', { x: 576, y: 72, w: 26, h: 26 }],
      ['bag', { x: 38, y: 422, w: 26, h: 26 }],
    ]);
  });

  it('follows a dragged panel by reading the slot it is handed', () => {
    const slots = DEFAULT_SLOTS.map((slot) => (slot.id === 'box' ? { ...slot, x: 640, y: 96 } : slot));
    const view = stripView(input({ slots }), DESKTOP);
    expect(view.chips.find((chip) => chip.id === 'box')?.box).toEqual({ x: 640, y: 96, w: 26, h: 26 });
  });

  it('gives no chip while the route is paused', () => {
    const view = stripView(input({ open: false }), PHONE);
    expect(view.open).toBe(false);
    expect(view.chips).toEqual([]);
  });

  it('gives no chip while every panel is open, and four when every one is collapsed', () => {
    const open = DEFAULT_SLOTS.map((slot) => ({ ...slot, collapsed: false }));
    expect(stripView(input({ slots: open }), DESKTOP).chips).toEqual([]);
    expect(stripView(input({ slots: ALL_COLLAPSED }), DESKTOP).chips.map((chip) => chip.id)).toEqual([
      'header',
      'box',
      'party',
      'bag',
    ]);
  });

  it('skips a panel the scene never built', () => {
    const slots = DEFAULT_SLOTS.filter((slot) => slot.id !== 'bag');
    expect(stripView(input({ slots }), PHONE).chips.map((chip) => chip.id)).toEqual(['header', 'box']);
  });

  it('names the live key in the label and keeps the initial as the letter', () => {
    const chipOf = (bindings: typeof DEFAULT_KEYBINDS) =>
      stripView(input({ keybinds: bindings }), DESKTOP).chips.find((chip) => chip.id === 'box')!;

    const shipped = chipOf(DEFAULT_KEYBINDS);
    expect(shipped.label).toBe(`${t('keybind.box')} (O)`);
    expect(shipped.label).toBe('PC box panel (O)');
    expect(shipped.letter).toBe('C');

    const rebound = chipOf({ ...DEFAULT_KEYBINDS, box: 'P' });
    expect(rebound.label).toBe(`${t('keybind.box')} (P)`);
    expect(rebound.letter).toBe('C');
  });

  it('is pure: the same input yields a deep-equal view and nothing is mutated', () => {
    const given = input();
    const slots = given.slots.map((slot) => ({ ...slot }));
    const keybinds = { ...given.keybinds };
    const snapshot = { slots, keybinds };

    expect(stripView(given, PHONE)).toEqual(stripView(given, PHONE));
    expect(given.slots).toEqual(snapshot.slots);
    expect(given.keybinds).toEqual(snapshot.keybinds);
  });
});

describe('the live flag contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  // A cold scene import globs 525 packed cues (~7 s), so the default 5 s budget starves the assertions.
  it('counts the canvas strip with the flag off and 0 under ?hud=dom', async () => {
    vi.resetModules();
    const flagOff = await import('../../../../scenes/panels/hud');
    expect(flagOff.HUD_HEADER_OBJECTS).toBe(7);
    flagOff.noteHudDrawnObjects(9);
    expect(flagOff.hudDrawnObjectCount()).toBe(9);

    vi.stubGlobal('window', { location: { search: '?hud=dom' } });
    vi.resetModules();
    const flagOn = await import('../../../../scenes/panels/hud');
    flagOn.noteHudDrawnObjects(9);
    expect(flagOn.hudDrawnObjectCount()).toBe(0);
  }, 30_000);
});
