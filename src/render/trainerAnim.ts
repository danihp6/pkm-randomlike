import {
  OVERWORLD_FACINGS,
  overworldWalkFrames,
  type OverworldFacing,
} from '../data/overworldSprites';
import { TRAINER_ARCHETYPES } from '../data/trainers';
import type { Facing } from '../engine/routes';

/**
 * The trainers' walk animation registry. `BootScene` builds one looping
 * animation per archetype and facing off the algebra in
 * `src/data/overworldSprites.ts`, and `RouteScene` plays it while a trainer
 * walks toward a player it spotted; a still trainer draws the resting pose.
 */

/** Playback rate in frames per second; the frame maths live in `overworldSprites`. */
export const TRAINER_WALK_FRAME_RATE = 5;

/** The Phaser animation key for an archetype's facing walk cycle. */
export function trainerWalkAnimKey(spriteKey: string, facing: OverworldFacing): string {
  return `trainer-walk:${spriteKey}:${facing}`;
}

/** How a route `Facing` reads on the three-direction overworld sheet. */
export type TrainerFacingPose = Readonly<{ facing: OverworldFacing; flipX: boolean }>;

export function trainerFacingPose(facing: Facing): TrainerFacingPose {
  switch (facing) {
    case 'N':
      return { facing: 'up', flipX: false };
    case 'S':
      return { facing: 'down', flipX: false };
    case 'W':
      return { facing: 'side', flipX: false };
    case 'E':
      return { facing: 'side', flipX: true };
  }
}

export type TrainerWalkAnim = Readonly<{
  key: string;
  spriteKey: string;
  facing: OverworldFacing;
  frames: readonly number[];
}>;

/** Every walk animation, for `BootScene` to register off the atlas. */
export const TRAINER_WALK_ANIMS: readonly TrainerWalkAnim[] = TRAINER_ARCHETYPES.flatMap(
  (archetype) => {
    const spriteKey = archetype.spriteKey;
    if (!spriteKey) return [];
    return OVERWORLD_FACINGS.flatMap((facing) => {
      const frames = overworldWalkFrames(spriteKey, facing);
      return frames
        ? [{ key: trainerWalkAnimKey(spriteKey, facing), spriteKey, facing, frames }]
        : [];
    });
  },
);
