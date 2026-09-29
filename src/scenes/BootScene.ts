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
    this.scene.start('Route');
  }
}
