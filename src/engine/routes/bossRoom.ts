import { healParty } from '../run/heal';
import { isItemPicked, markItemPicked, type RunState } from '../run/state';

/**
 * The boss room's own rules (`docs/maps-spec.md` §6): the door sealed behind the
 * run until the boss falls and the one free heal the room gives when it is first
 * built on a floor. Pure, and no RNG: the room's opening is a data read
 * (`bossOpeningRoll`, `src/engine/routes/battlefield.ts`).
 */

/** The `pickedItems` mark of the boss room's one heal on `mapIndex`: `boss-heal-<mapIndex>`. */
export function bossHealId(mapIndex: number): string {
  return `boss-heal-${mapIndex}`;
}

/**
 * True while the boss room refuses to let the run walk back out (`docs/maps-spec.md`
 * §6): `boss && !bossDefeated`. Reads no RNG and no run state.
 */
export function bossRoomSealed(boss: boolean, bossDefeated: boolean): boolean {
  return boss && !bossDefeated;
}

/**
 * The boss room's one free heal: `healParty` (party **and** box, HP and PP, never a
 * resurrection, D5) once per floor, recorded as `bossHealId(mapIndex)` in
 * `pickedItems` — which `advanceMap` clears, so the next floor heals again. A second
 * call on the same floor returns the **same object**. Reads no RNG.
 */
export function bossRoomHeal(run: RunState, mapIndex: number): RunState {
  const healId = bossHealId(mapIndex);
  if (isItemPicked(run, healId)) return run;
  return markItemPicked(healParty(run), healId);
}
