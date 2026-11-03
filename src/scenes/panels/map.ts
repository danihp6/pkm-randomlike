import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import { planRegion, type RegionPlan } from '../../engine/region/plan';
import { reduceHudCommand, type HudCommand } from '../../ui/hud/commands';
import { mapPanelView, mountMapPanel, type MapPanelView } from '../../ui/hud/panels/map';
import { regionMapView } from '../../ui/regionMap';
import { panelExpanded, panelFrameMount } from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The route header, which **is** the region map (`docs/region-spec.md` §5, `D64`): the
 * current settlement's name and the run's badges over the plan's node graph, one panel
 * in the free top-left corner. The plan is pure and cheap but not free, so it is built
 * once per seed and kept here; every repaint only reads it.
 *
 * The card is the Preact panel in `src/ui/hud/panels/map/` and this module draws none
 * of it: the region view is pure (`regionMapView`), the card's view is pure
 * (`mapPanelView`), and `refresh` feeds the panel's signal. `#hud` is a DOM layer above
 * the canvas, so while the route is paused under a battle or the Settings screen the
 * mount hides the card and brings it back as it was on `RESUME`.
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
/**
 * The region plan, keyed by the run seed. A seed change is a new run, so the cache is
 * cleared rather than grown: one region is ever alive in a scene.
 */
const planCache = new Map<string, RegionPlan>();

/** The plan of `seed`, built once and kept until the run's seed changes. */
function planFor(seed: string): RegionPlan {
  const cached = planCache.get(seed);
  if (cached !== undefined) return cached;
  planCache.clear();
  const plan = planRegion(seed);
  planCache.set(seed, plan);
  return plan;
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
 * The card as data: the region graph and the panel record's own open state. It is the
 * one emit point of the DOM panel — the scene owns the run and the plan, the Preact
 * card paints them.
 */
function mapDomView(host: RoutePanelHost): MapPanelView {
  const plan = planFor(host.run().seed);
  const view = mapPanelView(regionMapView(plan, host.run()), viewport(host));
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
 * The card's own command seam: a press on a node marker is a flight, and the scene —
 * not the card — decides whether the run may make it.
 */
function dispatchHudCommand(host: RoutePanelHost, command: HudCommand): void {
  const intent = reduceHudCommand(command);
  if (intent !== null && intent.kind === 'node') host.flyToNode(intent.key);
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
  if (layer !== null)
    domDispose = mountMapPanel(
      layer,
      view,
      (command) => dispatchHudCommand(host, command),
      panelFrameMount(host, 'header'),
    );
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
