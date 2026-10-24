import { TILE_SIZE } from '../../engine/tileset';
import { SHOP_COUNTER_TEXTURE_KEY } from '../BootScene';
import { openTradeCard } from '../panels/trade';
import type { RoomDescriptor } from './types';

/**
 * The **trade** room (`docs/maps-spec.md` §7, `docs/routes-spec.md` §6, `D47`): a
 * counter whose interact key opens the trade card. The window itself — the shipped
 * Phaser one with `?hud=dom` off, the board's `03i`/`03j` Preact card with it on —
 * lives in `src/scenes/panels/trade.ts`, and the rule (and the roll) in
 * `src/engine/run/trade.ts`, so this module only places the counter, reports the
 * interact key and draws the room's marker.
 */

/** The counter sprite's own pixel size and the depth the shop's counter uses. */
const TRADE_COUNTER_SIZE = 22;
const TRADE_COUNTER_DEPTH = 5;

/** A route tile's centre in world pixels, the placement the scene draws entities at. */
const centerX = (tileX: number): number => tileX * TILE_SIZE + TILE_SIZE / 2;
const centerY = (tileY: number): number => tileY * TILE_SIZE + TILE_SIZE / 2;

export const descriptor: RoomDescriptor = {
  kind: 'trade',
  marker: 'trade',
  // The counter is a fixture, so it sits on the room's farthest walkable tile and
  // the scene blocks movement on it (`D47`).
  fixture: (host) => ({ counter: host.farthestRoomTile() }),
  interact: (host, tile) => {
    const counter = host.counterTile();
    if (!counter || tile.x !== counter.x || tile.y !== counter.y) return false;
    // The card already owns the keyboard: a second press is the card's, so the key is
    // consumed without rebuilding it.
    if (host.panelOpen()) return true;
    openTradeCard(host);
    return true;
  },
  drawFixture: (host) => {
    if (host.generatorStepActive()) return;
    const counter = host.counterTile();
    if (!counter) return;
    host.scene.add
      .image(centerX(counter.x), centerY(counter.y), SHOP_COUNTER_TEXTURE_KEY)
      .setScale(TILE_SIZE / TRADE_COUNTER_SIZE)
      .setDepth(TRADE_COUNTER_DEPTH);
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0x2f80ed, 1);
    graphics.fillRect(cx - radius, cy - radius * 0.6, radius * 2, radius * 0.5);
    graphics.fillTriangle(
      cx + radius * 0.2,
      cy - radius,
      cx + radius,
      cy - radius * 0.35,
      cx + radius * 0.2,
      cy + radius * 0.25,
    );
    graphics.fillStyle(0x56ccf2, 1);
    graphics.fillRect(cx - radius, cy + radius * 0.15, radius * 2, radius * 0.5);
    graphics.fillTriangle(
      cx - radius * 0.2,
      cy + radius,
      cx - radius,
      cy + radius * 0.35,
      cx - radius * 0.2,
      cy - radius * 0.25,
    );
  },
};
