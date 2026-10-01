import { PLAYER_FACINGS, playerWalkFrames, type PlayerFacing } from '../data/playerSprite';

/**
 * The player's walk animation registry. `BootScene` builds one looping
 * animation per facing off the algebra in `src/data/playerSprite.ts`, and the
 * route scene plays it while a step is in flight; `RouteScene` scales its
 * `timeScale` up to run, so running reuses the walking frames at a faster rate,
 * exactly as FireRed/LeafGreen does (`D24`). The resting frame, drawn when the
 * player stops, comes straight from `playerSpriteFrame`.
 */

/** Playback rate in frames per second; the frame maths live in `playerSprite`. */
export const PLAYER_WALK_FRAME_RATE = 5;

/** The Phaser animation key for a facing's walk cycle. */
export function playerWalkAnimKey(facing: PlayerFacing): string {
  return `player-walk:${facing}`;
}

/** Playback rate multiplier while running, so the cycle keeps up with steps. */
export function playerWalkTimeScale(running: boolean, walkStepMs: number, runStepMs: number): number {
  return running ? walkStepMs / runStepMs : 1;
}

export type PlayerWalkAnim = Readonly<{ key: string; facing: PlayerFacing; frames: readonly number[] }>;

/** Every walk animation, in atlas order, for `BootScene` to register. */
export const PLAYER_WALK_ANIMS: readonly PlayerWalkAnim[] = PLAYER_FACINGS.map((facing) => ({
  key: playerWalkAnimKey(facing),
  facing,
  frames: playerWalkFrames(facing),
}));
