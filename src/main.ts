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
import { LeagueScene } from './scenes/LeagueScene';
import type { ScenePanels } from './scenes/panels/host';
import type { RoutePanelHost } from './scenes/panels/types';
import { RouteScene } from './scenes/RouteScene';
import { RunOverScene } from './scenes/RunOverScene';
import { SettingsScene } from './scenes/SettingsScene';
import { StarterScene } from './scenes/StarterScene';
import { REGION_SCENES } from './scenes/regionScenes';
import { WorldScene } from './scenes/WorldScene';
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
      /** The scene on top: whatever the player is looking at, of any kind. */
      const liveScene = (): Phaser.Scene | null => game.scene.getScenes(true)[0] ?? null;

      /**
       * The route screen, when the route is the one on top. Every frame-map, generator
       * and debug-party tool narrows the live scene this way, so a settlement's screen
       * answers no route method instead of the route answering from its stopped slot.
       */
      const liveRoute = (): RouteScene | null => {
        const scene = liveScene();
        return scene instanceof RouteScene ? scene : null;
      };

      /**
       * The panel host the live node screen mounted, or null. A city, a gym, a Centre
       * and the League carry the same port the route does, so a dev tool reaches the
       * run through it without knowing which screen is up.
       */
      const liveHost = (): RoutePanelHost | null => {
        const scene = liveScene();
        if (!(scene instanceof WorldScene) && !(scene instanceof LeagueScene)) return null;
        const layer = (scene as unknown as { panelLayer: ScenePanels | null }).panelLayer;
        return layer === null ? null : layer.host;
      };

      /**
       * Hands a save the panel just wrote to the live screen, so its run and the save
       * agree again. A screen the panel layer owns takes the run through its host; a
       * stopped scene needs no restart: its next `create` reads the save.
       */
      const restartRoute = (run: RunState): void => {
        const host = liveHost();
        if (host !== null) {
          host.commitRun(run);
          return;
        }
        const scene = liveScene();
        if (!(scene instanceof WorldScene) && !(scene instanceof LeagueScene)) return;
        if (scene.scene.isActive()) scene.scene.restart({ run });
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
          liveRoute()?.startDebugWildBattle(speciesId, level);
        },
        onAddPokemon: (speciesId, level) => liveRoute()?.addDebugPokemon(speciesId, level) ?? null,
        onAddItem: (itemId, count) => {
          liveRoute()?.addDebugItem(itemId, count);
        },
        readParty: () => liveRoute()?.debugParty() ?? [],
        onSetSquadLevel: (level) => liveRoute()?.setDebugSquadLevel(level) ?? false,
        onEditPartyMember: (memberId, edit) => liveRoute()?.editDebugPokemon(memberId, edit) ?? false,
        onHealPartyMember: (memberId) => liveRoute()?.healDebugPokemon(memberId) ?? false,
        readRouteContext: () => liveRoute()?.debugRouteContext() ?? null,
        onRegenerateRoute: (input) => {
          liveRoute()?.regenerateRoute(input);
        },
        onTogglePassThrough: (enabled) => {
          liveRoute()?.setPassThrough(enabled);
        },
        onToggleHoverInspect: (enabled) => {
          liveRoute()?.setHoverInspect(enabled);
        },
        generatorStepInfo: () => liveRoute()?.generatorStepInfo() ?? null,
        stepGenerator: (delta) => {
          liveRoute()?.stepGenerator(delta);
        },
        resetGeneratorStep: () => {
          liveRoute()?.resetGeneratorStep();
        },
        exportFrameMap: () => liveRoute()?.exportFrameMap() ?? null,
        importFrameMap: (text) =>
          liveRoute()?.importFrameMap(text) ?? { ok: false, error: 'no active route' },
        readNodeContext: () => {
          const run = loadSave(browserStorage()).run;
          return run ? nodeContextFor(run) : null;
        },
        onTeleportNode: async (nodeKey) => {
          const route = liveRoute();
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
          liveRoute()?.setIgnoreEncounters(enabled);
        },
        onToggleIgnoreTrainers: (enabled) => {
          liveRoute()?.setIgnoreTrainers(enabled);
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
