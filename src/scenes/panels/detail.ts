import { signal, type Signal } from '@preact/signals';
import { getMove, getSpecies, type Stats } from '../../data/dex';
import { tmNumber } from '../../data/tms';
import { abilityMoveType } from '../../engine/battle/moveType';
import { MAX_MOVES, evolveMember, moveMoves, type RunPokemon, type RunState } from '../../engine/run';
import { equipMove, learnsetPool, unequipMove, type LearnEntry } from '../../engine/run/learnset';
import { NICKNAME_MAX_LENGTH, normalizeNickname, renameMember } from '../../engine/run/nickname';
import { t } from '../../i18n';
import { moveName } from '../../i18n/content';
import {
  DETAIL_POOL_COLS,
  detailPanelView,
  initialDetailPanelUi,
  mountDetailPanel,
  type DetailIntent,
  type DetailPanelUi,
  type DetailPanelView,
  type DetailPoolRow,
} from '../../ui/hud/panels/detail';
import { FRLG_MUTED, addFrlgWindow } from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import {
  CLOSED_DETAIL,
  carriedDetailTab,
  closeDetail,
  dropMove,
  grabMove,
  memberDetail,
  openDetail,
  setDetailTab,
  type DetailState,
  type MemberDetail,
} from '../../ui/partyDetail';
import { dropOnCard, grabAt, type DragPick, type PaneId } from '../../ui/partyScreen';
import { maxScrollTop, scrollByRows } from '../../ui/scroll';
import type { LevelUpBeat } from '../../ui/beats';
import type Phaser from 'phaser';
import { panelExpanded, panelFrameMount } from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The member detail window: a header (name, level, types) over the STATS and MOVES
 * tabs, the nickname field, the evolution graph, the draggable move grid and the
 * learnset pool.
 *
 * The card is the Preact panel in `src/ui/hud/panels/detail/` and this module draws
 * none of it: it owns the open member, the tab, the cursors, the search query and
 * the nickname buffer, and the mount paints them. The level-up / evolution popup is
 * **not** part of the card — it is the beat `RouteScene` raises after a battle — so
 * it is still built here.
 */

/** The learnset pool's window: two columns of two rows, scrolled one row at a time. */
const HUD_DETAIL_LEARN_COLS = 2;
const HUD_DETAIL_LEARN_ROWS = 2;

/** The detail card's own state behind the view. */
let hudDetailState: DetailState = CLOSED_DETAIL;
/** True while the nickname field owns the keyboard. */
let hudNicknameFocus = false;
/** The in-progress text; null while the field is not being edited. */
let hudNicknameEdit: string | null = null;
/** The move slot and the pool row the card's cursor sits on; -1 for none. */
let hudDetailCursor = -1;
let hudPoolCursor = -1;
/** The first visible row of the pool window. */
let hudLearnScrollTop = 0;
let hudLearnQuery = '';
let hudSearchFocus = false;
/** The move cell whose ⓘ floats its popup, or null; the two `pinned` flags keep it up. */
let hudDetailInfo: { index: number } | null = null;
let hudDetailInfoPinned = false;
let hudAbilityInfo = false;
let hudAbilityInfoPinned = false;
/** The level-up / evolution popup and whether it is up. */
let learnPopup!: Phaser.GameObjects.Container;
let learnPopupTitle!: Phaser.GameObjects.BitmapText;
let learnPopupBody!: Phaser.GameObjects.BitmapText;
let learnPopupOpen = false;
/** Scene time the popup opened, so the click that opened it cannot dismiss it. */
let learnPopupAt = 0;

/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this module imports
 * Phaser type-only. The route pauses itself for a battle and for the Settings screen;
 * a DOM card sits above the canvas, so it has to hide itself on the beat.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';

/** The mounted DOM card: the view it paints and the mount's disposer. */
let domView: Signal<DetailPanelView> | null = null;
let domDispose: (() => void) | null = null;
/** The `#hud` member drag the card's layer owns, and its remover. */
let domDrag: (() => void) | null = null;
/** The member a pointer drag carries, or null when no drag is in flight. */
let hudDrag: DragPick | null = null;
/** The scene's pause/resume subscription, dropped when the route goes away. */
let domUnsubscribeScene: (() => void) | null = null;
/** True while the route is paused under another screen: the card hides then. */
let domPaused = false;

