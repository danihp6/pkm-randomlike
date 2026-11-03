import type Phaser from 'phaser';
import type { FrameMesh } from '../engine/frameMap';
import type { NodeMeshes } from '../engine/region/preload';
import { TILE_SIZE, type TilesetConfig } from '../engine/tileset';

/** The underlay's depth: below every actor, item and overlay the route draws. */
export const WORLD_GROUND_DEPTH = -1;
/** The tiles' depth: over the underlay, under the items (`5`) and the actors (`8`). */
export const WORLD_OVERLAY_DEPTH = 0;

/**
 * Phaser's 2-D tile data for one mesh: `height` rows of `width` indices, row-major
 * like the mesh, with `-1` kept as the empty tile. A map with no cells answers `[]`.
 */
export function tilemapData(mesh: FrameMesh): number[][] {
  if (mesh.width === 0 || mesh.height === 0) return [];
  const rows: number[][] = [];
  for (let y = 0; y < mesh.height; y++) {
    const row = new Array<number>(mesh.width);
    for (let x = 0; x < mesh.width; x++) row[x] = mesh.frames[y * mesh.width + x];
    rows.push(row);
  }
  return rows;
}

export type WorldLayers = Readonly<{
  tilemap: Phaser.Tilemaps.Tilemap;
  ground: Phaser.Tilemaps.TilemapLayer;
  overlay: Phaser.Tilemaps.TilemapLayer;
}>;

/**
 * One tilemap, two culled layers, at a whole-cell scale of `TILE_SIZE`: the
 * underlay (the floor every cell stands on) and the tiles over it. The meshes come
 * from the engine's `buildNodeMeshes`, so this module never resolves a frame.
 */
export function buildWorldLayers(
  scene: Phaser.Scene,
  meshes: NodeMeshes,
  tileset: TilesetConfig,
  textureKey: string,
): WorldLayers {
  const tileWidth = tileset.atlas.tileSize;
  const tileHeight = tileWidth;
  const tilemap = scene.make.tilemap({
    data: tilemapData(meshes.ground),
    tileWidth,
    tileHeight,
  });
  const image = tilemap.addTilesetImage('tileset', textureKey, tileWidth, tileHeight, 0, 0, 0);
  if (!image) throw new Error(`no tileset image for ${textureKey}`);
  const ground = tilemap.createLayer(0, image);
  const overlay = tilemap.createBlankLayer('overlay', image);
  if (!ground || !overlay) throw new Error(`no layer for ${textureKey}`);
  overlay.putTilesAt(tilemapData(meshes.overlay), 0, 0);
  const scale = TILE_SIZE / tileWidth;
  ground.setScale(scale).setDepth(WORLD_GROUND_DEPTH);
  overlay.setScale(scale).setDepth(WORLD_OVERLAY_DEPTH);
  return { tilemap, ground, overlay };
}

/** Destroys both layers and the tilemap; idempotent. */
export function destroyWorldLayers(layers: WorldLayers): void {
  layers.ground.destroy();
  layers.overlay.destroy();
  layers.tilemap.destroy();
}
