import Phaser from 'phaser';
import type { KeybindAction } from '../data/keybinds';
import { prefersTouchControls } from '../input/device';
import { addFrlgText } from './frlgFont';
import {
  padDirection,
  touchControlsLayout,
  type TouchControlsLayout,
  type TouchDirection,
} from './touchLayout';

/**
 * The on-screen touch controls (direction pad + A / B), shown only on a
 * touch-first screen. The pad walks the route (held) and steers menus (each
 * press forwards the matching keybind action), while A answers `confirm` and B
 * answers `cancel`; every press goes back through the scene's action handler, so
 * a rebind reaches the touch controls exactly like a key. The shapes are drawn
 * as outlines only — a transparent body with a half-transparent stroke — so the
 * route shows through underneath.
 */

/** The outline colour and its half-transparent alpha, per the control's look. */
const OUTLINE_COLOR = 0xffffff;
const OUTLINE_ALPHA = 0.5;
const OUTLINE_WIDTH = 3;
const LABEL_ALPHA = 0.6;
const DEPTH = 260;
/** Each arm of the pad is this share of the pad's width. */
const ARM_RATIO = 0.42;
/** The glyph size inside an arm, as a share of the arm's full width. */
const CHEVRON_RATIO = 0.22;

export type TouchControls = Readonly<{
  /** The overlay's root, so a scene can place it on its own camera. */
  root: Phaser.GameObjects.Container;
  /** Whether this screen wants the controls at all. */
  enabled: boolean;
  setVisible(visible: boolean): void;
  /** The direction held on the pad, or the last quick tap not yet consumed. */
  heldDirection(): TouchDirection | null;
  /** Drops any held pad input, e.g. when the scene pauses under a battle. */
  release(): void;
  /**
   * Re-places the controls for a `width` x `height` stage drawn inside a camera
   * viewport at (`offsetX`, `offsetY`) — the battle's centred square. Pointer
   * coordinates are canvas-space, so they are shifted by the same offset before
   * they are read as a direction.
   */
  layout(width: number, height: number, offsetX?: number, offsetY?: number): void;
  destroy(): void;
}>;

export type TouchControlsConfig = Readonly<{
  /** A pad press or an A / B press, as the keybind action it stands for. */
  onAction: (action: KeybindAction) => void;
}>;

export function createTouchControls(
  scene: Phaser.Scene,
  config: TouchControlsConfig,
): TouchControls {
  const enabled = prefersTouchControls();
  const root = scene.add.container(0, 0).setDepth(DEPTH).setVisible(enabled);
  if (!enabled) {
    return {
      root,
      enabled: false,
      setVisible: () => undefined,
      heldDirection: () => null,
      release: () => undefined,
      layout: () => undefined,
      destroy: () => root.destroy(),
    };
  }

  let layout = touchControlsLayout(scene.scale.width, scene.scale.height);
  /** The camera viewport offset the stage is drawn at (0 except the battle). */
  let offsetX = 0;
  let offsetY = 0;
  /** The direction under a finger, and the pointer id that owns the pad. */
  let held: TouchDirection | null = null;
  let padPointer = -1;

  const shapes = scene.add.graphics();
  const aLabel = addFrlgText(scene, 0, 0, 'A', { size: 32, tint: OUTLINE_COLOR, origin: 0.5 });
  const bLabel = addFrlgText(scene, 0, 0, 'B', { size: 32, tint: OUTLINE_COLOR, origin: 0.5 });
  aLabel.setAlpha(LABEL_ALPHA);
  bLabel.setAlpha(LABEL_ALPHA);

  const padZone = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: false });
  const aZone = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: false });
  const bZone = scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: false });
  root.add([shapes, padZone, aZone, bZone, aLabel, bLabel]);

  const draw = (): void => {
    const { pad, a, b } = layout;
    const half = pad.size / 2;
    const armHalf = (pad.size * ARM_RATIO) / 2;
    /** Where an arm's chevron sits, halfway along that arm. */
    const reach = (half + armHalf) / 2;
    shapes.clear();
    shapes.lineStyle(OUTLINE_WIDTH, OUTLINE_COLOR, OUTLINE_ALPHA);
    drawPadOutline(shapes, pad.x, pad.y, half, armHalf);
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      const { x, y } = armCentre(pad, direction, reach);
      drawChevron(shapes, direction, x, y, pad.size * ARM_RATIO * CHEVRON_RATIO);
    }
    shapes.strokeCircle(a.x, a.y, a.radius);
    shapes.strokeCircle(b.x, b.y, b.radius);
    aLabel.setPosition(a.x, a.y);
    bLabel.setPosition(b.x, b.y);
    padZone.setPosition(pad.x, pad.y).setSize(pad.size, pad.size);
    aZone.setPosition(a.x, a.y).setSize(a.radius * 2, a.radius * 2);
    bZone.setPosition(b.x, b.y).setSize(b.radius * 2, b.radius * 2);
  };

  padZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    padPointer = pointer.id;
    held = padDirection(pointer.x - offsetX, pointer.y - offsetY, layout);
    if (held) config.onAction(held);
  });

  aZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (pointer.id === padPointer) return;
    aLabel.setAlpha(1);
    config.onAction('confirm');
  });
  bZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    if (pointer.id === padPointer) return;
    bLabel.setAlpha(1);
    config.onAction('cancel');
  });

  const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id !== padPointer) return;
    const next = padDirection(pointer.x - offsetX, pointer.y - offsetY, layout);
    if (next === held) return;
    held = next;
    if (next) config.onAction(next);
  };
  const onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.id === padPointer) {
      padPointer = -1;
      held = null;
    }
    if (!pointer.leftButtonDown() && !pointer.isDown) {
      aLabel.setAlpha(LABEL_ALPHA);
      bLabel.setAlpha(LABEL_ALPHA);
    }
  };
  scene.input.on('pointermove', onPointerMove);
  scene.input.on('pointerup', onPointerUp);
  scene.input.on('pointerupoutside', onPointerUp);

  draw();

  return {
    root,
    enabled: true,
    setVisible: (visible) => root.setVisible(visible),
    heldDirection: () => held,
    release: () => {
      padPointer = -1;
      held = null;
      aLabel.setAlpha(LABEL_ALPHA);
      bLabel.setAlpha(LABEL_ALPHA);
    },
    layout: (width, height, nextOffsetX = 0, nextOffsetY = 0) => {
      layout = touchControlsLayout(width, height);
      offsetX = nextOffsetX;
      offsetY = nextOffsetY;
      draw();
    },
    destroy: () => {
      scene.input.off('pointermove', onPointerMove);
      scene.input.off('pointerup', onPointerUp);
      scene.input.off('pointerupoutside', onPointerUp);
      root.destroy();
    },
  };
}

