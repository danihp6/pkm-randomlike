import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { t } from '../../../../i18n';
import type { RoutePanelHost } from '../../../../scenes/panels/types';
import {
  PAUSE_CARD_H,
  PAUSE_CARD_RADIUS,
  PAUSE_CARD_W,
  PAUSE_DIVIDER_TOP,
  PAUSE_HIGHLIGHT_INSET,
  PAUSE_LABEL_INSET,
  PAUSE_MARGIN,
  PAUSE_ROW_H,
  PAUSE_ROW_INSET,
  PAUSE_ROW_PITCH,
  PAUSE_ROW_TOP,
  PAUSE_SLUG,
  PAUSE_TITLE,
  pausePanelBox,
  pausePanelView,
  type PauseInput,
  type PausePanelView,
} from './index';

/**
 * The route panels' modules read the texture keys from `BootScene`, which builds
 * Phaser textures a headless test cannot load; the pause module's own surface is
 * collected without it, as `src/scenes/panels/registry.test.ts` does.
 */
vi.mock('../../../../scenes/BootScene', () => ({
  PANEL_ICON_KEYS: { header: 'route:icon-map' },
  PANEL_ICON_SIZE: 24,
  SHOP_COUNTER_TEXTURE_KEY: 'route:shop-counter',
}));

/**
 * The DOM card's mount is captured instead of rendered: the headless environment has
 * no `document`, so the scene's callback is the only part of the mount a test can
 * drive. Whatever the mount is handed is exactly what a row press sends.
 */
const mountMock = vi.hoisted(() => ({
  dispose: vi.fn(),
  onIntent: undefined as ((intent: { type: 'row'; index: number }) => void) | undefined,
  view: undefined as { value: unknown } | undefined,
}));

vi.mock('./mount', () => ({
  mountPausePanel: (
    _host: unknown,
    view: { value: unknown },
    onIntent?: (intent: { type: 'row'; index: number }) => void,
  ) => {
    mountMock.onIntent = onIntent;
    mountMock.view = view;
    return mountMock.dispose;
  },
}));

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

function input(overrides: Partial<PauseInput> = {}): PauseInput {
  return { open: true, selected: 0, armed: false, ...overrides };
}

function view(overrides: Partial<PauseInput> = {}, viewport = DESKTOP): PausePanelView {
  return pausePanelView(input(overrides), viewport);
}

/** A viewport rect as the page shows it: the card's origin plus a card-relative rect. */
function absolute(panel: PausePanelView, rect: { x: number; y: number; w: number; h: number }) {
  return { x: panel.box.x + rect.x, y: panel.box.y + rect.y, w: rect.w, h: rect.h };
}

describe('pausePanelBox', () => {
  it('centres the board’s card at the two QA viewports', () => {
    expect(pausePanelBox(DESKTOP)).toEqual({ x: 460, y: 300, w: 360, h: 200 });
    expect(pausePanelBox(PHONE)).toEqual({ x: 15, y: 322, w: 360, h: 200 });
  });

  it('draws the board’s desktop card for a zero or unmeasurable viewport', () => {
    for (const viewport of [
      { width: Number.NaN, height: Number.NaN },
      { width: 0, height: 0 },
      { width: Number.POSITIVE_INFINITY, height: 0 },
    ]) {
      expect(pausePanelBox(viewport), JSON.stringify(viewport)).toEqual({
        x: 460,
        y: 300,
        w: 360,
        h: 200,
      });
    }
  });

  it('keeps the card inside an 8 px margin on every edge', () => {
    for (const viewport of [
      DESKTOP,
      PHONE,
      { width: 320, height: 800 },
      { width: 390, height: 640 },
      { width: 1280, height: 300 },
      { width: 240, height: 200 },
    ]) {
      const box = pausePanelBox(viewport);
      expect(box.x, JSON.stringify(viewport)).toBeGreaterThanOrEqual(PAUSE_MARGIN);
      expect(box.y, JSON.stringify(viewport)).toBeGreaterThanOrEqual(PAUSE_MARGIN);
      expect(box.x + box.w, JSON.stringify(viewport)).toBeLessThanOrEqual(viewport.width - PAUSE_MARGIN);
      expect(box.y + box.h, JSON.stringify(viewport)).toBeLessThanOrEqual(
        viewport.height - PAUSE_MARGIN,
      );
    }
  });

  it('gives way inside the margin before it overflows a narrow screen', () => {
    expect(pausePanelBox({ width: 320, height: 800 })).toEqual({ x: 8, y: 300, w: 304, h: 200 });
  });
});

