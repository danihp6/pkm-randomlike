import Phaser from 'phaser';
import playerSpriteUrl from '../assets/pokemon/25.png';
import { COMMON_TILE_SIZE, TILE_SIZE } from '../engine/tileset';
import {
  COMMON_ATLAS_URL,
  COMMON_TEXTURE_KEY,
  TILESET_IDS,
  TILESETS,
  tilesetTextureKey,
} from '../data/tilesets';

export const PLAYER_TEXTURE_KEY = 'player';
// Pikachu's overworld sheet: 32x32 frames, first row is the facing-down idle.
export const PLAYER_SPRITE_URL = playerSpriteUrl;
export const GRASS_TEXTURE_KEY = 'route:grass';
export const TRAINER_TEXTURE_KEY = 'route:trainer';
export const ITEM_TEXTURE_KEY = 'route:item';
export const ARROW_TEXTURE_KEY = 'route:arrow';
export const BATTLE_MON_TEXTURE_KEY = 'battle:mon';
export const BATTLE_PLATFORM_TEXTURE_KEY = 'battle:platform';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const id of TILESET_IDS) {
      this.load.spritesheet(tilesetTextureKey(id), TILESETS[id].atlasUrl, {
        frameWidth: TILE_SIZE,
        frameHeight: TILE_SIZE,
      });
    }
    this.load.spritesheet(COMMON_TEXTURE_KEY, COMMON_ATLAS_URL, {
      frameWidth: COMMON_TILE_SIZE,
      frameHeight: COMMON_TILE_SIZE,
    });
    this.load.spritesheet(PLAYER_TEXTURE_KEY, PLAYER_SPRITE_URL, {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create(): void {
    this.buildRouteTextures();
    this.scene.start('Route');
  }

  /**
   * Procedural stand-ins for the two art slots the tilesets still lack (tall
   * grass, trainer sprites) plus the floor-item marker. White shapes so the
   * scene can tint them; `docs/tileset-spec.md` §6.
   */
  private buildRouteTextures(): void {
    const grass = this.make.graphics({ x: 0, y: 0 });
    grass.fillStyle(0x1f5130, 0.9);
    grass.fillTriangle(4, TILE_SIZE, 8, 8, 12, TILE_SIZE);
    grass.fillTriangle(11, TILE_SIZE, 15, 5, 19, TILE_SIZE);
    grass.fillTriangle(14, TILE_SIZE, 18, 10, 22, TILE_SIZE);
    grass.generateTexture(GRASS_TEXTURE_KEY, TILE_SIZE, TILE_SIZE);
    grass.destroy();

    const trainer = this.make.graphics({ x: 0, y: 0 });
    trainer.fillStyle(0xffffff, 1);
    trainer.fillCircle(9, 5, 4);
    trainer.fillRect(4, 10, 10, 8);
    trainer.generateTexture(TRAINER_TEXTURE_KEY, 18, 18);
    trainer.destroy();

    const item = this.make.graphics({ x: 0, y: 0 });
    item.fillStyle(0xfbbf24, 1);
    item.fillCircle(5, 5, 5);
    item.fillStyle(0x78350f, 1);
    item.fillCircle(5, 5, 2);
    item.generateTexture(ITEM_TEXTURE_KEY, 10, 10);
    item.destroy();

    const arrow = this.make.graphics({ x: 0, y: 0 });
    arrow.fillStyle(0xffffff, 1);
    arrow.fillTriangle(5, 0, 10, 9, 0, 9);
    arrow.generateTexture(ARROW_TEXTURE_KEY, 10, 9);
    arrow.destroy();

    // Placeholder battle stand-ins (O1): a tintable body and a shadow platform.
    const mon = this.make.graphics({ x: 0, y: 0 });
    mon.fillStyle(0xffffff, 1);
    mon.fillEllipse(20, 20, 34, 30);
    mon.fillEllipse(11, 36, 12, 10);
    mon.fillEllipse(29, 36, 12, 10);
    mon.fillStyle(0x10161f, 1);
    mon.fillCircle(14, 16, 3);
    mon.fillCircle(26, 16, 3);
    mon.generateTexture(BATTLE_MON_TEXTURE_KEY, 40, 44);
    mon.destroy();

    const platform = this.make.graphics({ x: 0, y: 0 });
    platform.fillStyle(0xffffff, 1);
    platform.fillEllipse(90, 16, 180, 32);
    platform.generateTexture(BATTLE_PLATFORM_TEXTURE_KEY, 180, 32);
    platform.destroy();
  }
}
