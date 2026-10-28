import { signal, type Signal } from '@preact/signals';
import itemIcons from '../../data/anil/item-icons.json';
import { ITEM_ICON_ATLAS_URL, ITEM_ICON_SIZE, itemIconFrame } from '../../data/itemIcons';
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
 * The card is the HUD's Preact panel (`src/ui/hud/panels/rewards/`) and this module
 * draws nothing in Phaser: it owns the rows, the arm and the callback, and the mount
 * paints them. A press **arms** a row and a second press on the armed row — or
 * `confirm` — **commits** it, so the pick is inert until it is committed. The commit
 * path is the shipped one: an item lands in the bag through the shipped bag drop
 * (`addItem` + `commitRun` + the pickup notice) and is used on a member from the bag
 * afterwards, and a Pokémon lands in the party through `createRunPokemon` +
 * `adoptAtLevel` + `addPokemon`. No capture is spent, `stats.catches` does not move,
 * the stored callback (the level-up beat) runs exactly once, and the two `:reward:`
 * streams are the only RNG.
 */

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

/** How many items a beaten mini-boss offers (`docs/maps-spec.md` §7). */
const MINI_BOSS_REWARD_CHOICES = 3;
/** How many unidentified Pokémon the same window offers. */
const MINI_BOSS_REWARD_POKEMON_CHOICES = 3;

/** The card's session: its host, view signal, mount disposer and scene subscription. */
let cardHost: RoutePanelHost | null = null;
let cardView: Signal<RewardsPanelView> | null = null;
let cardDispose: (() => void) | null = null;
let cardUnsubscribe: (() => void) | null = null;
/** The rows on offer, the armed row and the level-up beat. */
let rewardRowsOnOffer: readonly RewardRow[] = [];
let rewardArmed = -1;
let rewardPaused = false;
let rewardOnDone: (() => void) | null = null;
/** The number of display objects the reward card draws in Phaser: none, it is the DOM card. */
export function rewardsDrawnObjectCount(): number {
  return 0;
}

/** The retired canvas card's reporter, kept so the count contract's call sites compile. */
export function noteRewardsDrawnObjects(_count: number): void {}

/** True while a reward card is up. */
function rewardOpen(): boolean {
  return cardView !== null;
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
  openRewardsCard(host);
}

/** Tears the reward card down and runs its callback (the level-up beat). */
export function closeMiniBossReward(): void {
  const onDone = rewardOnDone;
  rewardOnDone = null;
  closeRewardsCard();
  rewardRowsOnOffer = [];
  rewardArmed = -1;
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

/**
 * Takes one reward row on its drop and closes: an item joins the bag first and
 * only then spends or equips itself on the member (an item that does not apply
 * stays in the bag); a Pokémon lands through the **shipped placement** —
 * `createRunPokemon` adopted at the squad's level into `addPokemon` (a full
 * party sends it to the box) — and is **not a catch**: no room capture is spent,
 * no `stats.catches` moves and nothing about the room is recorded. Any other drop leaves
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
    cardHost = null;
    cardView = null;
    rewardRowsOnOffer = [];
    rewardArmed = -1;
    rewardPaused = false;
    rewardOnDone = null;
  },
};
