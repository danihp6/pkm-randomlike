import Phaser from 'phaser';
import { specialNpcRow } from '../data/npcs';
import {
  OVERWORLD_SPRITE_TEXTURE_KEY,
  OVERWORLD_SPRITE_WIDTH,
  overworldSpriteFrame,
} from '../data/overworldSprites';
import type { CityPlan } from '../engine/region/city/plan';
import type { PoiKind } from '../engine/region/content';
import { markNpcUsed, type PlacedNpc } from '../engine/region/npcs';
import type { RunState } from '../engine/run';
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
 *
 * It also names the two **counters** the region places (`docs/region-spec.md` §7.7 and
 * §7.8): the branch `CityScene` and `RouteScene` route through, so the person or the
 * zone that opens a machine or a trade card is decided here and never in a scene's
 * switch. The same layer decides which rows stay open after a visit.
 */

/** What a person's interact opens: the Team Rocket machine, or the one generic card. */
export type NpcCounter = 'rocket' | 'card';

/** What a lateral's point of interest opens: the trade card, or nothing yet. */
export type PoiCounter = 'trade';

/** The rows whose own scene opens a counter instead of the generic card. */
const NPC_COUNTERS: Readonly<Record<string, NpcCounter>> = { rocket: 'rocket' };

/**
 * What a person's interact opens. Every row the table does not name reads as the
 * generic card — a stale save's unknown id included — so a caller always has an answer.
 */
export function npcCounterOf(rowId: string): NpcCounter {
  const counter: NpcCounter | undefined = NPC_COUNTERS[rowId];
  return counter ?? 'card';
}

/** The kinds whose zone opens a counter on the interact key; the other eight are inert. */
const POI_COUNTERS: Readonly<Partial<Record<PoiKind, PoiCounter>>> = { trade: 'trade' };

/** What a lateral's point of interest opens, or `null` while its kind has no opener. */
export function poiCounterOf(kind: PoiKind): PoiCounter | null {
  const counter: PoiCounter | undefined = POI_COUNTERS[kind];
  return counter ?? null;
}

/**
 * Whether a person answers again after a visit. A row `repeatable` in
 * `src/data/npcs.ts` — the merchant and the Rocket grunt — is never marked spent, so
 * its card keeps its own line and its counter reopens every visit; every other row,
 * and an id no table holds, is spent once per node.
 */
export function npcStaysOpen(rowId: string): boolean {
  return specialNpcRow(rowId)?.repeatable === true;
}

/**
 * The run after a visit to `placed`, with the mark the row owes: a row that stays open
 * keeps its mark unwritten, so `npcUsed` answers false and no card prints `npc.used`.
 * Pure, so the scene only commits what this answers.
 */
export function markNpcVisit(run: RunState, placed: PlacedNpc): RunState {
  return npcStaysOpen(placed.rowId) ? run : markNpcUsed(run, placed);
}

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
  const sprites: Phaser.GameObjects.Sprite[] = [];
  for (const npc of placed) {
    // A body off the settlement's own square has no tile to stand on.
    if (npc.tile.x < 0 || npc.tile.x >= city.width) continue;
    if (npc.tile.y < 0 || npc.tile.y >= city.height) continue;
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
