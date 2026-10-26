import { signal, type Signal } from '@preact/signals';
import type Phaser from 'phaser';
import itemIcons from '../../data/anil/item-icons.json';
import {
  ITEM_ICON_ATLAS_URL,
  ITEM_ICON_SIZE,
  ITEM_ICON_TEXTURE_KEY,
  itemIconFrame,
} from '../../data/itemIcons';
import { getItem } from '../../data/items';
import { ROUTE_LOOT } from '../../data/loot';
import { bandForMap } from '../../engine/run';
import {
  addItem,
  addPokemon,
  adoptAtLevel,
  createRunPokemon,
  equipHeldItem,
  nextMemberId,
  squadLevel,
} from '../../engine/run';
import { useItemOn } from '../../engine/run/items';
import { speciesPool } from '../../engine/run/pool';
import { hashSeed, Rng } from '../../engine/rng';
import { t } from '../../i18n';
import { FRLG_MUTED, FRLG_SELECTED_FILL, FRLG_SELECTED_STROKE } from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { addFloatingPanel, type FloatingPanel } from '../../ui/floatingPanel';
import { parseHudFlags } from '../../ui/hud/fixtures';
import {
  mountRewardsPanel,
  rewardsPanelView,
  rewardsPress,
  type RewardRowView,
  type RewardsInput,
  type RewardsIntent,
  type RewardsPanelView,
} from '../../ui/hud/panels/rewards';
import { itemPickupNotice } from '../../ui/notice';
import { pokemonRewardChoices, rewardChoices, rewardRows, type RewardRow } from '../../ui/rewards';
import type { RoomDrop } from '../rooms/types';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The mini-boss reward (`docs/maps-spec.md` §7, D33, D45): a beaten strong
 * trainer opens one **floating** card of six rows — three items from the map's
 * reward pool and three Pokémon it presents only by their highest stat and their
 * nature. The two lists ride **sibling streams**, so the item rows a fixed seed
 * already produced do not move.
 *
 * With `?hud=dom` (`D49`) the card is the HUD's Preact panel
 * (`src/ui/hud/panels/rewards/`) and this module draws nothing in Phaser: it still
 * owns the rows, the arm and the callback, and the mount paints them. A press
 * **arms** a row and a second press on the armed row — or `confirm` — **commits**
 * it, so the pick is inert until it is committed. The commit path is the shipped
 * one: an item lands in the bag through the shipped bag drop (`addItem` +
 * `commitRun` + the pickup notice) and is used on a member from the bag
 * afterwards, and a Pokémon lands in the party through `createRunPokemon` +
 * `adoptAtLevel` + `addPokemon`. With the flag off the shipped drag still drops an
 * item straight onto a member. Either way no capture is spent, `stats.catches` does
 * not move, the stored callback (the level-up beat) runs exactly once, and the two
 * `:reward:` streams are the only RNG.
 */

/**
 * `?hud=dom` read once, the way every scene module reads it. With the flag off this
 * module builds the canvas card and the Preact panel is never mounted.
 */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;
/** The item atlas' columns (`src/data/anil/item-icons.json`), for the sprite offsets. */
const ITEM_ICON_COLS: number = itemIcons.cols;
/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this folder's
 * modules never import Phaser as a value. A paused route sits under the DOM root,
 * which has to hide itself; the resume brings the card back.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';
/** The scene's own teardown: the DOM card is outside Phaser and must be unmounted. */
const SCENE_SHUTDOWN = 'shutdown';

/** The mini-boss reward choice (Phase 9): one window of item and Pokémon rows. */
const REWARD_W = 560;
const REWARD_H = 660;
const REWARD_ROW_H = 84;
/** How many items a beaten mini-boss offers (`docs/maps-spec.md` §7). */
const MINI_BOSS_REWARD_CHOICES = 3;
/** How many unidentified Pokémon the same window offers. */
const MINI_BOSS_REWARD_POKEMON_CHOICES = 3;

