import type Phaser from 'phaser';
import { FRLG_HAIRLINE, FRLG_SURFACE, FRLG_TRACK } from './frlg';

export const PANEL_FILL = FRLG_SURFACE;
export const PANEL_STROKE = FRLG_HAIRLINE.colour;
export const GAUGE_TRACK = FRLG_TRACK.colour;

/** A rounded glass card, the shared chrome for a message box or an HP readout. */
export function drawPanel(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  options: Readonly<{ fill?: number; stroke?: number; radius?: number }> = {},
): void {
  graphics.fillStyle(options.fill ?? PANEL_FILL, 1);
  graphics.fillRoundedRect(x, y, width, height, options.radius ?? 11);
  graphics.lineStyle(1, options.stroke ?? PANEL_STROKE, FRLG_HAIRLINE.alpha);
  graphics.strokeRoundedRect(x, y, width, height, options.radius ?? 11);
}

/** An HP/XP gauge: the glass track with a coloured fill clamped to 0..1. */
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
  graphics.fillStyle(GAUGE_TRACK, FRLG_TRACK.alpha);
  graphics.fillRoundedRect(x, y, width, height, height / 2);
  if (clamped <= 0) return;
  graphics.fillStyle(color, 1);
  graphics.fillRoundedRect(x, y, Math.max(height, width * clamped), height, height / 2);
}