function armCentre(
  pad: TouchControlsLayout['pad'],
  direction: TouchDirection,
  offset: number,
): { x: number; y: number } {
  switch (direction) {
    case 'up':
      return { x: pad.x, y: pad.y - offset };
    case 'down':
      return { x: pad.x, y: pad.y + offset };
    case 'left':
      return { x: pad.x - offset, y: pad.y };
    case 'right':
      return { x: pad.x + offset, y: pad.y };
  }
}

/** The pad's silhouette: one outline around the four arms together. */
function drawPadOutline(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  half: number,
  armHalf: number,
): void {
  const points: readonly (readonly [number, number])[] = [
    [cx - armHalf, cy - half],
    [cx + armHalf, cy - half],
    [cx + armHalf, cy - armHalf],
    [cx + half, cy - armHalf],
    [cx + half, cy + armHalf],
    [cx + armHalf, cy + armHalf],
    [cx + armHalf, cy + half],
    [cx - armHalf, cy + half],
    [cx - armHalf, cy + armHalf],
    [cx - half, cy + armHalf],
    [cx - half, cy - armHalf],
    [cx - armHalf, cy - armHalf],
  ];
  graphics.beginPath();
  graphics.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) graphics.lineTo(points[i][0], points[i][1]);
  graphics.closePath();
  graphics.strokePath();
}

/** An open chevron pointing `direction`, stroked in the live line style. */
function drawChevron(
  graphics: Phaser.GameObjects.Graphics,
  direction: TouchDirection,
  cx: number,
  cy: number,
  r: number,
): void {
  const points: readonly (readonly [number, number])[] =
    direction === 'up'
      ? [
          [cx - r, cy + r * 0.5],
          [cx, cy - r * 0.5],
          [cx + r, cy + r * 0.5],
        ]
      : direction === 'down'
        ? [
            [cx - r, cy - r * 0.5],
            [cx, cy + r * 0.5],
            [cx + r, cy - r * 0.5],
          ]
        : direction === 'left'
          ? [
              [cx + r * 0.5, cy - r],
              [cx - r * 0.5, cy],
              [cx + r * 0.5, cy + r],
            ]
          : [
              [cx - r * 0.5, cy - r],
              [cx + r * 0.5, cy],
              [cx - r * 0.5, cy + r],
            ];
  graphics.beginPath();
  graphics.moveTo(points[0][0], points[0][1]);
  graphics.lineTo(points[1][0], points[1][1]);
  graphics.lineTo(points[2][0], points[2][1]);
  graphics.strokePath();
}
