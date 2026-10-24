import { describe, expect, it } from 'vitest';
import desktopFrame from '../../../../../design/frames/03k-panels-notice-item.json';
import phoneFrame from '../../../../../design/frames/m03k-panels-notice-item.json';
import tokens from '../../../../../design/tokens.json';
import {
  SAFE_AREA_BOTTOM,
  SAFE_AREA_TOP,
  areaBox,
  missionBox,
  noticeBox,
  noticesPanelView,
  type NoticesInput,
  type Rect,
  type Viewport,
} from './index';

const DESKTOP: Viewport = { width: 1280, height: 800 };
const PHONE: Viewport = { width: 390, height: 844 };
const BREAKPOINT: Viewport = { width: 560, height: 800 };

type FrameNode = Readonly<{
  name: string;
  type: string;
  properties: Readonly<{ x?: number; y?: number; width?: number; height?: number }>;
  children?: readonly FrameNode[];
}>;

type Frame = Readonly<{ geometry: readonly FrameNode[] }>;

/** The frame's own measured node, by name: the board is the source of the refs. */
function frameNode(frame: unknown, name: string): Rect {
  const root = (frame as unknown as Frame).geometry[0];
  const node = root?.children?.find((child) => child.name === name);
  expect(node, name).toBeDefined();
  const properties = node?.properties ?? {};
  return {
    x: properties.x ?? Number.NaN,
    y: properties.y ?? Number.NaN,
    w: properties.width ?? Number.NaN,
    h: properties.height ?? Number.NaN,
  };
}

const LINE: NoticesInput = {
  notice: 'Obtained Potion!',
  area: 'Entered Añil Path',
  mission: 'Mission: Catch 3',
};

describe('the three card rects', () => {
  it('stacks them at the desktop board: (280,24,720,56), (460,88,360,32), (460,128,360,64)', () => {
    expect(noticeBox(DESKTOP)).toEqual({ x: 280, y: 24, w: 720, h: 56 });
    expect(missionBox(DESKTOP)).toEqual({ x: 460, y: 88, w: 360, h: 32 });
    expect(areaBox(DESKTOP)).toEqual({ x: 460, y: 128, w: 360, h: 64 });
  });

  it('stacks them on the phone at the safe area: (8,47,374,56), (8,111,374,32), (8,151,374,64)', () => {
    expect(noticeBox(PHONE)).toEqual({ x: 8, y: 47, w: 374, h: 56 });
    expect(missionBox(PHONE)).toEqual({ x: 8, y: 111, w: 374, h: 32 });
    expect(areaBox(PHONE)).toEqual({ x: 8, y: 151, w: 374, h: 64 });
  });

  it('takes the strip’s desktop rect from the board frame 03k', () => {
    expect(noticeBox(DESKTOP)).toEqual(frameNode(desktopFrame, 'notice strip'));
  });

  it('takes the strip’s phone rect from the board frame m03k', () => {
    expect(noticeBox(PHONE)).toEqual(frameNode(phoneFrame, 'm toast'));
  });

  it('starts the phone stack at the token safe area, not a copied literal', () => {
    expect(SAFE_AREA_TOP).toBe(tokens.safeArea.top);
    expect(SAFE_AREA_BOTTOM).toBe(tokens.safeArea.bottom);
    expect(noticeBox(PHONE).y).toBe(tokens.safeArea.top);
    expect(missionBox(PHONE).y).toBe(tokens.safeArea.top + 56 + 8);
    expect(areaBox(PHONE).y).toBe(missionBox(PHONE).y + 32 + 8);
  });

  it('keeps every card inside the viewport at 1280×800, 390×844 and 560×800', () => {
    for (const viewport of [DESKTOP, PHONE, BREAKPOINT]) {
      for (const box of [noticeBox(viewport), missionBox(viewport), areaBox(viewport)]) {
        const label = `${viewport.width}×${viewport.height} ${JSON.stringify(box)}`;
        expect(box.x, label).toBeGreaterThanOrEqual(0);
        expect(box.y, label).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w, label).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.h, label).toBeLessThanOrEqual(viewport.height);
      }
    }
  });

  it('narrows and centres a narrow desktop window instead of overflowing', () => {
    const narrow: Viewport = { width: 600, height: 800 };
    const strip = noticeBox(narrow);
    expect(strip).toEqual({ x: 8, y: 24, w: 584, h: 56 });
    expect(strip.x + strip.w).toBe(narrow.width - 8);
    expect(missionBox(narrow)).toEqual({ x: 120, y: 88, w: 360, h: 32 });
  });

  it('keeps a phone narrower than the board inside its own width', () => {
    const small: Viewport = { width: 320, height: 640 };
    for (const box of [noticeBox(small), missionBox(small), areaBox(small)]) {
      expect(box.w).toBe(304);
      expect(box.x + box.w).toBe(small.width - 8);
    }
  });

  it('never draws the stack past the safe area’s bottom', () => {
    const short: Viewport = { width: 390, height: 240 };
    expect(areaBox(short).y + areaBox(short).h).toBeLessThanOrEqual(SAFE_AREA_BOTTOM);
    const shorter: Viewport = { width: 1280, height: 200 };
    for (const box of [noticeBox(shorter), missionBox(shorter), areaBox(shorter)]) {
      expect(box.y + box.h).toBeLessThanOrEqual(shorter.height);
    }
  });

  it('falls back to the board’s own window for a viewport it cannot measure', () => {
    const broken: Viewport = { width: Number.NaN, height: Number.NaN };
    expect(noticeBox(broken)).toEqual(noticeBox(DESKTOP));
    expect(areaBox(broken)).toEqual(areaBox(DESKTOP));
  });
});

describe('noticesPanelView', () => {
  it('paints the three lines in their own boxes', () => {
    const view = noticesPanelView(LINE, DESKTOP);
    expect(view.notice).toEqual({ text: 'Obtained Potion!', box: noticeBox(DESKTOP) });
    expect(view.area).toEqual({ text: 'Entered Añil Path', box: areaBox(DESKTOP) });
    expect(view.mission).toEqual({ text: 'Mission: Catch 3', box: missionBox(DESKTOP) });
  });

  it('renders nothing for a null line and keeps the other two', () => {
    const view = noticesPanelView({ notice: null, area: null, mission: 'Mission: Catch 3' }, PHONE);
    expect(view.notice).toBeNull();
    expect(view.area).toBeNull();
    expect(view.mission).toEqual({ text: 'Mission: Catch 3', box: missionBox(PHONE) });
  });

  it('is pure and total: the same input gives a deep-equal view and the input is not written', () => {
    const input: NoticesInput = Object.freeze({ ...LINE });
    const first = noticesPanelView(input, DESKTOP);
    const second = noticesPanelView(input, DESKTOP);
    expect(first).toEqual(second);
    expect(input).toEqual({ ...LINE });
    expect(Object.isFrozen(input)).toBe(true);
    expect(first).not.toBe(second);
  });

  it('reads no clock and no state: the view is a function of the input and the viewport', () => {
    const empty = noticesPanelView({ notice: null, area: null, mission: null }, DESKTOP);
    expect(empty).toEqual({ notice: null, area: null, mission: null });
  });
});
