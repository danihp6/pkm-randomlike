import Phaser from 'phaser';
import type { TilesetId } from '../data/tilesets';
import { TILESETS, tilesetTextureKey } from '../data/tilesets';
import type { Tile } from '../engine/grid';
import { mapPixelSize, type TileMap } from '../engine/map';
import type { NodeMeshes, NodeReply, NodeRequest, NodeWorld } from '../engine/region/preload';
import { TILE_SIZE } from '../engine/tileset';
import { prefersTouchControls } from '../input/device';
import type { WorldLayers } from '../render/tilemapLayer';
import { buildWorldLayers, destroyWorldLayers } from '../render/tilemapLayer';
import {
  createScenePanels,
  NODE_PANEL_IDS,
  type PanelSceneSource,
  type ScenePanels,
} from './panels/host';
import type { RoutePanelHost, RoutePanelId } from './panels/types';

/** The one transition's length: the fade out, then the fade in. */
export const WORLD_TRANSITION_MS = 200;

/** Emitted after a transition swapped the drawn node; the payload is the arrival. */
export const WORLD_ARRIVED = 'world:arrived';

/**
 * Ground actors (the player and the trainers) sort by their foot position, so a
 * lower tile draws in front: a player standing north of a trainer passes behind
 * it. The whole band stays between the ground items (`5`) and the map, so
 * layering above the tiles is untouched.
 */
const ACTOR_DEPTH = 8;
const ACTOR_DEPTH_STEP = 0.0001;

/** The render depth of a ground actor standing with its feet at `footY`. */
export function actorDepth(footY: number): number {
  return ACTOR_DEPTH + footY * ACTOR_DEPTH_STEP;
}

/**
 * The world camera's zoom while walking a node: tiles read at 2x on a desktop
 * window. A touch screen has a much narrower viewport, so it pulls back a quarter
 * (`ROUTE_TOUCH_ZOOM_OUT`) to keep the same slice of the map on screen. Only the
 * world camera uses this; the menus and the battle are untouched.
 */
const ROUTE_CAMERA_ZOOM = 2;
const ROUTE_TOUCH_ZOOM_OUT = 0.75;

/** The world camera's zoom: 2, pulled back a quarter on a touch screen. */
export function worldCameraZoom(): number {
  return ROUTE_CAMERA_ZOOM * (prefersTouchControls() ? ROUTE_TOUCH_ZOOM_OUT : 1);
}

/** One map to draw: its tiles and the two meshes resolved from them. */
export type WorldDraw = Readonly<{
  tiles: TileMap;
  meshes: NodeMeshes;
  tilesetId: TilesetId;
}>;

type PendingNode = Readonly<{
  promise: Promise<NodeWorld | null>;
  settle: (world: NodeWorld | null) => void;
}>;

/**
 * The base every node scene extends (route, city, gym, League): it owns the tile
 * draw, the camera's bounds, the node preload and the shared panel layer. It holds
 * no run, no plan and no HUD state of its own - a subclass draws its own actors over
 * the layers, hands `panelSource` the run it carries and keeps its own rules.
 */
export abstract class WorldScene extends Phaser.Scene {
  /**
   * The shared panel layer this scene mounted, or null (and nothing is drawn). A
   * subclass that answers `null` from `panelSource` gets no layer and no listener.
   */
  protected panelLayer: ScenePanels | null = null;
  private layers: WorldLayers | null = null;
  private meshes: NodeMeshes | null = null;
  private bounds: Readonly<{ width: number; height: number }> = { width: 0, height: 0 };
  /** Every node the worker answered, keyed `${seed}:${key}`, plus the drawn one by its key. */
  private worlds = new Map<string, NodeWorld>();
  private pendingNodes = new Map<string, PendingNode>();
  private worker: Worker | null = null;
  private workerUnavailable = false;
  /** The node and spawn of the last transition, or null before the first one. */
  private lastArrival: Readonly<{ key: string; spawn: Tile }> | null = null;
  /** True while a fade is in flight, so a second `transitionToNode` cannot double-draw. */
  private transitioning = false;

