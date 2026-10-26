import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../../data/itemIcons';
import { PORTRAIT_TEXTURE_KEY, portraitFor } from '../../data/portraits';
import { STATUS_ICON_TEXTURE_KEY, STATUS_ICON_W, statusIconFrame } from '../../data/statusIcons';
import { getSpecies } from '../../data/dex';
import { restoreFighter } from '../../engine/battle';
import { MAX_PARTY_SIZE, moveInParty, type RunPokemon } from '../../engine/run';
import {
  FRLG_HPBAR,
  FRLG_HPBAR_KEY,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  addFrlgWindow,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import type { HudCommand } from '../../ui/hud/commands';
import { parseHudFlags } from '../../ui/hud/fixtures';
import {
  initialPartyPanelUi,
  mountPartyPanel,
  partyPanelView,
  type PartyPanelUi,
  type PartyPanelView,
} from '../../ui/hud/panels/party';
import { projectHud } from '../../ui/hud/state';
import { hpColorInt, hpFraction } from '../../ui/metrics';
import { portraitTint, type PaneId } from '../../ui/partyScreen';
import { PANEL_ICON_KEYS } from '../BootScene';
import {
  HUD_PAD_BOTTOM,
  HUD_PAD_X,
  HUD_PARTY_COLUMN,
  HUD_TOP,
  HUD_VIAL_H,
  HUD_VIAL_Y,
  PANEL_KEY_ACTIONS,
  draggedItemFrom,
  hudColumnLeft,
  makeHudPanel,
  panelExpanded,
  panelPoint,
  toggleHudPanel,
} from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The party window: the squad's six rows (portrait, name, status badge and HP bar)
 * under the shared level/XP line and the Pokevial bar the frame layer paints. A row
 * is a hit target for the scene's drag path; it repaints from the run, never per
 * frame.
 *
 * With `?hud=dom` (`D49`) the card is the Preact panel in the `#hud` layer and this
 * module draws none of it: the window and its panel record are still built (so the
 * quick key, the saved layout and the collapse keep working) but stay invisible, and
 * `refresh` feeds the panel's signal instead. Presses inside the panel come back as
 * `HudCommand`s, so the run is still only ever written here. `#hud` is a DOM layer
 * above the canvas, so while the route is paused under a battle or the Settings screen
 * the mount hides the card and brings it back as it was on `RESUME`.
 */

const HUD_PARTY_ROW = 52;
/** The party avatar, enlarged to the row height so the held-item badge reads. */
const HUD_PARTY_PORTRAIT_SCALE = 0.7;
/** The status badge at the right of a party row's name line (the detail header shares it). */
export const HUD_PARTY_STATUS_SCALE = 1.5;
/** Gap (px) kept between the row name and its status badge. */
const HUD_PARTY_STATUS_GAP = 4;
/** The held-item icon on an avatar's lower-right corner. */
const HUD_HELD_ICON_SCALE = 0.85;
/** The party header's band: the level line, the XP bar and the vial, over the rows. */
const HUD_PARTY_HEADER = HUD_VIAL_Y + HUD_VIAL_H + 8;

/** `?hud=dom`, read once: the DOM party panel is the only party this scene draws. */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;
/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this folder imports
 * Phaser type-only: the route stops under a battle or the Settings screen and comes
 * back from it on these two.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';

let hudRows: {
  highlight: Phaser.GameObjects.Rectangle;
  portrait: Phaser.GameObjects.Image;
  held: Phaser.GameObjects.Image;
  status: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.BitmapText;
  bar: Phaser.GameObjects.Image;
  fill: Phaser.GameObjects.Rectangle;
  dark: boolean;
}[] = [];
/** The party window's own top and height, which the bag window stacks under. */
let hudPartyY = 0;
let hudPartyH = 0;
/**
 * The live party body. It hangs off `globalThis` the way the battle scene publishes
 * itself (`__pkmBattle`): the dev server serves a second copy of this module under
 * `?t=` after an HMR update, and the acceptance probe imports the module by path, so
 * a copy-local reference would report a panel that is drawing as empty.
 */
type PartyLive = { body: Phaser.GameObjects.Container | null };
const PARTY_LIVE_KEY = '__pkmPartyPanel';

function partyLive(): PartyLive {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[PARTY_LIVE_KEY];
  if (existing !== undefined) return existing as PartyLive;
  const created: PartyLive = { body: null };
  scope[PARTY_LIVE_KEY] = created;
  return created;
}
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

/** The members a pane shows: the party, the PC box, or the fallen. */
export function paneMembers(host: RoutePanelHost, pane: PaneId): readonly RunPokemon[] {
  const run = host.run();
  if (pane === 'party') return run.party;
  return pane === 'rip' ? run.rip : run.box;
}

/** The party window's bottom edge, so the bag window can stack under it. */
export function partyBottom(): number {
  return hudPartyY + hudPartyH;
}

/** The number of display objects the party draws right now: 0 under `?hud=dom`. */
export function partyDrawnObjectCount(): number {
  if (DOM_HUD) return 0;
  return partyLive().body?.list.length ?? 0;
}

/** True when the pointer is on the party window's frame. */
export function pointerInPartyPanel(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (DOM_HUD) return false;
  if (!panelExpanded(host, 'party')) return false;
  const point = panelPoint(host, pointer, 'party');
  const x = hudColumnLeft(host);
  return (
    point.x >= x &&
    point.x <= x + host.hud().partyW &&
    point.y >= hudPartyY &&
    point.y <= hudPartyY + hudPartyH
  );
}

/** The party index under the pointer, or null outside a filled row. */
export function hudPartyRowAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): number | null {
  if (DOM_HUD) return null;
  if (!pointerInPartyPanel(host, pointer)) return null;
  const point = panelPoint(host, pointer, 'party');
  const rowTop = hudPartyY + HUD_PARTY_HEADER;
  const slot = Math.floor((point.y - rowTop) / HUD_PARTY_ROW);
  if (point.y < rowTop || slot < 0 || slot >= MAX_PARTY_SIZE) return null;
  return slot < host.run().party.length ? slot : null;
}

