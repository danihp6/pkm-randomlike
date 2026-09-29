import type Phaser from 'phaser';

export const PANEL_FILL = 0x1b2740;
export const PANEL_STROKE = 0xf8fafc;
export const GAUGE_TRACK = 0x0b1220;

/** A rounded panel, the shared chrome for the message box and the HP readouts. */
export function drawPanel(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  options: Readonly<{ fill?: number; stroke?: number; radius?: number }> = {},
): void {
  graphics.fillStyle(options.fill ?? PANEL_FILL, 0.96);
  graphics.fillRoundedRect(x, y, width, height, options.radius ?? 12);
  graphics.lineStyle(3, options.stroke ?? PANEL_STROKE, 1);
  graphics.strokeRoundedRect(x, y, width, height, options.radius ?? 12);
}

/** An HP/XP gauge: a dark track with a coloured fill clamped to 0..1. */
export function drawGauge(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  fraction: number,
  color: number,
): void {
  const clamped = Math.max(0, Math.min(1, fraction));
  graphics.fillStyle(GAUGE_TRACK, 1);
  graphics.fillRoundedRect(x, y, width, height, height / 2);
  if (clamped <= 0) return;
  graphics.fillStyle(color, 1);
  graphics.fillRoundedRect(x, y, Math.max(height, width * clamped), height, height / 2);
}
