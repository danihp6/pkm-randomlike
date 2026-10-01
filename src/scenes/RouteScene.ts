import Phaser from 'phaser';
import { biomeForRoute } from '../data/biomes';
import { getSpecies } from '../data/dex';
import { getItem } from '../data/items';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../data/itemIcons';
import { keyLabel } from '../data/keybinds';
import { ROUTE_LOOT } from '../data/loot';
import { PORTRAIT_TEXTURE_KEY, portraitFrameFor } from '../data/portraits';
import { bandForRoute } from '../data/run';
import { TRAINER_ARCHETYPE_IDS, getTrainerArchetype } from '../data/trainers';
import { DEBUG_MENU_TOGGLE_KEY, IS_DEVELOP } from '../dev/env';
import { restoreFighter, type FighterInput } from '../engine/battle';
import {
  MAX_PARTY_SIZE,
  addItem,
  addPokemon,
  advanceRoute,
  battleSeed,
  canCapture,
  createRun,
  createRunPokemon,
  hasLivingParty,
  healParty,
  isFinalStage,
  isTrainerDefeated,
  resolveBattle,
  trainerRoster,
  type BagCounts,
  type BattleLaunch,
  type BattleReturn,
  type BattleReward,
  type BattleTrigger,
  type RunState,
} from '../engine/run';
import {
  COMMON_TEXTURE_KEY,
  TILESET_IDS,
  TILESETS,
  resolveTileset,
  type TilesetId,
  tilesetTextureKey,
} from '../data/tilesets';
import type { Tile } from '../engine/grid';
import { EXIT, TALL_GRASS, resolveMove, tileAt, type TileMap } from '../engine/map';
import { hashSeed, Rng } from '../engine/rng';
import { storeRun, type Settings } from '../engine/save';
import {
  RouteEncounters,
  seesPlayer,
  sketchRoute,
  tileKey,
  trainerAt,
  type Facing,
  type RouteMap,
  type RouteTrainer,
} from '../engine/routes';
import { COMMON_TILE_SIZE, TILE_SIZE } from '../engine/tileset';
import { resolveTileFrame } from '../engine/tileFrames';
import { Vision } from '../engine/vision';
import { addFrlgWindow } from '../ui/frlg';
import { levelUpBeats, type LevelUpBeat } from '../ui/beats';
import { RELEASE_HOLD_MS, RELEASE_INPUT_DELAY_MS, releaseBeats, type ReleaseBeat } from '../ui/permadeath';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import { actionKeys, subscribeKeybinds } from '../input/input';
import { loadSettings } from '../settings';
import { browserStorage } from '../storage';
import {
  ARROW_TEXTURE_KEY,
  GRASS_TEXTURE_KEY,
  PLAYER_TEXTURE_KEY,
  TRAINER_TEXTURE_KEY,
} from './BootScene';

const VISION_RADIUS = 6;
const HIDDEN_ALPHA = 0.3;
const EXPLORED_ALPHA = 0.7;
/** Item stacks the route HUD's bag row shows before it drops the rest. */
const BAG_ICON_SLOTS = 6;

/** The four directions, in the order the update loop tests them. */
type MoveKey = 'up' | 'down' | 'left' | 'right';

// Until the starter pick lands, the scene seeds a run with a fixed demo starter
// and bag and walks its routes off one dev seed.
const DEV_SEED = 'dev-seed';

const DEMO_STARTER: FighterInput = { id: 'starter', speciesId: 'charmander', level: 5, moves: ['ember', 'scratch', 'growl'] };
const DEMO_RESERVE: FighterInput = { id: 'reserve', speciesId: 'squirtle', level: 4, moves: ['watergun', 'tackle', 'tailwhip'] };

const DEMO_BAG: readonly BagCounts[] = [
  { itemId: 'potion', count: 2 },
  { itemId: 'pokeball', count: 5 },
  { itemId: 'paralyzeheal', count: 1 },
];

const FACING_ANGLE: Readonly<Record<Facing, number>> = { N: 0, E: 90, S: 180, W: 270 };

