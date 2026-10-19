import { MEGA_STONE_IDS } from '../../data/items';
import { hashSeed, Rng } from '../../engine/rng';
import { isItemPicked } from '../../engine/run/state';
import type { RoomDescriptor } from './types';

/**
 * The **mega-stone** room (`docs/maps-spec.md` §7, D33, D47): a random Mega Stone
 * (one per floor, off a dedicated stream) on the room's farthest tile, taken with
 * the interact key like any ground item.
 */

/** The stable ground-item id of a floor's mega-stone room (`docs/maps-spec.md` §7). */
function megaStoneItemId(mapIndex: number): string {
  return `mega-${mapIndex}`;
}

export const descriptor: RoomDescriptor = {
  kind: 'mega-stone',
  marker: 'mega-stone',
  fixture: (host) => {
    const id = megaStoneItemId(host.view.mapIndex);
    if (isItemPicked(host.run, id)) return null;
    const position = host.farthestRoomTile();
    if (!position) return null;
    const rng = new Rng(hashSeed(`${host.run.seed}:mega:${host.view.mapIndex}`));
    const itemId = MEGA_STONE_IDS[rng.int(0, MEGA_STONE_IDS.length - 1)];
    return { items: [{ id, position, itemId, hidden: false }] };
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0x9b6bff, 1);
    graphics.fillTriangle(cx, cy - radius, cx + radius, cy, cx, cy + radius);
    graphics.fillTriangle(cx, cy - radius, cx - radius, cy, cx, cy + radius);
  },
};
