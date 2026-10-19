import Phaser from 'phaser';
import moveFxUrl from '../assets/moves.png';
import { GROUND_ITEM_TEXTURE_KEY, GROUND_ITEM_URL } from '../data/groundItemSprite';
import { ITEM_ICON_ATLAS_URL, ITEM_ICON_SIZE, ITEM_ICON_TEXTURE_KEY } from '../data/itemIcons';
import {
  OVERWORLD_SPRITE_ATLAS_URL,
  OVERWORLD_SPRITE_HEIGHT,
  OVERWORLD_SPRITE_TEXTURE_KEY,
  OVERWORLD_SPRITE_WIDTH,
} from '../data/overworldSprites';
import {
  PLAYER_SPRITE_ATLAS_URL,
  PLAYER_SPRITE_HEIGHT,
  PLAYER_SPRITE_TEXTURE_KEY,
  PLAYER_SPRITE_WIDTH,
} from '../data/playerSprite';
import {
  PORTRAIT_ATLAS_URL,
  PORTRAIT_SHINY_ATLAS_URL,
  PORTRAIT_SHINY_TEXTURE_KEY,
  PORTRAIT_SIZE,
  PORTRAIT_TEXTURE_KEY,
} from '../data/portraits';
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
import { TRAINER_WALK_ANIMS, TRAINER_WALK_FRAME_RATE } from '../render/trainerAnim';
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
import { FRLG_FONT_ATLAS_URL, FRLG_FONT_TEXTURE_KEY, registerFrlgFont } from '../ui/frlgFont';
import {
  MOVE_CATEGORY_ATLAS_URL,
  MOVE_CATEGORY_ICON_H,
  MOVE_CATEGORY_ICON_W,
  MOVE_CATEGORY_TEXTURE_KEY,
} from '../data/moveCategoryIcons';
import { TYPE_ICON_ATLAS_URL, TYPE_ICON_H, TYPE_ICON_TEXTURE_KEY, TYPE_ICON_W } from '../data/typeIcons';
import {
  STATUS_ICON_ATLAS_URL,
  STATUS_ICON_H,
  STATUS_ICON_TEXTURE_KEY,
  STATUS_ICON_W,
} from '../data/statusIcons';
import { preloadAudio, syncAudioVolume } from '../audio/audio';
import { COMMON_TILE_SIZE, TILE_SIZE } from '../engine/tileset';
import { clearRun, loadSave } from '../engine/save';
import { hasLivingParty } from '../engine/run';
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
/** The faint star a hidden ground item shows instead of a Poke Ball. */
export const SPARKLE_TEXTURE_KEY = 'route:sparkle';
/** The shop counter the player interacts with in a shop room (Phase 9). */
export const SHOP_COUNTER_TEXTURE_KEY = 'route:shop-counter';
/** The slot machine the casino room's grunt runs (`docs/maps-spec.md` §7). */
export const CASINO_MACHINE_TEXTURE_KEY = 'route:casino-machine';
export const BATTLE_MON_TEXTURE_KEY = 'battle:mon';
export const BATTLE_PLATFORM_TEXTURE_KEY = 'battle:platform';

/** The square size of a HUD panel's collapse-icon button. */
export const PANEL_ICON_SIZE = 24;
/**
 * The white line-art glyph each HUD panel shows at its top-left. Tinted by the
 * route scene onto a small dark button; the panel collapses to it on click.
 */
