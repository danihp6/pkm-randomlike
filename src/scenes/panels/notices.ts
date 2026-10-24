import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import { getBiome } from '../../data/biomes';
import { getMission } from '../../data/missions';
import { t } from '../../i18n';
import { FRLG_ACCENT, addFrlgWindow } from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { parseHudFlags } from '../../ui/hud/fixtures';
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
 * Under `?hud=dom` (`D49`) the three are the board's cards in the `#hud` layer —
 * `src/ui/hud/panels/notices/` — and this module builds no Phaser object. The DOM
 * strip is the board's 56 px card (`03k`) at the safe-area top; with the flag off the
 * shipped 44 px strip is kept untouched, because switching it would move every
 * build the flag does not cover.
 */

/**
 * The transient notice strip (`src/ui/notice.ts`): a slim FRLG textbox pinned at
 * the top of the screen, narrowed when the viewport cannot hold its full width.
 */
const NOTICE_W = 720;
const NOTICE_H = 44;
const NOTICE_TOP = 24;

/** The floor's mission line (`docs/routes-spec.md` §6): one slim card under the notice strip. */
const MISSION_W = 360;
const MISSION_H = 32;
const MISSION_TOP = NOTICE_TOP + NOTICE_H + 8;

/**
 * The area-entry panel (`docs/routes-spec.md` §6, `src/ui/notice.ts`): the boxed
 * banner that greets the player on entering a room. It is the same `'window'`
 * card as the strip and the mission line, told apart by being boxed, taller,
 * lower and fringed in the accent — the one card whose 1px ring is the accent
 * instead of the muted hairline (`FRLG_ACCENT`'s "never a border of its own" is
 * the rule; this card is its frozen exception).
 */
const AREA_PANEL_W = 360;
const AREA_PANEL_H = 64;
const AREA_PANEL_TOP = MISSION_TOP + MISSION_H + 8;
/** Above the HUD's cards, below the mission line (439) and the notice strip (440). */
const AREA_PANEL_DEPTH = 438;

/**
 * `?hud=dom` read once, the way every scene module reads it. With the flag on this
 * module draws none of the three cards and the Preact panel paints them instead.
 */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;