type Foggable = Readonly<{ tile: Tile; objects: readonly Phaser.GameObjects.Image[] }>;

export class RouteScene extends Phaser.Scene {
  private route!: RouteMap;
  private map!: TileMap;
  private vision!: Vision;
  private encounters!: RouteEncounters;
  private tilesetId: TilesetId = 'wood';
  private player: Tile = { x: 1, y: 1 };
  private playerSprite!: Phaser.GameObjects.Sprite;
  private tileSprites: Phaser.GameObjects.Image[][] = [];
  private foggables: Foggable[] = [];
  private run!: RunState;
  private settings!: Settings;
  private pickedItems = new Set<string>();
  private gameOver = false;
  private battleCounter = 0;
  private pendingBattle: BattleLaunch | null = null;
  /** What the party/PC screen was opened for, while it is open. */
  private pendingParty: 'field' | 'rest' | null = null;
  /** Set when the rest stop closes: advance the route on the next update. */
  private advanceAfterParty = false;
  /** The four movement keys behind the current bindings, watched every frame. */
  private moveKeys!: Record<MoveKey, Phaser.Input.Keyboard.Key | null>;
  private hint!: Phaser.GameObjects.BitmapText;
  private hintBackdrop!: Phaser.GameObjects.Rectangle;
  private hudRoot!: Phaser.GameObjects.Container;
  private hudTitle!: Phaser.GameObjects.BitmapText;
  private hudBagIcons: { icon: Phaser.GameObjects.Image; count: Phaser.GameObjects.BitmapText }[] = [];
  private hudRows: { portrait: Phaser.GameObjects.Image; text: Phaser.GameObjects.BitmapText }[] = [];
  /** The "was released" overlay while a beat sequence is playing. */
  private releaseRoot: Phaser.GameObjects.Container | null = null;
  private releaseQueue: ReleaseBeat[] = [];
  private releaseOnDone: (() => void) | null = null;
  private releaseWait: Phaser.Time.TimerEvent | null = null;
  private releaseArmed = false;
  private releasePortrait!: Phaser.GameObjects.Image;
  private releaseText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Route');
  }

  init(data?: { run?: RunState }): void {
    if (data?.run) this.run = data.run;
  }

  /** Writes the run to the save slot (Phase 7), so a reload resumes it. */
  private persistRun(): void {
    storeRun(browserStorage(), this.run);
  }

  create(): void {
    if (!this.run) {
      this.run = createRun({ seed: DEV_SEED, starter: createRunPokemon(DEMO_STARTER), bag: DEMO_BAG });
      this.run = addPokemon(this.run, createRunPokemon(DEMO_RESERVE));
    }
    this.persistRun();
    this.tileSprites = [];
    this.foggables = [];
    this.hudRows = [];
    this.pickedItems = new Set<string>();
    this.gameOver = false;
    this.pendingBattle = null;
    this.pendingParty = null;
    this.advanceAfterParty = false;
    this.releaseRoot = null;
    this.releaseQueue = [];
    this.releaseOnDone = null;
    this.releaseWait = null;
    this.releaseArmed = false;
    this.settings = loadSettings();

    const routeIndex = this.run.routeIndex;
    const biome = biomeForRoute(routeIndex);
    const band = bandForRoute(routeIndex);
    this.route = sketchRoute({
      seed: this.run.seed,
      routeIndex,
      biomeId: biome.id,
      trainerArchetypeIds: TRAINER_ARCHETYPE_IDS,
      trainerCount: band.trainerSize,
      itemCount: ROUTE_LOOT[band.id].count,
      loot: ROUTE_LOOT[band.id].pool,
      grassPatches: biome.terrain.grassPatches,
      waterBodies: biome.terrain.waterBodies,
      ledges: biome.terrain.ledges,
    });
    this.map = this.route.tiles;
    this.tilesetId = resolveTileset(this.settings.tileset, biome.tilesetId);
    this.vision = new Vision(VISION_RADIUS);
    this.encounters = new RouteEncounters(
      biome.encounters[band.id],
      band.minLevel,
      band.maxLevel,
      new Rng(hashSeed(`${this.run.seed}:encounters:${routeIndex}`)),
    );

    this.drawTiles();
    this.drawEntities();
    this.player = { ...this.route.start };
    this.playerSprite = this.add.sprite(0, 0, PLAYER_TEXTURE_KEY, 0).setScale(0.75).setDepth(10);
    this.movePlayerTo(this.player.x, this.player.y, true);

    const width = this.map[0].length * TILE_SIZE;
    const height = this.map.length * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.setZoom(2);
    this.cameras.main.startFollow(this.playerSprite, true, 0.2, 0.2);

    this.refreshMoveKeys();
    this.hintBackdrop = this.add
      .rectangle(8, 8, 780, 56, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(99);
    this.hint = addFrlgText(this, 16, 14, '', {
      size: 16,
      align: 'left',
    })
      .setScrollFactor(0)
      .setDepth(100);
    this.hint.setMaxWidth(760);

    // The debug tileset swap stays a fixed key: it is not a player action.
    this.input.keyboard!.on('keydown-R', () => {
      if (this.scene.isActive()) this.cycleTileset();
    });
    subscribeKeybinds(
      this,
      ({ action }) => {
        if (!this.scene.isActive()) return;
        switch (action) {
          case 'confirm':
            if (this.releaseRoot && this.releaseArmed) this.advanceRelease();
            return;
          case 'party':
            this.openParty('field');
            return;
          case 'settings':
            this.openSettings();
            return;
        }
      },
      // The route holds the run, so it keeps its own settings snapshot rather
      // than re-reading the whole save on every key; `applySettings` refreshes it.
      () => this.settings.keybinds,
    );
    if (IS_DEVELOP) {
      this.input.keyboard!.on('keydown-B', () => {
        if (this.scene.isActive()) this.startBattle({ kind: 'wild', speciesId: 'scatterbug', level: 5, key: 'dev' });
      });
    }
    this.buildHud();
    this.setupHudCamera();
    this.hint.setDepth(200);
    this.setHint(this.defaultHint());
    this.refreshHud();
  }

  /** Resolves the movement keys from the shared map; re-run when it changes. */
  private refreshMoveKeys(): void {
    const bind = (action: MoveKey): Phaser.Input.Keyboard.Key | null =>
      actionKeys(this, action, this.settings.keybinds)[0] ?? null;
    this.moveKeys = { up: bind('up'), down: bind('down'), left: bind('left'), right: bind('right') };
  }

  /** The resting line, spelled with whatever keys the player has bound. */
  private defaultHint(): string {
    const { up, down, left, right, party, settings } = this.settings.keybinds;
    return `Walk the route.  ${keyLabel(up)}${keyLabel(down)}${keyLabel(left)}${keyLabel(right)} move   ·   ${keyLabel(party)} party   ·   ${keyLabel(settings)} settings`;
  }

  /** The persistent overlay: route header, party (with portraits) and the bag. */
  private buildHud(): void {
    const x = this.scale.width - 266;
    const y = 8;
    const panelW = 258;
    const rowH = 34;
    const panelH = 44 + MAX_PARTY_SIZE * rowH + 30;

    const panel = addFrlgWindow(this, x, y, panelW, panelH);
    this.hudTitle = addFrlgText(this, x + 14, y + 12, '', { size: 16, tint: FRLG_INK });

    const children: Phaser.GameObjects.GameObject[] = [panel, this.hudTitle];
    this.hudRows = [];
    for (let i = 0; i < MAX_PARTY_SIZE; i++) {
      const rowY = y + 40 + i * rowH;
      const portrait = this.add
        .image(x + 22, rowY + 15, PORTRAIT_TEXTURE_KEY, 0)
        .setScale(0.6)
        .setVisible(false);
      const text = addFrlgText(this, x + 46, rowY + 6, '', { size: 16, tint: 0x2a2a44 });
      this.hudRows.push({ portrait, text });
      children.push(portrait, text);
    }

    this.hudBagIcons = [];
    for (let i = 0; i < BAG_ICON_SLOTS; i++) {
      const icon = this.add
        .image(x + 24 + i * 38, y + panelH - 17, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(0.55)
        .setVisible(false);
      const count = addFrlgText(this, x + 33 + i * 38, y + panelH - 24, '', {
        size: 16,
        tint: FRLG_INK,
      });
      this.hudBagIcons.push({ icon, count });
      children.push(icon, count);
    }

    this.hudRoot = this.add.container(0, 0, children).setDepth(150);
  }

  private refreshHud(): void {
    if (!this.hudRoot) return;
    this.hudTitle.setText(`Route ${this.run.routeIndex} · ${biomeForRoute(this.run.routeIndex).name}`);
    const bag = this.run.bag.slice(0, BAG_ICON_SLOTS);
    this.hudBagIcons.forEach((slot, i) => {
      const stack = bag[i];
      const frame = stack ? itemIconFrame(stack.itemId) : null;
      const visible = stack !== undefined && frame !== null;
      slot.icon.setVisible(visible);
      if (frame !== null) slot.icon.setFrame(frame);
      slot.count.setText(visible ? `x${stack!.count}` : '');
    });
    this.hudRows.forEach((row, i) => {
      const member = this.run.party[i];
      if (!member) {
        row.portrait.setVisible(false);
        row.text.setText('');
        return;
      }
      const frame = portraitFrameFor(member.fighter.speciesId);
      row.portrait.setVisible(frame !== null);
      if (frame !== null) row.portrait.setFrame(frame);
      const maxHp = restoreFighter(member.fighter).maxHp;
      const name = getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId;
      row.text.setText(`${name} Lv${member.fighter.level}  ${member.fighter.hp}/${maxHp}`);
    });
  }

  /** Two cameras: one follows the world, one pins the HUD (hint + overlay) to the screen. */
  private setupHudCamera(): void {
    const hud = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    hud.setScroll(0, 0);
    const keep = new Set<Phaser.GameObjects.GameObject>([this.hint, this.hintBackdrop, this.hudRoot]);
    hud.ignore(this.children.list.filter((child) => !keep.has(child)));
    this.cameras.main.ignore([this.hint, this.hintBackdrop, this.hudRoot]);
  }

  /**
   * A tile's display scale so every atlas lands on the same `TILE_SIZE` world
   * cell: the biome sheet's own cell (`D18`) or the 24px common sheet.
   */
  private tileScale(source: 'atlas' | 'common'): number {
    if (source === 'common') return TILE_SIZE / COMMON_TILE_SIZE;
    return TILE_SIZE / TILESETS[this.tilesetId].config.atlas.tileSize;
  }

  private drawTiles(): void {
    const textures = TILESETS[this.tilesetId];
    for (let y = 0; y < this.map.length; y++) {
      const row: Phaser.GameObjects.Image[] = [];
      for (let x = 0; x < this.map[y].length; x++) {
        const frame = resolveTileFrame(this.map, x, y, textures.config);
        const source = frame?.source ?? 'atlas';
        const key = source === 'common' ? COMMON_TEXTURE_KEY : tilesetTextureKey(this.tilesetId);
        row.push(
          this.add
            .image(x * TILE_SIZE, y * TILE_SIZE, key, frame?.frame ?? 0)
            .setOrigin(0, 0)
            .setScale(this.tileScale(source)),
        );
      }
      this.tileSprites.push(row);
    }
  }

  private drawEntities(): void {
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[y].length; x++) {
        if (this.map[y][x] === TALL_GRASS) {
          const object = this.add.image(this.centerX(x), this.centerY(y), GRASS_TEXTURE_KEY).setDepth(1);
          this.foggables.push({ tile: { x, y }, objects: [object] });
        }
      }
    }
    for (const item of this.route.items) {
      const frame = itemIconFrame(item.itemId) ?? 0;
      const object = this.add
        .image(this.centerX(item.position.x), this.centerY(item.position.y), ITEM_ICON_TEXTURE_KEY, frame)
        .setScale(0.7)
        .setDepth(5);
      this.foggables.push({ tile: item.position, objects: [object] });
    }
    for (const trainer of this.route.trainers) {
      const colour = getTrainerArchetype(trainer.archetypeId)?.colour ?? 0xffffff;
      const body = this.add
        .image(this.centerX(trainer.position.x), this.centerY(trainer.position.y), TRAINER_TEXTURE_KEY)
        .setTint(colour)
        .setDepth(8);
      const arrow = this.add
        .image(this.centerX(trainer.position.x), this.centerY(trainer.position.y), ARROW_TEXTURE_KEY)
        .setTint(colour)
        .setAngle(FACING_ANGLE[trainer.facing])
        .setDepth(9);
      this.foggables.push({ tile: trainer.position, objects: [body, arrow] });
    }
  }

  private centerX(tileX: number): number {
    return tileX * TILE_SIZE + TILE_SIZE / 2;
  }

  private centerY(tileY: number): number {
    return tileY * TILE_SIZE + TILE_SIZE / 2;
  }

  private cycleTileset(): void {
    const next = TILESET_IDS[(TILESET_IDS.indexOf(this.tilesetId) + 1) % TILESET_IDS.length];
    this.applyTileset(next);
  }

  private applyTileset(id: TilesetId): void {
    this.tilesetId = id;
    const textures = TILESETS[id];
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[y].length; x++) {
        const frame = resolveTileFrame(this.map, x, y, textures.config);
        const source = frame?.source ?? 'atlas';
        const key = source === 'common' ? COMMON_TEXTURE_KEY : tilesetTextureKey(id);
        this.tileSprites[y][x].setTexture(key, frame?.frame ?? 0).setScale(this.tileScale(source));
      }
    }
    this.setHint(`tileset: ${textures.name}`);
  }

  private movePlayerTo(x: number, y: number, first: boolean): void {
    this.player = { x, y };
    this.playerSprite.setPosition(this.centerX(x), this.centerY(y));
    this.vision.recompute(this.map, this.player);
    this.refreshFog();
    if (!first) this.onTileEntered();
  }

  private refreshFog(): void {
    const alphaFor = (tile: Tile): number => {
      const key = tileKey(tile);
      if (this.vision.visible.has(key)) return 1;
      return this.vision.explored.has(key) ? EXPLORED_ALPHA : HIDDEN_ALPHA;
    };
    const entityAlphaFor = (tile: Tile): number => {
      const key = tileKey(tile);
      if (this.vision.visible.has(key)) return 1;
      return this.vision.explored.has(key) ? EXPLORED_ALPHA : 0;
    };
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[y].length; x++) {
        this.tileSprites[y][x].setAlpha(alphaFor({ x, y }));
      }
    }
    for (const foggable of this.foggables) {
      const alpha = entityAlphaFor(foggable.tile);
      for (const object of foggable.objects) object.setAlpha(alpha);
    }
  }

  private onTileEntered(): void {
    const value = tileAt(this.map, this.player);
    if (value === EXIT) {
      this.leaveRoute();
      return;
    }
    if (value === TALL_GRASS) {
      const encounter = this.encounters.step();
      if (encounter) {
        this.startBattle({
          kind: 'wild',
          speciesId: encounter.speciesId,
          level: encounter.level,
          key: `grass:${this.player.x},${this.player.y}`,
          tile: { x: this.player.x, y: this.player.y },
        });
        return;
      }
    }
    if (this.collectItemAt(this.player)) return;

    const spotter = this.route.trainers.find(
      (trainer) => !isTrainerDefeated(this.run, trainer.id) && seesPlayer(this.route, trainer, this.player),
    );
    if (spotter) {
      this.startBattle(this.trainerTrigger(spotter));
      return;
    }
    this.setHint(this.defaultHint());
  }

  /** The exit beat: rest the party, then let the player manage it before moving on. */
  private leaveRoute(): void {
    if (this.gameOver || this.pendingBattle || this.pendingParty || this.releaseRoot) return;
    if (isFinalStage(this.run.routeIndex, this.run.mode)) {
      this.gameOver = true;
      this.scene.start('RunOver', { run: this.run, won: true });
      return;
    }
    this.run = healParty(this.run);
    this.persistRun();
    this.openParty('rest');
  }

  /** Opens the party/PC screen paused-on-top, like a battle (`P`, or the rest stop). */
  private openParty(mode: 'field' | 'rest'): void {
    if (this.gameOver || this.pendingBattle || this.pendingParty || this.releaseRoot) return;
    this.pendingParty = mode;
    this.scene.pause();
    this.scene.launch('Party', { run: this.run, mode });
  }

  /** Opens the settings screen paused-on-top, like the party screen (`O`). */
  private openSettings(): void {
    if (this.gameOver || this.pendingBattle || this.pendingParty || this.releaseRoot) return;
    this.scene.pause();
    this.scene.launch('Settings', { from: 'Route' });
  }

  /**
   * Called by `SettingsScene` before it closes: re-reads the preferences and
   * re-renders the route with the tileset they now ask for (D10 keeps the
   * biome's own tileset until the player forces another one).
   */
  applySettings(): void {
    this.settings = loadSettings();
    const wanted = resolveTileset(this.settings.tileset, biomeForRoute(this.run.routeIndex).tilesetId);
    if (wanted !== this.tilesetId) this.applyTileset(wanted);
    // A rebind happened behind this screen; re-resolve the movement keys and the
    // resting line so the new keys are live the moment the route resumes.
    this.refreshMoveKeys();
    this.setHint(this.defaultHint());
  }

  /** Called by `PartyScene` before it stops: adopts the managed run. */
  applyPartyResult(run: RunState): void {
    if (!this.pendingParty) return;
    const mode = this.pendingParty;
    this.pendingParty = null;
    this.run = run;
    this.persistRun();
    if (mode === 'rest') {
      // The route advances on the next update, once the screen has closed.
      this.advanceAfterParty = true;
      return;
    }
    this.refreshHud();
  }

  private trainerTrigger(trainer: RouteTrainer): BattleTrigger {
    const archetype = getTrainerArchetype(trainer.archetypeId);
    const band = bandForRoute(this.run.routeIndex);
    const seed = battleSeed(this.run.seed, this.run.routeIndex, `trainer:${trainer.id}:roster`);
    const roster =
      archetype !== undefined
        ? trainerRoster(archetype, band, new Rng(seed), trainer.id)
        : [{ id: `${trainer.id}:0`, speciesId: 'sentret', level: band.minLevel }];
    return {
      kind: 'trainer',
      trainerId: trainer.id,
      trainerName: archetype?.name ?? 'Trainer',
      archetypeId: trainer.archetypeId,
      roster,
    };
  }

  /** Pauses the route and rolls the battle on top of it (Phase 5 transition). */
  private startBattle(trigger: BattleTrigger): void {
    if (this.gameOver || this.pendingBattle || this.releaseRoot) return;
    this.battleCounter += 1;
    const key = trigger.kind === 'wild' ? `${trigger.key}:${this.battleCounter}` : `trainer:${trigger.trainerId}`;
    const launch: BattleLaunch = {
      trigger,
      player: this.run.party.map((member) => member.fighter),
      experience: this.run.party.map((member) => ({ id: member.fighter.id, xp: member.xp })),
      bag: this.run.bag,
      seed: battleSeed(this.run.seed, this.run.routeIndex, key),
      runSeed: this.run.seed,
      routeIndex: this.run.routeIndex,
      canCapture: canCapture(this.run),
    };
    this.pendingBattle = launch;
    this.scene.pause();
    this.scene.launch('Battle', launch);
  }

  /**
   * Dev only: opens a battle against a chosen wild Pokémon from the debug menu.
   * Ignored while the route is paused behind another battle or the run is over.
   */
  startDebugWildBattle(speciesId: string, level: number): void {
    if (!IS_DEVELOP || this.gameOver || this.pendingBattle || this.releaseRoot || !this.scene.isActive()) return;
    this.startBattle({ kind: 'wild', speciesId, level, key: `debug:${speciesId}` });
  }

  /** Called by `BattleScene` before it stops: folds the result back into the run. */
  applyBattleResult(result: BattleReturn): void {
    const pending = this.pendingBattle;
    this.pendingBattle = null;
    if (!pending) return;

    const reward = this.rewardFor(pending.trigger);
    const before = this.run.party;
    const { run, released, events } = resolveBattle(this.run, result, reward);
    this.run = run;
    this.persistRun();
    this.refreshHud();

    const over = !hasLivingParty(this.run);
    this.gameOver = over;
    this.playReleaseBeats(releaseBeats(released), () => {
      if (over) {
        this.scene.start('RunOver', { run: this.run, won: false });
        return;
      }
      const notes: string[] = [result.message];
      if (events.some((event) => event.kind === 'level')) notes.push('Level up!');
      if (events.some((event) => event.kind === 'evolve')) notes.push('It evolved!');
      this.setHint(notes.join('  '));
      this.playLevelUp(levelUpBeats(before, this.run.party));
    });
  }

  /**
   * Permadeath feedback (Phase 5): one beat per fallen Pokémon — a scrim, its
   * portrait and "<name> was released." — then `onDone`. With nothing to show it
   * calls back straight away, so the caller keeps one code path.
   */
  private playReleaseBeats(beats: readonly ReleaseBeat[], onDone: () => void): void {
    if (beats.length === 0) {
      onDone();
      return;
    }
    this.releaseQueue = [...beats];
    this.releaseOnDone = onDone;
    this.releaseArmed = false;
    this.buildReleaseOverlay();
    this.time.delayedCall(RELEASE_INPUT_DELAY_MS, () => {
      this.releaseArmed = true;
    });
    this.showReleaseBeat();
  }

  private buildReleaseOverlay(): void {
    const { width, height } = this.scale;
    const panelW = 460;
    const panelH = 264;
    const x = (width - panelW) / 2;
    const y = (height - panelH) / 2 - 24;
    const scrim = this.add.rectangle(0, 0, width, height, 0x05070c, 0.72).setOrigin(0, 0);
    const panel = addFrlgWindow(this, x, y, panelW, panelH, 'textbox');
    this.releasePortrait = this.add.image(width / 2, y + 96, PORTRAIT_TEXTURE_KEY, 0).setScale(3);
    this.releaseText = addFrlgText(this, width / 2, y + 168, '', { align: 'center', origin: 0.5 });
    this.releaseText.setMaxWidth(panelW - 48);
    const hint = addFrlgText(this, width / 2, y + panelH + 28, 'Z — continue', {
      size: 16,
      tint: 0x94a3b8,
      origin: 0.5,
    });
    // The HUD camera was told to ignore everything that existed at setup, not
    // this, so the overlay lives there; the world camera must drop it.
    this.releaseRoot = this.add
      .container(0, 0, [scrim, panel, this.releasePortrait, this.releaseText, hint])
      .setDepth(300);
    this.cameras.main.ignore(this.releaseRoot);
  }

  private showReleaseBeat(): void {
    const beat = this.releaseQueue[0];
    if (!beat || !this.releaseRoot) {
      this.finishReleaseBeats();
      return;
    }
    const frame = portraitFrameFor(beat.speciesId);
    this.releasePortrait.setVisible(frame !== null);
    if (frame !== null) this.releasePortrait.setFrame(frame);
    this.releaseText.setText(`Lv${beat.level} ${beat.name}\nwas released.`);
    this.releaseWait?.remove(false);
    this.releaseWait = this.time.delayedCall(RELEASE_HOLD_MS, () => this.advanceRelease());
  }

  private advanceRelease(): void {
    if (this.releaseQueue.length === 0) return;
    this.releaseWait?.remove(false);
    this.releaseWait = null;
    this.releaseQueue.shift();
    this.showReleaseBeat();
  }

  private finishReleaseBeats(): void {
    this.releaseWait?.remove(false);
    this.releaseWait = null;
    this.releaseQueue = [];
    this.releaseRoot?.destroy();
    this.releaseRoot = null;
    const done = this.releaseOnDone;
    this.releaseOnDone = null;
    done?.();
  }

  /**
   * The level-up beat: each row that levelled counts its level up from the old
   * value with a gold flash on the portrait, then the HUD resyncs (Phase 5).
   */
  private playLevelUp(beats: readonly LevelUpBeat[]): void {
    for (const beat of beats) {
      const index = this.run.party.findIndex((member) => member.fighter.id === beat.id);
      const row = this.hudRows[index];
      if (index < 0 || !row) continue;
      const member = this.run.party[index];
      const name = getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId;
      const maxHp = restoreFighter(member.fighter).maxHp;
      const counter = { level: beat.fromLevel };
      const paint = () => {
        row.text.setText(`${name} Lv${Math.round(counter.level)}  ${member.fighter.hp}/${maxHp}`);
      };
      paint();
      row.portrait.setTint(0xf2c14e);
      this.tweens.add({
        targets: counter,
        level: beat.toLevel,
        duration: 520,
        ease: 'Quad.easeOut',
        onUpdate: paint,
        onComplete: () => {
          row.portrait.clearTint();
          this.refreshHud();
        },
      });
    }
  }

  private rewardFor(trigger: BattleTrigger): BattleReward {
    if (trigger.kind === 'wild') return { enemyLevels: [trigger.level], isTrainer: false };
    return {
      enemyLevels: trigger.roster.map((entry) => entry.level),
      isTrainer: true,
      trainerId: trigger.trainerId,
    };
  }

  private collectItemAt(tile: Tile): boolean {
    const item = this.route.items.find((candidate) => !this.pickedItems.has(candidate.id) && candidate.position.x === tile.x && candidate.position.y === tile.y);
    if (!item) return false;
    this.pickedItems.add(item.id);
    this.run = addItem(this.run, item.itemId);
    this.persistRun();
    const name = getItem(item.itemId)?.name ?? item.itemId;
    this.setHint(`You found ${name}!`);
    return true;
  }

  private setHint(text: string): void {
    const dev = IS_DEVELOP ? `  ·  B: random battle  ·  ${DEBUG_MENU_TOGGLE_KEY}: debug menu` : '';
    this.hint.setText(
      `${text}\nArrows: move  ·  P: party/PC  ·  R: swap tileset${dev}  ·  trainers: ${this.route.trainers.length}`,
    );
  }

  override update(): void {
    if (this.advanceAfterParty) {
      this.advanceAfterParty = false;
      this.run = advanceRoute(this.run);
      this.persistRun();
      // Restart with the advanced run: Phaser reuses a scene's previous start
      // data on `restart()`, so without this the route would boot the old run.
      this.scene.restart({ run: this.run });
      return;
    }
    if (this.gameOver || this.pendingBattle || this.pendingParty || this.releaseRoot) return;
    const step: Tile = { x: 0, y: 0 };
    const { up, down, left, right } = this.moveKeys;
    if (left && Phaser.Input.Keyboard.JustDown(left)) step.x = -1;
    else if (right && Phaser.Input.Keyboard.JustDown(right)) step.x = 1;
    else if (up && Phaser.Input.Keyboard.JustDown(up)) step.y = -1;
    else if (down && Phaser.Input.Keyboard.JustDown(down)) step.y = 1;
    if (step.x === 0 && step.y === 0) return;

    const result = resolveMove(this.map, this.player, step);
    if (!result) return;
    const blocker = trainerAt(this.route, result.to);
    if (blocker && !isTrainerDefeated(this.run, blocker.id)) return;
    this.playerSprite.setFlipX(step.x < 0);
    this.movePlayerTo(result.to.x, result.to.y, false);
  }
}
