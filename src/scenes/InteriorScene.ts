import Phaser from 'phaser';
import type { KeybindAction } from '../data/keybinds';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../data/itemIcons';
import { PLAYER_SPRITE_TEXTURE_KEY, PLAYER_SPRITE_WIDTH, playerSpriteFrame } from '../data/playerSprite';
import { TILESETS } from '../data/tilesets';
import { interiorTilesetId } from '../data/tilesets/interior';
import { IS_DEVELOP } from '../dev/env';
import type { Tile } from '../engine/grid';
import {
  interiorRoomKind,
  nextToStarterBalls,
  planInterior,
  type InteriorPlan,
} from '../engine/region/interior/plan';
import { planRegion } from '../engine/region/plan';
import { buildNodeMeshes } from '../engine/region/preload';
import type { RunState } from '../engine/run';
import { serviceHeal } from '../engine/run/heal';
import { STARTER_LEVEL, isPrologue, takeStarter } from '../engine/run/prologue';
import { starterOffer } from '../engine/run/starters';
import { loadSave, storeRun, type Settings } from '../engine/save';
import { TILE_SIZE } from '../engine/tileset';
import { t } from '../i18n';
import { actionKeys } from '../input/input';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import {
  liveStarterView,
  mountStarter,
  type StarterHandle,
  type StarterIntent,
  type StarterView,
} from '../ui/hud/panels/starter';
import type { PanelSceneSource } from './panels/host';
import { actorDepth, WORLD_TRANSITION_MS, WorldScene } from './WorldScene';
import { WorldWalker } from './walker';

/**
 * The prologue's room (`docs/region-spec.md` §6): the town's **laboratory**, the one
 * interior the town has — a city's Centre is `services.ts`. A brand-new run starts
 * here with no Pokémon at all and sees the room: the player walks up to the room's
 * table — three Poké Balls on three `COUNTER` cells — and the interact key opens the
 * professor's pick (`04 Starter pick`, the shipped `starter` panel), which hands over
 * the starter and the starting bag. The town's exit stays shut until it does
 * (`canLeaveTown`, enforced by the pure travel seam). The room also **heals on
 * entry**, the town's free rest (`serviceHeal`).
 *
 * It owns no rule of its own: the room is `planInterior`'s, the table's reach is
 * `nextToStarterBalls`'s, the gift is `run/prologue.ts`'s, the heal is
 * `run/heal.ts`'s and the walk is the shared `WorldWalker`. Every other interior key
 * keeps today's fade-back — the folder registry registers one key per module, so
 * generalising the rest is a later batch's.
 */

export const regionSceneKey = 'Lab';

/** The one interior key this scene draws: the town's laboratory. */
const LAB_INTERIOR_KEY = 'lab';

/** What the debug/dev browser pass reads. */
export type InteriorDebugState = Readonly<{
  /** The scene's registered key: always `'Lab'`. */
  sceneKey: string;
  /** The door's interior key: `'lab'` for the laboratory. */
  interiorKey: string;
  /** The settlement that owns the door: `'town:1'` on a new run. */
  cityKey: string;
  /** `interiorRoomKind(interiorKey)`: `'lab'`. */
  kind: string;
  starterTaken: boolean;
  partySize: number;
  tile: { x: number; y: number };
}>;

/** The keys the laboratory reads for its table: one to open the pick, one to cancel it. */
type StarterKeySet = Readonly<Record<'interact' | 'confirm' | 'cancel', Phaser.Input.Keyboard.Key[]>>;

/** The cards the laboratory stands: the offer while it is a prologue, `[]` after. */
export function labStarterOffer(run: RunState | undefined, seed: string): readonly string[] {
  if (run === undefined || run.starterTaken) return [];
  return starterOffer(seed);
}

