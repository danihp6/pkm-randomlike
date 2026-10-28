import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import { getBiome } from '../../data/biomes';
import { getMission } from '../../data/missions';
import { t } from '../../i18n';
import {
  mountNoticesPanel,
  noticesPanelView,
  type NoticesInput,
  type NoticesPanelView,
} from '../../ui/hud/panels/notices';
import { areaEntryNotice, type Notice } from '../../ui/notice';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The route's transient cards: the notice strip, the area-entry banner and the
 * floor's mission line. All three are screen-space, take no key and block nothing,
 * so the route keeps walking under them.
 *
 * The three are the board's cards in the `#hud` layer — `src/ui/hud/panels/notices/`
 * — and this module builds no Phaser object: it owns the lines and their holds.
 */

/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME` / `SHUTDOWN`, spelled out because this
 * folder's modules never import Phaser as a value. A paused route sits under the DOM
 * root, which has to hide itself; the resume brings the stack back.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';
const SCENE_SHUTDOWN = 'shutdown';

/** The mounted DOM card: its host, its view, its mount and the scene events it follows. */
let domHost: RoutePanelHost | null = null;
let domView: Signal<NoticesPanelView> | null = null;
let domDispose: (() => void) | null = null;
let domSceneEvents: Phaser.Events.EventEmitter | null = null;
/** The three lines this module handed the card, kept while the route is paused. */
let domNotice: string | null = null;
let domArea: string | null = null;
let domMission: string | null = null;
/** True while a battle or the Settings screen covers the route. */
let domPaused = false;
/** The card's own holds: the shipped `holdMs`, on the scene's clock like the strip's. */
let domNoticeTimer: Phaser.Time.TimerEvent | null = null;
let domAreaTimer: Phaser.Time.TimerEvent | null = null;

/** The view's viewport: the scene's own window, which the cards are centred in. */
function viewport(host: RoutePanelHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

/** The lines the card floats: a paused route floats none of them. */
function domInput(): NoticesInput {
  return {
    notice: domPaused ? null : domNotice,
    area: domPaused ? null : domArea,
    mission: domPaused ? null : domMission,
  };
}

/** One assignment, one paint: the card's only emit point. */
function paintDomNotices(): void {
  const view = domView;
  const host = domHost;
  if (view === null || host === null) return;
  view.value = noticesPanelView(domInput(), viewport(host));
}

/**
 * Mounts the three cards into `#hud` and subscribes to the scene's pause, resume and
 * shutdown. A missing layer mounts nothing, exactly as the shipped DOM panels guard
 * it; the signal still exists, so the module's own calls stay total.
 */
function buildDomNotices(host: RoutePanelHost): void {
  domHost = host;
  // `create()` runs before the scene reports active, so only a real pause counts.
  domPaused = host.scene.sys.isPaused();
  const view = signal(noticesPanelView(domInput(), viewport(host)));
  domView = view;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null) domDispose = mountNoticesPanel(layer, view);
  const events = host.scene.events;
  domSceneEvents = events;
  events.on(SCENE_PAUSE, onScenePause);
  events.on(SCENE_RESUME, onSceneResume);
  events.on(SCENE_SHUTDOWN, disposeDomNotices);
}

/** A battle or the Settings screen covers the route: the paused stack floats nothing. */
function onScenePause(): void {
  domPaused = true;
  paintDomNotices();
}

/** The route is back on top: the lines it was showing return. */
function onSceneResume(): void {
  domPaused = false;
  paintDomNotices();
}

/** Tears the mount down: the scene subscription, the disposer and the held lines. */
function disposeDomNotices(): void {
  if (domSceneEvents !== null) {
    domSceneEvents.off(SCENE_PAUSE, onScenePause);
    domSceneEvents.off(SCENE_RESUME, onSceneResume);
    domSceneEvents.off(SCENE_SHUTDOWN, disposeDomNotices);
    domSceneEvents = null;
  }
  domNoticeTimer?.remove(false);
  domNoticeTimer = null;
  domAreaTimer?.remove(false);
  domAreaTimer = null;
  domDispose?.();
  domDispose = null;
  domView = null;
  domHost = null;
  domNotice = null;
  domArea = null;
  domMission = null;
  domPaused = false;
}

/** Takes the transient notice down and repaints; safe when it is not up. */
function hideDomNotice(): void {
  domNoticeTimer?.remove(false);
  domNoticeTimer = null;
  domNotice = null;
  paintDomNotices();
}

/** Takes the area banner down and repaints; safe when it is not up. */
function hideDomArea(): void {
  domAreaTimer?.remove(false);
  domAreaTimer = null;
  domArea = null;
  paintDomNotices();
}

/**
 * Floats one transient notice. One at a time: a second notice replaces the first
 * and restarts its hold. Nothing is blocked and no key is consumed.
 */
export function showNotice(host: RoutePanelHost, notice: Notice): void {
  domNotice = notice.text;
  paintDomNotices();
  domNoticeTimer?.remove(false);
  domNoticeTimer = host.scene.time.delayedCall(notice.holdMs, () => hideDomNotice());
}

/**
 * Names the area the run just walked into. No key, no scroll, no pause: the
 * banner is the room's greeting and the walk goes on under it. A no-op until the
 * card is built and the scene has a route, so `applyRoute` may raise it during
 * `create`.
 */
export function showAreaPanel(host: RoutePanelHost): void {
  const route = host.route();
  if (!route) return;
  const notice = areaEntryNotice(getBiome(route.biomeId).name);
  domArea = notice.text;
  paintDomNotices();
  domAreaTimer?.remove(false);
  domAreaTimer = host.scene.time.delayedCall(notice.holdMs, () => hideDomArea());
}

/**
 * The floor's own objective: one line under the notice strip, and nothing at
 * all when the run carries no mission row (an old save's `null`).
 */
function refreshNotices(host: RoutePanelHost): void {
  const run = host.run();
  const mission = run.mission ? getMission(run.mission.id) : undefined;
  domMission = mission === undefined ? null : t('hud.mission', { mission: t(mission.nameKey) });
  paintDomNotices();
}

/** The number of display objects the three cards draw in Phaser: none, they are the DOM panel's. */
export function noticesDrawnObjectCount(): number {
  return 0;
}

export const descriptor: RoutePanelDescriptor = {
  id: 'notices',
  order: 60,
  build(host: RoutePanelHost): void {
    disposeDomNotices();
    buildDomNotices(host);
  },
  refresh: refreshNotices,
  // The card lives outside Phaser, so the scene's teardown has to unmount it.
  close(): void {
    disposeDomNotices();
  },
};
