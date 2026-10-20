import { isItemPicked, markItemPicked } from '../../engine/run';
import { secretShopGateOpen, secretShopSealId, secretShopStock } from '../../engine/routes';
import { TILE_SIZE } from '../../engine/tileset';
import { gateLockedNotice, gateOpenedNotice } from '../../ui/notice';
import { SHOP_COUNTER_TEXTURE_KEY } from '../BootScene';
import { openMart } from './shop';
import type { RoomDescriptor } from './types';

/**
 * The **secret shop** (`docs/maps-spec.md` §7, `D47`): a dead-end leaf whose route
 * carved the shipped one-tile vault behind a bush, a rock or a pond. The interact key
 * opens that seal when some **party** member holds the obstacle's own type (the same
 * rule and the same table the gated leaf reads), and the far side holds a counter
 * whose key opens the shipped Mart card with the room's **own fixed stock**: four
 * held items and two TMs at their catalogue prices. The opening lives **only** in the
 * run's `pickedItems`, so a revisit and a reload agree and no module state travels.
 */

/** The counter sprite's own pixel size and the depth the trade room's counter uses. */
const SECRET_COUNTER_SIZE = 22;
const SECRET_COUNTER_DEPTH = 5;

/** The cache key the secret shelf belongs to: one counter, one shelf, no stream. */
const SECRET_STOCK_KEY = 'secret-shop';

const centerX = (tileX: number): number => tileX * TILE_SIZE + TILE_SIZE / 2;
const centerY = (tileY: number): number => tileY * TILE_SIZE + TILE_SIZE / 2;

export const descriptor: RoomDescriptor = {
  kind: 'secret-shop',
  marker: 'secret-shop',
  fixture: (host) => {
    const gate = host.route().gate;
    if (!gate) return null;
    return { counter: gate.pocket };
  },
  interact: (host, tile) => {
    const gate = host.route().gate;
    if (!gate) return false;
    const id = secretShopSealId(host.view.mapIndex, host.view.roomId);
    if (tile.x === gate.tile.x && tile.y === gate.tile.y) {
      // An opened seal is not an object any more: the key falls through to the
      // ordinary paths instead of being swallowed by a floor tile.
      if (isItemPicked(host.run, id)) return false;
      if (!secretShopGateOpen(host.run, gate.kind)) {
        host.showNotice(gateLockedNotice(gate.kind));
        return true;
      }
      host.commitRun(markItemPicked(host.run, id));
      host.rebuildRoom();
      host.showNotice(gateOpenedNotice());
      return true;
    }
    if (tile.x === gate.pocket.x && tile.y === gate.pocket.y) {
      // The card owns the key while it is up: a second press is the card's.
      if (host.panelOpen()) return true;
      openMart(host, {
        key: SECRET_STOCK_KEY,
        slots: secretShopStock(),
        title: 'mart.secretTitle',
      });
      return true;
    }
    return false;
  },
  drawFixture: (host) => {
    if (host.generatorStepActive()) return;
    const gate = host.route().gate;
    if (!gate) return;
    // Drawn whether or not the seal is open, like the gated leaf's reward.
    host.scene.add
      .image(centerX(gate.pocket.x), centerY(gate.pocket.y), SHOP_COUNTER_TEXTURE_KEY)
      .setScale(TILE_SIZE / SECRET_COUNTER_SIZE)
      .setDepth(SECRET_COUNTER_DEPTH);
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0x14b8a6, 1);
    graphics.fillCircle(cx, cy, radius * 0.85);
    graphics.fillStyle(0x10161f, 1);
    graphics.fillCircle(cx, cy, radius * 0.34);
  },
};
