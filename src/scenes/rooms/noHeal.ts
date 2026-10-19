import { NO_HEAL_ROOM } from '../../data/noHeal';
import { noHealTrainerId } from '../../engine/maps';
import { DEFAULT_TRAINER_SIGHT } from '../../engine/routes';
import { isTrainerDefeated } from '../../engine/run/state';
import { noHealRoomNotice } from '../../ui/notice';
import type { RoomDescriptor } from './types';

/**
 * The **no-heal** room (`docs/maps-spec.md` §7, D47): a dead-end leaf whose
 * battles refuse the player's Bag and healing moves. Entering it floats the room's
 * notice, and one `psychic` trainer stands at the room's farthest tile under the
 * floor's own stable id, so a beaten room stays beaten on a revisit. The rule
 * itself rides the launch (`BattleLaunch.noHeal`), never this descriptor.
 */
export const descriptor: RoomDescriptor = {
  kind: 'no-heal',
  marker: 'no-heal',
  fixture: (host) => {
    const notice = noHealRoomNotice();
    const id = noHealTrainerId(host.view.mapIndex);
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
          archetypeId: NO_HEAL_ROOM.archetypeId,
        },
      ],
    };
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0x8b5cf6, 1);
    graphics.fillCircle(cx, cy, radius * 0.8);
    graphics.fillStyle(0x10161f, 1);
    graphics.fillRect(cx - radius * 0.75, cy - radius * 0.18, radius * 1.5, radius * 0.36);
  },
};