/** The last row the pool window may start at, or 0 when it all fits. */
function maxLearnScrollTop(host: RoutePanelHost): number {
  return maxScrollTop(learnPool(host).length, HUD_DETAIL_LEARN_COLS, HUD_DETAIL_LEARN_ROWS);
}

/** The party/box member the open detail panel shows, or undefined. */
function detailMember(host: RoutePanelHost): RunPokemon | undefined {
  const memberId = hudDetailState.memberId;
  if (memberId === null) return undefined;
  const run = host.run();
  return (
    run.party.find((entry) => entry.fighter.id === memberId) ??
    run.box.find((entry) => entry.fighter.id === memberId) ??
    run.rip.find((entry) => entry.fighter.id === memberId)
  );
}

/** True while the open detail panel is showing a member of `run.rip`. */
function deadDetail(host: RoutePanelHost): boolean {
  const memberId = hudDetailState.memberId;
  return memberId !== null && host.run().rip.some((member) => member.fighter.id === memberId);
}

/** The filtered learnset pool for the open member, in draw order. */
function learnPool(host: RoutePanelHost): LearnEntry[] {
  const member = detailMember(host);
  if (!member) return [];
  const run = host.run();
  const pool = learnsetPool(run, member, run.seed);
  const query = hudLearnQuery.trim().toLowerCase();
  if (query.length === 0) return pool;
  return pool.filter((entry) => {
    const move = getMove(entry.moveId);
    return (
      entry.moveId.includes(query) ||
      moveName(entry.moveId).toLowerCase().includes(query) ||
      (move?.type ?? '').toLowerCase().includes(query)
    );
  });
}

/** Focuses the nickname field and seeds it with the name the row shows. */
function beginNicknameEdit(host: RoutePanelHost): void {
  const memberId = hudDetailState.memberId;
  if (memberId === null) return;
  if (deadDetail(host)) return;
  const detail = memberDetail(host.run(), memberId);
  if (!detail) return;
  hudAbilityInfoPinned = false;
  hudAbilityInfo = false;
  hudNicknameEdit = detail.nickname ?? detail.name;
  hudNicknameFocus = true;
  hudSearchFocus = false;
  refreshDetail(host);
}

/** Escape, a press elsewhere, a tab switch, closing the panel, a battle: no write. */
export function cancelNicknameEdit(host: RoutePanelHost): void {
  if (!hudNicknameFocus && hudNicknameEdit === null) return;
  hudNicknameFocus = false;
  hudNicknameEdit = null;
  refreshDetail(host);
}

/**
 * The nickname field's key router: it consumes **every** key while the field is
 * focused, so nothing typed reaches the game underneath. Characters and
 * Backspace work in code points, Enter commits and Escape cancels.
 */