describe('pausePanelView', () => {
  it('pins the measured desktop table', () => {
    const panel = view();
    expect(panel.box).toEqual({ x: 460, y: 300, w: 360, h: 200 });
    expect(panel.scrim).toEqual({ x: 0, y: 0, w: 1280, h: 800 });
    expect(absolute(panel, panel.highlight)).toEqual({ x: 472, y: 312, w: 336, h: 1 });
    expect(absolute(panel, panel.title.box)).toEqual({ x: 484, y: 320, w: 200, h: 30 });
    expect(absolute(panel, panel.divider)).toEqual({ x: 484, y: 360, w: 312, h: 1 });
    expect(absolute(panel, panel.rows[0]!.box)).toEqual({ x: 484, y: 376, w: 312, h: 48 });
    expect(absolute(panel, panel.rows[1]!.box)).toEqual({ x: 484, y: 432, w: 312, h: 48 });
    expect(absolute(panel, panel.rows[0]!.labelBox)).toEqual({ x: 504, y: 393, w: 272, h: 16 });
    expect(absolute(panel, panel.rows[1]!.labelBox)).toEqual({ x: 504, y: 449, w: 272, h: 16 });
  });

  it('keeps the frame’s card-relative offsets and the board’s two-row height', () => {
    const panel = view();
    expect(panel.highlight).toEqual({ x: 12, y: 12, w: 336, h: 1 });
    expect(panel.title).toEqual({ text: 'MENU', box: PAUSE_TITLE });
    expect(panel.title.text).toBe(t('hud.menu'));
    expect(panel.divider).toEqual({ x: 24, y: 60, w: 312, h: 1 });
    expect(panel.rows.map((row) => row.box)).toEqual([
      { x: 24, y: 76, w: 312, h: 48 },
      { x: 24, y: 132, w: 312, h: 48 },
    ]);
    expect(panel.rows.map((row) => row.labelBox)).toEqual([
      { x: 44, y: 93, w: 272, h: 16 },
      { x: 44, y: 149, w: 272, h: 16 },
    ]);
    expect(panel.box.h).toBe(PAUSE_CARD_H);
    expect(PAUSE_CARD_H).toBe(88 + PAUSE_ROW_PITCH * 2);
  });

  it('derives every width from the clamped card, never from the 360 literal', () => {
    const panel = view({}, { width: 320, height: 800 });
    expect(panel.box).toEqual({ x: 8, y: 300, w: 304, h: 200 });
    expect(panel.highlight.w).toBe(304 - PAUSE_HIGHLIGHT_INSET * 2);
    expect(panel.divider.w).toBe(304 - PAUSE_ROW_INSET * 2);
    expect(panel.rows.map((row) => row.box.w)).toEqual([304 - 48, 304 - 48]);
    expect(panel.rows.map((row) => row.labelBox.w)).toEqual([304 - 88, 304 - 88]);
    expect(panel.rows.map((row) => row.labelBox.x)).toEqual([44, 44]);
  });

  it('lists exactly the two shipped rows, in order, localised', () => {
    const panel = view();
    expect(panel.rows).toHaveLength(2);
    expect(panel.rows.map((row) => [row.id, row.index])).toEqual([
      ['settings', 0],
      ['reset', 1],
    ]);
    expect(panel.rows.map((row) => row.label)).toEqual([t('pause.settings'), t('pause.reset')]);
    expect(panel.rows.some((row) => row.armed)).toBe(false);
  });

  it('marks exactly one row selected and clamps the cursor into the two rows', () => {
    expect(view({ selected: 0 }).rows.map((row) => row.selected)).toEqual([true, false]);
    expect(view({ selected: 1 }).rows.map((row) => row.selected)).toEqual([false, true]);
    expect(view({ selected: 5 }).rows.map((row) => row.selected)).toEqual([false, true]);
    expect(view({ selected: 1.9 }).rows.map((row) => row.selected)).toEqual([false, true]);
    expect(view({ selected: -3 }).rows.map((row) => row.selected)).toEqual([true, false]);
    expect(view({ selected: Number.NaN }).rows.map((row) => row.selected)).toEqual([true, false]);
  });

  it('arms only Reset, and only then renames it', () => {
    const armed = view({ selected: 1, armed: true });
    expect(armed.rows.map((row) => row.armed)).toEqual([false, true]);
    expect(armed.rows.map((row) => row.label)).toEqual([t('pause.settings'), t('pause.resetArmed')]);
    expect(armed.rows[0]!.box).toEqual(view().rows[0]!.box);
  });

  it('keeps the same geometry while the card is closed', () => {
    const closed = view({ open: false, selected: 1, armed: true });
    const open = view({ selected: 1, armed: true });
    expect(closed.open).toBe(false);
    expect(closed.box).toEqual(open.box);
    expect(closed.scrim).toEqual(open.scrim);
    expect(closed.rows).toEqual(open.rows);
  });

  it('is pure: the same input deep-equals, and the input is never written', () => {
    const before = JSON.stringify(input({ selected: 1, armed: true }));
    const first = JSON.stringify(view({ selected: 1, armed: true }));
    expect(JSON.stringify(view({ selected: 1, armed: true }))).toBe(first);
    view({ selected: 1, armed: true });
    expect(JSON.stringify(input({ selected: 1, armed: true }))).toBe(before);
  });
});

