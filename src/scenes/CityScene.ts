import Phaser from 'phaser';
import { playMusic } from '../audio/audio';
import type { KeybindAction } from '../data/keybinds';
import { PLAYER_SPRITE_TEXTURE_KEY, PLAYER_SPRITE_WIDTH, playerSpriteFrame } from '../data/playerSprite';
import { IS_DEVELOP } from '../dev/env';
import type { Tile } from '../engine/grid';
import type { CityBuilding, CityExitBand, CityPlan } from '../engine/region/city/plan';
import { planCity } from '../engine/region/city/plan';
import { planNodeContent } from '../engine/region/content';
import { markNpcUsed, nodeNpcs, npcUsed, useNpc, type PlacedNpc } from '../engine/region/npcs';
import { nodeOf, planRegion, type RegionNodeKind, type RegionPlan } from '../engine/region/plan';
import type { NodeWorld } from '../engine/region/preload';
import { travel } from '../engine/region/travel';
import type { RunState } from '../engine/run';
import { storeRun, type Settings } from '../engine/save';
import { TILE_SIZE } from '../engine/tileset';
import { actionKeys } from '../input/input';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import { openNpcPanel } from '../ui/npcPanel';
import type { PanelSceneSource } from './panels/host';
import type { RoomPanel } from './rooms/types';
import { actorDepth, WorldScene, WORLD_TRANSITION_MS } from './WorldScene';
import { drawCityNpcs, npcCardView } from './npcs';
import { WorldWalker } from './walker';

/**
 * A settlement as a place you walk (`docs/region-spec.md` §7.5): the street grid,
 * the buildings and their doors, the plaza and the grass corner drawn on the base
 * scene's two layers, the player spawned on the plan's own spawn and walked on the
 * run's movement keys, and the three things a settlement tile can do — a **door**
 * opens the interior its key names, an **exit band** walks to the neighbour
 * through the pure travel rule, and a **person** (§7.7) opens its own card.
 *
 * It owns no rule: every walk decision is `map.ts`'s, every exit is `travel.ts`'s,
 * every wall, door and band is `planCity`'s and every body, line and use mark is
 * `src/engine/region/npcs.ts`'s.
 */

/** What the debug/dev browser pass reads. */
export type CityDebugState = Readonly<{
  key: string;
  tile: { x: number; y: number };
  /** The interior key the last door step opened, or null. */
  interior: string | null;
  /** How many settle transitions this scene played. */
  travels: number;
  /** Every placed NPC of the settlement on screen, in placement order. */
  npcs: readonly Readonly<{
    id: string;
    kind: 'generic' | 'special';
    rowId: string;
    x: number;
    y: number;
    used: boolean;
  }>[];
  /** The card on screen, or null. */
  card: Readonly<{ rowId: string; used: boolean }> | null;
}>;

/** The keys a settlement reads for its people: one to talk, the rest for the card. */
type NpcKeySet = Readonly<
  Record<'interact' | 'up' | 'down' | 'confirm' | 'cancel', Phaser.Input.Keyboard.Key[]>
>;

/** The building whose door is `tile`, or null. */
export function doorAt(plan: CityPlan, tile: Tile): CityBuilding | null {
  return (
    plan.buildings.find((building) => building.door.x === tile.x && building.door.y === tile.y) ?? null
  );
}

/** The exit band `tile` belongs to, or null. */
export function exitBandAt(plan: CityPlan, tile: Tile): CityExitBand | null {
  for (const band of plan.exits) {
    for (const cell of band.tiles) {
      if (cell.x === tile.x && cell.y === tile.y) return band;
    }
  }
  return null;
}

/**
 * The scene key a city interior opens: `'centre' → 'Centre'`, `'gym' → 'Gym'`,
 * `'lab' → 'Lab'`, `'casino' → 'Casino'`, `'house:2' → 'House'`. The interior key
 * carries its city separately, so its own kind is all the key's prefix.
 */
export function interiorSceneKey(interiorKey: string): string {
  const kind = interiorKey.split(':')[0];
  return kind.length === 0 ? '' : kind[0].toUpperCase() + kind.slice(1);
}