export class InteriorScene extends WorldScene {
  private run: RunState | null = null;
  private settings!: Settings;
  private seed = '';
  /** The settlement whose door opened this room: the town on a new run. */
  private cityKey = '';
  /** The interior key the door named: `'lab'`. */
  private interiorKey: string = LAB_INTERIOR_KEY;
  /** The room on screen, or null before its plan resolves. */
  private interior: InteriorPlan | null = null;
  private walker: WorldWalker | null = null;
  private playerSprite: Phaser.GameObjects.Sprite | null = null;
  private runKey: Phaser.Input.Keyboard.Key | null = null;
  /** The keys the table is asked with; the pick's cancel drops it. */
  private starterKeys: StarterKeySet | null = null;
  /** The mounted DOM picker: the one emit point of the professor's offer. */
  private controller: StarterHandle | null = null;
  /** The card the pick is on. */
  private index = 0;
  /** True once the player has stepped off the door, so a step back onto it walks out. */
  private leftEntry = false;
  /** True once the way back to the town is taken, so one landing cannot start it twice. */
  private leaving = false;

  constructor() {
    super(regionSceneKey);
  }

  init(data?: { run?: RunState; cityKey?: string; interiorKey?: string }): void {
    this.walker = null;
    this.playerSprite = null;
    this.interior = null;
    this.starterKeys = null;
    this.controller = null;
    this.index = 0;
    this.leftEntry = false;
    this.leaving = false;

    const run = data?.run ?? loadSave(browserStorage()).run;
    if (!run) {
      this.run = null;
      this.scene.start('MainMenu');
      return;
    }
    this.run = run;
    this.seed = run.seed;
    this.cityKey = data?.cityKey ?? run.nodeKey;
    this.interiorKey = data?.interiorKey ?? LAB_INTERIOR_KEY;
  }

