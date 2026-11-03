import Phaser from 'phaser';
import { playerSpriteFrame, type PlayerFacing } from '../data/playerSprite';
import type { Tile } from '../engine/grid';
import { cutsCorner, isWalkable, type TileMap } from '../engine/map';
import { TILE_SIZE } from '../engine/tileset';
import { actionKeys } from '../input/input';
import { playerWalkAnimKey, playerWalkTimeScale } from '../render/playerAnim';

/**
 * The one tile walker every node scene shares (`D47`'s shape, one layer down): it
 * slides the scene's own sprite one cell at a time on the run's movement keys,
 * plays the player's walk cycle while a step is in flight and reports each landed
 * step through its hook. It draws nothing, owns no run and decides no rule beyond
 * `canWalkStep`, so a city, a gym and the League's interior walk identically.
 */

export type MoveDirection = 'up' | 'down' | 'left' | 'right';

export type WalkerHooks = Readonly<{
  /** Called once the step's tween landed, with both tiles. */
  onStep?: (from: Tile, to: Tile, direction: MoveDirection) => void;
}>;

/** How long one tile takes to cross on foot, and with the run key held. */
export const WALK_STEP_MS = 200;
export const RUN_STEP_MS = 110;

const STEP: Readonly<Record<MoveDirection, Tile>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** The x a sprite centred on `tile` stands at. */
function tileCenterX(tile: Tile): number {
  return tile.x * TILE_SIZE + TILE_SIZE / 2;
}

/** The y of a sprite whose feet stand on `tile`'s bottom edge, as the 16x32 frame does. */
function tileFootY(tile: Tile): number {
  return tile.y * TILE_SIZE + TILE_SIZE;
}

/** Whether a held direction moves `from` one tile: free and corner-cut aware. */
export function canWalkStep(map: TileMap, from: Tile, direction: MoveDirection): boolean {
  const step = STEP[direction];
  const to = { x: from.x + step.x, y: from.y + step.y };
  return isWalkable(map, to) && !cutsCorner(map, from, step);
}

export class WorldWalker {
  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly map: TileMap;
  private readonly hooks: WalkerHooks;
  private readonly keys: Readonly<Record<MoveDirection, Phaser.Input.Keyboard.Key[]>>;
  private current: Tile = { x: 0, y: 0 };
  private facing: PlayerFacing = 'down';
  /** The in-flight step's tween, or null while the sprite stands. */
  private tween: Phaser.Tweens.Tween | null = null;
  /** True while the sprite shows its resting frame, so a still frame is painted once. */
  private resting = false;
  /** True while the run key was held on the last `update`. */
  private running = false;
  /** The direction the map refused last, so a held key against a wall is not re-asked. */
  private blocked: MoveDirection | null = null;

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    map: TileMap,
    hooks: WalkerHooks = {},
  ) {
    this.scene = scene;
    this.sprite = sprite;
    this.map = map;
    this.hooks = hooks;
    this.keys = {
      up: actionKeys(scene, 'up'),
      down: actionKeys(scene, 'down'),
      left: actionKeys(scene, 'left'),
      right: actionKeys(scene, 'right'),
    };
  }

  get tile(): Tile {
    return { x: this.current.x, y: this.current.y };
  }

  /** True while a step's tween is running. */
  get stepping(): boolean {
    return this.tween !== null;
  }

  /** Puts the sprite on `tile` with no tween; no map rule is read. */
  place(tile: Tile): void {
    this.tween?.remove();
    this.tween = null;
    this.current = { x: tile.x, y: tile.y };
    this.blocked = null;
    this.sprite.setPosition(tileCenterX(tile), tileFootY(tile));
    this.resting = false;
    this.rest();
  }

  /** One tile in `direction`; false when the map refuses or a step is in flight. */
  step(direction: MoveDirection): boolean {
    if (this.tween !== null) return false;
    this.face(direction);
    if (!canWalkStep(this.map, this.current, direction)) {
      this.blocked = direction;
      this.rest();
      return false;
    }
    this.blocked = null;
    const step = STEP[direction];
    const from: Tile = { x: this.current.x, y: this.current.y };
    const to: Tile = { x: from.x + step.x, y: from.y + step.y };
    this.current = to;
    const running = this.running;
    this.sprite.anims.timeScale = playerWalkTimeScale(running, WALK_STEP_MS, RUN_STEP_MS);
    const key = playerWalkAnimKey(this.facing);
    if (this.scene.anims.exists(key)) this.sprite.play(key, true);
    this.resting = false;
    this.tween = this.scene.tweens.add({
      targets: this.sprite,
      x: tileCenterX(to),
      y: tileFootY(to),
      duration: running ? RUN_STEP_MS : WALK_STEP_MS,
      ease: 'Linear',
      onComplete: () => {
        this.tween = null;
        this.hooks.onStep?.(from, to, direction);
      },
    });
    return true;
  }

  /** Reads the held direction(s) and starts a step when the timing allows it. */
  update(delta: number, running: boolean): void {
    // A tween is frame-driven, so a frame's own delta buys nothing here.
    void delta;
    this.running = running;
    if (this.tween !== null) return;
    const direction = this.heldDirection();
    if (direction === null) {
      this.blocked = null;
      this.rest();
      return;
    }
    // A key held against a wall is not re-asked every frame: the refusal is a fact
    // of the cell, and re-asking it would allocate a tile per frame.
    if (direction === this.blocked) {
      this.rest();
      return;
    }
    this.step(direction);
  }

  /** The direction the player is pushing: a held key or a fresh tap, in key order. */
  private heldDirection(): MoveDirection | null {
    const { up, down, left, right } = this.keys;
    const pressed = (keys: Phaser.Input.Keyboard.Key[]): boolean =>
      keys.some((key) => key.isDown || Phaser.Input.Keyboard.JustDown(key));
    if (pressed(left)) return 'left';
    if (pressed(right)) return 'right';
    if (pressed(up)) return 'up';
    if (pressed(down)) return 'down';
    return null;
  }

  /** Turns the sprite toward a direction, flipping the left-facing side frames. */
  private face(direction: MoveDirection): void {
    this.facing = direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'side';
    this.sprite.setFlipX(direction === 'right');
  }

  /** Stands the sprite on the facing's resting frame, once. */
  private rest(): void {
    if (this.resting) return;
    this.resting = true;
    if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
    this.sprite.setFrame(playerSpriteFrame(this.facing));
  }
}