/** The one music bed a settlement plays (`menu-music`). */
const CITY_MUSIC = 'menu-music';

export class CityScene extends WorldScene {
  private run!: RunState;
  /** The settlement on screen, or null before its plan resolves. */
  private city: CityPlan | null = null;
  private walker: WorldWalker | null = null;
  private playerSprite: Phaser.GameObjects.Sprite | null = null;
  private settings!: Settings;
  private runKey: Phaser.Input.Keyboard.Key | null = null;
  private interior: string | null = null;
  private travels = 0;
  /** The spawn the payload named (a hand-off from a flight), or null. */
  private handedSpawn: Tile | null = null;
  /** True while a door's fade is in flight, so one landing fades once. */
  private opening = false;
  /** True while a band step's travel is in flight; the player may not step again. */
  private travelling = false;
  /** Every person this settlement stands, in placement order. */
  private npcs: readonly PlacedNpc[] = [];
  /** The sprites drawn for `npcs`, in the same order (a sprite-less row is skipped). */
  private npcSprites: readonly Phaser.GameObjects.Sprite[] = [];
  /** The card on screen, or null; the one panel slot of the scene. */
  private card: Readonly<{ rowId: string; used: boolean }> | null = null;
  private npcPanel: RoomPanel | null = null;
  /** The keys the people are read from; one panel is open at a time. */
  private npcKeys: NpcKeySet | null = null;

  constructor() {
    super('City');
  }

  /**
   * `spawn` is the tile a hand-off already resolved (a flight lands on a settlement's
   * own door, `docs/region-spec.md` §5); the plan's spawn is the fallback for a run
   * that arrives with no tile named.
   */
  init(data?: { run?: RunState; spawn?: Tile }): void {
    if (data?.run) this.run = data.run;
    this.handedSpawn = data?.spawn ? { x: data.spawn.x, y: data.spawn.y } : null;
  }

  override create(): void {
    this.city = null;
    this.walker = null;
    this.playerSprite = null;
    this.interior = null;
    this.travels = 0;
    this.opening = false;
    this.travelling = false;
    this.npcs = [];
    this.npcSprites = [];
    this.card = null;
    this.npcPanel = null;
    this.settings = loadSettings();
    this.refreshRunKey();
    this.refreshNpcKeys();
    this.exposeDebugScene();

    const run = this.run;
    if (!run) {
      console.warn('city: no run to draw');
      return;
    }
    const plan = planRegion(run.seed);
    const node = nodeOf(plan, run.nodeKey);
    if (!node || (node.kind !== 'town' && node.kind !== 'city')) {
      console.warn(`city: ${run.nodeKey} is not a settlement`);
      return;
    }
    this.city = planCity(plan, node.key);
    super.create();

    const world = this.cachedWorld(run.seed, node.key);
    if (world !== null) {
      this.enter(world);
      return;
    }
    void this.preload(run.seed, node.key).then((loaded) => {
      if (loaded === null) {
        console.warn(`city: no world for ${node.key}`);
        return;
      }
      this.enter(loaded);
    });
  }

  override update(time: number, delta: number): void {
    void time;
    const action = this.readNpcAction();
    const panel = this.npcPanel;
    if (panel !== null) {
      if (action !== null) panel.handle?.(action);
      return;
    }
    const walker = this.walker;
    const sprite = this.playerSprite;
    if (walker === null || sprite === null) return;
    if (this.opening || this.travelling) return;
    if (action === 'confirm' || action === 'interact') {
      const npc = this.npcAt(walker.tile);
      if (npc !== null) {
        this.openNpcCard(npc);
        return;
      }
    }
    const running = this.settings.alwaysRun || (this.runKey?.isDown ?? false);
    walker.update(delta, running);
    sprite.setDepth(actorDepth(sprite.y));
  }

