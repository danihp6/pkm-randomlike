import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03n-panels-pause-menu.json';
import frame from '../../../../../design/frames/03n-panels-pause-menu.json';
import { t } from '../../../../i18n';
import { isHudState } from '../../fixtures';
import { PAUSE_CARD_H, PAUSE_ROW_PITCH, PAUSE_SLUG, fixturePausePanelView, type Rect } from './index';

const DESKTOP = { width: 1280, height: 800 };

type FrameProperties = Readonly<{
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  characters?: string;
}>;
type FrameNode = Readonly<{ name?: string; properties?: FrameProperties }>;

const FRAME_NODES: readonly FrameNode[] = frame.geometry[0].children;
/** The frame's own copy lives on the text tree; geometry carries the rects. */
const FRAME_TEXT_NODES: readonly FrameNode[] = frame.text[0].children;

function frameCopy(name: string): string | undefined {
  return FRAME_TEXT_NODES.find((entry) => entry.name === name)?.properties?.characters;
}

function node(name: string): FrameNode {
  const found = FRAME_NODES.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`the 03n frame carries no "${name}" node`);
  return found;
}

function frameRect(name: string): Rect {
  const properties = node(name).properties;
  if (
    properties === undefined ||
    properties.x === undefined ||
    properties.y === undefined ||
    properties.width === undefined ||
    properties.height === undefined
  ) {
    throw new Error(`the 03n frame's "${name}" has no measured rect`);
  }
  return { x: properties.x, y: properties.y, w: properties.width, h: properties.height };
}

/** The frame's card origin: every card-relative node sits at `rect - this`. */
const FRAME_CARD = frameRect('pause panel');

function cardRelative(rect: Rect): Rect {
  return { x: rect.x - FRAME_CARD.x, y: rect.y - FRAME_CARD.y, w: rect.w, h: rect.h };
}

function view() {
  const painted = fixturePausePanelView(fixture, DESKTOP);
  if (painted === null) throw new Error('the 03n fixture is not a payload the panel can draw');
  return painted;
}

describe('design/fixtures/03n-panels-pause-menu.json', () => {
  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(fixture.state)).toBe(true);
    expect(Object.keys(fixture.state)).toEqual(['party', 'bag', 'money', 'route', 'battle', 'notice']);
  });

  it('names the frame it belongs to', () => {
    expect(fixture.slug).toBe(PAUSE_SLUG);
    expect(fixture.slug).toBe('03n-panels-pause-menu');
  });

  it('stores the live English labels, not the board’s four rows', () => {
    expect(fixture.menu.rows.map((row) => row.label)).toEqual([t('pause.settings'), t('pause.reset')]);
    expect(fixture.menu.title).toBe(t('hud.menu'));
    expect(fixture.menu.rows.map((row) => row.id)).toEqual(['settings', 'reset']);
    expect(fixture.menu.selected).toBe(0);
    expect(fixture.menu.armed).toBe(false);
  });
});

