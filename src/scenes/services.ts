import Phaser from 'phaser';
import type { KeybindAction } from '../data/keybinds';
import type { HudPanelId, HudLayout } from '../data/hudLayout';
import { PLAYER_SPRITE_TEXTURE_KEY, PLAYER_SPRITE_WIDTH, playerSpriteFrame } from '../data/playerSprite';
import { shopBandForTier } from '../data/shop';
import { FRLG_INTERIOR_TILESET } from '../data/tilesets/interior';
import { IS_DEVELOP } from '../dev/env';
import type { Tile } from '../engine/grid';
import { COUNTER, tileAt } from '../engine/map';
import { planInterior, type InteriorPlan, type InteriorSlotRole } from '../engine/region/interior/plan';
import { nodeOf, planRegion } from '../engine/region/plan';
import { buildNodeMeshes } from '../engine/region/preload';
import { hashSeed, Rng } from '../engine/rng';
import { pcMemberEditable, type RunState } from '../engine/run';
import { serviceHeal } from '../engine/run/heal';
import { loadSave, storeRun, type Settings } from '../engine/save';
import { TILE_SIZE } from '../engine/tileset';
import { t } from '../i18n';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import { initialPartyUi, type PartyUiState } from '../ui/partyScreen';
import { buildShop, buyRows, type ShopSlot } from '../ui/shop';
import { descriptor as detailPanel, refreshDetail } from './panels/detail';
import { hudMetrics } from './panels/hud';
import { descriptor as pcPanel, openPcPanel, refreshPcPanel } from './panels/pc';
import { closeShopCard, openShopCard, type ShopCardHost } from './panels/shop';
import type { RoutePanelHost } from './panels/types';
import { actorDepth, WORLD_TRANSITION_MS, WorldScene } from './WorldScene';
import { WorldWalker } from './walker';

/**
 * A region **Pokémon Centre** (`docs/region-spec.md` §6): the one interior a city's
 * `centre` door opens onto, and the only place the three services exist. Its counter
 * heals the party and the box on entry (HP and PP, never a status and never a revival,
 * `D5`), its PC is the one place the party and the box may trade members and its
 * merchant is the region's only shop, stocked per city off `shopBandForTier`.
 *
 * It owns no rule of its own: the room is `planInterior`'s, the heal is `serviceHeal`'s,
 * the shelf is `buildShop`'s and the walk is the shared `WorldWalker`. The two cards it
 * opens are the shipped PC box and the shipped merchant card, mounted in `#hud` the way
 * the route mounts them, through a host built here because a Centre is not a route.
 */

export const regionSceneKey = 'Centre';

/** The one interior key a city's door names: its Centre. */
const CENTRE_INTERIOR_KEY = 'centre';

/** The Centre's own shop stream: one shelf per city, rolled once (`D11`). */
const shopStreamKey = (seed: string, cityKey: string): string => `${seed}:shop:${cityKey}`;

/** What the debug/dev browser pass reads. */
export type ServicesDebugState = Readonly<{
  /** The scene's registered key: always `'Centre'`. */
  sceneKey: string;
  /** The door's interior key: `'centre'`. */
  interiorKey: string;
  /** The settlement that owns the door: `'city:2'` on a city. */
  cityKey: string;
  /** True once the entry heal ran and was committed to the save. */
  healed: boolean;
  /** `pcMemberEditable(run, true)`: the PC is editable here, and only here. */
  pcEditable: boolean;
  /** The city's stock rows (`buyRows`); 0 before the shelf is rolled. */
  shopRows: number;
  /** The city's shelf key: `${seed}:shop:${cityKey}`. */
  stockKey: string;
}>;

/** True when two tiles touch: they are the same cell or one cardinal step apart. */
function beside(a: Tile, b: Tile): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
}

/**
 * The room this scene draws: a city's Centre. A city's door names it `'centre'`, and a
 * caller that hands the city's own suffix (`'centre:2'`) still gets the one Centre room,
 * because the plan's layout stream is `<cityKey>/centre` either way.
 */
