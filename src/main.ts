import Phaser from 'phaser';
import { IS_DEVELOP } from './dev/env';
import type { DebugMenuHandlers } from './dev/debugMenu';
import { grantBadge } from './engine/run/badge';
import type { RunState } from './engine/run/state';
import { loadSave, storeRun } from './engine/save';
import { onLocaleChange } from './i18n';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { RouteScene } from './scenes/RouteScene';
import { RunOverScene } from './scenes/RunOverScene';
import { SettingsScene } from './scenes/SettingsScene';
import { StarterScene } from './scenes/StarterScene';
import { REGION_SCENES } from './scenes/regionScenes';
import { browserStorage } from './storage';
import { mountHud } from './ui/hud/mount';

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
  scene: [
    BootScene,
    MainMenuScene,
    StarterScene,
    RouteScene,
    BattleScene,
    RunOverScene,
    SettingsScene,
    ...REGION_SCENES.map((entry) => entry.Scene as Phaser.Types.Scenes.SceneType),
  ],
};

export const game = new Phaser.Game(config);

// The DOM HUD (D49) is the HUD: it mounts on every boot and owns no Phaser object.
// The scenes below mount their own panel into `#hud`; `?hud=dom` is only an alias.
mountHud(window.location.search);

// The debug menu is a dev-only DOM overlay; the dynamic import keeps its code
// out of the production entry chunk (see `src/dev/debugMenu.ts`).
if (IS_DEVELOP) {
  void import('./dev/debugMenu').then(
    ({ changedRun, installDebugMenu, nodeContextFor, withTowerStreak, withVisitedNode }) => {
      /**
       * The live route scene, or null. The panel's own handlers reach it the same way
       * every other dev tool does, so nothing above the gate knows about it.
       */
      const routeScene = (): RouteScene | null => game.scene.getScene('Route') as RouteScene | null;

      /**
       * Hands a save the panel just wrote to the live route, so its run and the save
       * agree again. A stopped scene needs no restart: its next `create` reads the save.
       */
      const restartRoute = (run: RunState): void => {
        const route = routeScene();
        if (route?.scene.isActive()) route.scene.restart({ run });
      };

      /** Reads the saved run, applies a pure rule, and writes only a changed value. */
      const updateRun = (rule: (run: RunState) => RunState): boolean => {
        const storage = browserStorage();
        const run = loadSave(storage).run;
        if (!run) return false;
        const next = changedRun(run, rule);
        if (next === null) return false;
        storeRun(storage, next);
        restartRoute(next);
        return true;
      };

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
        readNodeContext: () => {
          const run = loadSave(browserStorage()).run;
          return run ? nodeContextFor(run) : null;
        },
        onTeleportNode: async (nodeKey) => {
          const route = routeScene();
          if (!route || route.debugTravelState() === null) {
            return { ok: false, error: 'no active route' };
          }
          const arrived = await route.travelToNode(nodeKey, 'fly');
          return arrived ? { ok: true, where: nodeKey } : { ok: false, error: 'travel refused' };
        },
        onGrantBadge: (badge) => updateRun((run) => grantBadge(run, badge)),
        onMarkVisited: (nodeKey) => updateRun((run) => withVisitedNode(run, nodeKey)),
        onSetTowerStreak: (streak) => updateRun((run) => withTowerStreak(run, streak)),
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
    },
  );
}
