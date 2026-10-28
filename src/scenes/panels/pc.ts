import { signal, type Signal } from '@preact/signals';
import { pcMemberEditable, withdrawToParty, type RunState } from '../../engine/run';
import {
  BOX_PAGE_SIZE,
  boxPageCount,
  boxPageForIndex,
  boxRows,
  ripRows,
  type PartyRow,
} from '../../ui/partyScreen';
import type { HudCommand } from '../../ui/hud/commands';
import {
  initialPcPanelUi,
  mountPcPanel,
  pcPanelView,
  type PcPane,
  type PcPanelView,
  type PcRow,
} from '../../ui/hud/panels/pc';
import { panelExpanded, toggleHudPanel } from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The PC BOX window: a page-tab strip over a grid of avatar cells, plus the RIP
 * tab that shows the fallen.
 *
 * The box is the Preact panel in `src/ui/hud/panels/pc/`: this module keeps the
 * shipped rules (the page follows the cursor, a press withdraws a box member through
 * `withdrawToParty`, the RIP list stays read-only) but draws no Phaser object at all,
 * and feeds the panel's view from its own state.
 */

/** The page cap the card's own tab strip carries. */
const HUD_BOX_MAX_PAGES = 7;

/** The DOM panel's view and the mount's disposer. */
let pcView: Signal<PcPanelView> | null = null;
let pcDispose: (() => void) | null = null;
/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because a panel module never
 * imports Phaser as a value. The route pauses itself for a battle and for the
 * Settings screen; a DOM root sits above the canvas, so it has to hide itself.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';
/** True while the route scene is paused: the DOM root is hidden then. */
let pcPaused = false;
let pcUnsubscribeScene: (() => void) | null = null;

/** The number of display objects the PC draws in Phaser: none, it is the DOM card. */
export function pcDrawnObjectCount(): number {
  return 0;
}

