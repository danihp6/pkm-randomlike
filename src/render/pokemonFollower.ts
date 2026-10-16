import { OVERWORLD_FACINGS, type OverworldFacing } from '../data/overworldSprites';
import {
  pokemonOverworldFrame,
  type PokemonOverworldAnimId,
  type PokemonOverworldDirRow,
  type PokemonOverworldSheet,
} from '../data/pokemonOverworld';

/**
 * The party follower's animation registry. The route resolves the lead's pair
 * through `src/data/pokemonOverworld.ts` and registers one looping idle and walk
 * strip per facing off this algebra; running is the walk strip played with the
 * player's own time scale (`D24`), so both sprites keep the same cadence.
 */

/** The three facings the route draws; right is `side` flipped, as the player's art is. */
export type FollowerFacing = OverworldFacing;

/** Playback rate in frames per second; the player's own walk cycle uses the same rate. */
export const FOLLOWER_FRAME_RATE = 5;

/** The two animations the follower plays, in registration order. */
export const FOLLOWER_ANIMS: readonly PokemonOverworldAnimId[] = ['idle', 'walk'];

const DIR_ROW_NAME: Readonly<Record<FollowerFacing, PokemonOverworldDirRow>> = {
  down: 'down',
  up: 'up',
  side: 'left',
};

/** The sheet row a facing draws: down → `down`, up → `up`, side → `left`. */
export function followerDirRowName(facing: FollowerFacing): PokemonOverworldDirRow {
  return DIR_ROW_NAME[facing];
}

/** That row's index in the sheet's own `dirRows`, or -1 when the sheet lacks it. */
export function followerDirRow(sheet: PokemonOverworldSheet, facing: FollowerFacing): number {
  return sheet.dirRows.indexOf(followerDirRowName(facing));
}

/** The frame a facing draws for `anim`'s step, or null when the sheet cannot answer. */
export function followerFrame(
  sheet: PokemonOverworldSheet,
  facing: FollowerFacing,
  anim: PokemonOverworldAnimId,
  step: number,
): number | null {
  const row = followerDirRow(sheet, facing);
  if (row < 0) return null;
  const frame = pokemonOverworldFrame(sheet, anim, row, step);
  return frame < 0 ? null : frame;
}

/** The resting frame a facing stands on: idle step 0, or null. */
export function followerIdleFrame(sheet: PokemonOverworldSheet, facing: FollowerFacing): number | null {
  return followerFrame(sheet, facing, 'idle', 0);
}

/** The Phaser animation key for one sheet's facing + anim: `<textureKey>:<anim>:<row>`. */
export function followerAnimKey(
  sheet: PokemonOverworldSheet,
  facing: FollowerFacing,
  anim: PokemonOverworldAnimId,
): string {
  return `${sheet.textureKey}:${anim}:${followerDirRow(sheet, facing)}`;
}

export interface FollowerAnim {
  readonly key: string;
  readonly frames: readonly number[];
  readonly frameRate: number;
  readonly repeat: number;
}

/**
 * Every animation the follower registers for a sheet: one entry per `FOLLOWER_ANIMS`
 * id per facing, in the order `down`, `up`, `side` and, within a facing,
 * `FOLLOWER_ANIMS`' own order. Each strip is the pair's own `count` frames in
 * playback order. Empty when the sheet cannot answer a facing.
 */
export function followerAnims(sheet: PokemonOverworldSheet): readonly FollowerAnim[] {
  const anims: FollowerAnim[] = [];
  for (const facing of OVERWORLD_FACINGS) {
    const row = followerDirRow(sheet, facing);
    if (row < 0) continue;
    for (const anim of FOLLOWER_ANIMS) {
      const block = sheet.anims[anim];
      const frames = Array.from({ length: block.count }, (_, i) => row * sheet.cols + block.start + i);
      anims.push({
        key: followerAnimKey(sheet, facing, anim),
        frames,
        frameRate: FOLLOWER_FRAME_RATE,
        repeat: -1,
      });
    }
  }
  return anims;
}