describe('the mirrored board constants', () => {
  it('equal the literals the frame measures', () => {
    expect(PAUSE_SLUG).toBe('03n-panels-pause-menu');
    expect(PAUSE_CARD_W).toBe(360);
    expect(PAUSE_CARD_H).toBe(200);
    expect(PAUSE_CARD_RADIUS).toBe(11);
    expect(PAUSE_MARGIN).toBe(8);
    expect(PAUSE_HIGHLIGHT_INSET).toBe(12);
    expect(PAUSE_DIVIDER_TOP).toBe(60);
    expect(PAUSE_ROW_TOP).toBe(76);
    expect(PAUSE_ROW_H).toBe(48);
    expect(PAUSE_ROW_PITCH).toBe(56);
    expect(PAUSE_ROW_INSET).toBe(24);
    expect(PAUSE_TITLE).toEqual({ x: 24, y: 20, w: 200, h: 30 });
    expect(PAUSE_LABEL_INSET).toEqual({ x: 20, y: 17, h: 16 });
  });
});

describe('src/scenes/panels/pause.ts', () => {
  type StubHost = { openSettings: () => void; restartRun: () => void };
  type SceneModule = typeof import('../../../../scenes/panels/pause');

  let scene: SceneModule;

  // The first import walks the whole panel chain (`detail`, the engine, the dex);
  // one load pays it for every case in this block.
  beforeAll(async () => {
    scene = await import('../../../../scenes/panels/pause');
  }, 60000);

  function stubHost(): StubHost & RoutePanelHost {
    return { openSettings: vi.fn(), restartRun: vi.fn() } as unknown as StubHost & RoutePanelHost;
  }

  it('keeps the frozen descriptor surface and its key router', () => {
    const host = stubHost();
    expect(scene.descriptor.id).toBe('pause');
    expect(scene.descriptor.order).toBe(100);
    expect(typeof scene.descriptor.close).toBe('function');
    for (const action of ['up', 'down', 'confirm', 'cancel'] as const) {
      expect(scene.descriptor.key?.(host, action), action).toBe(true);
    }
    expect(scene.descriptor.key?.(host, 'interact')).toBe(false);
  });

  it('arms Reset on the first confirm and restarts the run on the second', () => {
    const host = stubHost();
    scene.openPauseMenu(host);
    expect(scene.pauseMenuOpenNow()).toBe(true);
    expect(scene.descriptor.key?.(host, 'down')).toBe(true);
    expect(scene.descriptor.key?.(host, 'confirm')).toBe(true);
    expect(host.restartRun).not.toHaveBeenCalled();
    expect(scene.pauseMenuOpenNow()).toBe(true);
    expect(scene.descriptor.key?.(host, 'confirm')).toBe(true);
    expect(host.restartRun).toHaveBeenCalledTimes(1);
    expect(scene.pauseMenuOpenNow()).toBe(false);
  });

  it('runs Settings from the selected row and closes on cancel', () => {
    const host = stubHost();
    scene.openPauseMenu(host);
    scene.descriptor.key?.(host, 'down');
    scene.descriptor.key?.(host, 'up');
    expect(scene.descriptor.key?.(host, 'confirm')).toBe(true);
    expect(host.openSettings).toHaveBeenCalledTimes(1);
    expect(host.restartRun).not.toHaveBeenCalled();
    expect(scene.pauseMenuOpenNow()).toBe(false);

    scene.openPauseMenu(host);
    expect(scene.descriptor.key?.(host, 'cancel')).toBe(true);
    expect(scene.pauseMenuOpenNow()).toBe(false);
  });

  it('is total before build: a key with no menu built consumes the four actions', () => {
    const host = stubHost();
    expect(scene.descriptor.key?.(host, 'confirm')).toBe(true);
    expect(scene.descriptor.key?.(host, 'cancel')).toBe(true);
    expect(scene.descriptor.close?.(host)).toBeUndefined();
  });
});

