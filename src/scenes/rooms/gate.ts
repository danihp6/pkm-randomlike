import { GATES } from '../../data/gates';
import { ROUTE_LOOT } from '../../data/loot';
import { bandForMap, isItemPicked, markItemPicked, partyHasType } from '../../engine/run';
import { gateId, gateRewardId, pickWeighted } from '../../engine/routes';
import { hashSeed, Rng } from '../../engine/rng';
import { gateLockedNotice, gateOpenedNotice } from '../../ui/notice';
import type { RoomDescriptor } from './types';

/**
 * The **gated** reward room (`docs/maps-spec.md` §7, `D47`): a one-tile vault the
 * route generator carved (`RouteRequest.gate`) behind a bush, a rock or a pond. The
 * interact key on the seal opens it for good when some **party member has the
 * obstacle's type** (`src/data/gates.ts`, `partyHasType`); the reward inside is one
 * ordinary ground item the scene's own `drawItems` draws. The seal is a tile value
 * the renderer draws and the opened state lives **only** in the run's `pickedItems`,
 * so a revisit and a reload agree and no module state travels.
 */

export const descriptor: RoomDescriptor = {
  kind: 'gated',
  marker: 'gated',
  fixture: (host) => {
    const gate = host.route().gate;
    if (!gate) return null;
    const id = gateRewardId(host.view.mapIndex, host.view.roomId);
    if (isItemPicked(host.run, id)) return null;
    const band = bandForMap(host.view.mapIndex);
    const rng = new Rng(
      hashSeed(`${host.run.seed}:gate:${host.view.mapIndex}:${host.view.roomId}:reward`),
    );
    const itemId = pickWeighted(ROUTE_LOOT[band.id].pool, rng).itemId;
    return { items: [{ id, position: gate.pocket, itemId, hidden: false }] };
  },
  interact: (host, tile) => {
    const gate = host.route().gate;
    if (!gate || tile.x !== gate.tile.x || tile.y !== gate.tile.y) return false;
    const id = gateId(host.view.mapIndex, host.view.roomId);
    // An opened gate is not an object any more: the key falls through to the ordinary
    // paths (an item, a trainer) instead of being swallowed by a floor tile.
    if (isItemPicked(host.run, id)) return false;
    if (!partyHasType(host.run, GATES[gate.kind].types)) {
      host.showNotice(gateLockedNotice(gate.kind));
      return true;
    }
    host.commitRun(markItemPicked(host.run, id));
    host.rebuildRoom();
    host.showNotice(gateOpenedNotice());
    return true;
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0x8a6d3b, 1);
    graphics.fillCircle(cx, cy - radius * 0.25, radius * 0.42);
    graphics.fillRect(cx - radius * 0.2, cy, radius * 0.4, radius * 0.85);
  },
};