describe('fixturePausePanelView against the 03n frame', () => {
  it('paints the frame’s scrim and card at the measured viewport rects', () => {
    const panel = view();
    expect(panel.scrim).toEqual(frameRect('pause scrim'));
    expect(panel.scrim).toEqual({ x: 0, y: 0, w: 1280, h: 800 });
    expect(panel.box).toEqual({ x: FRAME_CARD.x, y: 300, w: FRAME_CARD.w, h: PAUSE_CARD_H });
  });

  it('is two rows shorter than the frame’s four-row card, by its own formula', () => {
    expect(FRAME_CARD.h).toBe(PAUSE_CARD_H + 2 * PAUSE_ROW_PITCH);
    expect(view().box.h).toBe(88 + PAUSE_ROW_PITCH * 2);
  });

  it('reproduces the frame node by node, card-relative, to the pixel', () => {
    const panel = view();
    expect(cardRelative(frameRect('pause panel highlight'))).toEqual(panel.highlight);
    expect(cardRelative(frameRect('pause divider'))).toEqual(panel.divider);
    expect(cardRelative(frameRect('pause title'))).toEqual(panel.title.box);
    expect(frameCopy('pause title')).toBe(panel.title.text);
    expect(frameCopy('pause label 0')).toBe('CONTINUE');
    expect(frameCopy('pause label 1')).toBe('OPTIONS');
    expect(cardRelative(frameRect('pause row 0'))).toEqual(panel.rows[0]!.box);
    expect(cardRelative(frameRect('pause row 1'))).toEqual(panel.rows[1]!.box);
    expect(cardRelative(frameRect('pause label 0'))).toEqual(panel.rows[0]!.labelBox);
    expect(cardRelative(frameRect('pause label 1'))).toEqual(panel.rows[1]!.labelBox);
  });

  it('paints the frame’s own title and labels verbatim on the shared geometry', () => {
    const panel = view();
    expect(panel.open).toBe(true);
    expect(panel.title.text).toBe('MENU');
    expect(panel.rows.map((row) => row.label)).toEqual(['Settings', 'Reset run']);
    expect(panel.rows.map((row) => row.selected)).toEqual([true, false]);
    expect(panel.rows.some((row) => row.armed)).toBe(false);
  });

  it('centres the same card on the phone viewport instead of a second layout', () => {
    const phone = fixturePausePanelView(fixture, { width: 390, height: 844 });
    expect(phone?.box).toEqual({ x: 15, y: 322, w: 360, h: 200 });
    expect(phone?.rows).toEqual(view().rows);
  });
});

describe('fixturePausePanelView’s structural guards', () => {
  const menu = fixture.menu;
  const row = (edits: Record<string, unknown> = {}) => ({ id: 'settings', label: 'Settings', ...edits });
  const payload = (edits: Record<string, unknown>) => ({
    slug: PAUSE_SLUG,
    state: fixture.state,
    menu: edits,
  });

  it('returns null — never throws — for anything that is not the panel’s payload', () => {
    const invalid: readonly unknown[] = [
      null,
      undefined,
      42,
      '03n',
      [1, 2],
      {},
      { menu: null },
      { menu: 'menu' },
      { menu: {} },
      payload({ ...menu, title: undefined }),
      payload({ ...menu, title: '' }),
      payload({ ...menu, title: 7 }),
      payload({ ...menu, selected: '0' }),
      payload({ ...menu, selected: 0.5 }),
      payload({ ...menu, selected: Number.NaN }),
      payload({ ...menu, armed: undefined }),
      payload({ ...menu, armed: 'no' }),
      payload({ ...menu, rows: undefined }),
      payload({ ...menu, rows: 'rows' }),
    ];
    for (const entry of invalid) {
      expect(fixturePausePanelView(entry, DESKTOP), JSON.stringify(entry) ?? 'undefined').toBeNull();
    }
  });

  it('returns null for a row list that is not exactly the two ids in order', () => {
    const invalid: readonly unknown[] = [
      [menu.rows[0]],
      [...menu.rows, { id: 'exit', label: 'Exit' }],
      [
        { id: 'reset', label: 'Reset run' },
        { id: 'settings', label: 'Settings' },
      ],
      [row({ id: 'settings', label: '' }), menu.rows[1]],
      [row({ id: 'settings', label: 4 }), menu.rows[1]],
      [row({ id: 'settings', label: null }), menu.rows[1]],
      [menu.rows[0], { id: 'reset' }],
      [menu.rows[0], { label: 'Reset run' }],
      [menu.rows[0], null],
      [menu.rows[0], 'reset'],
    ];
    for (const rows of invalid) {
      expect(fixturePausePanelView(payload({ ...menu, rows }), DESKTOP)).toBeNull();
    }
  });

  it('clamps the fixture’s cursor and renames only an armed Reset row', () => {
    const armed = fixturePausePanelView(payload({ ...menu, selected: 1, armed: true }), DESKTOP);
    expect(armed?.rows.map((row) => row.selected)).toEqual([false, true]);
    expect(armed?.rows.map((row) => row.armed)).toEqual([false, true]);
    const clamped = fixturePausePanelView(payload({ ...menu, selected: 12 }), DESKTOP);
    expect(clamped?.rows.map((row) => row.selected)).toEqual([false, true]);
  });
});
