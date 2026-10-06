import Phaser from 'phaser';
import moveFxUrl from '../assets/moves.png';
import { ITEM_ICON_ATLAS_URL, ITEM_ICON_SIZE, ITEM_ICON_TEXTURE_KEY } from '../data/itemIcons';
import {
  OVERWORLD_SPRITE_ATLAS_URL,
  OVERWORLD_SPRITE_HEIGHT,
  OVERWORLD_SPRITE_TEXTURE_KEY,
  OVERWORLD_SPRITE_WIDTH,
} from '../data/overworldSprites';
import { POKEMON_SPRITE_SHEETS } from '../data/pokemonSprites';
import {
  PLAYER_SPRITE_ATLAS_URL,
  PLAYER_SPRITE_HEIGHT,
  PLAYER_SPRITE_TEXTURE_KEY,
  PLAYER_SPRITE_WIDTH,
} from '../data/playerSprite';
import { PORTRAIT_ATLAS_URL, PORTRAIT_SIZE, PORTRAIT_TEXTURE_KEY } from '../data/portraits';
import {
  TRAINER_SPRITE_ATLAS_URL,
  TRAINER_SPRITE_SIZE,
  TRAINER_SPRITE_TEXTURE_KEY,
} from '../data/trainerSprites';
import {
  MOVE_FX_FRAME_RATE,
  MOVE_FX_FRAME_SIZE,
  MOVE_FX_IDS,
  MOVE_FX_TEXTURE_KEY,
  moveFxAnimKey,
  moveFxFrames,
} from '../render/moveFx';
import { PLAYER_WALK_ANIMS, PLAYER_WALK_FRAME_RATE } from '../render/playerAnim';
import {
  FRLG_CURSOR_KEY,
  FRLG_CURSOR_URL,
  FRLG_HPBAR_KEY,
  FRLG_HPBAR_URL,
  FRLG_TEXTBOX_KEY,
  FRLG_TEXTBOX_URL,
  FRLG_WINDOW_KEY,
  FRLG_WINDOW_URL,
} from '../ui/frlg';
import {
  PARTY_PANEL_KEY,
  PARTY_PANEL_URL,
  PARTY_SLOT_KEY,
  PARTY_SLOT_URL,
} from '../data/partyMenu';
import {
  FRLG_FONT_ATLAS_URL,
  FRLG_FONT_TEXTURE_KEY,
  registerFrlgFont,
} from '../ui/frlgFont';
import { COMMON_TILE_SIZE, TILE_SIZE } from '../engine/tileset';
import { clearRun, loadSave } from '../engine/save';
import { hasLivingParty } from '../engine/run';
import { applyVolume } from '../settings';
import {
  COMMON_ATLAS_URL,
  COMMON_TEXTURE_KEY,
  TILESET_IDS,
  TILESETS,
  tilesetTextureKey,
} from '../data/tilesets';
import { browserStorage } from '../storage';

