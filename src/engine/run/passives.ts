import { getAbility } from '../../data/dex/abilities';
import { mapPassivesFor, type MapPassiveTrigger } from '../../data/passives';
import { hashSeed, Rng } from '../rng';
import { addItem, isItemPicked, markItemPicked, type RunState } from './state';

/**
 * The map passives (`docs/routes-spec.md` §2): a party member's **out-of-battle**
 * ability pays an item when a room is entered (`'room'`) or when a battle in the
 * room is won (`'win'`). The rows are data (`MAP_PASSIVES`), this file is the whole
 * rule. Pure: no Phaser, no DOM, no storage, no clock, and the only draw is the
 * row's own minted stream, so no shipped stream moves (D11).
 */

/** One payment a room's passives made. */
export type PassivePickup = Readonly<{
  /** The dex ability id (`'pickup'`). */
  ability: string;
  /** The row's trigger. */
  trigger: MapPassiveTrigger;
  /** The catalogue id that landed in the bag. */
  itemId: string;
  /** The per-floor `pickedItems` mark that makes this row's payment one-shot. */
  mark: string;
}>;

export type PassiveResult = Readonly<{
  /** The run after the payments; the **same reference** when nothing was picked. */
  run: RunState;
  /** What landed in the bag, in `MAP_PASSIVES` order. */
  picks: readonly PassivePickup[];
}>;

/**
 * The stable per-floor mark of one row: `passive-<ability>-<trigger>-<mapIndex>-<roomId>`.
 * `ability` is the dex id (`getAbility`'s), so a display name can never leak in.
 */
export function passiveMark(
  ability: string,
  trigger: MapPassiveTrigger,
  mapIndex: number,
  roomId: number,
): string {
  return `passive-${ability}-${trigger}-${mapIndex}-${roomId}`;
}

/**
 * Folds every `MAP_PASSIVES` row whose `trigger` matches and whose ability **the
 * party** holds. The box is never asked (`docs/routes-spec.md` §2). Each paying row
 * mints `${seed}:passive:${mapIndex}:${roomId}:${ability}`, rolls its chance and
 * then one item from its list, adds it with `addItem` and records its mark in
 * `pickedItems`, which `advanceMap` clears: a room pays each row at most once per
 * floor, and a revisit or a reload pays nothing.
 */
export function runPassives(run: RunState, trigger: MapPassiveTrigger): PassiveResult {
  const held = new Set<string>();
  for (const member of run.party) {
    const id = getAbility(member.fighter.ability)?.id;
    if (id) held.add(id);
  }
  const picks: PassivePickup[] = [];
  let next = run;
  for (const row of mapPassivesFor(trigger)) {
    if (!held.has(row.ability)) continue;
    const mark = passiveMark(row.ability, row.trigger, run.mapIndex, run.routeInMap);
    if (isItemPicked(next, mark)) continue;
    const rng = new Rng(
      hashSeed(`${run.seed}:passive:${run.mapIndex}:${run.routeInMap}:${row.ability}`),
    );
    if (rng.next() >= row.effect.chance) continue;
    const itemId = row.effect.itemIds[rng.int(0, row.effect.itemIds.length - 1)];
    next = markItemPicked(addItem(next, itemId), mark);
    picks.push({ ability: row.ability, trigger: row.trigger, itemId, mark });
  }
  return { run: next, picks };
}