  override create(): void {
    this.settings = loadSettings();
    this.exposeDebugScene();

    const run = this.run;
    let interior: InteriorPlan | null = null;
    if (run !== null) {
      // `planInterior` throws `not an interior key: <key>`; a throw is a warn on an
      // empty camera, never a crash (the `CityScene` rule).
      try {
        interior = planInterior(planRegion(run.seed), this.interiorKey, this.cityKey);
      } catch (error) {
        console.warn(`interior: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (run === null || interior === null) return;

    this.interior = interior;
    this.cityKey = interior.cityKey;
    if (interior.kind === 'lab') this.run = this.healOnEntry(run);
    super.create();

    const id = interiorTilesetId(interior.kind);
    this.drawWorld({
      tiles: interior.tiles,
      meshes: buildNodeMeshes(interior.tiles, TILESETS[id].config),
      tilesetId: id,
    });
    this.cameras.main.fadeIn(WORLD_TRANSITION_MS);

    this.buildPlayer(interior.entry);
    this.drawStarterBalls(interior);
    this.runKey = actionKeys(this, 'run', this.settings.keybinds)[0] ?? null;
    this.starterKeys = this.readStarterKeys();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposePanel());
  }

  override update(time: number, delta: number): void {
    void time;
    const action = this.readStarterAction();
    // The pick owns the room while it is up: it never walks the player under itself,
    // and the scene's cancel key drops it, exactly as the panel's own intent does.
    if (this.controller !== null) {
      if (action === 'cancel') this.disposePanel();
      return;
    }
    const walker = this.walker;
    const sprite = this.playerSprite;
    if (walker === null || sprite === null || this.leaving) return;
    const run = this.run;
    const interior = this.interior;
    const atTable =
      interior !== null && run !== null && isPrologue(run) && nextToStarterBalls(walker.tile, interior);
    if ((action === 'interact' || action === 'confirm') && atTable) {
      this.openStarter();
      return;
    }
    const running = this.settings.alwaysRun || (this.runKey?.isDown ?? false);
    walker.update(delta, running);
    sprite.setDepth(actorDepth(sprite.y));
  }

  /**
   * The seven cards an interior draws (`./panels/host.ts`): the run it carries and
   * the two writes it owns. A laboratory opens no room card, cannot fly and has
   * nowhere to restart, so those keep the host's own defaults.
   */
  protected override panelSource(): PanelSceneSource {
    return {
      scene: this,
      run: () => this.liveRun(),
      settings: () => this.settings,
      actions: {
        openSettings: () => this.openSettings(),
        commitRun: (run) => this.commitRun(run),
        persistRun: () => this.persistRun(),
      },
    };
  }

  /** The pause card's Settings row: this room pauses under the options page. */
  private openSettings(): void {
    if (this.leaving) return;
    this.scene.pause();
    this.scene.launch('Settings', { from: regionSceneKey });
  }

  /** The live run, or a throw: `panelSource` is only read once the room resolved. */
  private liveRun(): RunState {
    const run = this.run;
    if (run === null) throw new Error('the laboratory has no run');
    return run;
  }

  /** Sets the scene's run, persists it and repaints the cards (a HUD write). */
  private commitRun(run: RunState): void {
    this.run = run;
    this.persistRun();
    this.panelLayer?.refresh();
  }

  /** Writes the run to the slot the room resumed from. */
  private persistRun(): void {
    const run = this.run;
    if (run !== null) storeRun(browserStorage(), run);
  }

  /** Dev only. */
  debugInteriorState(): InteriorDebugState {
    const run = this.run;
    const tile = this.walker?.tile ?? { x: 0, y: 0 };
    return {
      sceneKey: regionSceneKey,
      interiorKey: this.interior?.interiorKey ?? this.interiorKey,
      cityKey: this.interior?.cityKey ?? this.cityKey,
      kind: interiorRoomKind(this.interiorKey) ?? '',
      starterTaken: run?.starterTaken ?? false,
      partySize: run?.party.length ?? 0,
      tile: { x: tile.x, y: tile.y },
    };
  }

  /** Dev only: stands the player on `tile` and lets that tile's own rule answer. */
  placePlayer(tile: Tile): void {
    const walker = this.walker;
    if (walker === null) return;
    walker.place(tile);
    this.playerSprite?.setDepth(actorDepth(this.playerSprite.y));
    this.landed(tile);
  }

  /**
   * The offer's one build: the same rules, no Phaser object, one panel in `#hud`,
   * exactly as the options panel mounts it. The panel prints only copy that
   * already exists: its own title, the cards, the share line and the starter blurb.
   * Only the table opens it — a new run never lands with the pick already up.
   */
  private openStarter(): void {
    if (this.controller !== null) return;
    const run = this.run;
    if (run === null || !isPrologue(run)) return;
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.index = 0;
    this.controller = mountStarter(host, this.view(), (intent) => this.handleIntent(intent));
  }

  /**
   * The three Poké Balls on the room's table, one per `starterBalls` cell, centred on
   * the tile and sorted with the actors by their foot so the player passes behind
   * them. A prop, not a map value: the table itself is the plan's `COUNTER` run.
   */
  private drawStarterBalls(interior: InteriorPlan): void {
    const frame = itemIconFrame('pokeball');
    if (frame === null) return;
    for (const tile of interior.starterBalls ?? []) {
      this.add
        .image(this.centerX(tile.x), this.centerY(tile.y), ITEM_ICON_TEXTURE_KEY, frame)
        .setDepth(actorDepth(tile.y * TILE_SIZE + TILE_SIZE));
    }
  }

  /** Resolves the keys the table is asked with, once, from the shared keybind map. */
  private readStarterKeys(): StarterKeySet {
    const bind = (action: KeybindAction): Phaser.Input.Keyboard.Key[] =>
      actionKeys(this, action, this.settings.keybinds);
    return {
      interact: bind('interact'),
      confirm: bind('confirm'),
      cancel: bind('cancel'),
    };
  }

  /** The starter action a press this frame means, or null; `cancel` is read first. */
  private readStarterAction(): KeybindAction | null {
    const keys = this.starterKeys;
    if (keys === null) return null;
    const down = (key: Phaser.Input.Keyboard.Key): boolean => Phaser.Input.Keyboard.JustDown(key);
    if (keys.cancel.some(down)) return 'cancel';
    if (keys.confirm.some(down)) return 'confirm';
    if (keys.interact.some(down)) return 'interact';
    return null;
  }

  private view(): StarterView {
    const run = this.run;
    return liveStarterView(
      this.offer(),
      this.index,
      this.seed,
      run?.mode ?? 'finite',
      t('starter.blurb'),
    );
  }

  private offer(): readonly string[] {
    return labStarterOffer(this.run ?? undefined, this.seed);
  }

  private disposePanel(): void {
    if (this.controller === null) return;
    this.controller.dispose();
    this.controller = null;
  }

  private clampIndex(index: number): number {
    const offer = this.offer();
    if (!Number.isFinite(index) || offer.length === 0) return 0;
    return Math.min(Math.max(0, Math.trunc(index)), offer.length - 1);
  }

  /** The one emit point of the panel: the scene owns the offer, the panel paints it. */
  private render(): void {
    this.controller?.update(this.view());
  }

  /**
   * The panel's intents. A chosen card is the one-click pick: the professor's gift is
   * committed to the save and the picker drops, because the offer is spent. Cancel
   * drops it with no gift at all, so the player can walk away and come back.
   */
  private handleIntent(intent: StarterIntent): void {
    switch (intent.type) {
      case 'select':
        this.index = this.clampIndex(intent.index);
        this.render();
        return;
      case 'choose':
        this.index = this.clampIndex(intent.index);
        this.confirm();
        return;
      case 'cancel':
        this.disposePanel();
        return;
      case 'seed-prompt':
      case 'settings':
        return;
    }
  }

  private confirm(): void {
    const run = this.run;
    const speciesId = this.offer()[this.index];
    if (run === null || speciesId === undefined) return;
    this.commitRun(takeStarter(run, speciesId, STARTER_LEVEL));
    this.disposePanel();
  }

  /**
   * The laboratory's **free entry heal** (`docs/region-spec.md` §6): the town has no
   * Centre, so its one room rests the party and the box when the door opens — HP and
   * PP, never a status cure and never a revival (`serviceHeal`, `D5`).
   */
  private healOnEntry(run: RunState): RunState {
    const healed = serviceHeal(run);
    storeRun(browserStorage(), healed);
    return healed;
  }

  private buildPlayer(spawn: Tile): void {
    const interior = this.interior;
    if (interior === null) return;
    const sprite = this.add
      .sprite(0, 0, PLAYER_SPRITE_TEXTURE_KEY, playerSpriteFrame('down'))
      .setOrigin(0.5, 1)
      .setScale(TILE_SIZE / PLAYER_SPRITE_WIDTH)
      .setDepth(actorDepth(0));
    this.playerSprite = sprite;
    this.walker = new WorldWalker(this, sprite, interior.tiles, {
      onStep: (_from, to) => this.landed(to),
    });
    this.walker.place(spawn);
    sprite.setDepth(actorDepth(sprite.y));
    this.followCamera(sprite);
  }

  /**
   * What a landed tile means: leaving the door opens the room, and stepping back onto
   * it once the player has left walks them out to the town. Standing on it at the
   * start is the arrival, not a departure.
   */
  private landed(tile: Tile): void {
    if (this.leaving) return;
    const interior = this.interior;
    if (interior === null) return;
    if (tile.x === interior.entry.x && tile.y === interior.entry.y) {
      if (this.leftEntry) this.exitToCity();
      return;
    }
    this.leftEntry = true;
  }

  private exitToCity(): void {
    const run = this.run;
    if (run === null || this.leaving) return;
    this.leaving = true;
    storeRun(browserStorage(), run);
    this.scene.start('City', { run });
  }

  /** Dev only: the browser pass reaches this scene by name, as it does the city's. */
  private exposeDebugScene(): void {
    if (!IS_DEVELOP) return;
    (globalThis as Record<string, unknown>).__pkmInterior = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      delete (globalThis as Record<string, unknown>).__pkmInterior;
    });
  }
}

export const regionSceneClass = InteriorScene;