  /**
   * The neighbour is on screen: its plan is the walker's map now, and its people
   * are stood on its own free tiles.
   */
  protected override onNodeArrived(key: string, spawn: Tile): void {
    this.travelling = false;
    const plan = planRegion(this.run.seed);
    const node = nodeOf(plan, key);
    if (node && (node.kind === 'town' || node.kind === 'city')) {
      this.city = planCity(plan, key);
      this.standNpcs(plan, key);
    }
    this.buildPlayer(spawn);
    playMusic(this, CITY_MUSIC);
  }

  /** Draws an already-resolved settlement and stands the player where it spawns. */
  private enter(world: NodeWorld): void {
    this.standNpcs(planRegion(this.run.seed), world.key);
    this.applyWorld(world);
    this.buildPlayer(this.spawnFor(world.key));
    playMusic(this, CITY_MUSIC);
  }

  /**
   * Where the player stands: the payload's own spawn first (a flight's door), then
   * the arrival of a transition that landed on this node, then the plan's spawn.
   */
  private spawnFor(worldKey: string): Tile {
    if (this.handedSpawn !== null) return { x: this.handedSpawn.x, y: this.handedSpawn.y };
    const arrival = this.arrival();
    if (arrival !== null && arrival.key === worldKey) return { ...arrival.spawn };
    return this.citySpawn();
  }

  private citySpawn(): Tile {
    const city = this.city;
    return city === null ? { x: 0, y: 0 } : { x: city.spawn.x, y: city.spawn.y };
  }

  private buildPlayer(spawn: Tile): void {
    const city = this.city;
    if (city === null) return;
    if (this.playerSprite === null) {
      this.playerSprite = this.add
        .sprite(0, 0, PLAYER_SPRITE_TEXTURE_KEY, playerSpriteFrame('down'))
        .setOrigin(0.5, 1)
        .setScale(TILE_SIZE / PLAYER_SPRITE_WIDTH)
        .setDepth(actorDepth(0));
    }
    const sprite = this.playerSprite;
    this.walker = new WorldWalker(this, sprite, city.tiles, {
      onStep: (_from, to) => this.landed(to),
    });
    this.walker.place(spawn);
    sprite.setDepth(actorDepth(sprite.y));
    this.followCamera(sprite);
  }

  /**
   * Stands the node's people (the content pass decides them, `nodeNpcs` places
   * them) and draws the bodies the atlas can pose. One call per arrival, never per
   * frame: a revisit replays the very same list.
   */
  private standNpcs(plan: RegionPlan, key: string): void {
    const node = nodeOf(plan, key);
    this.npcs = node ? nodeNpcs(plan, key, planNodeContent(plan, key, node.tier ?? 1)) : [];
    for (const sprite of this.npcSprites) sprite.destroy();
    const city = this.city;
    this.npcSprites = city === null ? [] : drawCityNpcs(this, city, this.npcs);
  }

  /** The person standing on `tile`, or null. */
  private npcAt(tile: Tile): PlacedNpc | null {
    return this.npcs.find((npc) => npc.tile.x === tile.x && npc.tile.y === tile.y) ?? null;
  }

  /**
   * Opens one person's card through the scene's one panel slot: its name, its line
   * and, when it has anything left, its own rows plus `LEAVE` (`openNpcCardView`'s
   * bookkeeping, so a confirm that fired a choice closes the card once).
   */
  private openNpcCard(placed: PlacedNpc): void {
    if (this.npcPanel !== null) return;
    const used = npcUsed(this.run, placed);
    this.card = { rowId: placed.rowId, used };
    let chosen = false;
    const panel = openNpcPanel(this, npcCardView(placed, used), (id) => {
      chosen = true;
      this.chooseNpc(placed, id);
    });
    this.openPanel({
      handle: (action) => {
        chosen = false;
        panel.handle(action);
        if (!chosen && (action === 'confirm' || action === 'interact' || action === 'cancel')) {
          this.closePanel();
        }
      },
      close: () => panel.close(),
    });
  }