  constructor(key: string) {
    super(key);
  }

  /**
   * The panels a node scene mounts: the seven a settlement produces, unless the
   * subclass names its own set (the route keeps all twelve).
   */
  protected panelSelection(): readonly RoutePanelId[] {
    return NODE_PANEL_IDS;
  }

  /**
   * The source the host answers from. The base default mounts nothing: a subclass
   * that stands a run on screen overrides it with that run, its card slot and the
   * writes it owns.
   */
  protected panelSource(): PanelSceneSource | null {
    return null;
  }

  /** The cards' port, or null for a scene that mounted no layer. */
  protected get panelHost(): RoutePanelHost | null {
    return this.panelLayer === null ? null : this.panelLayer.host;
  }

  /**
   * Builds the shared panel layer from `panelSource()`, mounts it and wires the two
   * listeners that keep it alive: a window resize repaints every card from the live
   * scale, and the scene's shutdown unmounts them. A scene with no source gets no
   * layer and registers nothing.
   */
  create(): void {
    this.panelLayer = null;
    const source = this.panelSource();
    if (source === null) return;
    const layer = createScenePanels({ ...source, panels: this.panelSelection() });
    this.panelLayer = layer;
    layer.build();
    const onResize = (): void => {
      if (this.panelLayer !== null) this.panelLayer.refresh();
    };
    const onShutdown = (): void => {
      this.scale.off('resize', onResize);
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
      if (this.panelLayer !== null) this.panelLayer.close();
    };
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
  }

  /** The underlay layer of the map on screen, or null before the first draw. */
  protected get groundLayer(): Phaser.Tilemaps.TilemapLayer | null {
    return this.layers === null ? null : this.layers.ground;
  }

  /** The tiles layer of the map on screen, or null before the first draw. */
  protected get overlayLayer(): Phaser.Tilemaps.TilemapLayer | null {
    return this.layers === null ? null : this.layers.overlay;
  }

  /** The meshes the two layers were filled from, or null before the first draw. */
  protected get worldMeshes(): NodeMeshes | null {
    return this.meshes;
  }

  /** The map's size in pixels; `{ width: 0, height: 0 }` before the first draw. */
  protected get mapBounds(): Readonly<{ width: number; height: number }> {
    return this.bounds;
  }

  /** Draws one map (replacing whatever was drawn) and puts the camera's bounds on it. */
  protected drawWorld(draw: WorldDraw): void {
    this.forgetLayers();
    const tileset = TILESETS[draw.tilesetId];
    this.layers = buildWorldLayers(this, draw.meshes, tileset.config, tilesetTextureKey(draw.tilesetId));
    this.meshes = draw.meshes;
    const bounds = mapPixelSize(draw.tiles, TILE_SIZE);
    this.bounds = { width: bounds.width, height: bounds.height };
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
  }

  /** Draws a whole node + its scene-visible camera setup; the caller places the player. */
  protected applyWorld(world: NodeWorld): void {
    this.drawWorld({ tiles: world.tiles, meshes: world.meshes, tilesetId: world.tilesetId });
    this.worlds.set(world.key, world);
  }

  /** The node and spawn of the last transition, or null before the first one. */
  protected arrival(): Readonly<{ key: string; spawn: Tile }> | null {
    return this.lastArrival;
  }

