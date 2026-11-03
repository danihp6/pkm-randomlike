import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import { activeMissions } from '../../engine/region/missions';
import { nodeOf, planRegion } from '../../engine/region/plan';
import type { RunState } from '../../engine/run';
import { t } from '../../i18n';
import {
  mountMissionsPanel,
  missionsPanelView,
  type MissionsInput,
  type MissionsPanelView,
} from '../../ui/hud/panels/missions';
import { panelExpanded, panelFrameMount } from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The node's missions, as a card: the stack the run stands on — its stretch's automatic
 * mission, its city's fixed one and the random row an NPC offers — one row each, in the
 * engine's own order (`docs/region-spec.md` §7.10, `D58`).
 *
 * The card is the Preact panel in `#hud` and this module draws none of it: it resolves
 * the strings the panel prints, mounts the card in the shared frame (the chip, the drag
 * and the saved slot) and repaints it on every `refresh`. No press comes back from it —
 * the only interaction the card has is the frame's own chip.
 */

/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this folder's modules
 * import Phaser type-only: the route stops under a battle or the Settings screen.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';

let domView: Signal<MissionsPanelView> | null = null;
let domDispose: (() => void) | null = null;
let domHost: RoutePanelHost | null = null;
let domScene: Phaser.Scene | null = null;
/** True while a battle or the Settings screen covers the route. */
let routePaused = false;

/** The card's data from the run: every row of the node's stack, with its status word. */
export function missionsInput(run: RunState, open: boolean): MissionsInput {
  const plan = planRegion(run.seed);
  const tag = t('hud.missionsBadge', { badge: nodeOf(plan, run.nodeKey)?.badge ?? 1 });
  const missions = activeMissions(run, plan).map((mission) => ({
    id: mission.id,
    scopeKey: mission.scopeKey,
    name: t(mission.nameKey),
    tag,
    progress:
      mission.status === 'active'
        ? null
        : t(mission.status === 'met' ? 'hud.missionsMet' : 'hud.missionsFailed'),
    status: mission.status,
  }));
  return {
    open,
    title: t('hud.missions'),
    missions,
    empty: t('hud.missionsEmpty'),
  };
}

function viewport(host: RoutePanelHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

/** The view the DOM paints: the node's rows plus the card's own open state. */
function missionsView(host: RoutePanelHost): MissionsPanelView {
  const open = !routePaused && panelExpanded(host, 'missions');
  return missionsPanelView(missionsInput(host.run(), open), viewport(host));
}

function repaintDomPanel(): void {
  if (domView === null || domHost === null) return;
  domView.value = missionsView(domHost);
}

function pauseDomPanel(): void {
  routePaused = true;
  repaintDomPanel();
}

function resumeDomPanel(): void {
  routePaused = false;
  repaintDomPanel();
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

function mountDomPanel(host: RoutePanelHost): void {
  disposeDomPanel();
  if (typeof document === 'undefined') return;
  const layer = document.getElementById('hud');
  if (layer === null) return;
  const view = signal(missionsView(host));
  domView = view;
  domHost = host;
  domDispose = mountMissionsPanel(layer, view, panelFrameMount(host, 'missions'));
  domScene = host.scene;
  domScene.events.on(SCENE_PAUSE, pauseDomPanel);
  domScene.events.on(SCENE_RESUME, resumeDomPanel);
}

function refreshMissions(host: RoutePanelHost): void {
  if (domView !== null) domView.value = missionsView(host);
}

export const descriptor: RoutePanelDescriptor = {
  id: 'missions',
  order: 65,
  hudPanel: 'missions',
  build(host: RoutePanelHost): void {
    mountDomPanel(host);
  },
  refresh: refreshMissions,
  close(): void {
    disposeDomPanel();
  },
};