/** The canvas card (flag off): its floating panel, which also answers "is it up". */
let miniBossRewardPanel: FloatingPanel | null = null;
/** The DOM card (flag on): its host, view signal, mount disposer and scene subscription. */
let cardHost: RoutePanelHost | null = null;
let cardView: Signal<RewardsPanelView> | null = null;
let cardDispose: (() => void) | null = null;
let cardUnsubscribe: (() => void) | null = null;
/** Both paths' shared state: the rows on offer, the armed row and the level-up beat. */
let rewardRowsOnOffer: readonly RewardRow[] = [];
let rewardArmed = -1;
let rewardPaused = false;
let rewardOnDone: (() => void) | null = null;
/** The canvas card's display-object count, for the live flag contract (flag off). */
let shippedDrawnObjects = 0;

/**
 * The number of display objects the reward card draws in Phaser right now. Under
 * the flag the card is the DOM one and the answer is 0; with the flag off the count
 * is the built card's own (`buildMiniBossReward` reports it through
 * `noteRewardsDrawnObjects`), exactly as `shopDrawnObjectCount` reads the Mart's.
 */
export function rewardsDrawnObjectCount(): number {
  return DOM_HUD ? 0 : shippedDrawnObjects;
}

/** The canvas card reports its display-object count; under the flag nothing is drawn. */
export function noteRewardsDrawnObjects(count: number): void {
  shippedDrawnObjects = DOM_HUD ? 0 : Math.max(0, count);
}

/** True while a reward card is up, whichever path built it. */
function rewardOpen(): boolean {
  return miniBossRewardPanel !== null || cardView !== null;
}

/** Opens the reward card, or runs its callback straight away when one is up. */
export function openMiniBossReward(host: RoutePanelHost, onDone: () => void): void {
  if (rewardOpen()) {
    onDone();
    return;
  }
  const run = host.run();
  const band = bandForMap(run.mapIndex);
  const rng = new Rng(hashSeed(`${run.seed}:reward:${run.mapIndex}`));
  const items = rewardChoices(ROUTE_LOOT[band.id].pool, MINI_BOSS_REWARD_CHOICES, rng);
  const pokemon = pokemonRewardChoices({
    pool: speciesPool(band, 'wild'),
    count: MINI_BOSS_REWARD_POKEMON_CHOICES,
    level: squadLevel(run),
    learnsetSeed: run.seed,
    rng: new Rng(hashSeed(`${run.seed}:reward:${run.mapIndex}:pokemon`)),
  });
  const rows = rewardRows(items, pokemon);
  if (rows.length === 0) {
    onDone();
    return;
  }
  rewardOnDone = onDone;
  rewardRowsOnOffer = rows;
  rewardArmed = -1;
  rewardPaused = false;
  if (DOM_HUD) openRewardsCard(host);
  else buildMiniBossReward(host, rows);
}

/** Tears the reward card down and runs its callback (the level-up beat). */
export function closeMiniBossReward(): void {
  const onDone = rewardOnDone;
  rewardOnDone = null;
  closeRewardsCard();
  miniBossRewardPanel?.destroy();
  miniBossRewardPanel = null;
  rewardRowsOnOffer = [];
  rewardArmed = -1;
  shippedDrawnObjects = 0;
  onDone?.();
}

/** The atlas cell for an item, as the panel's `background-position` pair. */
function rewardIcon(itemId: string): RewardRowView['icon'] {
  const frame = itemIconFrame(itemId);
  if (frame === null) return null;
  return {
    url: ITEM_ICON_ATLAS_URL,
    size: ITEM_ICON_SIZE,
    x: (frame % ITEM_ICON_COLS) * ITEM_ICON_SIZE,
    y: Math.floor(frame / ITEM_ICON_COLS) * ITEM_ICON_SIZE,
  };
}

