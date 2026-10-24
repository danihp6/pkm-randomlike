import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import type { KeybindAction } from '../../data/keybinds';
import { t, type TranslationKey } from '../../i18n';
import {
  FRLG_ACCENT,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  FRLG_SURFACE,
  addFrlgWindow,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { parseHudFlags } from '../../ui/hud/fixtures';
import {
  installPausePreview,
  mountPausePanel,
  pausePanelView,
  pausePreviewRequested,
  type PausePanelIntent,
  type PausePanelView,
} from '../../ui/hud/panels/pause';
import { cancelNicknameEdit } from './detail';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The pause menu (ESC, or a left-edge swipe on a phone) and the hold-to-reset
 * overlay. Neither pauses the scene: the route's update stops walking while the
 * menu is up, so the pad and A / B still drive it. The run's own restart belongs
 * to the scene; this module only asks for it.
 *
 * Under `?hud=dom` (`D49`) the card is the board's `03n` card in the HUD's Preact
 * layer (`src/ui/hud/panels/pause/`) and this module draws nothing for it: it still
 * owns the open state, the cursor, the two-press Reset and the keys, and the mount
 * paints them. The hold-to-reset overlay stays in Phaser on both paths.
 */

/** The pause menu (ESC / left-edge swipe): a centred window with two rows. */
const PAUSE_MENU_W = 360;
const PAUSE_MENU_ROW_H = 56;
const PAUSE_MENU_ITEMS = ['settings', 'reset'] as const;
const PAUSE_MENU_LABELS: Readonly<Record<(typeof PAUSE_MENU_ITEMS)[number], TranslationKey>> = {
  settings: 'pause.settings',
  reset: 'pause.reset',
};

/** Hold the reset key this long to start a fresh run: a filling ring + a fade. */
const RESET_HOLD_MS = 1600;
const RESET_RADIUS = 22;
const RESET_FADE_IN_MS = 260;
/** `Phaser.Math.DegToRad` without a runtime Phaser import (the folder is type-only). */
const DEG_TO_RAD = Math.PI / 180;

/**
 * `?hud=dom` read once, the way every scene module reads it. The fixture preview
 * mounts on its own, even before a route is ever opened, so
 * `?hudFixture=03n-panels-pause-menu` can be screenshotted without walking the menu.
 */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;
const HUD_SEARCH = typeof window === 'undefined' ? '' : window.location.search;
installPausePreview(HUD_SEARCH);

/** The pause menu (ESC, or a left-edge swipe on mobile): Settings and Reset. */
let pauseMenu: Phaser.GameObjects.Container | null = null;
let pauseMenuOpen = false;
let pauseMenuIndex = 0;
/** Reset is two-press: the first arms it, the second starts the new run. */
let pauseMenuArmed = false;
let pauseMenuRows: {
  highlight: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
}[] = [];
let resetHold = 0;
let resetScrim: Phaser.GameObjects.Rectangle | null = null;
let resetRing: Phaser.GameObjects.Graphics | null = null;

/** The DOM card (flag on): its host, its view signal, its mount and the shipped count. */
let cardHost: RoutePanelHost | null = null;
let cardView: Signal<PausePanelView> | null = null;
let cardDispose: (() => void) | null = null;
let shippedDrawnObjects = 0;

/** True while the pause menu owns the input. */
export function pauseMenuOpenNow(): boolean {
  return pauseMenuOpen;
}

/** The pause menu's own display objects; 0 under `?hud=dom`, where the card is the DOM panel's. */
export function pauseDrawnObjectCount(): number {
  return DOM_HUD ? 0 : shippedDrawnObjects;
}

/** The Phaser card reports its own display-object count; under the flag it is discarded. */
export function notePauseDrawnObjects(count: number): void {
  shippedDrawnObjects = DOM_HUD ? 0 : Math.max(0, count);
}

/** The view's viewport: the scene's own window, which the card is centred in. */
function viewport(host: RoutePanelHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

function buildPauseMenu(host: RoutePanelHost): void {
  const scene = host.scene;
  const { width, height } = scene.scale;
  const panelH = 88 + PAUSE_MENU_ITEMS.length * PAUSE_MENU_ROW_H;
  const x = (width - PAUSE_MENU_W) / 2;
  const y = (height - panelH) / 2;
  const rowX = x + 24;
  const rowW = PAUSE_MENU_W - 48;

  const scrim = scene.add.rectangle(0, 0, width, height, 0x05070c, 0.55).setOrigin(0, 0);
  const panel = addFrlgWindow(scene, x, y, PAUSE_MENU_W, panelH);
  const title = addFrlgText(scene, x + 24, y + 20, t('hud.menu'), { size: 32, tint: FRLG_INK });

  const children: Phaser.GameObjects.GameObject[] = [scrim, panel, title];
  pauseMenuRows = PAUSE_MENU_ITEMS.map((_item, i) => {
    const rowY = y + 76 + i * PAUSE_MENU_ROW_H;
    const highlight = scene.add
      .rectangle(
        rowX,
        rowY,
        rowW,
        PAUSE_MENU_ROW_H - 8,
        FRLG_SELECTED_FILL.colour,
        FRLG_SELECTED_FILL.alpha,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
      .setVisible(false);
    const label = addFrlgText(scene, rowX + 16, rowY + 12, t(PAUSE_MENU_LABELS[PAUSE_MENU_ITEMS[i]]), {
      size: 16,
      tint: FRLG_INK,
    });
    const zone = scene.add.zone(rowX, rowY, rowW, PAUSE_MENU_ROW_H).setOrigin(0, 0);
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      pauseMenuIndex = i;
      pauseMenuArmed = false;
      activatePauseMenu(host);
    });
    children.push(highlight, label, zone);
    return { highlight, label };
  });

  const container = scene.add.container(0, 0, children).setDepth(450).setVisible(false);
  pauseMenu = container;
  scene.cameras.main.ignore(container);
  notePauseDrawnObjects(container.list.length);
}

/**
 * Mounts the card into `#hud` for the scene's whole lifetime: it is hidden while
 * closed and merely painted on open, so the mount never races a new opening. A
 * missing layer mounts nothing, exactly as the shipped DOM panels guard it; the
 * fixture preview owns the card when the URL asks for it, so the scene stays out.
 */
function buildPauseCard(host: RoutePanelHost): void {
  cardHost = host;
  const painted = signal(pausePanelView({ open: false, selected: 0, armed: false }, viewport(host)));
  cardView = painted;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null && !pausePreviewRequested(HUD_SEARCH)) {
    cardDispose = mountPausePanel(layer, painted, (intent) => handlePauseIntent(host, intent));
  }
}

