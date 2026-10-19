import type Phaser from 'phaser';
import { FRLG_INK, addFrlgText } from './frlgFont';
import { FRLG_WINDOW_PADDING, addFrlgWindow } from './frlg';

/**
 * The floating glass card a non-modal window draws itself on (`D45`): a framed
 * card with a title band that is its own drag handle and a drawn ✕ that closes
 * it. It takes no keyboard, pauses nothing and saves no position, so the route
 * keeps walking behind it; the caller fills `content` with its own rows and adds
 * them to `root`. Everything here is a pure rectangle, so the clamp is
 * unit-tested headless.
 */

export const FLOATING_PANEL_DEPTH = 600;
export const FLOATING_HEADER_H = 44;
export const FLOATING_CLOSE_SIZE = 24;
export const FLOATING_MARGIN = 8;

export type PanelRect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type PanelViewport = Readonly<{ w: number; h: number }>;

/** The two arms of the drawn ✕, in px: long enough to read, thin enough to be a stroke. */
const CLOSE_ARM = 12;
const CLOSE_STROKE = 2;

/** Pins `{x,y}` so a `{w,h}` panel stays inside `[margin, view - size - margin]`. */
export function clampPanelOrigin(
  x: number,
  y: number,
  w: number,
  h: number,
  viewport: PanelViewport,
  margin: number = FLOATING_MARGIN,
): Readonly<{ x: number; y: number }> {
  const maxX = Math.max(margin, viewport.w - w - margin);
  const maxY = Math.max(margin, viewport.h - h - margin);
  return {
    x: Math.min(Math.max(x, margin), maxX),
    y: Math.min(Math.max(y, margin), maxY),
  };
}

export type FloatingPanelOptions = Readonly<{
  width: number;
  height: number;
  title: string;
  /** Called by the drawn close control, and only by it. */
  onClose: () => void;
}>;

export type FloatingPanel = Readonly<{
  root: Phaser.GameObjects.Container;
  /** The glass card's screen rect. */
  rect(): PanelRect;
  /** The interior below the header, inside the window's own padding. */
  content: PanelRect;
  /** Moves the whole panel; clamped by `clampPanelOrigin`. */
  moveTo(x: number, y: number): void;
  /** Removes every listener it added and destroys the root. */
  destroy(): void;
}>;

/** Builds the panel centred in the viewport, at `FLOATING_PANEL_DEPTH`. */
export function addFloatingPanel(
  scene: Phaser.Scene,
  options: FloatingPanelOptions,
): FloatingPanel {
  const { width, height, title, onClose } = options;
  const viewport = (): PanelViewport => ({ w: scene.scale.width, h: scene.scale.height });
  const start = clampPanelOrigin(
    (scene.scale.width - width) / 2,
    (scene.scale.height - height) / 2,
    width,
    height,
    viewport(),
  );

  const content: PanelRect = {
    x: FRLG_WINDOW_PADDING.x,
    y: FLOATING_HEADER_H,
    w: width - 2 * FRLG_WINDOW_PADDING.x,
    h: height - FLOATING_HEADER_H - FRLG_WINDOW_PADDING.bottom,
  };

  const closeCentreX = width - FRLG_WINDOW_PADDING.x - FLOATING_CLOSE_SIZE / 2;
  const closeCentreY = FLOATING_HEADER_H / 2;
  const closeHit = scene.add
    .rectangle(closeCentreX, closeCentreY, FLOATING_CLOSE_SIZE, FLOATING_CLOSE_SIZE, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  closeHit.on('pointerdown', () => onClose());

  const closeArms = [
    scene.add
      .rectangle(closeCentreX, closeCentreY, CLOSE_ARM, CLOSE_STROKE, FRLG_INK)
      .setRotation(Math.PI / 4),
    scene.add
      .rectangle(closeCentreX, closeCentreY, CLOSE_ARM, CLOSE_STROKE, FRLG_INK)
      .setRotation(-Math.PI / 4),
  ];

  const headerW = Math.max(0, closeCentreX - FLOATING_CLOSE_SIZE / 2 - FRLG_WINDOW_PADDING.x);
  const header = scene.add
    .zone(FRLG_WINDOW_PADDING.x, 0, headerW, FLOATING_HEADER_H)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });

  const root = scene.add
    .container(start.x, start.y, [
      addFrlgWindow(scene, 0, 0, width, height),
      addFrlgText(scene, FRLG_WINDOW_PADDING.x, FRLG_WINDOW_PADDING.top, title, {
        size: 24,
        tint: FRLG_INK,
      }),
      header,
      closeHit,
      ...closeArms,
    ])
    .setDepth(FLOATING_PANEL_DEPTH);
  scene.cameras.main.ignore(root);

  let drag: { originX: number; originY: number; fromX: number; fromY: number } | null = null;
  const moveTo = (x: number, y: number): void => {
    const pinned = clampPanelOrigin(x, y, width, height, viewport());
    root.setPosition(pinned.x, pinned.y);
  };
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (!drag) return;
    moveTo(drag.originX + pointer.x - drag.fromX, drag.originY + pointer.y - drag.fromY);
  };
  const onUp = (): void => {
    drag = null;
  };
  header.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    drag = { originX: root.x, originY: root.y, fromX: pointer.x, fromY: pointer.y };
  });
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);

  return {
    root,
    rect: () => ({ x: root.x, y: root.y, w: width, h: height }),
    content,
    moveTo,
    destroy: () => {
      drag = null;
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      root.destroy(true);
    },
  };
}
