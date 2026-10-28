import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import itemIcons from '../../data/anil/item-icons.json';
import { ITEM_ICON_ATLAS_URL, ITEM_ICON_SIZE, itemIconFrame } from '../../data/itemIcons';
import { getItem } from '../../data/items';
import { keyLabel } from '../../data/keybinds';
import { candyTreat } from '../../engine/run/items';
import { t } from '../../i18n';
import { itemText } from '../../i18n/content';
import type { HudCommand } from '../../ui/hud/commands';
import {
  bagPanelView,
  initialBagPanelUi,
  mountBagPanel,
  type BagPanelUi,
  type BagPanelView,
  type BagPocket,
  type SpriteCell,
} from '../../ui/hud/panels/bag';
import { projectHud } from '../../ui/hud/state';
import { bagDiscoveredCandy } from '../../ui/bag';
import { statLabel } from '../../ui/partyDetail';
import { panelExpanded, panelFrameMount, toggleHudPanel } from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The bag window: the pocket tabs over the filter field, the five-column grid of
 * item stacks and the footer that holds the run's Poké Dollars, plus the card that
 * describes the selected stack. A press only selects; the run is never written here.
 *
 * The card is the Preact panel in the `#hud` layer and this module draws none of it:
 * it owns the pocket, the cursor and the query, and the mount paints them.
 */

/** The item atlas' columns (`src/data/anil/item-icons.json`), for the sprite offsets. */
const ITEM_ICON_COLS: number = itemIcons.cols;

/** The mounted DOM panel: its host, its state, its view and its disposer. */
let domHost: RoutePanelHost | null = null;
let domHostElement: HTMLElement | null = null;
let domUi: BagPanelUi = initialBagPanelUi();
let domView: Signal<BagPanelView> | null = null;
let domDispose: (() => void) | null = null;
let domSearchFocused = false;
/** The scene events the DOM mount follows, so `close()` can drop them again. */
let domSceneEvents: Phaser.Events.EventEmitter | null = null;
/** True while the route is paused behind a battle or the settings screen. */
let domScenePaused = false;

/** The number of display objects the bag draws in Phaser: none, it is the DOM card. */
export function bagDrawnObjectCount(): number {
  return 0;
}

/** True while the bag's filter field owns the keyboard. */
export function bagTextFieldFocused(): boolean {
  return domSearchFocused;
}

/**
 * Routes a key into the bag's filter field while it holds focus. The native input
 * owns the text: every key is consumed while it has focus and the query is mirrored
 * from its `input` event, never edited here. Escape and Enter leave the field, as
 * the retired canvas one did.
 */
export function typeInBagSearch(_host: RoutePanelHost, event: KeyboardEvent): boolean {
  const focused = domSearchFocused;
  if (focused && (event.key === 'Escape' || event.key === 'Enter')) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('[data-hud-bag="search"]') !== null) {
      active.blur();
    }
    domSearchFocused = false;
  }
  return focused;
}

/**
 * The card's two lines: the item's English name (`D43`), then its body through
 * `itemText`, or the run's own candy treat once its colour has been discovered.
 */
export function bagInfoFor(host: RoutePanelHost, itemId: string): string {
  const run = host.run();
  const item = getItem(itemId);
  const name = item?.name ?? itemId;
  const body = itemText(itemId) || item?.shortDesc || '';
  const colour = bagDiscoveredCandy(itemId, run.discoveredCandy);
  if (colour === null) return `${name}\n${body}`;
  const treat = candyTreat(run.seed, colour);
  const delta = treat.delta > 0 ? '+1' : '-1';
  return `${name}\n${t('hud.candyKnown', { stat: statLabel(treat.stat), delta })}`;
}

/** The atlas cell for an item, as the panel's `background-position` pair. */
function bagSprite(itemId: string): SpriteCell | null {
  const frame = itemIconFrame(itemId);
  if (frame === null) return null;
  return {
    url: ITEM_ICON_ATLAS_URL,
    size: ITEM_ICON_SIZE,
    x: (frame % ITEM_ICON_COLS) * ITEM_ICON_SIZE,
    y: Math.floor(frame / ITEM_ICON_COLS) * ITEM_ICON_SIZE,
  };
}

function isPocket(value: string | null): value is BagPocket {
  return (
    value === 'equipment' ||
    value === 'consumable' ||
    value === 'machine' ||
    value === 'ball' ||
    value === 'valuable'
  );
}

/**
 * The view the DOM panel paints. `HudState` carries neither the item's description
 * nor the quick-key letter, so the two strings the panel prints are filled here:
 * this module is the only holder of the run and the settings.
 */