/** Tears the DOM card down; safe when it was never mounted. */
function disposePauseCard(): void {
  cardDispose?.();
  cardDispose = null;
  cardView = null;
  cardHost = null;
}

/** Repaints the DOM card from this module's state; a card that is not mounted no-ops. */
function paintPauseCard(host: RoutePanelHost | null): void {
  const view = cardView;
  if (view === null || host === null) return;
  cardHost = host;
  view.value = pausePanelView(
    { open: pauseMenuOpen, selected: pauseMenuIndex, armed: pauseMenuArmed },
    viewport(host),
  );
}

/** The one repaint point: the DOM card under the flag, the shipped rows without it. */
function repaintPause(host: RoutePanelHost): void {
  if (DOM_HUD) {
    paintPauseCard(host);
    return;
  }
  refreshPauseMenu();
}

/**
 * The hold-to-reset overlay: a full-screen scrim that fades the whole screen
 * out and a small ring that fills. Screen-space, so the world camera ignores it
 * and only the pinned camera draws it.
 */
function buildResetOverlay(host: RoutePanelHost): void {
  const scene = host.scene;
  const { width, height } = scene.scale;
  resetScrim = scene.add
    .rectangle(0, 0, width, height, 0x05070c, 0)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(400);
  resetRing = scene.add.graphics().setScrollFactor(0).setDepth(401);
  scene.cameras.main.ignore([resetScrim, resetRing]);
}

/** Opens the pause menu: the route stops walking, the menu takes the keys. */
export function openPauseMenu(host: RoutePanelHost): void {
  if (pauseMenuOpen) return;
  // The pause menu takes the player away from the panel, so an in-progress
  // nickname edit is discarded (the phone's Back gesture can open it directly).
  cancelNicknameEdit(host);
  pauseMenuOpen = true;
  pauseMenuIndex = 0;
  pauseMenuArmed = false;
  pauseMenu?.setVisible(true);
  repaintPause(host);
}

export function closePauseMenu(): void {
  pauseMenuOpen = false;
  pauseMenuArmed = false;
  if (DOM_HUD) {
    paintPauseCard(cardHost);
    return;
  }
  pauseMenu?.setVisible(false);
}

/**
 * The pause menu's own key router: up/down pick a row, confirm runs it and cancel
 * closes. A row that leaves the menu opens the scene's own Settings screen or
 * starts the fresh run, exactly as a click on it does.
 */
export function handlePauseMenuAction(host: RoutePanelHost, action: KeybindAction): boolean {
  switch (action) {
    case 'up':
      movePauseMenu(host, -1);
      return true;
    case 'down':
      movePauseMenu(host, 1);
      return true;
    case 'confirm':
      activatePauseMenu(host);
      return true;
    case 'cancel':
      closePauseMenu();
      return true;
    default:
      return false;
  }
}

function movePauseMenu(host: RoutePanelHost, delta: number): void {
  const count = PAUSE_MENU_ITEMS.length;
  pauseMenuIndex = (pauseMenuIndex + delta + count) % count;
  pauseMenuArmed = false;
  repaintPause(host);
}

/** Runs the chosen row: Settings pauses onto it; Reset arms, then starts over. */
function activatePauseMenu(host: RoutePanelHost): void {
  const item = PAUSE_MENU_ITEMS[pauseMenuIndex];
  if (item === 'settings') {
    closePauseMenu();
    host.openSettings();
    return;
  }
  if (!pauseMenuArmed) {
    pauseMenuArmed = true;
    repaintPause(host);
    return;
  }
  closePauseMenu();
  host.restartRun();
}