export const PANEL_ICON_KEYS = {
  header: 'hud:icon:route',
  party: 'hud:icon:party',
  bag: 'hud:icon:bag',
  box: 'hud:icon:box',
  detail: 'hud:icon:detail',
} as const;

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
    this.load.spritesheet(PORTRAIT_SHINY_TEXTURE_KEY, PORTRAIT_SHINY_ATLAS_URL, {
      frameWidth: PORTRAIT_SIZE,
      frameHeight: PORTRAIT_SIZE,
    });
    this.load.spritesheet(ITEM_ICON_TEXTURE_KEY, ITEM_ICON_ATLAS_URL, {
      frameWidth: ITEM_ICON_SIZE,
      frameHeight: ITEM_ICON_SIZE,
    });
    this.load.image(GROUND_ITEM_TEXTURE_KEY, GROUND_ITEM_URL);
    this.load.spritesheet(TRAINER_SPRITE_TEXTURE_KEY, TRAINER_SPRITE_ATLAS_URL, {
      frameWidth: TRAINER_SPRITE_SIZE,
      frameHeight: TRAINER_SPRITE_SIZE,
    });
    this.load.spritesheet(OVERWORLD_SPRITE_TEXTURE_KEY, OVERWORLD_SPRITE_ATLAS_URL, {
      frameWidth: OVERWORLD_SPRITE_WIDTH,
      frameHeight: OVERWORLD_SPRITE_HEIGHT,
    });
    this.load.spritesheet(MOVE_FX_TEXTURE_KEY, moveFxUrl, {
      frameWidth: MOVE_FX_FRAME_SIZE,
      frameHeight: MOVE_FX_FRAME_SIZE,
    });
    this.load.image(FRLG_WINDOW_KEY, FRLG_WINDOW_URL);
    this.load.image(FRLG_TEXTBOX_KEY, FRLG_TEXTBOX_URL);
    this.load.image(FRLG_HPBAR_KEY, FRLG_HPBAR_URL);
    this.load.image(FRLG_CURSOR_KEY, FRLG_CURSOR_URL);
    this.load.spritesheet(MOVE_CATEGORY_TEXTURE_KEY, MOVE_CATEGORY_ATLAS_URL, {
      frameWidth: MOVE_CATEGORY_ICON_W,
      frameHeight: MOVE_CATEGORY_ICON_H,
    });
    this.load.spritesheet(TYPE_ICON_TEXTURE_KEY, TYPE_ICON_ATLAS_URL, {
      frameWidth: TYPE_ICON_W,
      frameHeight: TYPE_ICON_H,
    });
    this.load.spritesheet(STATUS_ICON_TEXTURE_KEY, STATUS_ICON_ATLAS_URL, {
      frameWidth: STATUS_ICON_W,
      frameHeight: STATUS_ICON_H,
    });
    this.load.image(FRLG_FONT_TEXTURE_KEY, FRLG_FONT_ATLAS_URL);
    preloadAudio(this);
  }

  create(): void {
    registerFrlgFont(this.cache.bitmapFont);
    this.buildRouteTextures();
    this.buildPanelIconTextures();
    this.buildMoveFxAnimations();
    this.buildPlayerAnimations();
    this.buildTrainerAnimations();
    // Phase 7: the main menu is the landing screen. It offers a fresh run, the
    // run left in progress and the options. A saved run whose last Pokémon
    // already fell was over the moment it was written, so it is cleared rather
    // than offered (D5: nothing carries over).
    const storage = browserStorage();
    const save = loadSave(storage);
    // The master volume is a preference that outlives the run, so it is applied
    // to the sound manager as soon as the boot scene can (D5 keeps settings).
    syncAudioVolume(this);
    if (save.run && !hasLivingParty(save.run)) clearRun(storage);
    this.scene.start('MainMenu');
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
   * The trainers' walk cycles, one per archetype and facing, off the atlas in
   * `src/data/overworldSprites.ts`; the route plays them while a spotted trainer
   * walks toward the player.
   */
  private buildTrainerAnimations(): void {
    for (const anim of TRAINER_WALK_ANIMS) {
      if (this.anims.exists(anim.key)) continue;
      this.anims.create({
        key: anim.key,
        frames: anim.frames.map((frame) => ({ key: OVERWORLD_SPRITE_TEXTURE_KEY, frame })),
        frameRate: TRAINER_WALK_FRAME_RATE,
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

    // The hidden-item sparkle: a small four-point star, white so the scene can
    // tint and dim it (it must read as a faint glint, not a marker).
    const sparkle = this.make.graphics({ x: 0, y: 0 });
    sparkle.fillStyle(0xffffff, 1);
    sparkle.fillTriangle(6, 0, 5, 6, 7, 6);
    sparkle.fillTriangle(6, 12, 5, 6, 7, 6);
    sparkle.fillTriangle(0, 6, 6, 5, 6, 7);
    sparkle.fillTriangle(12, 6, 6, 5, 6, 7);
    sparkle.fillCircle(6, 6, 1.6);
    sparkle.generateTexture(SPARKLE_TEXTURE_KEY, 12, 12);
    sparkle.destroy();

    // The shop counter: a tintable stand-in for the Mart counter until the FRLG
    // prop art lands (Phase 8). A pale top over a darker body reads as a fixture.
    const counter = this.make.graphics({ x: 0, y: 0 });
    counter.fillStyle(0x2f6d78, 1);
    counter.fillRect(1, 6, 20, 12);
    counter.fillStyle(0x63c2cf, 1);
    counter.fillRect(0, 2, 22, 6);
    counter.fillStyle(0x1f4a52, 1);
    counter.fillRect(1, 4, 20, 2);
    counter.generateTexture(SHOP_COUNTER_TEXTURE_KEY, 22, 18);
    counter.destroy();

    // The casino's slot machine: a purple cabinet with a dark reel window, three
    // gold reels and a red lever, drawn at its own 22x22 so the scene scales it.
    const machine = this.make.graphics({ x: 0, y: 0 });
    machine.fillStyle(0x4c2a6b, 1);
    machine.fillRect(0, 3, 22, 19);
    machine.fillStyle(0x111827, 1);
    machine.fillRect(3, 6, 16, 7);
    machine.fillStyle(0xf2c14e, 1);
    for (let i = 0; i < 3; i++) machine.fillRect(4 + i * 5, 8, 3, 3);
    machine.fillStyle(0xe11d48, 1);
    machine.fillRect(19, 3, 3, 6);
    machine.generateTexture(CASINO_MACHINE_TEXTURE_KEY, 22, 22);
    machine.destroy();

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
    platform.fillEllipse(130, 25, 260, 50);
    platform.generateTexture(BATTLE_PLATFORM_TEXTURE_KEY, 260, 50);
    platform.destroy();
  }

  /**
   * The white line-art glyphs the HUD panel headers show at their top-left
   * (route flag, Poke Ball, bag, PC box, magnifier). One shared graphics draws
   * each into its own texture; the route scene tints them onto a dark button.
   */
  private buildPanelIconTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const size = PANEL_ICON_SIZE;
    const draw = (key: string, render: (graphics: Phaser.GameObjects.Graphics) => void): void => {
      g.clear();
      render(g);
      g.generateTexture(key, size, size);
    };

    // Route: a flag on a pole.
    draw(PANEL_ICON_KEYS.header, (graphics) => {
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.beginPath();
      graphics.moveTo(7, 4);
      graphics.lineTo(7, 20);
      graphics.strokePath();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillTriangle(7, 4, 19, 7, 7, 10);
    });

    // Party: a Poke Ball.
    draw(PANEL_ICON_KEYS.party, (graphics) => {
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.strokeCircle(12, 12, 8);
      graphics.beginPath();
      graphics.moveTo(4, 12);
      graphics.lineTo(20, 12);
      graphics.strokePath();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(12, 12, 3);
    });

    // Bag: a satchel with a handle.
    draw(PANEL_ICON_KEYS.bag, (graphics) => {
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.beginPath();
      graphics.arc(12, 10, 4, Math.PI, 0, false);
      graphics.strokePath();
      graphics.strokeRect(5, 10, 14, 10);
    });

    // PC box: a 2x2 grid of cells.
    draw(PANEL_ICON_KEYS.box, (graphics) => {
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.strokeRect(5, 5, 6, 6);
      graphics.strokeRect(13, 5, 6, 6);
      graphics.strokeRect(5, 13, 6, 6);
      graphics.strokeRect(13, 13, 6, 6);
    });

    // Detail: a magnifier.
    draw(PANEL_ICON_KEYS.detail, (graphics) => {
      graphics.lineStyle(2, 0xffffff, 1);
      graphics.strokeCircle(10, 10, 6);
      graphics.beginPath();
      graphics.moveTo(14.5, 14.5);
      graphics.lineTo(19, 19);
      graphics.strokePath();
    });

    g.destroy();
  }
}