function domViewFor(host: RoutePanelHost): BagPanelView {
  const state = projectHud({ screen: 'route', run: host.run(), notice: null });
  const viewport = { width: host.scene.scale.width, height: host.scene.scale.height };
  const model = bagPanelView(state, domUi, viewport, bagSprite);
  const open = panelExpanded(host, 'bag') && !domScenePaused;
  const selected = model.tiles.find((piece) => piece.selected) ?? null;
  let text = '';
  if (open && model.info !== null && selected !== null && selected.itemId !== null) {
    // `bagInfoFor` prints the name on its first line (the retired card had one
    // text); the panel's title already carries it, so the body is the rest.
    const described = bagInfoFor(host, selected.itemId);
    const cut = described.indexOf('\n');
    text = cut < 0 ? described : described.slice(cut + 1);
  }
  return {
    ...model,
    open,
    chip: { ...model.chip, letter: keyLabel(host.settings().keybinds.bag) },
    info:
      open && model.info !== null && selected !== null && text !== '' ? { ...model.info, text } : null,
  };
}

function paintDomBag(): void {
  if (domHost === null || domView === null) return;
  domView.value = domViewFor(domHost);
}

/**
 * The cards live in the `#hud` layer **above** the canvas, so a paused route would
 * leave them floating over the battle or the settings screen that replaced it. The
 * mount hides through the same path the collapse uses, so it keeps its state and
 * its rect for the resume. The event names are `Phaser.Scenes.Events.PAUSE` and
 * `RESUME` spelled out: this folder's modules never import Phaser's value.
 */
function onScenePause(): void {
  domScenePaused = true;
  paintDomBag();
}

function onSceneResume(): void {
  domScenePaused = false;
  paintDomBag();
}

/** A press on a pocket tab or a stack: the panel's own cursor, never the run. */
function onDomClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('[data-hud-panel="bag"]') === null) return;
  const tab = target.closest('[data-hud-bag-tab]');
  if (tab !== null) {
    const pocket = tab.getAttribute('data-hud-bag-tab');
    if (isPocket(pocket)) {
      domUi = { pocket, cursor: 0, query: '' };
      paintDomBag();
    }
    return;
  }
  const cell = target.closest('[data-hud-bag-tile]');
  if (cell === null) return;
  const index = Number(cell.getAttribute('data-hud-bag-tile'));
  if (Number.isInteger(index) && index >= 0) {
    domUi = { ...domUi, cursor: index };
    paintDomBag();
  }
}

function onDomInput(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.closest('[data-hud-panel="bag"]') === null) return;
  domUi = { ...domUi, query: target.value };
  paintDomBag();
}

function onDomFocus(event: FocusEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('[data-hud-bag="search"]') === null) return;
  domSearchFocused = event.type === 'focusin';
}

function handleDomCommand(host: RoutePanelHost, command: HudCommand): void {
  if (command.type === 'panel' && command.panel === 'bag') toggleHudPanel(host, 'bag');
}

function mountDomBag(host: RoutePanelHost): void {
  disposeDomBag();
  domHost = host;
  const view = signal(domViewFor(host));
  domView = view;
  const events = host.scene.events;
  domSceneEvents = events;
  // `create()` runs before the scene reports active, so only a real pause counts.
  domScenePaused = host.scene.sys.isPaused();
  events.on('pause', onScenePause);
  events.on('resume', onSceneResume);
  const element = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (element === null) return;
  domHostElement = element;
  domDispose = mountBagPanel(
    element,
    view,
    (command) => handleDomCommand(host, command),
    panelFrameMount(host, 'bag'),
  );
  element.addEventListener('click', onDomClick);
  element.addEventListener('input', onDomInput);
  element.addEventListener('focusin', onDomFocus);
  element.addEventListener('focusout', onDomFocus);
}

function disposeDomBag(): void {
  if (domSceneEvents !== null) {
    domSceneEvents.off('pause', onScenePause);
    domSceneEvents.off('resume', onSceneResume);
    domSceneEvents = null;
  }
  domScenePaused = false;
  if (domHostElement !== null) {
    domHostElement.removeEventListener('click', onDomClick);
    domHostElement.removeEventListener('input', onDomInput);
    domHostElement.removeEventListener('focusin', onDomFocus);
    domHostElement.removeEventListener('focusout', onDomFocus);
    domHostElement = null;
  }
  domDispose?.();
  domDispose = null;
  domView = null;
  domHost = null;
  domUi = initialBagPanelUi();
  domSearchFocused = false;
}

function refreshBag(host: RoutePanelHost): void {
  if (host === domHost) paintDomBag();
}

export const descriptor: RoutePanelDescriptor = {
  id: 'bag',
  order: 40,
  hudPanel: 'bag',
  build(host: RoutePanelHost): void {
    mountDomBag(host);
  },
  refresh: refreshBag,
  close(): void {
    disposeDomBag();
  },
};
