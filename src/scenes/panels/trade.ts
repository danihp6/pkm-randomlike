import { signal, type Signal } from '@preact/signals';
import { getSpecies } from '../../data/dex/species';
import type { KeybindAction } from '../../data/keybinds';
import { portraitFor } from '../../data/portraits';
import type { RoomView } from '../../engine/maps';
import {
  canTrade,
  isItemPicked,
  tradeId,
  tradePokemon,
  type RunPokemon,
  type RunState,
} from '../../engine/run';
import { t } from '../../i18n';
import {
  mountTradePanel,
  tradePanelView,
  type TradeInput,
  type TradeIntent,
  type TradePanelView,
} from '../../ui/hud/panels/trade';
import type { RoomHost, RoomPanel } from '../rooms/types';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The trade card's scene-side owner (`D33`/`D47`/`D49`): the room's counter opens it,
 * this module mounts it. The card is the board's `03i`/`03j` one, mounted into `#hud`
 * from `src/ui/hud/panels/trade/`. The **rule** stays in `src/engine/run/trade.ts`:
 * this module holds the card's own state (the selection, the line and the received
 * member) and is the only writer, through one `tradePokemon` call and one
 * `commitRun` per landed trade.
 */

/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this folder's modules
 * never import Phaser as a value. A paused route (a battle over it, the Settings
 * screen) hides the DOM card; the resume gives it back as it was.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';
/** The scene's own teardown: the DOM card is outside Phaser and must be unmounted. */
const SCENE_SHUTDOWN = 'shutdown';

/**
 * The hosts this card can open on: the room's own `RoomHost`, and the scene's
 * `RoutePanelHost` (the card's registry entry and the dev route's panel layer), which
 * has no room view — its room id then falls back to the route's own index.
 */
export type TradeCardHost = RoomHost | RoutePanelHost;

type TradeRow = Readonly<{ kind: 'member'; memberId: string }> | Readonly<{ kind: 'leave' }>;

/** The card's session: the host, the view signal and the mount's disposer. */
let cardHost: TradeCardHost | null = null;
let cardView: Signal<TradePanelView> | null = null;
let cardDispose: (() => void) | null = null;
let cardUnsubscribe: (() => void) | null = null;
/** The selection, the line and the received member are this module's own state. */
let cardIndex = 0;
let cardKind: 'pick' | 'result' = 'pick';
let cardMessage = '';
let cardReceived: TradeInput['received'] = null;
let cardPaused = false;

/** The number of display objects the card draws in Phaser: none, it is the DOM card. */
export function tradeDrawnObjectCount(): number {
  return 0;
}

/** The live run of either host: `RoomHost` carries it, `RoutePanelHost` reads it. */
function runOf(host: TradeCardHost): RunState {
  const value: unknown = (host as { run?: unknown }).run;
  return typeof value === 'function' ? (value as () => RunState)() : (host as RoomHost).run;
}

/** The room's stable identity: the view's own ids, or the route's index off a room. */
function roomOf(host: TradeCardHost): Readonly<{ mapIndex: number; roomId: number }> {
  const view = (host as { view?: RoomView }).view;
  if (view !== undefined) return { mapIndex: view.mapIndex, roomId: view.roomId };
  return { mapIndex: host.route().routeIndex, roomId: 0 };
}

/** The name a member reads by: its nickname, else the dex name, else the id. */
function memberName(member: RunPokemon): string {
  return (
    member.fighter.nickname ?? getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId
  );
}

/** The dex portrait frame a member paints, or null when the atlas has no cell. */
function memberFrame(member: RunPokemon): number | null {
  return portraitFor(member.fighter.speciesId)?.frame ?? null;
}

/** The species' primary type, the one the result card's chip paints. */
function memberType(member: RunPokemon): string {
  return getSpecies(member.fighter.speciesId)?.types[0] ?? '';
}

