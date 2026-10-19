import { miniBossTrainerId } from '../../engine/maps';
import { DEFAULT_TRAINER_SIGHT } from '../../engine/routes';
import { isTrainerDefeated } from '../../engine/run/state';
import type { RoomDescriptor } from './types';

/**
 * The **mini-boss** room (`docs/maps-spec.md` §7, D33, D47): a strong `ace` trainer
 * at the room's farthest tile, fielding a fixed three-member party (two on map 1)
 * at band levels and allowed a Mega Stone. Its id is the floor's own stable one, so
 * a beaten mini-boss stays beaten on a revisit.
 */
export const descriptor: RoomDescriptor = {
  kind: 'mini-boss',
  marker: 'mini-boss',
  fixture: (host) => {
    const id = miniBossTrainerId(host.view.mapIndex);
    if (isTrainerDefeated(host.run, id)) return null;
    const position = host.farthestRoomTile();
    if (!position) return null;
    return {
      trainers: [
        {
          id,
          position,
          facing: host.facingFromTo(position, host.entryTile()),
          sight: DEFAULT_TRAINER_SIGHT,
          archetypeId: 'ace',
        },
      ],
    };
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0xd9534f, 1);
    graphics.fillTriangle(
      cx,
      cy - radius,
      cx + radius,
      cy + radius * 0.8,
      cx - radius,
      cy + radius * 0.8,
    );
  },
};
