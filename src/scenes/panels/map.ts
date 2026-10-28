import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import { getBiome } from '../../data/biomes';
import { isFinalMap } from '../../engine/maps';
import { t } from '../../i18n';
import { mapPanelView, mountMapPanel, type MapPanelView } from '../../ui/hud/panels/map';
import { buildMapView, type MapRoomMarker, type MapView } from '../../ui/mapView';
import { panelExpanded } from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The route header, which **is** the floor minimap (`docs/maps-spec.md` §8, `D32`):
 * the map name over the discovered-rooms grid, one panel in the free top-left
 * corner. The layout and every reveal rule come from the pure `buildMapView`; this
 * module only feeds the view.
 *
 * The card is the Preact panel in `src/ui/hud/panels/map/` and this module draws
 * none of it: it derives the view from the plan and the run, and `refresh` feeds
 * the panel's signal. `#hud` is a DOM layer above the canvas, so while the route is
 * paused under a battle or the Settings screen the mount hides the card and brings
 * it back as it was on `RESUME`.
 */

/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this folder imports
 * Phaser type-only: the route stops under a battle or the Settings screen and comes
 * back from it on these two.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';

/** The mounted DOM panel: its view, its disposer, the host and the scene it follows. */
let domView: Signal<MapPanelView> | null = null;
let domDispose: (() => void) | null = null;
let domHost: RoutePanelHost | null = null;
let domScene: Phaser.Scene | null = null;
/**
 * True while the route is paused under another screen. `#hud` is a DOM layer **above**
 * the canvas, so a paused route's card would float over the battle covering it; the
 * mount stays and only the view's `open` goes false, which is the collapse state.
 */
let mapPaused = false;

/** The port, plus the marker map the minimap's special rooms come from. */
function mapViewOf(host: RoutePanelHost): MapView | null {
  const plan = host.plan();
  if (!plan) return null;
  const run = host.run();
  return buildMapView(plan, {
    discovered: run.discoveredRooms,
    currentRoom: run.routeInMap,
    portalOpen: portalOpen(host),
    captureSpent: run.capturedRooms,
    markers: plan.specials.reduce<Record<number, MapRoomMarker>>((all, special) => {
      all[special.roomId] = special.kind;
      return all;
    }, {}),
  });
}

/** The header's own line: the floor number and the biome it holds. */
function mapTitle(host: RoutePanelHost): string {
  return t('route.mapTitle', {
    map: host.run().mapIndex,
    biome: getBiome(host.route().biomeId).name,
  });
}

/** The portal is open once the map's boss has fallen, except on the final map (D31). */
function portalOpen(host: RoutePanelHost): boolean {
  const run = host.run();
  return run.bossDefeated && !isFinalMap(run.mode, run.mapIndex);
}

/** The number of display objects the header draws in Phaser: none, it is the DOM card. */
export function mapDrawnObjectCount(): number {
  return 0;
}

/** The view's viewport: the scene's own window, as the HUD metrics see it. */
function viewport(host: RoutePanelHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

/**
 * The card as data: the floor, its title and the panel record's own open state. It
 * is the one emit point of the DOM panel — the scene owns the run and the plan, the
 * Preact card paints them.
 */
function mapDomView(host: RoutePanelHost): MapPanelView {
  const view = mapPanelView(mapViewOf(host), mapTitle(host), viewport(host));
  return { ...view, open: !mapPaused && panelExpanded(host, 'header') };
}

/** Repaints the mounted card from the live host, or nothing before the first mount. */
function repaintDomPanel(): void {
  if (domView === null || domHost === null) return;
  domView.value = mapDomView(domHost);
}

/** A battle or the Settings screen covers the route: the card goes with the paused HUD. */
function pauseDomPanel(): void {
  mapPaused = true;
  repaintDomPanel();
}

/** The route is the screen on top again: the card returns as it was left. */
function resumeDomPanel(): void {
  mapPaused = false;
  repaintDomPanel();
}

function disposeDomPanel(): void {
  if (domScene !== null) {
    domScene.events.off(SCENE_PAUSE, pauseDomPanel);
    domScene.events.off(SCENE_RESUME, resumeDomPanel);
    domScene = null;
  }
  mapPaused = false;
  domHost = null;
  if (domDispose !== null) {
    domDispose();
    domDispose = null;
  }
  domView = null;
}

/**
 * The card's build: the plan and the run go into the view, the Preact card in `#hud`
 * paints them. A missing layer mounts nothing, and the module's own calls stay total.
 */
function buildDom(host: RoutePanelHost): void {
  disposeDomPanel();
  const scene = host.scene;
  mapPaused = scene.sys.isPaused();
  const view = signal(mapDomView(host));
  domView = view;
  domHost = host;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null) domDispose = mountMapPanel(layer, view, undefined);
  domScene = scene;
  domScene.events.on(SCENE_PAUSE, pauseDomPanel);
  domScene.events.on(SCENE_RESUME, resumeDomPanel);
}

export const descriptor: RoutePanelDescriptor = {
  id: 'map',
  order: 10,
  hudPanel: 'header',
  build(host: RoutePanelHost): void {
    buildDom(host);
  },
  refresh(): void {
    repaintDomPanel();
  },
  close(): void {
    disposeDomPanel();
  },
};