/** The line the card opens with, in the room's three states. */
function openingMessage(host: TradeCardHost): string {
  const room = roomOf(host);
  const run = runOf(host);
  if (isItemPicked(run, tradeId(room.mapIndex, room.roomId))) return t('trade.used');
  return canTrade(run) ? t('trade.greeting') : t('trade.refused');
}

/** The input the pure view reads, from the live run and this module's own state. */
function cardInput(host: TradeCardHost): TradeInput {
  const run = runOf(host);
  const room = roomOf(host);
  return {
    kind: cardKind,
    message: cardMessage,
    canTrade: canTrade(run) && !isItemPicked(run, tradeId(room.mapIndex, room.roomId)),
    party: run.party.map((member) => ({
      memberId: member.fighter.id,
      name: memberName(member),
      level: member.fighter.level,
      frame: memberFrame(member),
      selected: false,
      box: { x: 0, y: 0, w: 0, h: 0 },
    })),
    pc: run.box.map((member) => ({
      memberId: member.fighter.id,
      name: memberName(member),
      frame: memberFrame(member),
      box: { x: 0, y: 0, w: 0, h: 0 },
    })),
    selected: cardIndex,
    partyCount: run.party.length,
    pcCount: run.box.length,
    received: cardReceived,
    open: !cardPaused,
  };
}

/** The view's viewport: the scene's own window, which the card is centred in. */
function viewportOf(host: TradeCardHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

/** True while the route is paused behind another scene; a stub scene has no clock. */
function isPaused(host: TradeCardHost): boolean {
  const sys = (host.scene as { sys?: { isPaused?: () => boolean } }).sys;
  return typeof sys?.isPaused === 'function' ? sys.isPaused() : false;
}

/**
 * The rows the card offers right now: the live party, or the single LEAVE row of a
 * room that already traded or holds one member.
 */
function rows(host: TradeCardHost): readonly TradeRow[] {
  const room = roomOf(host);
  const run = runOf(host);
  if (isItemPicked(run, tradeId(room.mapIndex, room.roomId)) || !canTrade(run)) {
    return [{ kind: 'leave' }];
  }
  const members: TradeRow[] = run.party.map((member) => ({
    kind: 'member',
    memberId: member.fighter.id,
  }));
  return [...members, { kind: 'leave' }];
}

/** The member the current selection names, or null on the card's LEAVE row. */
function selectedMember(host: TradeCardHost): string | null {
  const row = rows(host)[cardIndex];
  return row !== undefined && row.kind === 'member' ? row.memberId : null;
}

/**
 * Opens the card for this room: the `#hud` mount, always. A second press while a card
 * is up is the card's, never a rebuild.
 */
export function openTradeCard(host: TradeCardHost): void {
  if (host.panelOpen()) return;
  closeTradeCard();
  cardHost = host;
  cardIndex = 0;
  cardKind = 'pick';
  cardReceived = null;
  cardMessage = openingMessage(host);
  cardPaused = isPaused(host);
  mountCard(host);
  host.openPanel(PANEL);
}

/** Repaints the card from the live run; the selection, the line and the kind stay. */
export function pushTradeCard(host: TradeCardHost): void {
  const view = cardView;
  if (view === null) return;
  cardHost = host;
  view.value = tradePanelView(cardInput(host), viewportOf(host));
}

/** Tears the card down: the scene subscription, the mount, the window and the state. */
export function closeTradeCard(): void {
  cardUnsubscribe?.();
  cardUnsubscribe = null;
  cardDispose?.();
  cardDispose = null;
  cardView = null;
  cardHost = null;
  cardIndex = 0;
  cardKind = 'pick';
  cardMessage = '';
  cardReceived = null;
  cardPaused = false;
}

/** Opens the DOM card: the signal, the `#hud` mount and the scene's own beats. */
function mountCard(host: TradeCardHost): void {
  const painted = signal(tradePanelView(cardInput(host), viewportOf(host)));
  cardView = painted;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null) {
    cardDispose = mountTradePanel(layer, painted, (intent) => handleTradeIntent(host, intent));
  }
  const events = host.scene.events;
  const onPause = (): void => setCardPaused(true);
  const onResume = (): void => setCardPaused(false);
  const onShutdown = (): void => closeTradeCard();
  events.on(SCENE_PAUSE, onPause);
  events.on(SCENE_RESUME, onResume);
  events.on(SCENE_SHUTDOWN, onShutdown);
  cardUnsubscribe = () => {
    events.off(SCENE_PAUSE, onPause);
    events.off(SCENE_RESUME, onResume);
    events.off(SCENE_SHUTDOWN, onShutdown);
  };
}

