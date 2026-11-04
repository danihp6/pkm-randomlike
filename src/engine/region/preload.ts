import type { TilesetId } from '../../data/tilesets/ids';
import { FRLG_CITY_TILESET } from '../../data/tilesets/city';
import { FRLG_FOREST_TILESET } from '../../data/tilesets/frlg';
import { buildFrameMesh, type FrameMesh } from '../frameMap';
import type { Tile } from '../grid';
import type { TileMap } from '../map';
import { resolveGroundFrame } from '../tileFrames';
import type { TilesetConfig } from '../tileset';
import { planCity } from './city';
import { nodeOf, parseNodeKey, planRegion, type RegionNodeKind, type RegionPlan } from './plan';
import { generateRoute, isRouteKind } from './route';

/** The two meshes one map draws: the floor under every cell, and the tile over it. */
export type NodeMeshes = Readonly<{ ground: FrameMesh; overlay: FrameMesh }>;

/** One region node resolved to everything a scene needs to draw and walk it. */
export type NodeWorld = Readonly<{
  /** The node's `nodeKey`. */
  key: string;
  kind: RegionNodeKind;
  /** The atlas the node draws from: `forest` on a route, `city` on a settlement. */
  tilesetId: TilesetId;
  width: number;
  height: number;
  /** The map in the engine's own values (`src/engine/map.ts`). */
  tiles: TileMap;
  meshes: NodeMeshes;
  /** Where a walk in through an exit band lands: `planCity().spawn`, or the carver's entry. */
  spawn: Tile;
}>;

/** The worker's request and reply, both structured-cloneable. */
export type NodeRequest = Readonly<{ seed: string; key: string }>;
export type NodeReply =
  | Readonly<{ ok: true; key: string; world: NodeWorld }>
  | Readonly<{ ok: false; key: string; error: string }>;

type NodeResolution = Readonly<{ ok: true; world: NodeWorld } | { ok: false; error: string }>;

/**
 * The two meshes of one map, resolved exactly as `RouteScene` framed them cell by
 * cell before the layers: `overlay` is the tile each cell draws, `ground` the floor
 * laid under it - the FRLG tree keeps a transparent ground, so a cell must never
 * draw over the void. Both are row-major over the same cells.
 */
export function buildNodeMeshes(tiles: TileMap, tileset: TilesetConfig, pad = 0): NodeMeshes {
  const overlay = buildFrameMesh(tiles, tileset, pad);
  const frames = new Int32Array(overlay.frames.length);
  let index = 0;
  for (let y = 0; y < overlay.height; y++) {
    for (let x = 0; x < overlay.width; x++) {
      frames[index] = resolveGroundFrame(tiles, x, y, tileset).frame;
      index += 1;
    }
  }
  return { ground: { width: overlay.width, height: overlay.height, frames }, overlay };
}

function settlementWorld(plan: RegionPlan, key: string, kind: RegionNodeKind): NodeResolution {
  const city = planCity(plan, key);
  return {
    ok: true,
    world: {
      key,
      kind,
      tilesetId: 'city',
      width: city.width,
      height: city.height,
      tiles: city.tiles,
      meshes: buildNodeMeshes(city.tiles, FRLG_CITY_TILESET),
      spawn: { x: city.spawn.x, y: city.spawn.y },
    },
  };
}

function routeWorld(plan: RegionPlan, key: string, kind: RegionNodeKind): NodeResolution {
  const route = generateRoute(plan, key);
  return {
    ok: true,
    world: {
      key,
      kind,
      tilesetId: 'forest',
      width: route.width,
      height: route.height,
      tiles: route.tiles,
      meshes: buildNodeMeshes(route.tiles, FRLG_FOREST_TILESET),
      spawn: { x: route.entry.x, y: route.entry.y },
    },
  };
}

/**
 * One node resolved off the run seed: the plan names it, its own generator carves
 * it and `buildNodeMeshes` frames it. It reads no RNG of its own, so a fixed seed
 * replays the same node however often it is asked for (`D11`).
 */
function resolveNode(seed: string, key: string): NodeResolution {
  if (parseNodeKey(key) === null) return { ok: false, error: `no node ${key}` };
  const plan = planRegion(seed);
  const node = nodeOf(plan, key);
  if (node === undefined) return { ok: false, error: `no node ${key}` };
  if (isRouteKind(node.kind)) return routeWorld(plan, key, node.kind);
  if (node.kind === 'town' || node.kind === 'city') return settlementWorld(plan, key, node.kind);
  return { ok: false, error: `no generator for ${key}` };
}

/** One node resolved off the run seed, or `null` when the plan holds no such drawable node. */
export function preloadNode(seed: string, key: string): NodeWorld | null {
  const resolution = resolveNode(seed, key);
  return resolution.ok ? resolution.world : null;
}

/** Answers one request without throwing: an unknown key is `{ ok: false }`. */
export function answerNodeRequest(request: NodeRequest): NodeReply {
  const key = typeof request?.key === 'string' ? request.key : '';
  const seed = typeof request?.seed === 'string' ? request.seed : '';
  try {
    const resolution = resolveNode(seed, key);
    return resolution.ok
      ? { ok: true, key, world: resolution.world }
      : { ok: false, key, error: resolution.error };
  } catch (error) {
    return { ok: false, key, error: error instanceof Error ? error.message : 'unknown error' };
  }
}