/** The view's viewport: the scene's own window, as the HUD metrics see it. */
function viewport(host: RoutePanelHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

/** One box/RIP row as the panel draws it; the box's lock is the shipped dimming. */
function pcRow(run: RunState, pane: PcPane, row: PartyRow): PcRow {
  return {
    memberId: row.id,
    name: row.name,
    level: row.level,
    hp: row.hp,
    maxHp: row.maxHp,
    statusLabel: row.statusLabel,
    locked: pane === 'box' && !pcMemberEditable(run),
  };
}

/**
 * The one emit point of the DOM panel: the scene owns the run and the pane, the
 * panel paints them. `open` is the frame machinery's, not the box's own state, so
 * it is stamped here after the pure projection.
 */
function refreshDom(host: RoutePanelHost): void {
  const view = pcView;
  if (view === null) return;
  const run = host.run();
  const ui = host.ui();
  const pane: PcPane = ui.pane === 'rip' ? 'rip' : 'box';
  const rows = (pane === 'rip' ? ripRows(run) : boxRows(run)).map((row) => pcRow(run, pane, row));
  const pageCount = boxPageCount(rows.length);
  const page = Math.min(boxPageForIndex(ui.index), pageCount - 1);
  view.value = {
    ...pcPanelView(rows, { pane, page, cursor: ui.index }, pageCount, viewport(host)),
    open: !pcPaused && panelExpanded(host, 'box'),
  };
}

/** The route paused (a battle over it, or the Settings screen): the panel follows. */
function setDomPaused(host: RoutePanelHost, paused: boolean): void {
  if (pcPaused === paused) return;
  pcPaused = paused;
  refreshDom(host);
}

/** Drops the scene's pause/resume subscription; the route is going away. */
function unsubscribeScene(): void {
  pcUnsubscribeScene?.();
  pcUnsubscribeScene = null;
  pcPaused = false;
}

/** Subscribes the panel to the route's own pause and resume beats. */
function subscribeScene(host: RoutePanelHost): void {
  unsubscribeScene();
  const events = host.scene.events;
  const onPause = (): void => setDomPaused(host, true);
  const onResume = (): void => setDomPaused(host, false);
  events.on(SCENE_PAUSE, onPause);
  events.on(SCENE_RESUME, onResume);
  pcUnsubscribeScene = () => {
    events.off(SCENE_PAUSE, onPause);
    events.off(SCENE_RESUME, onResume);
  };
}

/** Turns the DOM's page tabs and wheel into a page step: the page follows the cursor. */
function stepDomPage(host: RoutePanelHost, delta: number): void {
  const run = host.run();
  const ui = host.ui();
  const rows = ui.pane === 'rip' ? ripRows(run) : boxRows(run);
  const pages = Math.max(1, Math.min(HUD_BOX_MAX_PAGES, boxPageCount(rows.length)));
  const from = Math.min(boxPageForIndex(ui.index), pages - 1);
  const to = Math.max(0, Math.min(pages - 1, from + delta));
  if (to === from) return;
  const index = Math.min(to * BOX_PAGE_SIZE, Math.max(0, rows.length - 1));
  host.setUi({ ...ui, index });
  host.refreshHud();
}

/** Shows the box window's other list (`'rip'` or back to `'box'`). */
function setHudBoxPane(host: RoutePanelHost, pane: 'box' | 'rip'): void {
  if (host.ui().pane !== pane) host.setUi({ pane, index: 0, grabbed: null });
  host.refreshHud();
}

/**
 * A press on a box cell: the cursor follows the press, and a box member the run's
 * rules allow is withdrawn into the party — the shipped rule (`withdrawToParty`),
 * never a copy of it. The RIP list stays read-only.
 */
function pressDomCell(host: RoutePanelHost, memberId: string): void {
  const run = host.run();
  const ui = host.ui();
  const pane: PcPane = ui.pane === 'rip' ? 'rip' : 'box';
  const rows = pane === 'rip' ? ripRows(run) : boxRows(run);
  const index = rows.findIndex((row) => row.id === memberId);
  if (index < 0) return;
  if (ui.index !== index) host.setUi({ ...ui, index });
  if (pane !== 'box' || !pcMemberEditable(run)) {
    host.refreshHud();
    return;
  }
  const next = withdrawToParty(run, index);
  if (next !== run) host.commitRun(next);
  else host.refreshHud();
}

/**
 * The DOM panel's command vocabulary, resolved here and nowhere else: the key chip
 * asks for the panel toggle, a cell for a member, the page tabs and the wheel for a
 * left/right page step, and the RIP tab for a confirm (it selects that list).
 */
function handleDomCommand(host: RoutePanelHost, command: HudCommand): void {
  // A paused route takes no command from the DOM: the root is hidden and its own
  // key neither toggles now nor queues a toggle for the resume.
  if (pcPaused) return;
  switch (command.type) {
    case 'panel':
      if (command.panel === 'box') toggleHudPanel(host, 'box');
      return;
    case 'member':
      pressDomCell(host, command.memberId);
      return;
    case 'press':
      if (command.action === 'left' || command.action === 'right') {
        stepDomPage(host, command.action === 'right' ? 1 : -1);
      } else if (command.action === 'confirm') {
        setHudBoxPane(host, host.ui().pane === 'rip' ? 'box' : 'rip');
      }
      return;
    default:
      return;
  }
}

function disposeDomPanel(): void {
  if (pcDispose === null) return;
  pcDispose();
  pcDispose = null;
}

/** The card's build: the view signal, the `#hud` mount and the route's own beats. */
function buildDom(host: RoutePanelHost): void {
  disposeDomPanel();
  const view = signal(pcPanelView([], initialPcPanelUi(), 1, viewport(host)));
  pcView = view;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null)
    pcDispose = mountPcPanel(layer, view, (command) => handleDomCommand(host, command));
  subscribeScene(host);
  refreshDom(host);
}

/** Disposes the DOM panel and clears the box's module state. */
function closeDom(): void {
  unsubscribeScene();
  disposeDomPanel();
  pcView = null;
}

export const descriptor: RoutePanelDescriptor = {
  id: 'pc',
  order: 50,
  hudPanel: 'box',
  build(host: RoutePanelHost): void {
    buildDom(host);
  },
  refresh(host: RoutePanelHost): void {
    refreshDom(host);
  },
  close(): void {
    closeDom();
  },
};