function roomKeyOf(interiorKey: string): string {
  return interiorKey.split(':')[0] === CENTRE_INTERIOR_KEY ? CENTRE_INTERIOR_KEY : interiorKey;
}

export class ServicesScene extends WorldScene {
  private run: RunState | null = null;
  private settings!: Settings;
  /** The settlement whose door opened this room. */
  private cityKey = '';
  /** The interior key the door named: `'centre'`. */
  private interiorKey: string = CENTRE_INTERIOR_KEY;
  /** The room on screen, or null before its plan resolves. */
  private interior: InteriorPlan | null = null;
  private walker: WorldWalker | null = null;
  private playerSprite: Phaser.GameObjects.Sprite | null = null;
  private runKey: Phaser.Input.Keyboard.Key | null = null;
  /** True once the player has stepped off the door, so a step back onto it walks out. */
  private leftEntry = false;
  /** True once the way back to the city is taken, so one landing cannot start it twice. */
  private leaving = false;
  /** True once the counter's entry heal ran and was committed. */
  private healed = false;
  /** The city's shelf, rolled once on entry; `[]` until then. */
  private stock: readonly ShopSlot[] = [];
  /** The shelf's own stream key. */
  private stockKey = '';
  /** The panel host the two cards read the run through, built once. */
  private panelHostValue: RoutePanelHost | null = null;
  /** What the two cards trade against: the live run, the one writer and the ✕. */
  private shopHostValue: ShopCardHost | null = null;
  /** The HUD's cursor state: the box card's selection, no party card behind it. */
  private uiState: PartyUiState = initialPartyUi();
  /** The cards this scene has opened; the cards' own `open` flag reads it. */
  private readonly openCards = new Set<HudPanelId>();
  /** True while the merchant's card owns the surface. */
  private shopOpen = false;
  /** True once the PC box and the detail window are mounted. */
  private pcMounted = false;

  constructor() {
    super(regionSceneKey);
  }

  init(data?: { run?: RunState; cityKey?: string; interiorKey?: string }): void {
    this.walker = null;
    this.playerSprite = null;
    this.interior = null;
    this.leftEntry = false;
    this.leaving = false;
    this.healed = false;
    this.stock = [];
    this.stockKey = '';
    this.panelHostValue = null;
    this.shopHostValue = null;
    this.uiState = initialPartyUi();
    this.openCards.clear();
    this.shopOpen = false;
    this.pcMounted = false;

    const run = data?.run ?? loadSave(browserStorage()).run;
    if (!run) {
      this.run = null;
      this.scene.start('MainMenu');
      return;
    }
    this.run = run;
    this.cityKey = data?.cityKey ?? run.nodeKey;
    this.interiorKey = data?.interiorKey ?? CENTRE_INTERIOR_KEY;
  }