export const GRASS_TEXTURE_KEY = 'route:grass';
export const TRAINER_TEXTURE_KEY = 'route:trainer';
export const ARROW_TEXTURE_KEY = 'route:arrow';
export const BATTLE_MON_TEXTURE_KEY = 'battle:mon';
export const BATTLE_PLATFORM_TEXTURE_KEY = 'battle:platform';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const id of TILESET_IDS) {
      // The cell size is the tileset's own (`D18`): the PMD-derived sheets are
      // 24px, the FireRed/LeafGreen atlases 16px. The route scene scales each
      // cell back up to `TILE_SIZE` so the world stays one tile size.
      const { tileSize } = TILESETS[id].config.atlas;
      this.load.spritesheet(tilesetTextureKey(id), TILESETS[id].atlasUrl, {
        frameWidth: tileSize,
        frameHeight: tileSize,
      });
    }
    this.load.spritesheet(COMMON_TEXTURE_KEY, COMMON_ATLAS_URL, {
      frameWidth: COMMON_TILE_SIZE,
      frameHeight: COMMON_TILE_SIZE,
    });
    this.load.spritesheet(PLAYER_SPRITE_TEXTURE_KEY, PLAYER_SPRITE_ATLAS_URL, {
      frameWidth: PLAYER_SPRITE_WIDTH,
      frameHeight: PLAYER_SPRITE_HEIGHT,
    });
    this.load.spritesheet(PORTRAIT_TEXTURE_KEY, PORTRAIT_ATLAS_URL, {
      frameWidth: PORTRAIT_SIZE,
      frameHeight: PORTRAIT_SIZE,
    });
    this.load.spritesheet(ITEM_ICON_TEXTURE_KEY, ITEM_ICON_ATLAS_URL, {
      frameWidth: ITEM_ICON_SIZE,
      frameHeight: ITEM_ICON_SIZE,
    });
    this.load.spritesheet(TRAINER_SPRITE_TEXTURE_KEY, TRAINER_SPRITE_ATLAS_URL, {
      frameWidth: TRAINER_SPRITE_SIZE,
      frameHeight: TRAINER_SPRITE_SIZE,
    });
    this.load.spritesheet(OVERWORLD_SPRITE_TEXTURE_KEY, OVERWORLD_SPRITE_ATLAS_URL, {
      frameWidth: OVERWORLD_SPRITE_WIDTH,
      frameHeight: OVERWORLD_SPRITE_HEIGHT,
    });
    for (const sheet of Object.values(POKEMON_SPRITE_SHEETS)) {
      this.load.spritesheet(sheet.key, sheet.url, {
        frameWidth: sheet.size,
        frameHeight: sheet.size,
      });
    }
    this.load.spritesheet(MOVE_FX_TEXTURE_KEY, moveFxUrl, {
      frameWidth: MOVE_FX_FRAME_SIZE,
      frameHeight: MOVE_FX_FRAME_SIZE,
    });
    this.load.image(FRLG_WINDOW_KEY, FRLG_WINDOW_URL);
    this.load.image(FRLG_TEXTBOX_KEY, FRLG_TEXTBOX_URL);
    this.load.image(FRLG_HPBAR_KEY, FRLG_HPBAR_URL);
    this.load.image(FRLG_CURSOR_KEY, FRLG_CURSOR_URL);
    this.load.image(FRLG_FONT_TEXTURE_KEY, FRLG_FONT_ATLAS_URL);
    this.load.image(PARTY_PANEL_KEY, PARTY_PANEL_URL);
    this.load.image(PARTY_SLOT_KEY, PARTY_SLOT_URL);
  }

  create(): void {
    registerFrlgFont(this.cache.bitmapFont);
    this.buildRouteTextures();
    this.buildMoveFxAnimations();
    this.buildPlayerAnimations();
    // Phase 7: pick up the run left in progress, or start a fresh one. A saved
    // run whose last Pokémon already fell was over the moment it was written,
    // so it is cleared rather than resumed (D5: nothing carries over).
    const storage = browserStorage();
    const save = loadSave(storage);
    // The master volume is a preference that outlives the run, so it is applied
    // to the sound manager as soon as the boot scene can (D5 keeps settings).
    applyVolume(this.sound, save.settings);
    if (save.run && hasLivingParty(save.run)) {
      this.scene.start('Route', { run: save.run });
      return;
    }
    if (save.run) clearRun(storage);
    this.scene.start('Starter');
  }

  /**
   * One animation per move-FX strip, off the atlas registry, so the battle scene
   * plays `moveFxAnimKey(fx)` without knowing the sheet's frame layout.
   */
  private buildMoveFxAnimations(): void {
    for (const fx of MOVE_FX_IDS) {
      const key = moveFxAnimKey(fx);
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: moveFxFrames(fx).map((frame) => ({ key: MOVE_FX_TEXTURE_KEY, frame })),
        frameRate: MOVE_FX_FRAME_RATE,
        repeat: 0,
      });
    }
  }

  /**
   * The player's three walk cycles, one per facing, off the atlas in
   * `src/data/playerSprite.ts`; the route plays them by key and scales the rate
   * to run.
   */
  private buildPlayerAnimations(): void {
    for (const anim of PLAYER_WALK_ANIMS) {
      if (this.anims.exists(anim.key)) continue;
      this.anims.create({
        key: anim.key,
        frames: anim.frames.map((frame) => ({ key: PLAYER_SPRITE_TEXTURE_KEY, frame })),
        frameRate: PLAYER_WALK_FRAME_RATE,
        repeat: -1,
      });
    }
  }

  /**
   * Procedural stand-ins for the two art slots the tilesets still lack (tall
   * grass, trainer sprites). White shapes so the scene can tint them;
   * `docs/tileset-spec.md` §6.
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