  /**
   * The one transition the game plays: fade out **once**, draw `world` (which
   * destroys the old layers), fade in and hand the spawn to the subclass. A second
   * call while a fade is in flight is ignored, so a double click cannot draw two
   * maps. It never touches the run, the HUD or the music: the subclass does.
   */
  protected transitionToNode(world: NodeWorld, spawn: Tile): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.applyWorld(world);
      this.lastArrival = { key: world.key, spawn: { x: spawn.x, y: spawn.y } };
      camera.fadeIn(WORLD_TRANSITION_MS);
      this.onNodeArrived(world.key, this.lastArrival.spawn);
      this.events.emit(WORLD_ARRIVED, this.lastArrival);
      this.transitioning = false;
    });
    camera.fadeOut(WORLD_TRANSITION_MS);
  }

  /** Hook a subclass implements to place its own actor; the base does nothing. */
  protected onNodeArrived(key: string, spawn: Tile): void {
    void key;
    void spawn;
  }

  /** Starts the camera on `target` at `worldCameraZoom()`. */
  protected followCamera(target: Phaser.GameObjects.Sprite): void {
    this.cameras.main.setZoom(worldCameraZoom());
    this.cameras.main.startFollow(target, true, 0.2, 0.2);
  }

  /** A tile's centre in world pixels. */
  protected centerX(tileX: number): number {
    return tileX * TILE_SIZE + TILE_SIZE / 2;
  }

  protected centerY(tileY: number): number {
    return tileY * TILE_SIZE + TILE_SIZE / 2;
  }

  /** The node for `key`, asked of the worker once and cached per `${seed}:${key}`. */
  protected preload(seed: string, key: string): Promise<NodeWorld | null> {
    const cached = this.cachedWorld(seed, key);
    if (cached !== null) return Promise.resolve(cached);
    const cacheKey = `${seed}:${key}`;
    const inFlight = this.pendingNodes.get(cacheKey);
    if (inFlight !== undefined) return inFlight.promise;

    let settle: (world: NodeWorld | null) => void = () => undefined;
    const promise = new Promise<NodeWorld | null>((resolve) => {
      settle = resolve;
    });
    this.pendingNodes.set(cacheKey, { promise, settle });

    const worker = this.nodeWorker();
    if (worker === null) {
      this.settleNode(cacheKey, null);
      return promise;
    }

    const onMessage = (event: MessageEvent<NodeReply>): void => {
      const reply = event.data;
      if (!reply || reply.key !== key) return;
      off();
      if (!reply.ok) {
        this.settleNode(cacheKey, null);
        return;
      }
      this.worlds.set(cacheKey, reply.world);
      this.settleNode(cacheKey, reply.world);
    };
    const onError = (): void => {
      off();
      this.settleNode(cacheKey, null);
    };
    const off = (): void => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ seed, key } satisfies NodeRequest);
    return promise;
  }

  /** The cached node for `key`, or null. Synchronous: what a transition reads. */
  protected cachedWorld(seed: string, key: string): NodeWorld | null {
    // The drawn node is keyed by its own name whatever seed asked for it, so a
    // transition can read the map on screen without re-deriving the seed.
    return this.worlds.get(`${seed}:${key}`) ?? this.worlds.get(key) ?? null;
  }

  /** Destroys the layers, terminates the worker and drops every cached node. */
  protected forgetWorlds(): void {
    this.forgetLayers();
    for (const pending of [...this.pendingNodes.values()]) pending.settle(null);
    this.pendingNodes.clear();
    this.worlds.clear();
    this.worker?.terminate();
    this.worker = null;
    this.workerUnavailable = false;
  }

  private forgetLayers(): void {
    if (this.layers !== null) destroyWorldLayers(this.layers);
    this.layers = null;
    this.meshes = null;
    this.bounds = { width: 0, height: 0 };
  }

  private settleNode(cacheKey: string, world: NodeWorld | null): void {
    const pending = this.pendingNodes.get(cacheKey);
    this.pendingNodes.delete(cacheKey);
    if (pending !== undefined) pending.settle(world);
  }

  private nodeWorker(): Worker | null {
    if (this.worker !== null) return this.worker;
    if (this.workerUnavailable) return null;
    try {
      this.worker = new Worker(new URL('../workers/nodeWorker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      this.workerUnavailable = true;
      return null;
    }
    return this.worker;
  }
}