/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME` / `SHUTDOWN`, spelled out because this
 * folder's modules never import Phaser as a value. A paused route sits under the DOM
 * root, which has to hide itself; the resume brings the stack back.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';
const SCENE_SHUTDOWN = 'shutdown';

/**
 * The transient notice strip at the top of the screen (`src/ui/notice.ts`): one
 * at a time, dismissed by its own timer, never blocking input.
 */
let noticeRoot: Phaser.GameObjects.Container | null = null;
let noticeText: Phaser.GameObjects.BitmapText | null = null;
let noticeTimer: Phaser.Time.TimerEvent | null = null;
/**
 * The area-entry panel: a boxed banner under the strip and the mission line,
 * raised on every room entry and dismissed by its own timer. It takes no key and
 * blocks nothing, so it is a card, not a window the run waits on.
 */
let areaPanelRoot: Phaser.GameObjects.Container | null = null;
let areaPanelText: Phaser.GameObjects.BitmapText | null = null;
let areaPanelTimer: Phaser.Time.TimerEvent | null = null;
let missionRoot: Phaser.GameObjects.Container | null = null;
let hudMissionText: Phaser.GameObjects.BitmapText | null = null;

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
/** The DOM card's own holds: the shipped `holdMs`, on the scene's clock like the strip's. */
let domNoticeTimer: Phaser.Time.TimerEvent | null = null;
let domAreaTimer: Phaser.Time.TimerEvent | null = null;

/**
 * The transient notice strip: one fixed FRLG textbox at the top of the screen,
 * built screen-space after the HUD camera exists so only the pinned camera draws
 * it, hidden until a notice arrives.
 */
function buildNotice(host: RoutePanelHost): void {
  const scene = host.scene;
  const width = Math.min(NOTICE_W, scene.scale.width - 32);
  const x = (scene.scale.width - width) / 2;
  // The strip is the same card as every other panel, and its text is the
  // card's own ink.
  const strip = addFrlgWindow(scene, x, NOTICE_TOP, width, NOTICE_H);
  noticeText = addFrlgText(scene, scene.scale.width / 2, NOTICE_TOP + NOTICE_H / 2, '', {
    align: 'center',
    origin: 0.5,
    size: 16,
    tint: FRLG_INK,
  });
  noticeText.setMaxWidth(width - 32);
  noticeRoot = scene.add.container(0, 0, [strip, noticeText]).setDepth(440).setVisible(false);
  scene.cameras.main.ignore(noticeRoot);
}

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

/** One assignment, one paint: the DOM card's only emit point. */
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
  if (DOM_HUD) {
    domNotice = notice.text;
    paintDomNotices();
    domNoticeTimer?.remove(false);
    domNoticeTimer = host.scene.time.delayedCall(notice.holdMs, () => hideDomNotice());
    return;
  }
  if (!noticeRoot || !noticeText) return;
  noticeText.setText(notice.text);
  noticeRoot.setVisible(true);
  noticeTimer?.remove(false);
  noticeTimer = host.scene.time.delayedCall(notice.holdMs, () => hideNotice());
}

/** Takes the notice strip down; safe when it is not up. */
function hideNotice(): void {
  noticeTimer?.remove(false);
  noticeTimer = null;
  noticeRoot?.setVisible(false);
}

/**
 * The area-entry panel (`src/ui/notice.ts`, `docs/routes-spec.md` §6): the boxed
 * banner that greets the player on entering a room, pinned under the mission
 * line, screen-space on the HUD camera like the strip and hidden until a room is
 * entered. It is the same `'window'` card as every other panel and the one card
 * whose 1px ring is the accent rather than the muted hairline.
 */
function buildAreaPanel(host: RoutePanelHost): void {
  const scene = host.scene;
  const width = Math.min(AREA_PANEL_W, scene.scale.width - 32);
  const x = (scene.scale.width - width) / 2;
  const card = addFrlgWindow(scene, x, AREA_PANEL_TOP, width, AREA_PANEL_H, 'window');
  const hairline = scene.add.graphics();
  hairline.lineStyle(1, FRLG_ACCENT, 1);
  hairline.strokeRect(x + 0.5, AREA_PANEL_TOP + 0.5, width - 1, AREA_PANEL_H - 1);
  areaPanelText = addFrlgText(scene, scene.scale.width / 2, AREA_PANEL_TOP + AREA_PANEL_H / 2, '', {
    align: 'center',
    origin: 0.5,
    size: 18,
    tint: FRLG_INK,
  });
  areaPanelText.setMaxWidth(width - 32);
  areaPanelRoot = scene.add
    .container(0, 0, [card, hairline, areaPanelText])
    .setDepth(AREA_PANEL_DEPTH)
    .setVisible(false);
  scene.cameras.main.ignore(areaPanelRoot);
}

/**
 * Names the area the run just walked into. No key, no scroll, no pause: the
 * banner is the room's greeting and the walk goes on under it. A no-op until the
 * panel is built and the scene has a route, so `applyRoute` may raise it during
 * `create`.
 */
export function showAreaPanel(host: RoutePanelHost): void {
  if (!DOM_HUD && (!areaPanelRoot || !areaPanelText)) return;
  const route = host.route();
  if (!route) return;
  const notice = areaEntryNotice(getBiome(route.biomeId).name);
  if (DOM_HUD) {
    domArea = notice.text;
    paintDomNotices();
    domAreaTimer?.remove(false);
    domAreaTimer = host.scene.time.delayedCall(notice.holdMs, () => hideDomArea());
    return;
  }
  if (!areaPanelRoot || !areaPanelText) return;
  areaPanelText.setText(notice.text);
  areaPanelRoot.setVisible(true);
  areaPanelTimer?.remove(false);
  areaPanelTimer = host.scene.time.delayedCall(notice.holdMs, () => hideAreaPanel());
}

/** Takes the area banner down; safe when it is not up. */
function hideAreaPanel(): void {
  areaPanelTimer?.remove(false);
  areaPanelTimer = null;
  areaPanelRoot?.setVisible(false);
}

/**
 * The floor's mission line (`docs/routes-spec.md` §6): one card pinned under the
 * notice strip, screen-space on the HUD camera like the strip itself, hidden while
 * the run carries no mission row (an old save).
 */
function buildMissionLine(host: RoutePanelHost): void {
  const scene = host.scene;
  const x = (scene.scale.width - MISSION_W) / 2;
  const card = addFrlgWindow(scene, x, MISSION_TOP, MISSION_W, MISSION_H);
  hudMissionText = addFrlgText(scene, scene.scale.width / 2, MISSION_TOP + MISSION_H / 2, '', {
    align: 'center',
    origin: 0.5,
    size: 16,
    tint: FRLG_INK,
  });
  hudMissionText.setMaxWidth(MISSION_W - 32);
  missionRoot = scene.add.container(0, 0, [card, hudMissionText]).setDepth(439).setVisible(false);
  scene.cameras.main.ignore(missionRoot);
}

/**
 * The floor's own objective: one line under the notice strip, and nothing at
 * all when the run carries no mission row (an old save's `null`).
 */
function refreshNotices(host: RoutePanelHost): void {
  const run = host.run();
  const mission = run.mission ? getMission(run.mission.id) : undefined;
  const line = mission === undefined ? null : t('hud.mission', { mission: t(mission.nameKey) });
  if (DOM_HUD) {
    domMission = line;
    paintDomNotices();
    return;
  }
  missionRoot?.setVisible(mission !== undefined);
  if (line === null || !hudMissionText) return;
  hudMissionText.setText(line);
}

/**
 * The number of display objects the three cards draw in Phaser right now: 0 under
 * `?hud=dom`, where the cards are the DOM panel's.
 */
export function noticesDrawnObjectCount(): number {
  if (DOM_HUD) return 0;
  return (
    (noticeRoot?.list.length ?? 0) + (areaPanelRoot?.list.length ?? 0) + (missionRoot?.list.length ?? 0)
  );
}

export const descriptor: RoutePanelDescriptor = {
  id: 'notices',
  order: 60,
  build(host: RoutePanelHost): void {
    noticeRoot = null;
    noticeText = null;
    noticeTimer = null;
    areaPanelRoot = null;
    areaPanelText = null;
    areaPanelTimer = null;
    missionRoot = null;
    hudMissionText = null;
    disposeDomNotices();
    if (DOM_HUD) {
      buildDomNotices(host);
      return;
    }
    buildNotice(host);
    buildAreaPanel(host);
    buildMissionLine(host);
  },
  refresh: refreshNotices,
  // The DOM card lives outside Phaser, so the scene's teardown has to unmount it.
  close(): void {
    disposeDomNotices();
  },
};