/** The view's viewport: the scene's own window, which the card is centred in. */
function viewport(host: RoutePanelHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

/**
 * The rows as the panel reads them: an item row carries its name, its description
 * and its atlas cell; a Pokémon row carries its label and nothing else.
 */
function rewardRowViews(): readonly RewardRowView[] {
  return rewardRowsOnOffer.map((row, index): RewardRowView => ({
    index,
    kind: row.kind,
    label: row.kind === 'item' ? row.name : row.label,
    description: row.kind === 'item' ? row.description : '',
    icon: row.kind === 'item' ? rewardIcon(row.itemId) : null,
    armed: false,
    box: { x: 0, y: 0, w: 0, h: 0 },
  }));
}

/** This module's own state, as the pure view takes it. */
function rewardsInput(): RewardsInput {
  return {
    title: t('reward.title'),
    choose: t('reward.choose'),
    rows: rewardRowViews(),
    armed: rewardArmed,
    open: !rewardPaused,
  };
}

/** Repaints the DOM card from the rows and the arm; a paused route hides it. */
function paintRewards(host: RoutePanelHost): void {
  const view = cardView;
  if (view === null) return;
  cardHost = host;
  view.value = rewardsPanelView(rewardsInput(), viewport(host));
}

/**
 * Opens the DOM card: the view is this module's own rows, the mount is the `#hud`
 * layer. A missing layer mounts nothing, exactly as the shipped DOM panels guard it.
 */
function openRewardsCard(host: RoutePanelHost): void {
  cardHost = host;
  rewardPaused = host.scene.sys.isPaused();
  const painted = signal(rewardsPanelView(rewardsInput(), viewport(host)));
  cardView = painted;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null) {
    cardDispose = mountRewardsPanel(layer, painted, (intent) => handleRewardsIntent(host, intent));
  }
  const events = host.scene.events;
  const onPause = (): void => setRewardsPaused(true);
  const onResume = (): void => setRewardsPaused(false);
  const onShutdown = (): void => closeMiniBossReward();
  events.on(SCENE_PAUSE, onPause);
  events.on(SCENE_RESUME, onResume);
  events.on(SCENE_SHUTDOWN, onShutdown);
  cardUnsubscribe = () => {
    events.off(SCENE_PAUSE, onPause);
    events.off(SCENE_RESUME, onResume);
    events.off(SCENE_SHUTDOWN, onShutdown);
  };
}

/** Tears the DOM card down: the scene subscription, the mount and the session state. */
function closeRewardsCard(): void {
  cardUnsubscribe?.();
  cardUnsubscribe = null;
  cardDispose?.();
  cardDispose = null;
  cardView = null;
  cardHost = null;
  rewardPaused = false;
}

function setRewardsPaused(paused: boolean): void {
  if (rewardPaused === paused) return;
  rewardPaused = paused;
  const host = cardHost;
  if (host !== null) paintRewards(host);
}

/** The committed row's shipped drop: an item to the bag, a Pokémon to the party. */
function commitReward(host: RoutePanelHost, index: number): void {
  const row = rewardRowsOnOffer[index];
  if (row === undefined) return;
  takeMiniBossReward(host, row, row.kind === 'item' ? { onto: 'bag' } : { onto: 'party' });
}

/** The card's own command channel: the one place anything is written. */
function handleRewardsIntent(host: RoutePanelHost, intent: RewardsIntent): void {
  if (cardView === null) return;
  switch (intent.type) {
    case 'arm': {
      const action = rewardsPress(rewardArmed, intent.index, rewardRowsOnOffer.length);
      rewardArmed = action.armed;
      if (action.commit !== null) {
        commitReward(host, action.commit);
        return;
      }
      paintRewards(host);
      return;
    }
    case 'commit': {
      if (rewardRowsOnOffer.length === 0) return;
      // The keyboard's confirm is the second press: arming the first row when
      // nothing is armed, committing the armed one otherwise.
      if (rewardArmed < 0) {
        rewardArmed = 0;
        paintRewards(host);
        return;
      }
      commitReward(host, rewardArmed);
      return;
    }
    case 'close':
      closeMiniBossReward();
      return;
    default:
      return;
  }
}