  /**
   * Resolves the row the card accepted. The **medic** heals and the **chef** trades
   * here; every other special's effect belongs to its own scene, so the card only
   * marks the placement spent, and a reopened card prints `npc.used`.
   */
  private chooseNpc(placed: PlacedNpc, _choiceId: string): void {
    const use = useNpc(this.run, placed);
    if (use.ok) this.commitRun(use.run);
    else if (use.reason === 'needs-scene') this.commitRun(markNpcUsed(this.run, placed));
    this.closePanel();
  }

  /** Gives the card the settlement's one panel slot; the scene closes it. */
  private openPanel(panel: RoomPanel): void {
    this.npcPanel = panel;
  }

  /** Tears the card down and clears the debug state's own record of it. */
  private closePanel(): void {
    const panel = this.npcPanel;
    this.npcPanel = null;
    this.card = null;
    panel?.close();
  }

  /** Sets the scene's run and persists it, so a use mark survives a reload. */
  private commitRun(run: RunState): void {
    this.run = run;
    this.persistRun();
    this.panelLayer?.refresh();
  }

  /**
   * The seven cards a settlement draws (`./panels/host.ts`): the run it already
   * carries, the person card's one slot and the two writes it owns. It cannot fly and
   * has nowhere to restart, so those two keep the host's no-op default.
   */
  protected override panelSource(): PanelSceneSource {
    return {
      scene: this,
      run: () => this.run,
      settings: () => this.settings,
      slot: {
        open: (panel) => this.openPanel(panel),
        close: () => this.closePanel(),
        isOpen: () => this.npcPanel !== null,
      },
      actions: {
        openSettings: () => this.openSettings(),
        commitRun: (run) => this.commitRun(run),
        persistRun: () => this.persistRun(),
      },
    };
  }

  /** The pause card's Settings row: this settlement pauses under the options page. */
  private openSettings(): void {
    if (this.opening || this.travelling) return;
    this.scene.pause();
    this.scene.launch('Settings', { from: regionSceneKey });
  }

  /**
   * What a landed step means on a settlement: a person opens its card, a door opens
   * its interior, a band walks to its neighbour, and a street does nothing at all.
   * The NPC's tile stays walkable — it blocks nothing but the step's own rule — so
   * the check comes first and only decides what the landing opens.
   */
  private landed(tile: Tile): void {
    if (this.opening || this.travelling) return;
    const city = this.city;
    if (city === null) return;
    const npc = this.npcAt(tile);
    if (npc !== null) {
      this.openNpcCard(npc);
      return;
    }
    const building = doorAt(city, tile);
    if (building !== null) {
      this.openDoor(building);
      return;
    }
    const band = exitBandAt(city, tile);
    if (band !== null) void this.walkBand(band);
  }

