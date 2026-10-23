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
import { cancelNicknameEdit } from './detail';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The pause menu (ESC, or a left-edge swipe on a phone) and the hold-to-reset
 * overlay. Neither pauses the scene: the route's update stops walking while the
 * menu is up, so the pad and A / B still drive it. The run's own restart belongs
 * to the scene; this module only asks for it.
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

/** The pause menu (ESC, or a left-edge swipe on mobile): Settings and Reset. */
let pauseMenu!: Phaser.GameObjects.Container;
let pauseMenuOpen = false;
let pauseMenuIndex = 0;
/** Reset is two-press: the first arms it, the second starts the new run. */
let pauseMenuArmed = false;
let pauseMenuRows: {
  highlight: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
}[] = [];
let resetHold = 0;
let resetScrim!: Phaser.GameObjects.Rectangle;
let resetRing!: Phaser.GameObjects.Graphics;

/** True while the pause menu owns the input. */
export function pauseMenuOpenNow(): boolean {
  return pauseMenuOpen;
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

  pauseMenu = scene.add.container(0, 0, children).setDepth(450).setVisible(false);
  scene.cameras.main.ignore(pauseMenu);
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
  pauseMenu.setVisible(true);
  refreshPauseMenu();
}

export function closePauseMenu(): void {
  pauseMenuOpen = false;
  pauseMenuArmed = false;
  pauseMenu.setVisible(false);
}

/**
 * The pause menu's own key router: up/down pick a row, confirm runs it and cancel
 * closes. A row that leaves the menu opens the scene's own Settings screen or
 * starts the fresh run, exactly as a click on it does.
 */
export function handlePauseMenuAction(host: RoutePanelHost, action: KeybindAction): boolean {
  switch (action) {
    case 'up':
      movePauseMenu(-1);
      return true;
    case 'down':
      movePauseMenu(1);
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

function movePauseMenu(delta: number): void {
  const count = PAUSE_MENU_ITEMS.length;
  pauseMenuIndex = (pauseMenuIndex + delta + count) % count;
  pauseMenuArmed = false;
  refreshPauseMenu();
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
    refreshPauseMenu();
    return;
  }
  closePauseMenu();
  host.restartRun();
}

function refreshPauseMenu(): void {
  pauseMenuRows.forEach((row, i) => {
    row.highlight.setVisible(i === pauseMenuIndex);
    const reset = PAUSE_MENU_ITEMS[i] === 'reset';
    row.label.setText(
      reset && pauseMenuArmed ? t('pause.resetArmed') : t(PAUSE_MENU_LABELS[PAUSE_MENU_ITEMS[i]]),
    );
  });
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
  const scene = host.scene;
  const cx = scene.scale.width / 2;
  const cy = scene.scale.height / 2;
  scene.tweens.killTweensOf(resetScrim);
  scene.tweens.killTweensOf(resetRing);
  resetScrim.setAlpha(progress).setVisible(true);
  resetRing.clear();
  resetRing.fillStyle(FRLG_SURFACE, 0.5).fillCircle(cx, cy, RESET_RADIUS);
  resetRing.fillStyle(FRLG_ACCENT, 0.9);
  resetRing.slice(cx, cy, RESET_RADIUS, -90 * DEG_TO_RAD, (-90 + progress * 360) * DEG_TO_RAD, false);
  resetRing.fillPath();
  resetRing.lineStyle(2, FRLG_INK, 0.5).strokeCircle(cx, cy, RESET_RADIUS);
  resetRing.setAlpha(1);
}

/** Releasing the key fades the dark scrim and the ring back out. */
function fadeResetOverlayIn(host: RoutePanelHost): void {
  const scene = host.scene;
  scene.tweens.killTweensOf([resetScrim, resetRing]);
  if (host.settings().reducedFlash) {
    // The reduce-flashing preference releases the scrim instantly (D45).
    resetRing.clear();
    resetScrim.setAlpha(0);
    return;
  }
  scene.tweens.add({
    targets: [resetScrim, resetRing],
    alpha: 0,
    duration: RESET_FADE_IN_MS,
    ease: 'Quad.easeOut',
    onComplete: () => {
      resetRing.clear();
      resetScrim.setAlpha(0);
    },
  });
}

/** Puts the reset overlay away and clears the hold (the run is starting over). */
export function hideResetOverlay(host: RoutePanelHost): void {
  resetHold = 0;
  host.scene.tweens.killTweensOf([resetScrim, resetRing]);
  resetRing.clear();
  resetScrim.setAlpha(0);
}

export const descriptor: RoutePanelDescriptor = {
  id: 'pause',
  order: 100,
  build(host: RoutePanelHost): void {
    pauseMenuOpen = false;
    pauseMenuIndex = 0;
    pauseMenuArmed = false;
    pauseMenuRows = [];
    resetHold = 0;
    buildResetOverlay(host);
    buildPauseMenu(host);
  },
  // While the menu is up it owns every action; the hook hands each one over and
  // reports it consumed, as the room panels' own handle does.
  key(host: RoutePanelHost, action: KeybindAction): boolean {
    return handlePauseMenuAction(host, action);
  },
};
