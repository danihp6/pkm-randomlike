import Phaser from 'phaser';
import { IS_DEVELOP } from './dev/env';
import type { DebugMenuHandlers } from './dev/debugMenu';
import { onLocaleChange } from './i18n';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
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
  // Two extra touch pointers: the on-screen pad can be held while A / B is
  // pressed (Mouse + pointer1 + pointer2 + pointer3).
  input: { activePointers: 3 },
  scene: [BootScene, MainMenuScene, StarterScene, RouteScene, BattleScene, RunOverScene, SettingsScene],
};

export const game = new Phaser.Game(config);

// The debug menu is a dev-only DOM overlay; the dynamic import keeps its code
// out of the production entry chunk (see `src/dev/debugMenu.ts`).
if (IS_DEVELOP) {
  void import('./dev/debugMenu').then(({ installDebugMenu }) => {
    const handlers: DebugMenuHandlers = {
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
      readParty: () => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.debugParty() ?? [];
      },
      onSetSquadLevel: (level) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.setDebugSquadLevel(level) ?? false;
      },
      onEditPartyMember: (memberId, edit) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.editDebugPokemon(memberId, edit) ?? false;
      },
      onHealPartyMember: (memberId) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.healDebugPokemon(memberId) ?? false;
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
      onTeleportFloor: (mapIndex) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.teleportToFloor(mapIndex) ?? { ok: false, error: 'no active route' };
      },
      onTeleportRoom: (roomInMap) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.teleportToRoom(roomInMap) ?? { ok: false, error: 'no active route' };
      },
      onTeleportTile: (x, y) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        return route?.teleportToTile(x, y) ?? { ok: false, error: 'no active route' };
      },
      onToggleIgnoreEncounters: (enabled) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        route?.setIgnoreEncounters(enabled);
      },
      onToggleIgnoreTrainers: (enabled) => {
        const route = game.scene.getScene('Route') as RouteScene | null;
        route?.setIgnoreTrainers(enabled);
      },
    };

    // The panel bakes every label at mount, and the stored locale is applied later (a
    // scene's `create`), so a browser booted in Spanish would keep an English panel.
    // Remount it on a locale change; the module's own disposer does the cleanup.
    let dispose = installDebugMenu(handlers);
    onLocaleChange(() => {
      dispose();
      dispose = installDebugMenu(handlers);
    });
  });
}