  /**
   * One door step: the fade plays once, the building's own interior key is recorded,
   * and the interior's scene starts when the folder has shipped it. With no such
   * scene yet the fade comes back in and the player stays on the door tile.
   */
  private openDoor(building: CityBuilding): void {
    this.interior = building.interiorKey;
    this.opening = true;
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const key = interiorSceneKey(building.interiorKey);
      if (this.scene.manager.getScene(key) !== null) {
        this.scene.start(key, {
          run: this.run,
          cityKey: this.run.nodeKey,
          interiorKey: building.interiorKey,
        });
        return;
      }
      camera.fadeIn(WORLD_TRANSITION_MS);
      this.opening = false;
    });
    camera.fadeOut(WORLD_TRANSITION_MS);
  }

  /**
   * One exit band step: the pure travel rule decides. A settlement neighbour is
   * re-drawn in place through the base scene's one fade-and-swap; any other kind is
   * handed to the scene its kind names. A refusal — a closed gate — moves nothing.
   */
  private async walkBand(band: CityExitBand): Promise<void> {
    const plan = planRegion(this.run.seed);
    const arrival = travel(plan, this.run, band.neighbourKey, 'walk');
    if (!arrival.ok) return;
    const node = nodeOf(plan, arrival.key);
    if (!node) return;

    this.travelling = true;
    if (node.kind === 'town' || node.kind === 'city') {
      let world: NodeWorld | null = null;
      try {
        world =
          this.cachedWorld(this.run.seed, arrival.key) ??
          (await this.preload(this.run.seed, arrival.key));
      } catch {
        world = null;
      }
      if (world === null) {
        this.travelling = false;
        return;
      }
      this.run = arrival.run;
      this.travels += 1;
      this.persistRun();
      this.transitionToNode(world, arrival.spawn);
      return;
    }

    const key = this.destinationScene(node.kind);
    if (key === null || this.scene.manager.getScene(key) === null) {
      this.travelling = false;
      return;
    }
    this.run = arrival.run;
    this.persistRun();
    this.scene.start(key, { run: this.run });
  }

  /** The scene a neighbour of this kind is drawn by, or null while it has none. */
  private destinationScene(kind: RegionNodeKind): string | null {
    if (kind === 'town' || kind === 'city') return regionSceneKey;
    if (kind === 'route' || kind === 'lateral') return 'Route';
    return null;
  }

  private persistRun(): void {
    storeRun(browserStorage(), this.run);
  }

  private refreshRunKey(): void {
    this.runKey = actionKeys(this, 'run', this.settings.keybinds)[0] ?? null;
  }

  /** Resolves the keys the people are talked to and the card walked with, once. */
  private refreshNpcKeys(): void {
    const bind = (action: KeybindAction): Phaser.Input.Keyboard.Key[] =>
      actionKeys(this, action, this.settings.keybinds);
    this.npcKeys = {
      interact: bind('interact'),
      up: bind('up'),
      down: bind('down'),
      confirm: bind('confirm'),
      cancel: bind('cancel'),
    };
  }

  /**
   * The shared action a press this frame means, or null. `confirm` and `interact`
   * are one key by default (`E`), so the card opens and answers on the same press
   * the route's does; the order keeps a menu press off the walk.
   */
  private readNpcAction(): KeybindAction | null {
    const keys = this.npcKeys;
    if (keys === null) return null;
    const down = (key: Phaser.Input.Keyboard.Key): boolean => Phaser.Input.Keyboard.JustDown(key);
    if (keys.up.some(down)) return 'up';
    if (keys.down.some(down)) return 'down';
    if (keys.cancel.some(down)) return 'cancel';
    if (keys.confirm.some(down)) return 'confirm';
    if (keys.interact.some(down)) return 'interact';
    return null;
  }

  /** Dev only: the browser pass reaches this scene by name, as it does the route's. */
  private exposeDebugScene(): void {
    if (!IS_DEVELOP) return;
    (globalThis as Record<string, unknown>).__pkmCity = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      delete (globalThis as Record<string, unknown>).__pkmCity;
    });
  }

  /** Dev only: the settlement on screen, the tile stood on, the last door and the people. */
  debugCityState(): CityDebugState {
    const city = this.city;
    const tile = this.walker?.tile ?? { x: 0, y: 0 };
    const run = this.run;
    return {
      key: city?.key ?? '',
      tile: { x: tile.x, y: tile.y },
      interior: this.interior,
      travels: this.travels,
      npcs: this.npcs.map((npc) => ({
        id: npc.id,
        kind: npc.kind,
        rowId: npc.rowId,
        x: npc.tile.x,
        y: npc.tile.y,
        used: run !== undefined && npcUsed(run, npc),
      })),
      card: this.card === null ? null : { rowId: this.card.rowId, used: this.card.used },
    };
  }

  /** Dev only: opens the card of the person with that placement id, as the interact key does. */
  talkTo(id: string): void {
    const placed = this.npcs.find((npc) => npc.id === id);
    if (placed === undefined) return;
    this.openNpcCard(placed);
  }

  /** Dev only: stands the player on `tile` and lets that tile's own rule answer. */
  placePlayer(tile: Tile): void {
    const walker = this.walker;
    if (walker === null) return;
    walker.place(tile);
    if (this.playerSprite !== null) this.playerSprite.setDepth(actorDepth(this.playerSprite.y));
    this.landed(tile);
  }
}

export const regionSceneKey = 'City';
export const regionSceneClass = CityScene;