export function typeInNickname(host: RoutePanelHost, event: KeyboardEvent): boolean {
  if (!hudNicknameFocus) return false;
  if (event.key === 'Enter') {
    event.preventDefault();
    commitNicknameEdit(host);
    return true;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelNicknameEdit(host);
    return true;
  }
  if (event.key === 'Backspace') {
    hudNicknameEdit = [...(hudNicknameEdit ?? '')].slice(0, -1).join('');
  } else if (event.key.length === 1 && /[a-z0-9 '-]/i.test(event.key)) {
    const points = [...(hudNicknameEdit ?? ''), event.key];
    if (points.length <= NICKNAME_MAX_LENGTH) hudNicknameEdit = points.join('');
  }
  event.preventDefault();
  refreshDetail(host);
  return true;
}

/**
 * Enter: the pure `normalizeNickname` decides the stored text and `renameMember`
 * the run, so the panel never re-implements the rule. The save follows only when
 * the run object actually changed.
 */
function commitNicknameEdit(host: RoutePanelHost): void {
  const memberId = hudDetailState.memberId;
  const text = hudNicknameEdit;
  hudNicknameFocus = false;
  hudNicknameEdit = null;
  if (memberId !== null && text !== null) {
    const run = host.run();
    const next = renameMember(run, memberId, normalizeNickname(text));
    if (next !== run) host.commitRun(next);
  }
  refreshDetail(host);
  host.refreshHud();
}

/** True while the detail panel's nickname or learnset field owns the keyboard. */
export function detailTextFieldFocused(): boolean {
  return hudNicknameFocus || hudSearchFocus;
}

/**
 * Drops the band's info state when the band's window is rebuilt with different
 * entries: the target is an index into the visible pool, so an index that survives
 * a scroll would name another move.
 */
function dropLearnInfo(): void {
  hudDetailInfo = null;
  hudDetailInfoPinned = false;
}

/** Moves the pool window `deltaRows` rows (clamped) and redraws when it moved. */
export function scrollLearnset(host: RoutePanelHost, deltaRows: number): void {
  const next = scrollByRows(hudLearnScrollTop, deltaRows, maxLearnScrollTop(host));
  if (next === hudLearnScrollTop) return;
  hudLearnScrollTop = next;
  dropLearnInfo();
  refreshDetail(host);
}

/**
 * Routes a key into the learnset search field while it holds focus: letters and
 * digits filter the pool, Backspace and Escape edit or leave the field. Returns
 * true when the key was consumed, so it never drives the game underneath.
 */
export function typeInDetailSearch(host: RoutePanelHost, event: KeyboardEvent): boolean {
  if (!hudSearchFocus) return false;
  if (event.key === 'Escape' || event.key === 'Enter') {
    hudSearchFocus = false;
  } else if (event.key === 'Backspace') {
    if (hudLearnQuery.length === 0) return true;
    hudLearnQuery = hudLearnQuery.slice(0, -1);
    hudLearnScrollTop = 0;
    dropLearnInfo();
  } else if (event.key.length === 1 && /[a-z0-9 '-]/i.test(event.key)) {
    hudLearnQuery += event.key;
    hudLearnScrollTop = 0;
    dropLearnInfo();
  } else {
    return true;
  }
  event.preventDefault();
  refreshDetail(host);
  return true;
}

/**
 * Opens the detail panel on `memberId`, keeping the tab the panel already stands on
 * (STATS when it was closed), and paints it. The card is shown as well: its `open`
 * flag is the HUD's collapsed record and the detail window has no edge chip of its
 * own, so a press that opened a member and left the card collapsed would show
 * nothing.
 */
export function openMemberDetail(host: RoutePanelHost, memberId: string): void {
  hudDetailState = openDetail(memberId, carriedDetailTab(hudDetailState));
  resetDetailInfo();
  hudLearnScrollTop = 0;
  hudLearnQuery = '';
  hudSearchFocus = false;
  hudDetailCursor = -1;
  hudPoolCursor = -1;
  cancelNicknameEdit(host);
  if (!host.hudCardOpen('detail')) host.setHudCardOpen('detail', true);
  refreshDetail(host);
}

/** Closes the detail panel and repaints the HUD behind it. */
export function closeMemberDetail(host: RoutePanelHost): void {
  if (hudDetailState.memberId === null) return;
  hudDetailState = closeDetail(hudDetailState);
  resetDetailInfo();
  cancelNicknameEdit(host);
  refreshDetail(host);
  host.refreshHud();
}

/** Drops the info popup and its pins, e.g. when the panel closes or changes tab. */
function resetDetailInfo(): void {
  hudDetailInfo = null;
  hudDetailInfoPinned = false;
  hudAbilityInfo = false;
  hudAbilityInfoPinned = false;
}

/** Hides an unpinned info popup. */
export function clearDetailInfo(host: RoutePanelHost): void {
  if (!hudDetailInfoPinned && hudDetailInfo !== null) {
    hudDetailInfo = null;
    refreshDetail(host);
  }
  if (!hudAbilityInfoPinned && hudAbilityInfo) {
    hudAbilityInfo = false;
    refreshDetail(host);
  }
}

/** True while the level-up/evolution popup is up. */
export function learnPopupOpenNow(): boolean {
  return learnPopupOpen;
}

/** Dismisses the learn/evolution popup, unless it was just opened. */
export function dismissLearnPopup(host: RoutePanelHost): void {
  if (host.scene.time.now - learnPopupAt < 250) return;
  closeLearnPopup();
}

/** Dismisses the learn/evolution popup; safe when it is not up. */
export function closeLearnPopup(): void {
  if (!learnPopupOpen) return;
  learnPopupOpen = false;
  learnPopup.setVisible(false);
}

/** True while a member's detail window is open. */
export function detailOpen(): boolean {
  return hudDetailState.memberId !== null;
}

/** Shows the learn popup for the level-up beats, or stays hidden if none learned. */
export function showLearnPopup(host: RoutePanelHost, beats: readonly LevelUpBeat[]): void {
  if (learnPopupOpen) return;
  const lines: string[] = [];
  for (const beat of beats) {
    const member = host.run().party.find((entry) => entry.fighter.id === beat.id);
    const species = getSpecies(member?.fighter.speciesId ?? '');
    const name = member?.fighter.nickname ?? species?.name ?? t('common.unknownPokemon');
    for (const moveId of beat.learned) {
      lines.push(t('route.learned', { name, move: moveName(moveId) }));
    }
  }
  if (lines.length === 0) return;
  learnPopupTitle.setText(t('hud.learnTitle'));
  learnPopupBody.setText(lines.join('\n'));
  learnPopupOpen = true;
  learnPopupAt = host.scene.time.now;
  learnPopup.setVisible(true);
}

/** The centred window the level-up / evolution popup draws its lines on. */
function buildLearnPopup(host: RoutePanelHost): void {
  const scene = host.scene;
  const { width, height } = scene.scale;
  const panelW = 560;
  const panelH = 220;
  const x = (width - panelW) / 2;
  const y = (height - panelH) / 2;
  const scrim = scene.add.rectangle(0, 0, width, height, 0x05070c, 0.55).setOrigin(0, 0);
  const panel = addFrlgWindow(scene, x, y, panelW, panelH);
  learnPopupTitle = addFrlgText(scene, x + 24, y + 18, t('hud.learnTitle'), {
    size: 32,
    tint: FRLG_INK,
  });
  learnPopupBody = addFrlgText(scene, x + 24, y + 76, '', {
    size: 16,
    tint: FRLG_INK,
    lineSpacing: 8,
  }).setMaxWidth(panelW - 48);
  const hint = addFrlgText(scene, x + panelW - 24, y + panelH - 30, t('hud.pressAnyKey'), {
    size: 16,
    tint: FRLG_MUTED,
    origin: [1, 0],
  });
  const zone = scene.add.zone(0, 0, width, height).setOrigin(0, 0);
  zone.setInteractive();
  zone.on('pointerdown', () => dismissLearnPopup(host));
  learnPopup = scene.add
    .container(0, 0, [scrim, panel, learnPopupTitle, learnPopupBody, hint, zone])
    .setDepth(460)
    .setVisible(false);
  scene.cameras.main.ignore(learnPopup);
}

/** The DOM card's viewport: the scene's own window, as the HUD metrics see it. */
function viewportOf(host: RoutePanelHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

/** The number of display objects the detail window draws in Phaser: none, it is the DOM card. */
export function detailDrawnObjectCount(): number {
  return 0;
}

/** The panel's own state, as the DOM card's pure view reads it. */
function domUi(): DetailPanelUi {
  return {
    tab: hudDetailState.tab,
    cursor: hudDetailCursor,
    page: hudLearnScrollTop * DETAIL_POOL_COLS,
    poolCursor: hudPoolCursor,
    info: hudDetailInfoPinned && hudDetailInfo !== null ? hudDetailInfo.index : null,
    abilityInfo: hudAbilityInfoPinned,
    grab: hudDetailState.grab,
    nickname: hudNicknameEdit,
  };
}

/** One learnset pool row as the DOM card paints it: the shipped name and source tag. */
function learnRow(
  entry: LearnEntry,
  ability: string,
  ivs: Partial<Stats> | null | undefined,
): DetailPoolRow {
  const move = getMove(entry.moveId);
  const source =
    entry.source === 'tm'
      ? t('detail.learnTm', { tm: tmNumber(entry.tmId ?? '') ?? '?' })
      : entry.source === 'tutor'
        ? t('detail.learnTutor')
        : t('detail.learnLevel', { level: entry.level ?? '?' });
  return {
    moveId: entry.moveId,
    name: moveName(entry.moveId),
    type: move ? abilityMoveType(ability, move, ivs) : '',
    source,
    enabled: true,
  };
}

/** The member's panel data for the DOM: a fallen member has no branch to evolve into. */
function domDetail(host: RoutePanelHost, memberId: string): MemberDetail | null {
  const detail = memberDetail(host.run(), memberId);
  if (detail === null) return null;
  return deadDetail(host) ? { ...detail, evolutions: [] } : detail;
}

/** The one emit point of the DOM card: the scene owns the run, the card paints it. */
function pushDomView(host: RoutePanelHost): void {
  const view = domView;
  if (view === null) return;
  const memberId = hudDetailState.memberId;
  const detail = memberId === null ? null : domDetail(host, memberId);
  const member = detailMember(host);
  const pool =
    detail === null || member === undefined
      ? []
      : learnPool(host).map((entry) => learnRow(entry, detail.ability, member.fighter.ivs));
  const projected = detailPanelView(detail, pool, domUi(), viewportOf(host));
  view.value = {
    ...projected,
    open: projected.open && !domPaused && panelExpanded(host, 'detail'),
    search: { ...projected.search, value: hudLearnQuery },
  };
}

/** The card's repaint: the one place its view is rebuilt. */
export function refreshDetail(host: RoutePanelHost): void {
  pushDomView(host);
}

/** The route paused (a battle over it, or the Settings screen): the card follows. */
function setDomPaused(host: RoutePanelHost, paused: boolean): void {
  if (domPaused === paused) return;
  domPaused = paused;
  pushDomView(host);
}

/** Drops the scene's pause/resume subscription; the route is going away. */
function unsubscribeScene(): void {
  domUnsubscribeScene?.();
  domUnsubscribeScene = null;
  domPaused = false;
}

/** Subscribes the card to the route's own pause and resume beats. */
function subscribeScene(host: RoutePanelHost): void {
  unsubscribeScene();
  const events = host.scene.events;
  const onPause = (): void => setDomPaused(host, true);
  const onResume = (): void => setDomPaused(host, false);
  events.on(SCENE_PAUSE, onPause);
  events.on(SCENE_RESUME, onResume);
  domUnsubscribeScene = () => {
    events.off(SCENE_PAUSE, onPause);
    events.off(SCENE_RESUME, onResume);
  };
}

/** The HUD card a member is drawn on, by its root's own marker. */
const CARD_ATTR = 'data-hud-panel';
/** A party row's member id. */
const PARTY_MEMBER_ATTR = 'data-hud-party-member';
/** A PC/RIP cell's flat slot in the list its card shows. */
const PC_CELL_ATTR = 'data-hud-pc-cell';

/** The card a dropped pointer is over, or null when it let go on nothing. */
function cardUnder(event: Event): 'party' | 'box' | null {
  const point = event as Partial<PointerEvent>;
  const at =
    typeof point.clientX === 'number' && typeof point.clientY === 'number'
      ? (document.elementFromPoint?.(point.clientX, point.clientY) ?? null)
      : null;
  const under = at ?? (event.target instanceof Element ? event.target : null);
  const name = under?.closest(`[${CARD_ATTR}]`)?.getAttribute(CARD_ATTR) ?? null;
  return name === 'party' ? 'party' : name === 'box' ? 'box' : null;
}

/**
 * The member a pointer went down on: a party row by its id, a PC/RIP cell by the
 * slot its card prints. Anything else — a chip, a tab, the wall — carries no member.
 */
function dragPick(host: RoutePanelHost, target: Element): DragPick | null {
  const row = target.closest(`[${PARTY_MEMBER_ATTR}]`);
  if (row !== null) {
    const memberId = row.getAttribute(PARTY_MEMBER_ATTR);
    const index = host.run().party.findIndex((member) => member.fighter.id === memberId);
    return index < 0 ? null : { pane: 'party', index };
  }
  const cell = target.closest(`[${PC_CELL_ATTR}]`);
  const slot = cell?.getAttribute(PC_CELL_ATTR) ?? null;
  const index = slot === null ? Number.NaN : Number.parseInt(slot, 10);
  if (!Number.isInteger(index) || index < 0) return null;
  const pane: PaneId =
    cell?.closest(`[${CARD_ATTR}]`)?.getAttribute('data-pane') === 'rip' ? 'rip' : 'box';
  return { pane, index };
}

/**
 * A press on a member starts a drag; the pure `grabAt` decides whether there is one
 * to start, so a locked cell, an empty slot and the fallen's pane begin none.
 */
function startDrag(host: RoutePanelHost, event: Event): void {
  hudDrag = null;
  if (domPaused) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  const pick = dragPick(host, target);
  if (pick === null) return;
  const grabbed = grabAt(host.run(), host.ui(), pick.pane, pick.index).ui.grabbed;
  hudDrag = grabbed === null ? null : { pane: grabbed.pane, index: grabbed.origin };
}

/**
 * The pointer let go: the drag lands on one of the two cards, or on nothing and
 * moves no member. A drop on the member's own card is the card's own gesture, so
 * this leaves it alone; only the crossing is committed here (`dropOnCard`).
 */
function endDrag(host: RoutePanelHost, event: Event): void {
  const drag = hudDrag;
  hudDrag = null;
  if (drag === null || domPaused) return;
  const run = host.run();
  const next = dropOnCard(run, drag, cardUnder(event));
  if (next !== run) host.commitRun(next);
}

/**
 * The card's member gesture, one delegated pair on `#hud`: the press starts the drag
 * and the release — wherever it lands, the layer or the canvas — resolves the two
 * cards through the pure drop. A press on a member itself opens the member's detail
 * window from the card's own `member` command, so this is the **only** place the
 * pointer moves a member. Returns the disposer both listeners need.
 */
export function installMemberDrag(host: RoutePanelHost, layer: Element): () => void {
  const onDown = (event: Event): void => startDrag(host, event);
  const onUp = (event: Event): void => endDrag(host, event);
  const onCancel = (): void => {
    hudDrag = null;
  };
  layer.addEventListener('pointerdown', onDown);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
  return () => {
    hudDrag = null;
    layer.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
  };
}

function removeMemberDrag(): void {
  domDrag?.();
  domDrag = null;
}

function disposeDomPanel(): void {
  removeMemberDrag();
  if (domDispose === null) return;
  domDispose();
  domDispose = null;
}

/** A member's first free move slot, or the slot under the cursor, or the tail. */
function equipSlot(run: RunState, memberId: string): number {
  const member =
    run.party.find((entry) => entry.fighter.id === memberId) ??
    run.box.find((entry) => entry.fighter.id === memberId);
  const count = member?.fighter.moves.length ?? MAX_MOVES;
  if (hudDetailCursor >= 0 && hudDetailCursor < count) return hudDetailCursor;
  return Math.min(count, MAX_MOVES - 1);
}

/** The rename field's confirm: the pure rules decide the text, the host persists it. */
function commitDomNickname(host: RoutePanelHost, text: string): void {
  const memberId = hudDetailState.memberId;
  hudNicknameFocus = false;
  hudNicknameEdit = null;
  if (memberId !== null) {
    const run = host.run();
    const next = renameMember(run, memberId, normalizeNickname(text));
    if (next !== run) {
      host.commitRun(next);
      return;
    }
  }
  pushDomView(host);
}

/**
 * The DOM card's command channel, resolved here and nowhere else. Every write goes
 * through the engine functions this module already imports and lands on the run only
 * through `commitRun`; everything else is the panel's own cursor state.
 */
function runDetailIntent(host: RoutePanelHost, intent: DetailIntent): void {
  if (domPaused) return;
  const memberId = hudDetailState.memberId;
  switch (intent.type) {
    case 'tab':
      hudDetailState = setDetailTab(hudDetailState, intent.tab);
      hudDetailCursor = -1;
      hudPoolCursor = -1;
      resetDetailInfo();
      pushDomView(host);
      return;
    case 'cursor':
      hudDetailCursor = intent.index;
      pushDomView(host);
      return;
    case 'poolCursor':
      hudPoolCursor = intent.index;
      pushDomView(host);
      return;
    case 'page':
      scrollLearnset(host, intent.delta);
      return;
    case 'search':
      hudLearnQuery = intent.query;
      hudLearnScrollTop = 0;
      hudPoolCursor = -1;
      dropLearnInfo();
      pushDomView(host);
      return;
    case 'info':
      if (
        intent.index === null ||
        (hudDetailInfoPinned && hudDetailInfo !== null && hudDetailInfo.index === intent.index)
      ) {
        hudDetailInfo = null;
        hudDetailInfoPinned = false;
      } else {
        hudDetailInfo = { index: intent.index };
        hudDetailInfoPinned = true;
      }
      pushDomView(host);
      return;
    case 'abilityInfo':
      hudAbilityInfoPinned = intent.open;
      hudAbilityInfo = intent.open;
      pushDomView(host);
      return;
    case 'grab': {
      if (hudDetailState.grab === null) {
        hudDetailState = grabMove(hudDetailState, intent.index);
      } else if (hudDetailState.grab === intent.index) {
        hudDetailState = dropMove(hudDetailState);
      } else if (memberId !== null) {
        const run = host.run();
        const next = moveMoves(run, memberId, hudDetailState.grab, intent.index);
        hudDetailState = dropMove(hudDetailState);
        if (next !== run) {
          host.commitRun(next);
          return;
        }
      }
      pushDomView(host);
      return;
    }
    case 'drop': {
      const from = hudDetailState.grab;
      hudDetailState = dropMove(hudDetailState);
      if (from !== null && memberId !== null && from !== intent.slot) {
        const run = host.run();
        const next = moveMoves(run, memberId, from, intent.slot);
        if (next !== run) {
          host.commitRun(next);
          return;
        }
      }
      pushDomView(host);
      return;
    }
    case 'equip': {
      if (memberId === null) return;
      const run = host.run();
      const next = equipMove(run, memberId, intent.moveId, equipSlot(run, memberId), run.seed);
      if (next !== run) {
        host.commitRun(next);
        return;
      }
      pushDomView(host);
      return;
    }
    case 'unequip': {
      if (memberId === null) return;
      const slot = intent.slot >= 0 ? intent.slot : (hudDetailState.grab ?? -1);
      const run = host.run();
      const next = unequipMove(run, memberId, slot);
      hudDetailState = dropMove(hudDetailState);
      if (next !== run) {
        host.commitRun(next);
        return;
      }
      pushDomView(host);
      return;
    }
    case 'evolve': {
      if (memberId === null) return;
      const run = host.run();
      const next = evolveMember(run, memberId, intent.into);
      if (next !== run) {
        host.commitRun(next);
        return;
      }
      pushDomView(host);
      return;
    }
    case 'nickname':
      if ('begin' in intent) beginNicknameEdit(host);
      else if ('cancel' in intent) cancelNicknameEdit(host);
      else commitDomNickname(host, intent.commit);
      return;
    default:
      return;
  }
}

/**
 * The card's build: the level-up popup (the beat `RouteScene` raises, which the
 * board has no card for), the `#hud` mount of the detail card itself and the
 * member drag the two panels share.
 */
function buildDom(host: RoutePanelHost): void {
  buildLearnPopup(host);
  disposeDomPanel();
  const view = signal(detailPanelView(null, [], initialDetailPanelUi(), viewportOf(host)));
  domView = view;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null) {
    domDispose = mountDetailPanel(
      layer,
      view,
      (intent) => runDetailIntent(host, intent),
      panelFrameMount(host, 'detail'),
    );
    domDrag = installMemberDrag(host, layer);
  }
  subscribeScene(host);
  pushDomView(host);
}

/** Disposes the card and clears the module state it owns. */
function closeDom(): void {
  unsubscribeScene();
  disposeDomPanel();
  domView = null;
  hudDetailState = CLOSED_DETAIL;
  hudDetailCursor = -1;
  hudPoolCursor = -1;
  hudLearnScrollTop = 0;
  hudLearnQuery = '';
  hudSearchFocus = false;
  hudNicknameFocus = false;
  hudNicknameEdit = null;
  resetDetailInfo();
  learnPopupOpen = false;
}

export const descriptor: RoutePanelDescriptor = {
  id: 'detail',
  order: 110,
  hudPanel: 'detail',
  build(host: RoutePanelHost): void {
    hudDetailState = CLOSED_DETAIL;
    hudLearnScrollTop = 0;
    hudLearnQuery = '';
    hudSearchFocus = false;
    hudDetailInfo = null;
    hudDetailInfoPinned = false;
    hudAbilityInfo = false;
    hudAbilityInfoPinned = false;
    hudNicknameFocus = false;
    hudNicknameEdit = null;
    hudDetailCursor = -1;
    hudPoolCursor = -1;
    buildDom(host);
  },
  refresh: refreshDetail,
  close(): void {
    closeDom();
  },
};
