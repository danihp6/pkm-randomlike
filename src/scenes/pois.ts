import type Phaser from 'phaser';
import type { NodePoi, PoiRect } from '../engine/region/pois';
import type { RegionRouteMap } from '../engine/region/route/map';

/**
 * The drawing half of a route's points of interest (`docs/region-spec.md` §7.8): the
 * zone's tile rect and its marker tile as screen pixels, and the two shapes the world
 * scene paints for them. It owns no rule, starts nothing and registers no scene — the
 * rect, the marker and the battle rules all come off `src/engine/region/pois.ts`.
 *
 * A route's pixel origin is the scene's (0, 0): the camera scrolls, never the rect. The
 * two helpers therefore carry the route for their caller's seam and read only the tile
 * geometry they are handed.
 */

/** The depth a zone and its marker paint at: over the tile layers, under the actors. */
const POI_DEPTH = 4;

/** The zone outline's colour: a warm gold that reads over every biome's floor. */
const POI_OUTLINE_COLOR = 0xf2c14e;

/** The marker's colour: a lighter gold, so the pin stands out of its own outline. */
const POI_MARKER_COLOR = 0xffe9a8;

/** A tile rect in screen px, for the scene that later draws the zone. */
export function poiScreenRect(
  route: RegionRouteMap,
  rect: PoiRect,
  tileSize: number,
): Readonly<{ x: number; y: number; w: number; h: number }> {
  void route;
  return {
    x: rect.x * tileSize,
    y: rect.y * tileSize,
    w: rect.width * tileSize,
    h: rect.height * tileSize,
  };
}

/** The marker's screen centre, in px: the middle of its tile. */
export function poiMarkerPoint(
  route: RegionRouteMap,
  poi: NodePoi,
  tileSize: number,
): Readonly<{ x: number; y: number }> {
  void route;
  return {
    x: poi.marker.x * tileSize + tileSize / 2,
    y: poi.marker.y * tileSize + tileSize / 2,
  };
}

/** Draws the zone's outline and its marker; returns what it created (possibly none). */
export function drawPoi(
  scene: Phaser.Scene,
  route: RegionRouteMap,
  poi: NodePoi,
  tileSize: number,
): readonly Phaser.GameObjects.GameObject[] {
  const zone = poiScreenRect(route, poi.rect, tileSize);
  const marker = poiMarkerPoint(route, poi, tileSize);
  const size = Math.max(1, Math.floor(tileSize / 2));
  const outline = scene.add
    .rectangle(zone.x + zone.w / 2, zone.y + zone.h / 2, zone.w, zone.h)
    .setStrokeStyle(1, POI_OUTLINE_COLOR)
    .setDepth(POI_DEPTH);
  const pin = scene.add.rectangle(marker.x, marker.y, size, size, POI_MARKER_COLOR).setDepth(POI_DEPTH);
  return [outline, pin];
}
