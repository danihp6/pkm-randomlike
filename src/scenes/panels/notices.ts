import type Phaser from 'phaser';
import { getBiome } from '../../data/biomes';
import { getMission } from '../../data/missions';
import { t } from '../../i18n';
import { FRLG_ACCENT, addFrlgWindow } from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { areaEntryNotice, type Notice } from '../../ui/notice';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The route's transient cards: the notice strip, the area-entry banner and the
 * floor's mission line. All three are screen-space, take no key and block nothing,
 * so the route keeps walking under them.
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

/**
 * Floats one transient notice. One at a time: a second notice replaces the first
 * and restarts its hold. Nothing is blocked and no key is consumed.
 */
export function showNotice(host: RoutePanelHost, notice: Notice): void {
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
  if (!areaPanelRoot || !areaPanelText) return;
  const route = host.route();
  if (!route) return;
  const notice = areaEntryNotice(getBiome(route.biomeId).name);
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
  missionRoot?.setVisible(mission !== undefined);
  if (!mission || !hudMissionText) return;
  hudMissionText.setText(t('hud.mission', { mission: t(mission.nameKey) }));
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
    buildNotice(host);
    buildAreaPanel(host);
    buildMissionLine(host);
  },
  refresh: refreshNotices,
};
