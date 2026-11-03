import Phaser from 'phaser';
import { specialNpcRow } from '../data/npcs';
import {
  OVERWORLD_SPRITE_TEXTURE_KEY,
  OVERWORLD_SPRITE_WIDTH,
  overworldSpriteFrame,
} from '../data/overworldSprites';
import type { CityPlan } from '../engine/region/city/plan';
import type { PlacedNpc } from '../engine/region/npcs';
import { TILE_SIZE } from '../engine/tileset';
import { t } from '../i18n';
import { trainerFacingPose } from '../render/trainerAnim';
import { actorDepth } from './WorldScene';

/**
 * The settlement screen's people (`docs/region-spec.md` §7.7): `drawCityNpcs` puts
 * one overworld sprite per placed NPC on its tile, exactly as `RouteScene` draws a
 * room's NPC, and `npcCardView` resolves the copy `openNpcPanel` prints.
 *
 * The module holds no run state and draws nothing else: where a body stands, what it
 * says and whether it has anything left are all `src/engine/region/npcs.ts`'s.
 */

/** A tile's centre in world pixels, the way every node scene measures one. */
function centerX(tileX: number): number {
  return tileX * TILE_SIZE + TILE_SIZE / 2;
}

/** The y a body's feet stand on: the tile's bottom edge, as a 16x32 frame does. */
function footY(tileY: number): number {
  return tileY * TILE_SIZE + TILE_SIZE;
}

/** Draws the node's people; returns the sprites it created, in placement order. */
export function drawCityNpcs(
  scene: Phaser.Scene,
  city: CityPlan,
  placed: readonly PlacedNpc[],
): readonly Phaser.GameObjects.Sprite[] {
  void city;
  const sprites: Phaser.GameObjects.Sprite[] = [];
  for (const npc of placed) {
    const frame = npcFrameOf(npc);
    if (frame === null) continue;
    const pose = trainerFacingPose(npc.facing);
    const feet = footY(npc.tile.y);
    sprites.push(
      scene.add
        .sprite(centerX(npc.tile.x), feet, OVERWORLD_SPRITE_TEXTURE_KEY, frame)
        .setOrigin(0.5, 1)
        .setScale(TILE_SIZE / OVERWORLD_SPRITE_WIDTH)
        .setFlipX(pose.flipX)
        .setDepth(actorDepth(feet)),
    );
  }
  return sprites;
}

/** The sprite frame a placed NPC draws: `overworldSpriteFrame(spriteKey, pose.facing)`. */
export function npcFrameOf(placed: PlacedNpc): number | null {
  return overworldSpriteFrame(placed.spriteKey, trainerFacingPose(placed.facing).facing);
}

/**
 * The card copy for one placed NPC, already localised (`t` resolved by the caller's
 * locale). A spent placement prints `npc.used` and offers no choice, and a generic
 * offers `LEAVE` only, exactly as the route's card does.
 */
export function npcCardView(
  placed: PlacedNpc,
  used: boolean,
): Readonly<{
  title: string;
  paragraph: string;
  choices: readonly Readonly<{ id: string; label: string }>[];
}> {
  const row = placed.choiceId === null ? undefined : specialNpcRow(placed.rowId);
  const choices =
    used || row === undefined
      ? []
      : (row.choices ?? []).map((choice) => ({ id: choice.id, label: t(choice.label) }));
  return {
    title: t(placed.nameKey),
    paragraph: used ? t('npc.used') : t(placed.lineKey),
    choices,
  };
}
