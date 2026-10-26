import { CASINO, EGG_ITEM_ID, type CasinoPrize } from '../data/casino';
import { getItem } from '../data/items';
import { LEVEL_BANDS, type BandId } from '../data/run';
import { SHOP_ROTATION } from '../data/shop';
import { UNMODELLED_ITEMS } from '../engine/battle/effects/items';
import { hashSeed, Rng } from '../engine/rng';
import { bandForMap } from '../engine/run/floors';
import { speciesPool } from '../engine/run/pool';
import { adoptAtLevel, createRunPokemon, type RunPokemon } from '../engine/run/progression';
import {
  addItem,
  addPokemon,
  consumeItem,
  isItemPicked,
  itemCount,
  markItemPicked,
  nextMemberId,
  spendMoney,
  squadLevel,
  type RunState,
} from '../engine/run/state';

/**
 * The **slot machine**'s model (`docs/maps-spec.md` §7, D33/D47): one spin and the
 * Egg's hatch, both **pure functions of the run** (`D11`). The run seed, the floor,
 * the money and the floor's own spin marks are the whole input and the stream is
 * minted here, so a reloaded run continues the same sequence and no other stream in
 * the game moves. Phaser-free, so the Team Rocket NPC's panel
 * (`src/ui/rocketPanel.ts`) only renders and every rule is unit-tested headless.
 */

/** The floor's spin counter id (`pickedItems`), one per spin: `casino-spin-<map>-<n>`. */
export function casinoSpinId(mapIndex: number, index: number): string {
  return `casino-spin-${mapIndex}-${index}`;
}

/** The floor's machine lock (`pickedItems`): `casino-lock-<map>`. */
export function casinoLockId(mapIndex: number): string {
  return `casino-lock-${mapIndex}`;
}

/** The grunt's stable trainer id (`defeatedTrainers`): `casino-grunt-<map>`. */
export function casinoGruntTrainerId(mapIndex: number): string {
  return `casino-grunt-${mapIndex}`;
}

/** What one paying spin produced. */
export type CasinoOutcome =
  Readonly<{ kind: 'item'; itemId: string }> | Readonly<{ kind: 'egg' }> | Readonly<{ kind: 'battle' }>;

/** One spin's result: the run afterwards, whether it happened, and why not. */
export type CasinoSpin = Readonly<{
  run: RunState;
  ok: boolean;
  /** Present when `ok` is false. */
  reason?: 'locked' | 'no-money';
  /** Present when `ok` is true. */
  outcome?: CasinoOutcome;
}>;

/** The prefix every spin mark of a floor shares, so the count is a plain filter. */
const SPIN_PREFIX = 'casino-spin-';

/**
 * One band's Mart shelf as the machine sees it: `SHOP_ROTATION[band]` in table
 * order, without an id the catalogue does not hold, a consumable (`consumed`) and
 * an id the battle engine does not model (`UNMODELLED_ITEMS`), deduplicated.
 */
function shelfPool(band: BandId): readonly string[] {
  const pool: string[] = [];
  for (const entry of SHOP_ROTATION[band]) {
    const item = getItem(entry.itemId);
    if (!item || item.consumed === true) continue;
    if (UNMODELLED_ITEMS.includes(entry.itemId)) continue;
    if (pool.includes(entry.itemId)) continue;
    pool.push(entry.itemId);
  }
  return pool;
}

/**
 * The band's equipable pool: `SHOP_ROTATION[band]` filtered by `shelfPool`. A band
 * with no equipable of its own (the two berry-only on-ramp shelves) falls back to
 * the **first band above** it that has one in `LEVEL_BANDS` order, so `early` and
 * `low` both draw `mid`'s shelf; `[]` only when no band above has one either.
 */
export function casinoHeldPool(band: BandId): readonly string[] {
  const bands = LEVEL_BANDS.map((row) => row.id);
  for (let i = Math.max(0, bands.indexOf(band)); i < bands.length; i++) {
    const pool = shelfPool(bands[i]);
    if (pool.length > 0) return pool;
  }
  return [];
}

/** How many spins this floor has already paid for: the id the next stream reads. */
function spinCount(run: RunState, mapIndex: number): number {
  const prefix = `${SPIN_PREFIX}${mapIndex}-`;
  return run.pickedItems.filter((id) => id.startsWith(prefix)).length;
}

/**
 * The row a weighted pick lands: **one** draw over the usable rows' cumulative
 * weights, the same shape `rewardChoices` uses (`src/ui/rewards.ts`). A row whose
 * weight is `<= 0` is skipped, a `'held'` row is usable without an id (its id is
 * drawn later), and a band with no usable row pays nothing (the shipped table
 * always has one).
 */