/** A paused route's card goes `open: false` and comes back as it was. */
function setCardPaused(paused: boolean): void {
  if (cardPaused === paused) return;
  cardPaused = paused;
  const host = cardHost;
  if (host !== null) pushTradeCard(host);
}

/** One press, in the card's own command channel: the one place anything is written. */
function handleTradeIntent(host: TradeCardHost, intent: TradeIntent): void {
  switch (intent.type) {
    case 'pick': {
      const total = runOf(host).party.length;
      cardIndex = total === 0 ? -1 : Math.min(Math.max(Math.trunc(intent.index) || 0, 0), total - 1);
      break;
    }
    case 'give': {
      const memberId = selectedMember(host);
      if (memberId !== null) give(host, memberId);
      return;
    }
    case 'close': {
      host.closePanel();
      return;
    }
    default:
      return;
  }
  pushTradeCard(host);
}

/**
 * The one write: `tradePokemon` once, then `commitRun` once on a landing. A refusal
 * prints the shipped line and changes nothing.
 */
function give(host: TradeCardHost, memberId: string): void {
  const room = roomOf(host);
  const result = tradePokemon(runOf(host), {
    memberId,
    mapIndex: room.mapIndex,
    roomId: room.roomId,
  });
  if (!result.ok) {
    cardMessage =
      result.reason === 'used'
        ? t('trade.used')
        : result.reason === 'single-member'
          ? t('trade.refused')
          : t('trade.missing');
    repaint(host);
    return;
  }
  host.commitRun(result.run);
  cardMessage = t('trade.done', { name: memberName(result.received) });
  cardIndex = 0;
  cardKind = 'result';
  cardReceived = {
    name: memberName(result.received),
    level: result.received.fighter.level,
    type: memberType(result.received),
    frame: memberFrame(result.received),
  };
  repaint(host);
}

/** Repaints the mounted card. */
function repaint(host: TradeCardHost): void {
  pushTradeCard(host);
}

/** The card's keys: move the cursor, trade on confirm, close on cancel. */
function handleTradeAction(host: TradeCardHost, action: KeybindAction): void {
  switch (action) {
    case 'up':
      moveCard(host, -1);
      return;
    case 'down':
      moveCard(host, 1);
      return;
    case 'confirm':
    case 'interact':
      activate(host);
      return;
    case 'cancel':
      host.closePanel();
      return;
    default:
      return;
  }
}

/** Steps the selection through the rows, so the LEAVE row stays reachable. */
function moveCard(host: TradeCardHost, delta: number): void {
  const total = rows(host).length;
  if (total === 0) return;
  cardIndex = (cardIndex + delta + total) % total;
  repaint(host);
}

/** Takes the selected member, or closes the card on the shipped window's LEAVE. */
function activate(host: TradeCardHost): void {
  const memberId = selectedMember(host);
  if (memberId === null) {
    host.closePanel();
    return;
  }
  give(host, memberId);
}

/** The card as the scene holds it: one panel, keyed while it owns the keyboard. */
const PANEL: RoomPanel = {
  handle(action) {
    const host = cardHost;
    if (!host) return;
    handleTradeAction(host, action);
  },
  close() {
    closeTradeCard();
  },
};

export const descriptor: RoutePanelDescriptor = {
  id: 'trade',
  order: 90,
  // The card belongs to the room's counter and mounts its own DOM card on open, so
  // the registry only names the panel: there is nothing to build here.
  build(): void {
    return;
  },
};
