import { BANNED_ROOM } from '../../data/bannedRoom';
import { getSpecies } from '../../data/dex';
import { bannedTrainerId } from '../../engine/maps';
import { DEFAULT_TRAINER_SIGHT, bannedSpeciesOf } from '../../engine/routes';
import { isTrainerDefeated } from '../../engine/run/state';
import { bannedRoomNotice } from '../../ui/notice';
import type { RoomDescriptor } from './types';

/**
 * The **banned-species** room (`docs/maps-spec.md` §7, D47): a dead-end leaf whose
 * battles bar the run's most-used species from being sent out. Entering it floats
 * the room's notice, and one `blackbelt` trainer stands at the room's farthest tile
 * under the floor's own stable id, so a beaten room stays beaten on a revisit. The
 * rule itself rides the launch (`BattleLaunch.bannedSpecies`), never this
 * descriptor.
 */
export const descriptor: RoomDescriptor = {
  kind: 'banned',
  marker: 'banned',
  fixture: (host) => {
    const banned = bannedSpeciesOf(host.run);
    const notice = bannedRoomNotice(banned === null ? '' : (getSpecies(banned)?.name ?? banned));
    const id = bannedTrainerId(host.view.mapIndex);
    if (isTrainerDefeated(host.run, id)) return { notice };
    const position = host.farthestRoomTile();
    if (!position) return { notice };
    return {
      notice,
      trainers: [
        {
          id,
          position,
          facing: host.facingFromTo(position, host.entryTile()),
          sight: DEFAULT_TRAINER_SIGHT,
          archetypeId: BANNED_ROOM.archetypeId,
        },
      ],
    };
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0xef4444, 1);
    graphics.fillCircle(cx, cy, radius * 0.8);
    graphics.fillStyle(0x10161f, 1);
    graphics.fillRect(cx - radius * 0.75, cy - radius * 0.18, radius * 1.5, radius * 0.36);
    graphics.fillRect(cx - radius * 0.18, cy - radius * 0.75, radius * 0.36, radius * 1.5);
  },
};
