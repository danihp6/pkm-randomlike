import Phaser from 'phaser';
import { IS_DEVELOP } from './dev/env';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { PartyScene } from './scenes/PartyScene';
import { RouteScene } from './scenes/RouteScene';
import { RunOverScene } from './scenes/RunOverScene';
import { SettingsScene } from './scenes/SettingsScene';
import { StarterScene } from './scenes/StarterScene';

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;

export const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#10161f',
  // Pixel art throughout: nearest-neighbour sampling and integer camera scroll.
  // Without it the FRLG 16px cells scaled to the 24px world tile blend with the
  // neighbouring atlas frame at fractional scroll, leaving dark seams between tiles.
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene, StarterScene, RouteScene, BattleScene, PartyScene, RunOverScene, SettingsScene],
};

export const game = new Phaser.Game(config);

// The debug menu is a dev-only DOM overlay; the dynamic import keeps its code
// out of the production entry chunk (see `src/dev/debugMenu.ts`).
if (IS_DEVELOP) {
  void import('./dev/debugMenu').then(({ installDebugMenu }) => {
    installDebugMenu({
      onWildBattle: (speciesId, level) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        route?.startDebugWildBattle(speciesId, level);
      },
      onAddPokemon: (speciesId, level) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.addDebugPokemon(speciesId, level) ?? null;
      },
      onAddItem: (itemId, count) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        route?.addDebugItem(itemId, count);
      },
      readRouteContext: () => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.debugRouteContext() ?? null;
      },
      onRegenerateRoute: (input) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        route?.regenerateRoute(input);
      },
      onTogglePassThrough: (enabled) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        route?.setPassThrough(enabled);
      },
      onToggleHoverInspect: (enabled) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        route?.setHoverInspect(enabled);
      },
      generatorStepInfo: () => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.generatorStepInfo() ?? null;
      },
      stepGenerator: (delta) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        route?.stepGenerator(delta);
      },
      resetGeneratorStep: () => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        route?.resetGeneratorStep();
      },
      exportFrameMap: () => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.exportFrameMap() ?? null;
      },
      importFrameMap: (text) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.importFrameMap(text) ?? { ok: false, error: 'no active route' };
      },
    });
  });
}