describe('the live flag contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('reports the canvas count with the flag off and 0 under ?hud=dom', async () => {
    vi.resetModules();
    const flagOff = await import('../../../../scenes/panels/pause');
    flagOff.notePauseDrawnObjects(9);
    expect(flagOff.pauseDrawnObjectCount()).toBe(9);

    vi.stubGlobal('window', { location: { search: '?hud=dom' } });
    vi.resetModules();
    const flagOn = await import('../../../../scenes/panels/pause');
    flagOn.notePauseDrawnObjects(9);
    expect(flagOn.pauseDrawnObjectCount()).toBe(0);
  });

  it('never reports a negative canvas count', async () => {
    vi.resetModules();
    const scene = await import('../../../../scenes/panels/pause');
    scene.notePauseDrawnObjects(-4);
    expect(scene.pauseDrawnObjectCount()).toBe(0);
  });
});

describe('the DOM row press', () => {
  type StubHost = { openSettings: () => void; restartRun: () => void };
  type SceneModule = typeof import('../../../../scenes/panels/pause');

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    mountMock.onIntent = undefined;
    mountMock.view = undefined;
    mountMock.dispose.mockClear();
  });

  /** The module as the game loads it under `?hud=dom`, with the card's mount captured. */
  async function flagOnScene(): Promise<SceneModule> {
    vi.stubGlobal('window', { location: { search: '?hud=dom' } });
    vi.stubGlobal('document', { getElementById: () => ({ appendChild: vi.fn() }) });
    vi.resetModules();
    return import('../../../../scenes/panels/pause');
  }

  /** The chainable display object `buildResetOverlay` allocates when it builds. */
  function drawnObject(): Record<string, () => unknown> {
    const object: Record<string, () => unknown> = {};
    for (const method of ['setOrigin', 'setScrollFactor', 'setDepth']) {
      object[method] = () => object;
    }
    return object;
  }

  /** The host the card's build needs: a scale, the overlay's objects and the two calls. */
  function cardHost(): StubHost & RoutePanelHost {
    const scene = {
      scale: { width: 1280, height: 800 },
      add: { rectangle: () => drawnObject(), graphics: () => drawnObject() },
      cameras: { main: { ignore: vi.fn() } },
    };
    return { openSettings: vi.fn(), restartRun: vi.fn(), scene } as unknown as StubHost & RoutePanelHost;
  }

  function press(index: number): void {
    expect(mountMock.onIntent, 'the flag mounts the DOM card').toBeTypeOf('function');
    mountMock.onIntent?.({ type: 'row', index });
  }

  function painted(): PausePanelView {
    return mountMock.view!.value as PausePanelView;
  }

  it('arms Reset on the first row press and starts the run on the second', async () => {
    const scene = await flagOnScene();
    const host = cardHost();
    scene.descriptor.build(host);
    scene.openPauseMenu(host);

    press(1);
    expect(host.restartRun).not.toHaveBeenCalled();
    expect(scene.pauseMenuOpenNow()).toBe(true);
    expect(painted().open).toBe(true);
    expect(painted().rows[1]!.armed).toBe(true);
    expect(painted().rows[1]!.label).toBe(t('pause.resetArmed'));

    press(1);
    expect(host.restartRun).toHaveBeenCalledTimes(1);
    expect(scene.pauseMenuOpenNow()).toBe(false);
    expect(painted().open).toBe(false);
  });

  it('moves the cursor and disarms when the press picks another row', async () => {
    const scene = await flagOnScene();
    const host = cardHost();
    scene.descriptor.build(host);
    scene.openPauseMenu(host);

    press(1);
    expect(painted().rows[1]!.armed).toBe(true);
    press(0);
    expect(host.openSettings).toHaveBeenCalledTimes(1);
    expect(host.restartRun).not.toHaveBeenCalled();
    expect(scene.pauseMenuOpenNow()).toBe(false);
  });

  it('unmounts the card when the descriptor closes', async () => {
    const scene = await flagOnScene();
    const host = cardHost();
    scene.descriptor.build(host);
    scene.descriptor.close?.(host);
    expect(mountMock.dispose).toHaveBeenCalledTimes(1);
  });
});
