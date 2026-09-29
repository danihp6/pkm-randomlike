import Phaser from 'phaser';
import { TILE_SIZE } from '../engine/tileset';
import { EXIT, TALL_GRASS, isWalkable, mapFromSketch, moveToward, tileAt, type TileMap } from '../engine/map';
import { resolveTileFrame } from '../engine/tileFrames';
import { Vision } from '../engine/vision';
import {
  COMMON_TEXTURE_KEY,
  TILESETS,
  type TilesetId,
  tilesetTextureKey,
} from '../data/tilesets';
import { PLAYER_TEXTURE_KEY } from './BootScene';

const VISION_RADIUS = 6;
const HIDDEN_ALPHA = 0.3;
const EXPLORED_ALPHA = 0.7;

/**
 * Hand-authored stand-in for the procedural route generator (Phase 1). '#' wall,
 * '.' floor, '"' tall grass, 'E' exit. It exists to prove the tileset contract,
 * the fog and the grid movement end to end.
 */
const ROUTE_SKETCH: readonly string[] = [
  '################',
  '#....##....""""#',
  '#.##..#..."""""#',
  '#..#..#..."""""#',
  '#..#..#...#....#',
  '#..#......#..#.#',
  '#..####.###..#.#',
  '#.......#....#.#',
  '#.#####.#.####.#',
  '#...."""".....""',
  '##...""""...##.#',
  '#.....E......#.#',
  '################',
];

export class RouteScene extends Phaser.Scene {
  private tilesetId: TilesetId = 'wood';
  private map!: TileMap;
  private vision!: Vision;
  private player = { x: 1, y: 1 };
  private playerSprite!: Phaser.GameObjects.Sprite;
  private tileSprites: Phaser.GameObjects.Image[][] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('Route');
  }

  create(): void {
    this.map = mapFromSketch(ROUTE_SKETCH);
    this.vision = new Vision(VISION_RADIUS);
    this.drawTiles();
    this.playerSprite = this.add.sprite(0, 0, PLAYER_TEXTURE_KEY, 0).setScale(0.75).setDepth(10);
    this.movePlayerTo(this.player.x, this.player.y, true);

    const width = this.map[0].length * TILE_SIZE;
    const height = this.map.length * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.setZoom(2);
    this.cameras.main.startFollow(this.playerSprite, true, 0.2, 0.2);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.hint = this.add
      .text(8, 8, 'Arrows: step  |  R: swap tileset', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f8fafc',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.input.keyboard!.on('keydown-R', () => this.cycleTileset());
    this.setupHudCamera();
    this.reportTile();
  }

  /**
   * The world camera runs at zoom 2, so a `setScrollFactor(0)` text would still
   * be transformed by it. A second camera at zoom 1 that ignores the world is
   * the reliable way to pin the HUD to the screen.
   */
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

  private cycleTileset(): void {
    const ids: TilesetId[] = ['wood', 'placeholder'];
    const next = ids[(ids.indexOf(this.tilesetId) + 1) % ids.length];
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
    this.hint.setText(`Arrows: step  |  R: swap tileset  |  ${textures.name}`);
  }

  private movePlayerTo(x: number, y: number, first: boolean): void {
    this.player = { x, y };
    const center = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
    this.playerSprite.setPosition(center.x, center.y);
    this.vision.recompute(this.map, this.player);
    this.refreshFog();
    if (!first) this.reportTile();
  }

  private refreshFog(): void {
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[y].length; x++) {
        const key = `${x},${y}`;
        const visible = this.vision.visible.has(key);
        const explored = this.vision.explored.has(key);
        const alpha = visible ? 1 : explored ? EXPLORED_ALPHA : HIDDEN_ALPHA;
        this.tileSprites[y][x].setAlpha(alpha);
      }
    }
  }

  private reportTile(): void {
    const value = tileAt(this.map, this.player);
    if (value === EXIT) this.hint.setText('Route cleared. Next route: Phase 1.');
    else if (value === TALL_GRASS) this.hint.setText('Tall grass: a wild encounter would roll here.');
  }

  override update(): void {
    const step = { x: 0, y: 0 };
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) step.x = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) step.x = 1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) step.y = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) step.y = 1;
    if (step.x === 0 && step.y === 0) return;

    const next = { x: this.player.x + step.x, y: this.player.y + step.y };
    if (!isWalkable(this.map, next)) return;
    if (moveToward(this.player, step, this.map)) {
      this.playerSprite.setFlipX(step.x < 0);
      this.movePlayerTo(this.player.x, this.player.y, false);
    }
  }
}
