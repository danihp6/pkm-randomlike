import { openMart } from '../rooms/shop';
import type { RoomHost } from '../rooms/types';
import type { RoutePanelDescriptor } from './types';

/**
 * The Mart's **entry point** (`D33`/`D47`): the shop card's own drawing lives in
 * `src/scenes/rooms/shop.ts` (`openMart`) and is not copied here. This module only
 * names the panel in the route's registry, so a later migration can move the
 * drawing into `src/scenes/panels/shop.ts` and this file's `open` becomes it.
 */

/** Opens the Mart's floating card exactly as the merchant NPC does. */
export function open(host: RoomHost): void {
  openMart(host);
}

export const descriptor: RoutePanelDescriptor = {
  id: 'shop',
  order: 80,
  // The card is drawn (and destroyed) by the room module, so there is nothing to
  // build here: this descriptor is the registry's name for the panel.
  build(): void {
    return;
  },
};