/** A party row's held-item badge, so the drag path can take the item in hand. */
export function partyHeldBadge(index: number): Phaser.GameObjects.Image | undefined {
  if (DOM_HUD) return undefined;
  return hudRows[index]?.held;
}

/** Paints one party portrait for the level-up beat, and clears it afterwards. */
export function setPartyPortraitTint(index: number, tint: number): void {
  if (DOM_HUD) return;
  hudRows[index]?.portrait.setTint(tint);
}

export function clearPartyPortraitTints(): void {
  if (DOM_HUD) return;
  // Each row keeps its own mark: the level-up beat's flash must never erase the
  // dark portrait's tint (`Task-154`).
  for (const row of hudRows) {
    const tint = portraitTint(row.dark);
    if (tint === null) row.portrait.clearTint();
    else row.portrait.setTint(tint);
  }
}

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
  domDispose = mountPartyPanel(layer, view, (command) => runPanelCommand(host, command));
  domScene = host.scene;
  domScene.events.on(SCENE_PAUSE, pauseDomPanel);
  domScene.events.on(SCENE_RESUME, resumeDomPanel);
}

function refreshParty(host: RoutePanelHost): void {
  if (DOM_HUD) {
    if (domView !== null) domView.value = partyView(host);
    return;
  }
  if (hudRows.length === 0) return;
  const run = host.run();
  const ui = host.ui();
  const x = hudColumnLeft(host);
  hudRows.forEach((row, i) => {
    const member = run.party[i];
    const visible = member !== undefined;
    const alive = member !== undefined && member.fighter.hp > 0;
    row.highlight.setVisible(ui.grabbed?.pane === 'party' && ui.index === i);
    row.name.setVisible(visible);
    row.bar.setVisible(alive);
    row.fill.setVisible(alive);
    if (!member) {
      row.portrait.setVisible(false);
      row.held.setVisible(false);
      row.status.setVisible(false);
      row.name.setText('');
      return;
    }
    const portrait = portraitFor(member.fighter.speciesId, member.fighter.shiny);
    row.portrait.setVisible(portrait !== null);
    if (portrait) row.portrait.setTexture(portrait.key, portrait.frame);
    row.dark = member.dark === true;
    const tint = portraitTint(row.dark);
    if (tint === null) row.portrait.clearTint();
    else row.portrait.setTint(tint);
    const statusFrame = member.fighter.status ? statusIconFrame(member.fighter.status) : null;
    row.status.setVisible(statusFrame !== null);
    if (statusFrame !== null) row.status.setFrame(statusFrame);
    const heldFrame = member.fighter.heldItem ? itemIconFrame(member.fighter.heldItem) : null;
    const inHand = draggedItemFrom() === member.fighter.id;
    row.held.setVisible(heldFrame !== null && !inHand);
    if (heldFrame !== null) row.held.setFrame(heldFrame);
    const maxHp = restoreFighter(member.fighter).maxHp;
    const hp = member.fighter.hp;
    row.name.setText(
      member.fighter.nickname ?? getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId,
    );
    row.name.setMaxWidth(
      x +
        host.hud().partyW -
        HUD_PAD_X -
        row.name.x -
        (statusFrame !== null ? STATUS_ICON_W * HUD_PARTY_STATUS_SCALE + HUD_PARTY_STATUS_GAP : 0),
    );
    const fraction = hpFraction(hp, maxHp);
    const barScale = row.bar.scaleX;
    row.fill
      .setPosition(row.bar.x + FRLG_HPBAR.fill.x * barScale, row.bar.y + FRLG_HPBAR.fill.y * barScale)
      .setSize(
        Math.max(0, FRLG_HPBAR.fill.width * barScale * fraction),
        FRLG_HPBAR.fill.height * barScale,
      )
      .setFillStyle(hpColorInt(fraction));
  });
}