function drawPrize(rows: readonly CasinoPrize[], rng: Rng): CasinoPrize | null {
  const usable = rows.filter(
    (row) => row.weight > 0 && (row.kind !== 'item' || (row.itemId ?? '') !== ''),
  );
  if (usable.length === 0) return null;
  const total = usable.reduce((sum, row) => sum + row.weight, 0);
  let roll = rng.int(0, total - 1);
  let index = usable.length - 1;
  for (let i = 0; i < usable.length; i++) {
    roll -= usable[i].weight;
    if (roll < 0) {
      index = i;
      break;
    }
  }
  return usable[index];
}

/**
 * The catalogue id a drawn row pays. A grouped `'held'` row resolves here, with the
 * spin stream's **last** draw over the band's own pool, so every reader past
 * `casinoSpin` still sees one paid item id; a band with no pool, and the Egg row,
 * pay no id (the Egg).
 */
function prizeItemId(row: CasinoPrize, band: BandId, rng: Rng): string | null {
  if (row.kind === 'item') return row.itemId ?? null;
  if (row.kind !== 'held') return null;
  const pool = casinoHeldPool(band);
  return pool.length > 0 ? pool[rng.int(0, pool.length - 1)] : null;
}

/**
 * One spin, as a **pure function of the run** (`D11`): `run.seed`, `run.mapIndex`,
 * the money and the floor's own spin marks are the whole input, and the stream is
 * minted inside. Refused without spending when the machine is locked or the run
 * cannot afford the band's price; otherwise the price is spent, the spin is marked
 * and one outcome is rolled.
 */
export function casinoSpin(run: RunState): CasinoSpin {
  const mapIndex = run.mapIndex;
  if (isItemPicked(run, casinoLockId(mapIndex))) return { run, ok: false, reason: 'locked' };
  const band = bandForMap(mapIndex);
  const price = CASINO.price[band.id];
  if (run.money < price) return { run, ok: false, reason: 'no-money' };

  const index = spinCount(run, mapIndex);
  const rng = new Rng(hashSeed(`${run.seed}:casino:${mapIndex}:${index}`));
  const battle = rng.next() < CASINO.battleChance;
  let spun = markItemPicked(spendMoney(run, price), casinoSpinId(mapIndex, index));
  if (battle) {
    // The lock is set the moment the battle triggers, so the machine is out of
    // order for the rest of the floor even if the player flees the fight.
    return {
      run: markItemPicked(spun, casinoLockId(mapIndex)),
      ok: true,
      outcome: { kind: 'battle' },
    };
  }
  const prize = drawPrize(CASINO.prizes[band.id], rng);
  const itemId = prize ? prizeItemId(prize, band.id, rng) : null;
  if (itemId !== null) {
    return {
      run: addItem(spun, itemId),
      ok: true,
      outcome: { kind: 'item', itemId },
    };
  }
  return { run: addItem(spun, EGG_ITEM_ID), ok: true, outcome: { kind: 'egg' } };
}

/** The Egg that hatched: the run afterwards and the member it became. */
export type EggHatch = Readonly<{ run: RunState; member: RunPokemon }>;

/**
 * Hatches **one** Egg on the floor advance, or null when the run holds none (or the
 * band's pool resolves to nothing, in which case the Egg **stays** in the bag). One
 * Egg leaves the bag and one member is placed, exactly the shipped reward path:
 * `createRunPokemon({ id: nextMemberId(run), speciesId, level: squadLevel(run),
 * learnsetSeed: run.seed })` → `adoptAtLevel(member, squadLevel(run), run.seed)` →
 * `addPokemon` (a full party sends it to the box, `D7`). It is **not a catch**: no
 * `stats.catches`, no `caughtSpecies`, no `capturedRooms`. Pure, like
 * the rest of the run.
 */
export function hatchEgg(run: RunState): EggHatch | null {
  if (itemCount(run, EGG_ITEM_ID) <= 0) return null;
  const mapIndex = run.mapIndex;
  const band = bandForMap(mapIndex);
  const pool = speciesPool(band, 'wild');
  if (pool.length === 0) return null;
  const rng = new Rng(hashSeed(`${run.seed}:casino-egg:${mapIndex}`));
  const speciesId = pool[rng.int(0, pool.length - 1)];
  const level = squadLevel(run);
  const member = adoptAtLevel(
    createRunPokemon({ id: nextMemberId(run), speciesId, level, learnsetSeed: run.seed }),
    level,
    run.seed,
  );
  return { run: addPokemon(consumeItem(run, EGG_ITEM_ID), member), member };
}
