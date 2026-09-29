import Phaser from 'phaser';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { RouteScene } from './scenes/RouteScene';
import { StarterScene } from './scenes/StarterScene';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;

export const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#10161f',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene, StarterScene, RouteScene, BattleScene],
};

export const game = new Phaser.Game(config);