/** Builds the reward card: the item rows first, then the anonymous Pokémon rows. */
function buildMiniBossReward(host: RoutePanelHost, rows: readonly RewardRow[]): void {
  const scene = host.scene;
  const panel = addFloatingPanel(scene, {
    width: REWARD_W,
    height: REWARD_H,
    title: t('reward.title'),
    onClose: () => closeMiniBossReward(),
  });
  miniBossRewardPanel = panel;
  const content = panel.content;
  const left = content.x;
  const width = content.w;
  const children: Phaser.GameObjects.GameObject[] = [
    addFrlgText(scene, left, content.y, t('reward.choose'), { size: 16, tint: FRLG_MUTED }),
  ];
  const rowsTop = content.y + 34;
  rows.forEach((row, i) => {
    const rowY = rowsTop + i * REWARD_ROW_H;
    const highlight = scene.add
      .rectangle(
        left,
        rowY,
        width,
        REWARD_ROW_H - 8,
        FRLG_SELECTED_FILL.colour,
        FRLG_SELECTED_FILL.alpha,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
      .setVisible(false);
    const zone = scene.add
      .zone(left, rowY, width, REWARD_ROW_H - 8)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => highlight.setVisible(true));
    zone.on('pointerout', () => highlight.setVisible(false));
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      host.beginRowDrag({
        itemId: row.kind === 'item' ? row.itemId : null,
        label: row.kind === 'item' ? row.name : row.label,
        pointer: { x: pointer.x, y: pointer.y },
        onDrop: (drop) => takeMiniBossReward(host, row, drop),
      });
    });
    // A Pokémon row prints its label on the row's own line and nothing above it,
    // so an unidentified option can never leak a name, an icon or a description.
    if (row.kind === 'item') {
      const icon = scene.add
        .image(left + 26, rowY + 26, ITEM_ICON_TEXTURE_KEY, itemIconFrame(row.itemId) ?? 0)
        .setScale(1.1);
      const name = addFrlgText(scene, left + 56, rowY + 8, row.name, {
        size: 20,
        tint: FRLG_INK,
      });
      const desc = addFrlgText(scene, left + 56, rowY + 38, row.description, {
        size: 16,
        tint: FRLG_MUTED,
      }).setMaxWidth(width - 80);
      children.push(highlight, icon, name, desc, zone);
      return;
    }
    const name = addFrlgText(scene, left + 16, rowY + 30, row.label, {
      size: 20,
      tint: FRLG_INK,
    });
    children.push(highlight, name, zone);
  });
  children.push(
    addFrlgText(scene, left, content.y + content.h - 20, t('reward.controls'), {
      size: 16,
      tint: FRLG_MUTED,
    }),
  );
  panel.root.add(children);
  noteRewardsDrawnObjects(panel.root.list.length);
}

/**
 * Takes one reward row on its drop and closes: an item joins the bag first and
 * only then spends or equips itself on the member (an item that does not apply
 * stays in the bag); a Pokémon lands through the **shipped placement** —
 * `createRunPokemon` adopted at the squad's level into `addPokemon` (a full
 * party sends it to the box) — and is **not a catch**: no room capture is spent,
 * `stats.catches` moves and nothing is recorded about the room. Any other drop leaves
 * the card up and changes nothing.
 */
function takeMiniBossReward(host: RoutePanelHost, row: RewardRow, drop: RoomDrop): void {
  if (!rewardOpen()) return;
  const run = host.run();
  if (row.kind === 'pokemon') {
    if (drop.onto !== 'party') return;
    const option = row.option;
    const member = adoptAtLevel(
      createRunPokemon({
        id: nextMemberId(run),
        speciesId: option.speciesId,
        level: option.level,
        nature: option.nature,
        learnsetSeed: run.seed,
      }),
      squadLevel(run),
      run.seed,
    );
    host.commitRun(addPokemon(run, member));
    closeMiniBossReward();
    return;
  }
  if (drop.onto !== 'bag' && drop.onto !== 'member') return;
  let next = addItem(run, row.itemId);
  if (drop.onto === 'member') {
    const kind = getItem(row.itemId)?.kind;
    if (kind === 'heal' || kind === 'status') next = useItemOn(next, drop.memberId, row.itemId);
    else if (kind === 'held') next = equipHeldItem(next, drop.memberId, row.itemId);
  }
  host.commitRun(next);
  host.showNotice(itemPickupNotice(getItem(row.itemId)?.name ?? row.itemId));
  closeMiniBossReward();
}

export const descriptor: RoutePanelDescriptor = {
  id: 'rewards',
  order: 70,
  build(): void {
    miniBossRewardPanel = null;
    cardHost = null;
    cardView = null;
    rewardRowsOnOffer = [];
    rewardArmed = -1;
    rewardPaused = false;
    rewardOnDone = null;
    shippedDrawnObjects = 0;
  },
};
