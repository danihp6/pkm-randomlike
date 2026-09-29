import Phaser from 'phaser';
import { biomeForRoute } from '../data/biomes';
import { getSpecies } from '../data/dex';
import { bandForRoute } from '../data/run';
import { TRAINER_ARCHETYPE_IDS, getTrainerArchetype } from '../data/trainers';
import { IS_DEVELOP } from '../dev/env';
import type { FighterInput } from '../engine/battle';
import {
  addPokemon,
  battleSeed,
  canCapture,
  createRun,
  createRunPokemon,
  hasLivingParty,
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
  type TilesetId,
  tilesetTextureKey,
} from '../data/tilesets';
import type { Tile } from '../engine/grid';
import { EXIT, TALL_GRASS, resolveMove, tileAt, type TileMap } from '../engine/map';
import { hashSeed, Rng } from '../engine/rng';
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
import { TILE_SIZE } from '../engine/tileset';
import { resolveTileFrame } from '../engine/tileFrames';
import { Vision } from '../engine/vision';
import {
  ARROW_TEXTURE_KEY,
  GRASS_TEXTURE_KEY,
  ITEM_TEXTURE_KEY,
  PLAYER_TEXTURE_KEY,
  TRAINER_TEXTURE_KEY,
} from './BootScene';

const VISION_RADIUS = 6;
const HIDDEN_ALPHA = 0.3;
const EXPLORED_ALPHA = 0.7;