/** The shipped rows' own repaint: which highlight shows and which label Reset prints. */
function refreshPauseMenu(): void {
  pauseMenuRows.forEach((row, i) => {
    row.highlight.setVisible(i === pauseMenuIndex);
    const reset = PAUSE_MENU_ITEMS[i] === 'reset';
    row.label.setText(
      reset && pauseMenuArmed ? t('pause.resetArmed') : t(PAUSE_MENU_LABELS[PAUSE_MENU_ITEMS[i]]),
    );
  });
}

/** The DOM's twin of a row's `pointerdown` zone: a press names a row and runs it. */
function handlePauseIntent(host: RoutePanelHost, intent: PausePanelIntent): void {
  switch (intent.type) {
    case 'row': {
      const index = intent.index;
      if (!Number.isInteger(index)) return;
      if (index < 0 || index >= PAUSE_MENU_ITEMS.length) return;
      pauseMenuIndex = index;
      pauseMenuArmed = false;
      activatePauseMenu(host);
      return;
    }
    default:
      return;
  }
}

/**
 * Advances the hold-to-reset progress while the key is down, or fades back in.
 * True when the hold filled, so the scene starts the fresh run.
 */
export function updateReset(host: RoutePanelHost, delta: number, allowed: boolean): boolean {
  if (!allowed) {
    if (resetHold !== 0) {
      resetHold = 0;
      fadeResetOverlayIn(host);
    }
    return false;
  }
  resetHold = Math.min(RESET_HOLD_MS, resetHold + delta);
  const progress = resetHold / RESET_HOLD_MS;
  drawResetOverlay(host, progress);
  return progress >= 1;
}

/** Paints the screen fade-out and the small pie that fills as the hold advances. */
function drawResetOverlay(host: RoutePanelHost, progress: number): void {
  const scrim = resetScrim;
  const ring = resetRing;
  if (scrim === null || ring === null) return;
  const scene = host.scene;
  const cx = scene.scale.width / 2;
  const cy = scene.scale.height / 2;
  scene.tweens.killTweensOf(scrim);
  scene.tweens.killTweensOf(ring);
  scrim.setAlpha(progress).setVisible(true);
  ring.clear();
  ring.fillStyle(FRLG_SURFACE, 0.5).fillCircle(cx, cy, RESET_RADIUS);
  ring.fillStyle(FRLG_ACCENT, 0.9);
  ring.slice(cx, cy, RESET_RADIUS, -90 * DEG_TO_RAD, (-90 + progress * 360) * DEG_TO_RAD, false);
  ring.fillPath();
  ring.lineStyle(2, FRLG_INK, 0.5).strokeCircle(cx, cy, RESET_RADIUS);
  ring.setAlpha(1);
}

/** Releasing the key fades the dark scrim and the ring back out. */
function fadeResetOverlayIn(host: RoutePanelHost): void {
  const scrim = resetScrim;
  const ring = resetRing;
  if (scrim === null || ring === null) return;
  const scene = host.scene;
  scene.tweens.killTweensOf([scrim, ring]);
  if (host.settings().reducedFlash) {
    // The reduce-flashing preference releases the scrim instantly (D45).
    ring.clear();
    scrim.setAlpha(0);
    return;
  }
  scene.tweens.add({
    targets: [scrim, ring],
    alpha: 0,
    duration: RESET_FADE_IN_MS,
    ease: 'Quad.easeOut',
    onComplete: () => {
      ring.clear();
      scrim.setAlpha(0);
    },
  });
}

/** Puts the reset overlay away and clears the hold (the run is starting over). */
export function hideResetOverlay(host: RoutePanelHost): void {
  resetHold = 0;
  const scrim = resetScrim;
  const ring = resetRing;
  if (scrim === null || ring === null) return;
  host.scene.tweens.killTweensOf([scrim, ring]);
  ring.clear();
  scrim.setAlpha(0);
}

export const descriptor: RoutePanelDescriptor = {
  id: 'pause',
  order: 100,
  build(host: RoutePanelHost): void {
    pauseMenuOpen = false;
    pauseMenuIndex = 0;
    pauseMenuArmed = false;
    pauseMenuRows = [];
    pauseMenu = null;
    resetHold = 0;
    resetScrim = null;
    resetRing = null;
    disposePauseCard();
    shippedDrawnObjects = 0;
    buildResetOverlay(host);
    if (DOM_HUD) {
      buildPauseCard(host);
      return;
    }
    buildPauseMenu(host);
  },
  // The DOM card lives outside Phaser, so the scene's teardown has to unmount it.
  close(): void {
    disposePauseCard();
  },
  // While the menu is up it owns every action; the hook hands each one over and
  // reports it consumed, as the room panels' own handle does.
  key(host: RoutePanelHost, action: KeybindAction): boolean {
    return handlePauseMenuAction(host, action);
  },
};
