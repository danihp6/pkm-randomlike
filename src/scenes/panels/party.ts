import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import { moveInParty, reorderParty } from '../../engine/run';
import type { HudCommand } from '../../ui/hud/commands';
import {
  initialPartyPanelUi,
  mountPartyPanel,
  partyPanelView,
  type PartyPanelUi,
  type PartyPanelView,
} from '../../ui/hud/panels/party';
import { projectHud } from '../../ui/hud/state';
import { panelExpanded, panelFrameMount, toggleHudPanel } from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The party window: the squad's six rows (portrait, name, status badge and HP bar)
 * under the shared level/XP line and the Pokevial bar.
 *
 * The card is the Preact panel in `#hud` and this module draws none of it:
 * `refresh` feeds the panel's signal and presses inside the panel come back as
 * `HudCommand`s, so the run is still only ever written here. `#hud` is a DOM layer
 * above the canvas, so while the route is paused under a battle or the Settings
 * screen the mount hides the card and brings it back as it was on `RESUME`.
 */

/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this folder imports
 * Phaser type-only: the route stops under a battle or the Settings screen and comes
 * back from it on these two.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';

/** The mounted DOM panel: the view it paints and its disposer. */
let domView: Signal<PartyPanelView> | null = null;
let domDispose: (() => void) | null = null;
/** The host the mount was built with, so a pause repaints without waiting for `refresh`. */
let domHost: RoutePanelHost | null = null;
/** The scene the mount listens to, so `close` can drop the subscription. */
let domScene: Phaser.Scene | null = null;
/**
 * True while the route is paused under another screen. `#hud` is a DOM layer **above**
 * the canvas, so a paused route's cards would float over the battle covering it; the
 * mount stays and only the view's `open` goes false, which is the collapse state.
 */
let routePaused = false;

/** The panel's own cursor: the party pane's index while it holds the cursor. */
function panelUi(host: RoutePanelHost): PartyPanelUi {
  const ui = host.ui();
  return ui.pane === 'party' ? { cursor: ui.index } : initialPartyPanelUi();
}

/** The view the DOM paints: the route projection plus the panel record's own open state. */
function partyView(host: RoutePanelHost): PartyPanelView {
  const state = projectHud({ screen: 'route', run: host.run(), notice: null });
  const view = partyPanelView(state, panelUi(host), {
    width: host.scene.scale.width,
    height: host.scene.scale.height,
  });
  return { ...view, open: !routePaused && panelExpanded(host, 'party') };
}

/** Repaints the mounted card from the live host, or nothing before the first mount. */
function repaintDomPanel(): void {
  if (domView === null || domHost === null) return;
  domView.value = partyView(domHost);
}

/** A battle or the Settings screen covers the route: the card goes with the paused HUD. */
function pauseDomPanel(): void {
  routePaused = true;
  repaintDomPanel();
}

/** The route is the screen on top again: the card returns as it was left. */
function resumeDomPanel(): void {
  routePaused = false;
  repaintDomPanel();
}

/**
 * A press inside the DOM card. A row makes that member the lead (`moveInParty`), a
 * no-op for the member already there; the chip toggles the panel exactly as `P`.
 * A paused route takes neither, so a press can never toggle behind the screen on top.
 */
function runPanelCommand(host: RoutePanelHost, command: HudCommand): void {
  if (routePaused) return;
  if (command.type === 'member') {
    const run = host.run();
    const index = run.party.findIndex((member) => member.fighter.id === command.memberId);
    if (index <= 0) return;
    const next = moveInParty(run, index, 0);
    if (next !== run) host.commitRun(next);
    return;
  }
  if (command.type === 'panel' && command.panel === 'party') toggleHudPanel(host, 'party');
}

/**
 * A drop inside the DOM card: the row picked up and the row it was released on.
 * The two members **swap** (`reorderParty`), so index 0 keeps meaning "the lead"
 * and the drop decides who opens the next battle. A paused route takes no drop,
 * for the same reason it takes no press.
 */
function runPanelReorder(host: RoutePanelHost, from: number, to: number): void {
  if (routePaused) return;
  const run = host.run();
  const next = reorderParty(run, from, to);
  if (next !== run) host.commitRun(next);
}

function disposeDomPanel(): void {
  if (domScene !== null) {
    domScene.events.off(SCENE_PAUSE, pauseDomPanel);
    domScene.events.off(SCENE_RESUME, resumeDomPanel);
    domScene = null;
  }
  routePaused = false;
  domHost = null;
  if (domDispose !== null) {
    domDispose();
    domDispose = null;
  }
  domView = null;
}

/** Mounts the card in the `#hud` layer; a missing layer mounts nothing. */
function mountDomPanel(host: RoutePanelHost): void {
  disposeDomPanel();
  if (typeof document === 'undefined') return;
  const layer = document.getElementById('hud');
  if (layer === null) return;
  const view = signal(partyView(host));
  domView = view;
  domHost = host;
  domDispose = mountPartyPanel(
    layer,
    view,
    (command) => runPanelCommand(host, command),
    (from, to) => runPanelReorder(host, from, to),
    panelFrameMount(host, 'party'),
  );
  domScene = host.scene;
  domScene.events.on(SCENE_PAUSE, pauseDomPanel);
  domScene.events.on(SCENE_RESUME, resumeDomPanel);
}

function refreshParty(host: RoutePanelHost): void {
  if (domView !== null) domView.value = partyView(host);
}

export const descriptor: RoutePanelDescriptor = {
  id: 'party',
  order: 20,
  hudPanel: 'party',
  build(host: RoutePanelHost): void {
    mountDomPanel(host);
  },
  refresh: refreshParty,
  close(): void {
    disposeDomPanel();
  },
};
