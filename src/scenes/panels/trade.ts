import { descriptor as tradeRoom } from '../rooms/trade';
import type { RoomHost } from '../rooms/types';
import type { RoutePanelDescriptor } from './types';

/**
 * The trade card's **entry point** (`D33`/`D47`): the card's own drawing lives in
 * `src/scenes/rooms/trade.ts` and is not copied here. This module only names the
 * panel in the route's registry, so a later migration can move the drawing into
 * `src/scenes/panels/trade.ts` and this file's `open` becomes it.
 */

/**
 * Opens the trade card at the counter the room's fixture placed, exactly as the
 * room's own `interact` hook does when the player faces it.
 */
export function open(host: RoomHost): void {
  const counter = host.counterTile();
  if (counter) tradeRoom.interact?.(host, counter);
}

export const descriptor: RoutePanelDescriptor = {
  id: 'trade',
  order: 90,
  // The card is drawn (and destroyed) by the room module, so there is nothing to
  // build here: this descriptor is the registry's name for the panel.
  build(): void {
    return;
  },
};