  create(): void {
    this.settings = loadSettings();
    this.exposeDebugScene();

    const run = this.run;
    let interior: InteriorPlan | null = null;
    if (run !== null) {
      // `planInterior` throws `not an interior key: <key>`; a throw is a warn on an
      // empty camera, never a crash (the `CityScene` rule).
      try {
        interior = planInterior(planRegion(run.seed), roomKeyOf(this.interiorKey), this.cityKey);
      } catch (error) {
        console.warn(`interior: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (run === null || interior === null) return;

    this.interior = interior;
    this.cityKey = interior.cityKey;
    this.run = this.healOnEntry(run);
    this.stock = this.rollStock(run);

    this.drawWorld({
      tiles: interior.tiles,
      meshes: buildNodeMeshes(interior.tiles, FRLG_INTERIOR_TILESET),
      tilesetId: 'interior',
    });
    this.cameras.main.fadeIn(WORLD_TRANSITION_MS);

    this.buildPlayer(interior.entry);
    this.runKey = actionKeys(this, 'run', this.settings.keybinds)[0] ?? null;
    subscribeKeybinds(this, ({ action }) => this.handleAction(action));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownCards());
  }

  override update(time: number, delta: number): void {
    void time;
    const walker = this.walker;
    const sprite = this.playerSprite;
    if (walker === null || sprite === null || this.leaving) return;
    const running = this.settings.alwaysRun || (this.runKey?.isDown ?? false);
    walker.update(delta, running);
    sprite.setDepth(actorDepth(sprite.y));
  }

  /** Dev only. */
  debugServicesState(): ServicesDebugState {
    const run = this.run;
    return {
      sceneKey: regionSceneKey,
      interiorKey: this.interior?.interiorKey ?? this.interiorKey,
      cityKey: this.interior?.cityKey ?? this.cityKey,
      healed: this.healed,
      pcEditable: run !== null && pcMemberEditable(run, true),
      shopRows: run === null || this.stock.length === 0 ? 0 : buyRows(run, this.stock).length,
      stockKey: this.stockKey,
    };
  }

  /** The counter's heal: party and box to full HP/PP, committed to the save. */
  openCounter(): void {
    const run = this.run;
    if (run === null) return;
    this.commitRun(serviceHeal(run));
  }

  /** The box card, and the member detail window behind it. */
  openPc(): void {
    if (this.run === null) return;
    const host = this.panelHost();
    if (!this.pcMounted) {
      this.pcMounted = true;
      detailPanel.build(host);
    }
    openPcPanel(host);
  }

  /** The merchant's card, stocked from the city's own shelf. */
  openShop(): void {
    const run = this.run;
    if (run === null) return;
    openShopCard(this.shopHost(), {
      title: t('mart.title'),
      mode: 'buy',
      rows: buyRows(run, this.stock),
      scroll: 0,
      selected: 0,
      money: run.money,
      message: t('mart.greeting'),
      empty: t('mart.emptyStock'),
      open: true,
    });
    this.shopOpen = true;
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
   * The counter's heal on entry: the state the save holds from the first frame in the
   * room. HP and PP only — never a status cure, never a revival (`D5`).
   */
  private healOnEntry(run: RunState): RunState {
    const healed = serviceHeal(run);
    this.healed = true;
    storeRun(browserStorage(), healed);
    return healed;
  }

  /** The city's shelf: the band its tier buys at, rolled once per city (`D11`). */
  private rollStock(run: RunState): readonly ShopSlot[] {
    const node = nodeOf(planRegion(run.seed), this.cityKey);
    this.stockKey = shopStreamKey(run.seed, this.cityKey);
    return buildShop(shopBandForTier(node?.tier ?? 1), new Rng(hashSeed(this.stockKey)));
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
   * What a landed tile means: the door walks back out once the player has left it, and
   * reaching the counter's healing station re-heals the squad. The rest of the room is
   * a floor.
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
    if (this.atSlot(tile, 'heal')) this.openCounter();
  }

  /** True when `tile` is one of the room's slots of `role`, or stands beside one. */
  private atSlot(tile: Tile, role: InteriorSlotRole): boolean {
    const interior = this.interior;
    if (interior === null) return false;
    return interior.slots.some((slot) => slot.role === role && beside(slot.tile, tile));
  }

  /** True when `tile` stands at the merchant's counter: any `COUNTER` cell beside it. */
  private atCounter(tile: Tile): boolean {
    const interior = this.interior;
    if (interior === null) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 1) continue;
        if (tileAt(interior.tiles, { x: tile.x + dx, y: tile.y + dy }) === COUNTER) return true;
      }
    }
    return false;
  }

  /**
   * The one press the room answers: at the PC it opens the box, at the counter it opens
   * the merchant. The healing station needs no press — it heals on the landing.
   */
  private handleAction(action: KeybindAction): void {
    if (action !== 'interact' && action !== 'confirm') return;
    if (!this.scene.isActive() || this.leaving) return;
    const walker = this.walker;
    if (walker === null) return;
    const tile = walker.tile;
    if (this.atSlot(tile, 'pc')) {
      this.openPc();
      return;
    }
    if (this.atSlot(tile, 'counter') || this.atCounter(tile)) this.openShop();
  }

  private exitToCity(): void {
    const run = this.run;
    if (run === null || this.leaving) return;
    this.leaving = true;
    storeRun(browserStorage(), run);
    this.scene.start('City', { run });
  }

  /** The one writer the two cards trade through: the run and the save follow it. */
  private commitRun(run: RunState): void {
    this.run = run;
    storeRun(browserStorage(), run);
    this.refreshCards();
  }

  /** Repaints whichever card this scene has mounted; nothing before the first open. */
  private refreshCards(): void {
    const host = this.panelHost();
    refreshPcPanel(host);
    refreshDetail(host);
  }

  private closePanel(): void {
    closeShopCard();
    this.shopOpen = false;
  }

  /**
   * The panel host a route hands its cards, rebuilt here for a scene that is not a
   * route: the run, the one writer and the HUD's own state are real; the route-only
   * hooks (its minimap, its battles, its restart) have nothing to answer.
   */
  private panelHost(): RoutePanelHost {
    const existing = this.panelHostValue;
    if (existing !== null) return existing;
    const scene = this;
    const host: RoutePanelHost = {
      scene,
      run: () => scene.liveRun(),
      settings: () => scene.settings,
      hudLayout: () => scene.settings.hudLayout,
      setHudLayout: (layout: HudLayout) => {
        scene.settings = { ...scene.settings, hudLayout: layout };
      },
      hud: () => hudMetrics(scene.scale.width),
      hudCardOpen: (id) => scene.openCards.has(id),
      setHudCardOpen: (id, open) => {
        if (open) scene.openCards.add(id);
        else scene.openCards.delete(id);
        scene.refreshCards();
      },
      ui: () => scene.uiState,
      setUi: (state) => {
        scene.uiState = state;
      },
      commitRun: (run) => scene.commitRun(run),
      persistRun: () => storeRun(browserStorage(), scene.liveRun()),
      refreshHud: () => scene.refreshCards(),
      openPanel: () => undefined,
      closePanel: () => scene.closePanel(),
      panelOpen: () => scene.shopOpen,
      showNotice: () => undefined,
      startWildBattle: () => undefined,
      startTrainerBattle: () => undefined,
      route: () => {
        throw new Error('a Centre is not a route');
      },
      plan: () => null,
      rooms: () => {
        throw new Error('a Centre is not a route');
      },
      openSettings: () => undefined,
      restartRun: () => undefined,
      flyToNode: () => undefined,
    };
    this.panelHostValue = host;
    return host;
  }

  /** What the merchant's card trades against: the live run, the writer and its ✕. */
  private shopHost(): ShopCardHost {
    const existing = this.shopHostValue;
    if (existing !== null) return existing;
    const scene = this;
    const host: ShopCardHost = {
      scene,
      get run() {
        return scene.liveRun();
      },
      commitRun: (run) => scene.commitRun(run),
      closePanel: () => scene.closePanel(),
    };
    this.shopHostValue = host;
    return host;
  }

  private liveRun(): RunState {
    const run = this.run;
    if (run === null) throw new Error('the Centre has no run');
    return run;
  }

  /** Drops both cards and their `#hud` mounts; the scene is going away. */
  private teardownCards(): void {
    closeShopCard();
    this.shopOpen = false;
    if (!this.pcMounted) return;
    this.pcMounted = false;
    const host = this.panelHost();
    detailPanel.close?.(host);
    pcPanel.close?.(host);
  }

  /** Dev only: the browser pass reaches this scene by name, as it does the city's. */
  private exposeDebugScene(): void {
    if (!IS_DEVELOP) return;
    (globalThis as Record<string, unknown>).__pkmCentre = this;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      delete (globalThis as Record<string, unknown>).__pkmCentre;
    });
  }
}

export const regionSceneClass = ServicesScene;
