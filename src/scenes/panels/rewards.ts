import type Phaser from 'phaser';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../../data/itemIcons';
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
import { itemPickupNotice } from '../../ui/notice';
import { pokemonRewardChoices, rewardChoices, rewardRows, type RewardRow } from '../../ui/rewards';
import type { RoomDrop } from '../rooms/types';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The mini-boss reward (`docs/maps-spec.md` §7, D33, D45): a beaten strong
 * trainer opens one **floating** card of six rows — three items from the map's
 * reward pool and three Pokémon it presents only by their highest stat and their
 * nature. A row is taken by dragging it onto the bag or the party; the ✕ leaves
 * it, and either way the stored callback (the level-up beat) runs. The two lists
 * ride **sibling streams**, so the item rows a fixed seed already produced do
 * not move.
 */

/** The mini-boss reward choice (Phase 9): one window of item and Pokémon rows. */
const REWARD_W = 560;
const REWARD_H = 660;
const REWARD_ROW_H = 84;
/** How many items a beaten mini-boss offers (`docs/maps-spec.md` §7). */
const MINI_BOSS_REWARD_CHOICES = 3;
/** How many unidentified Pokémon the same window offers. */
const MINI_BOSS_REWARD_POKEMON_CHOICES = 3;

/** The mini-boss reward window: its floating card, root and callback. */
let miniBossRewardPanel: FloatingPanel | null = null;
let miniBossRewardRoot: Phaser.GameObjects.Container | null = null;
let miniBossRewardOnDone: (() => void) | null = null;

/** Opens the reward card, or runs its callback straight away when one is up. */
export function openMiniBossReward(host: RoutePanelHost, onDone: () => void): void {
  if (miniBossRewardPanel) {
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
  miniBossRewardOnDone = onDone;
  buildMiniBossReward(host, rows);
}

/** Tears down the reward card and runs its callback (the level-up beat). */
export function closeMiniBossReward(): void {
  const onDone = miniBossRewardOnDone;
  miniBossRewardOnDone = null;
  miniBossRewardPanel?.destroy();
  miniBossRewardPanel = null;
  miniBossRewardRoot = null;
  onDone?.();
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
  miniBossRewardRoot = panel.root;
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
}

/**
 * Takes one reward row on its drop and closes: an item joins the bag first and
 * only then spends or equips itself on the member (an item that does not apply
 * stays in the bag); a Pokémon lands through the **shipped placement** —
 * `createRunPokemon` adopted at the squad's level into `addPokemon` (a full
 * party sends it to the box) — and is **not a catch**: no room capture is spent,
 * no `stats.catches` moves and no `pcCatch` is recorded. Any other drop leaves
 * the card up and changes nothing.
 */
function takeMiniBossReward(host: RoutePanelHost, row: RewardRow, drop: RoomDrop): void {
  if (!miniBossRewardRoot) return;
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
    miniBossRewardRoot = null;
    miniBossRewardOnDone = null;
  },
};