// Until the starter pick lands, the scene generates route 1 of a fixed dev seed
// off a real run seeded with a fixed demo starter and bag.
const DEV_SEED = 'dev-seed';
const DEV_ROUTE_INDEX = 1;

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
  private pickedItems = new Set<string>();
  private gameOver = false;
  private battleCounter = 0;
  private pendingBattle: BattleLaunch | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('Route');
  }

  create(): void {
    const biome = biomeForRoute(DEV_ROUTE_INDEX);
    const band = bandForRoute(DEV_ROUTE_INDEX);
    this.route = sketchRoute({
      seed: DEV_SEED,
      routeIndex: DEV_ROUTE_INDEX,
      biomeId: biome.id,
      trainerArchetypeIds: TRAINER_ARCHETYPE_IDS,
      trainerCount: band.trainerSize,
      itemCount: 2,
      grassPatches: biome.terrain.grassPatches,
      waterBodies: biome.terrain.waterBodies,
      ledges: biome.terrain.ledges,
    });
    this.map = this.route.tiles;
    this.tilesetId = biome.tilesetId;
    this.vision = new Vision(VISION_RADIUS);
    this.encounters = new RouteEncounters(
      biome.encounters[band.id],
      band.minLevel,
      band.maxLevel,
      new Rng(hashSeed(`${DEV_SEED}:encounters:${DEV_ROUTE_INDEX}`)),
    );
    this.run = createRun({ seed: DEV_SEED, starter: createRunPokemon(DEMO_STARTER), bag: DEMO_BAG });
    this.run = addPokemon(this.run, createRunPokemon(DEMO_RESERVE));

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

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.hint = this.add
      .text(8, 8, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f8fafc',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.input.keyboard!.on('keydown-R', () => {
      if (this.scene.isActive()) this.cycleTileset();
    });
    if (IS_DEVELOP) {
      this.input.keyboard!.on('keydown-B', () => {
        if (this.scene.isActive()) this.startBattle({ kind: 'wild', speciesId: 'scatterbug', level: 5, key: 'dev' });
      });
    }
    this.setupHudCamera();
    this.setHint(
      `${biome.name} · route ${DEV_ROUTE_INDEX} · band ${band.name} (Lv ${band.minLevel}-${band.maxLevel})`,
    );
  }

  /** Two cameras: one follows the world, one pins the HUD to the screen. */
  private setupHudCamera(): void {
    const hud = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    hud.setScroll(0, 0);
    hud.ignore(this.children.list.filter((child) => child !== this.hint));
    this.cameras.main.ignore(this.hint);
  }

  private drawTiles(): void {
    const textures = TILESETS[this.tilesetId];
    for (let y = 0; y < this.map.length; y++) {
      const row: Phaser.GameObjects.Image[] = [];
      for (let x = 0; x < this.map[y].length; x++) {
        const frame = resolveTileFrame(this.map, x, y, textures.config);
        const key = frame?.source === 'common' ? COMMON_TEXTURE_KEY : tilesetTextureKey(this.tilesetId);
        row.push(this.add.image(x * TILE_SIZE, y * TILE_SIZE, key, frame?.frame ?? 0).setOrigin(0, 0));
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
      const object = this.add.image(this.centerX(item.position.x), this.centerY(item.position.y), ITEM_TEXTURE_KEY).setDepth(5);
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
        const key = frame?.source === 'common' ? COMMON_TEXTURE_KEY : tilesetTextureKey(id);
        this.tileSprites[y][x].setTexture(key, frame?.frame ?? 0);
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
      this.setHint('Route cleared. The next route is Phase 6.');
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
    this.setHint('Walk the route. Arrow keys to move.');
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
      roster,
    };
  }

  /** Pauses the route and rolls the battle on top of it (Phase 5 transition). */
  private startBattle(trigger: BattleTrigger): void {
    if (this.gameOver || this.pendingBattle) return;
    this.battleCounter += 1;
    const key = trigger.kind === 'wild' ? `${trigger.key}:${this.battleCounter}` : `trainer:${trigger.trainerId}`;
    const launch: BattleLaunch = {
      trigger,
      player: this.run.party.map((member) => member.fighter),
      experience: this.run.party.map((member) => ({ id: member.fighter.id, xp: member.xp })),
      bag: this.run.bag,
      seed: battleSeed(this.run.seed, this.run.routeIndex, key),
      canCapture: canCapture(this.run),
    };
    this.pendingBattle = launch;
    this.scene.pause();
    this.scene.launch('Battle', launch);
  }

  /** Called by `BattleScene` before it stops: folds the result back into the run. */
  applyBattleResult(result: BattleReturn): void {
    const pending = this.pendingBattle;
    this.pendingBattle = null;
    if (!pending) return;

    const reward = this.rewardFor(pending.trigger);
    const { run, released, events } = resolveBattle(this.run, result, reward);
    this.run = run;

    if (!hasLivingParty(this.run)) {
      this.gameOver = true;
      this.setHint('Your last Pokémon fainted. The run is over. Reload to start again.');
      return;
    }

    const notes: string[] = [result.message];
    for (const fallen of released) {
      notes.push(`${getSpecies(fallen.fighter.speciesId)?.name ?? fallen.fighter.speciesId} was released.`);
    }
    if (events.some((event) => event.kind === 'level')) notes.push('Level up!');
    if (events.some((event) => event.kind === 'evolve')) notes.push('It evolved!');
    this.setHint(notes.join('  '));
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
    this.setHint(`Found ${item.itemId}.`);
    return true;
  }

  private setHint(text: string): void {
    const dev = IS_DEVELOP ? '  |  B: battle (dev)' : '';
    this.hint.setText(
      `${text}\nArrows: move  |  R: swap tileset${dev}  |  trainers: ${this.route.trainers.length}`,
    );
  }

  override update(): void {
    if (this.gameOver || this.pendingBattle) return;
    const step: Tile = { x: 0, y: 0 };
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) step.x = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) step.x = 1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) step.y = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) step.y = 1;
    if (step.x === 0 && step.y === 0) return;

    const result = resolveMove(this.map, this.player, step);
    if (!result) return;
    const blocker = trainerAt(this.route, result.to);
    if (blocker && !isTrainerDefeated(this.run, blocker.id)) return;
    this.playerSprite.setFlipX(step.x < 0);
    this.movePlayerTo(result.to.x, result.to.y, false);
  }
}