export const descriptor: RoutePanelDescriptor = {
  id: 'party',
  order: 20,
  hudPanel: 'party',
  build(host: RoutePanelHost): void {
    const scene = host.scene;
    const x = hudColumnLeft(host);
    const partyY = HUD_TOP;
    const partyH = HUD_PARTY_HEADER + MAX_PARTY_SIZE * HUD_PARTY_ROW + HUD_PAD_BOTTOM;
    hudPartyY = partyY;
    hudPartyH = partyH;
    hudRows = [];
    partyLive().body = null;

    if (DOM_HUD) {
      const { partyW } = host.hud();
      const partyWindow = addFrlgWindow(scene, x, partyY, partyW, partyH).setVisible(false);
      const panel = makeHudPanel(
        host,
        'party',
        x,
        partyY,
        partyW,
        partyH,
        scene.add.container(0, 0),
        partyWindow,
        PANEL_ICON_KEYS.party,
        PANEL_KEY_ACTIONS.party ?? null,
      );
      panel.container.setVisible(false);
      panel.icon.setVisible(false);
      mountDomPanel(host);
      return;
    }

    const { partyW, partyHpBarScale } = host.hud();
    const partyChildren: Phaser.GameObjects.GameObject[] = [];
    const partyWindow = addFrlgWindow(scene, x, partyY, partyW, partyH);
    partyChildren.push(partyWindow);
    const partyLeft = x + HUD_PAD_X;
    const partyRight = x + partyW - HUD_PAD_X;
    for (let i = 0; i < MAX_PARTY_SIZE; i++) {
      const rowY = partyY + HUD_PARTY_HEADER + i * HUD_PARTY_ROW;
      const highlight = scene.add
        .rectangle(
          partyLeft,
          rowY,
          partyRight - partyLeft,
          HUD_PARTY_ROW - 4,
          FRLG_SELECTED_FILL.colour,
          FRLG_SELECTED_FILL.alpha,
        )
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
        .setVisible(false);
      const portraitX = partyLeft + 24;
      const portrait = scene.add
        .image(portraitX, rowY + 26, PORTRAIT_TEXTURE_KEY, 0)
        .setScale(HUD_PARTY_PORTRAIT_SCALE)
        .setVisible(false);
      const held = scene.add
        .image(portraitX + 15, rowY + 39, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(HUD_HELD_ICON_SCALE)
        .setVisible(false);
      const column = partyLeft + HUD_PARTY_COLUMN;
      const name = addFrlgText(scene, column, rowY + 6, '', { size: 16, tint: FRLG_INK }).setMaxWidth(
        partyRight - column,
      );
      const status = scene.add
        .image(partyRight, rowY + 5, STATUS_ICON_TEXTURE_KEY, 0)
        .setOrigin(1, 0)
        .setScale(HUD_PARTY_STATUS_SCALE)
        .setVisible(false);
      const bar = scene.add
        .image(column, rowY + 28, FRLG_HPBAR_KEY)
        .setOrigin(0, 0)
        .setScale(partyHpBarScale)
        .setVisible(false);
      const fill = scene.add
        .rectangle(column, rowY + 28, 0, FRLG_HPBAR.fill.height * partyHpBarScale, 0x58d080)
        .setOrigin(0, 0)
        .setVisible(false);
      hudRows.push({ highlight, portrait, held, status, name, bar, fill, dark: false });
      partyChildren.push(highlight, portrait, held, name, status, bar, fill);
    }
    const partyBody = scene.add.container(0, 0, partyChildren);
    partyLive().body = partyBody;
    makeHudPanel(
      host,
      'party',
      x,
      partyY,
      partyW,
      partyH,
      partyBody,
      partyWindow,
      PANEL_ICON_KEYS.party,
      PANEL_KEY_ACTIONS.party ?? null,
    );
  },
  refresh: refreshParty,
  close(): void {
    if (!DOM_HUD) return;
    disposeDomPanel();
    partyLive().body = null;
    hudRows = [];
  },
};
