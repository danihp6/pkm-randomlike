import { describe, expect, it } from 'vitest';
import { CASINO, EGG_ITEM_ID, type CasinoPrize } from '../data/casino';
import { getItem } from '../data/items';
import { levelCapForMap } from '../data/maps';
import { LEVEL_BANDS, type BandId } from '../data/run';
import { SHOP_ROTATION } from '../data/shop';
import { UNMODELLED_ITEMS } from '../engine/battle/effects/items';
import { hashSeed, Rng } from '../engine/rng';
import {
  addItem,
  addMoney,
  bandForMap,
  createRun,
  createRunPokemon,
  squadLevel,
  type RunState,
} from '../engine/run';
import { speciesPool } from '../engine/run/pool';
import { MAX_PARTY_SIZE } from '../engine/run/state';
import {
  casinoGruntTrainerId,
  casinoHeldPool,
  casinoLockId,
  casinoSpin,
  casinoSpinId,
  hatchEgg,
} from './casino';

/**
 * The casino's model pinned by seed (`pkm-64` on map 5 spins nugget → ultraball →
 * fullrestore → lifeorb → egg, its fourth spin the **grouped** draw paying a Life
 * Orb; `pkm-111` spins ultraball → fullrestore → egg; `casino-a` spins the battle
 * first). The values were read off this build and are never re-derived: a moved
 * stream is a defect, not a re-pin.
 */

const MAP = 5;
const SEED = 'pkm-64';

/** Every band id, in the shipped order. */
const BANDS: readonly BandId[] = LEVEL_BANDS.map((band) => band.id);

/** The late-band seeds whose weighted pick lands on the grouped equipable row. */
const GROUPED_SEEDS: readonly string[] = ['held-25', 'held-31', 'held-36'];

/** An id the machine may pay: catalogue item, not a consumable, modelled by the engine. */
function isModelled(itemId: string): boolean {
  const item = getItem(itemId);
  return item !== undefined && item.consumed !== true && !UNMODELLED_ITEMS.includes(itemId);
}

/** The run every spin below reads: a starter at level 5 on map 5, with money. */
function baseRun(seed = SEED, mapIndex = MAP, money = 100_000): RunState {
  const created = addMoney(
    createRun({
      seed,
      starter: createRunPokemon({
        id: 'starter',
        speciesId: 'charmander',
        level: 5,
        moves: ['scratch'],
      }),
    }),
    money,
  );
  return { ...created, mapIndex, levelCap: levelCapForMap(mapIndex) };
}

/** The band's own price, so a moved price table fails this test too. */
function priceFor(run: RunState): number {
  return CASINO.price[bandForMap(run.mapIndex).id];
}

/** A band's total row weight, the denominator of its shares. */
function totalOf(band: BandId): number {
  return CASINO.prizes[band].reduce((sum, row) => sum + row.weight, 0);
}

/** The paid id of a spin's outcome, or `''` for the Egg and the fight. */
function paidId(outcome: ReturnType<typeof casinoSpin>['outcome']): string {
  return outcome?.kind === 'item' ? outcome.itemId : '';
}

describe('the casino ids', () => {
  it("names the floor's own spin, lock and grunt", () => {
    expect(casinoSpinId(5, 0)).toBe('casino-spin-5-0');
    expect(casinoSpinId(10, 3)).toBe('casino-spin-10-3');
    expect(casinoLockId(5)).toBe('casino-lock-5');
    expect(casinoGruntTrainerId(5)).toBe('casino-grunt-5');
  });
});

describe('casinoHeldPool', () => {
  it("falls back from the two on-ramp bands to mid's shelf", () => {
    expect(casinoHeldPool('early')).toEqual(casinoHeldPool('mid'));
    expect(casinoHeldPool('low')).toEqual(casinoHeldPool('mid'));
    // `SHOP_ROTATION.mid` in table order, without the berries and the Normal Gem.
    expect(casinoHeldPool('mid')).toEqual([
      'charcoal',
      'mysticwater',
      'widelens',
      'muscleband',
      'wiseglasses',
      'ironball',
      'laggingtail',
    ]);
  });

  it('keeps every band a non-empty, distinct list of modelled equipables in shelf order', () => {
    for (const band of BANDS) {
      const pool = casinoHeldPool(band);
      expect(pool.length, band).toBeGreaterThan(0);
      expect(new Set(pool).size, band).toBe(pool.length);
      for (const itemId of pool) {
        expect(getItem(itemId), `${band} ${itemId}`).toBeDefined();
        expect(getItem(itemId)!.consumed, `${band} ${itemId}`).not.toBe(true);
        expect(UNMODELLED_ITEMS, `${band} ${itemId}`).not.toContain(itemId);
      }
      // The list is a subsequence of the shelf that supplies it: own band first,
      // else the first band above it that lists a modelled equipable.
      const start = BANDS.indexOf(band);
      const shelf = BANDS.slice(start).find((id) =>
        SHOP_ROTATION[id].some((entry) => isModelled(entry.itemId)),
      )!;
      const order = SHOP_ROTATION[shelf].map((entry) => entry.itemId);
      const positions = pool.map((itemId) => order.indexOf(itemId));
      expect(positions[0], `${band} ${shelf}`).toBeGreaterThanOrEqual(0);
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i], `${band} ${shelf}`).toBeGreaterThan(positions[i - 1]);
      }
    }
  });

  it('still reaches each removed fixed id through the shelf', () => {
    const reachable = new Set(BANDS.flatMap((band) => casinoHeldPool(band)));
    for (const itemId of ['charcoal', 'expertbelt', 'lifeorb', 'leftovers']) {
      expect(reachable, itemId).toContain(itemId);
    }
  });
});

describe('the casino shares', () => {
  it('gives the grouped row 0.85 × 1 / total, ≈ 7.1 / 6.5 / 9.4 / 12.1 / 10.6 / 10.6 %', () => {
    const shares = BANDS.map((band) => (1 - CASINO.battleChance) * (1 / totalOf(band)));
    const published = [0.071, 0.065, 0.094, 0.121, 0.106, 0.106];
    shares.forEach((share, i) => expect(share, BANDS[i]).toBeCloseTo(published[i], 3));
  });

  it('keeps the Egg and every other row at 0.85 × its weight / total', () => {
    for (const band of BANDS) {
      const total = totalOf(band);
      for (const row of CASINO.prizes[band]) {
        const chance = (1 - CASINO.battleChance) * (row.weight / total);
        expect(chance, `${band} ${row.kind}`).toBeCloseTo((0.85 * row.weight) / total, 5);
      }
      // The Egg is one weight of each band's total, so its absolute share is the
      // grouped row's own at every band (both weigh 1).
      const eggRow = CASINO.prizes[band].find((row) => row.kind === 'egg')!;
      expect((1 - CASINO.battleChance) * (eggRow.weight / total), band).toBeCloseTo(
        (0.85 * 1) / total,
        5,
      );
    }
  });
});

describe('casinoSpin', () => {
  it('refuses a locked machine without spending, and returns the same run object', () => {
    const run = baseRun();
    const locked: RunState = { ...run, pickedItems: [casinoLockId(run.mapIndex)] };
    const spin = casinoSpin(locked);
    expect(spin.ok).toBe(false);
    expect(spin.reason).toBe('locked');
    expect(spin.run).toBe(locked);
    expect(spin.run.money).toBe(run.money);
  });

  it('refuses a spin the run cannot afford, and returns the same run object', () => {
    const run = baseRun(SEED, MAP, priceFor(baseRun()) - 1);
    const spin = casinoSpin(run);
    expect(spin.ok).toBe(false);
    expect(spin.reason).toBe('no-money');
    expect(spin.run).toBe(run);
    expect(spin.run.pickedItems).toEqual([]);
  });

  it('draws no stream on a refusal: the next paying spin is still the first one', () => {
    const run = baseRun();
    const poor: RunState = { ...run, money: 0 };
    casinoSpin(poor);
    casinoSpin(poor);
    casinoSpin({ ...run, pickedItems: [casinoLockId(MAP)] });
    const spin = casinoSpin(run);
    expect(spin.outcome).toEqual({ kind: 'item', itemId: 'nugget' });
  });

  it('spends exactly the band price and marks the spin', () => {
    const run = baseRun();
    const spin = casinoSpin(run);
    expect(spin.ok).toBe(true);
    expect(spin.run.money).toBe(run.money - priceFor(run));
    expect(priceFor(run)).toBe(2000);
    expect(spin.run.pickedItems).toEqual([casinoSpinId(MAP, 0)]);
    expect(spin.outcome).toEqual({ kind: 'item', itemId: 'nugget' });
    expect(spin.run.bag).toEqual([{ itemId: 'nugget', count: 1 }]);
  });

  it('lands three pinned outcomes in a row, each off its own spin mark', () => {
    let run = baseRun();
    const outcomes = [];
    for (let i = 0; i < 3; i++) {
      const spin = casinoSpin(run);
      outcomes.push(spin.outcome);
      run = spin.run;
    }
    expect(outcomes).toEqual([
      { kind: 'item', itemId: 'nugget' },
      { kind: 'item', itemId: 'ultraball' },
      { kind: 'item', itemId: 'fullrestore' },
    ]);
    expect(run.pickedItems).toEqual([casinoSpinId(MAP, 0), casinoSpinId(MAP, 1), casinoSpinId(MAP, 2)]);
    expect(run.money).toBe(baseRun().money - priceFor(run) * 3);
  });

  it('reproduces the next spin from a run rebuilt off the marks alone (the reload rule)', () => {
    let run = baseRun();
    for (let i = 0; i < 3; i++) run = casinoSpin(run).run;
    const reloaded: RunState = {
      ...baseRun(),
      money: run.money,
      bag: run.bag,
      pickedItems: run.pickedItems,
    };
    const next = casinoSpin(reloaded);
    // The fourth spin's pick lands on the grouped row; `late`'s own shelf pays Life
    // Orb, so the pinned id is a shelf draw, not a fixed row any more.
    expect(next.outcome).toEqual({ kind: 'item', itemId: 'lifeorb' });
    expect(casinoHeldPool('late')).toContain('lifeorb');
    expect(next.run.pickedItems).toEqual([...run.pickedItems, casinoSpinId(MAP, 3)]);
    // And the fifth spin is the Egg, so a five-spin floor pays one Egg at most.
    const fifth = casinoSpin(next.run);
    expect(fifth.outcome).toEqual({ kind: 'egg' });
    expect(fifth.run.bag).toEqual([
      { itemId: 'nugget', count: 1 },
      { itemId: 'ultraball', count: 1 },
      { itemId: 'fullrestore', count: 1 },
      { itemId: 'lifeorb', count: 1 },
      { itemId: EGG_ITEM_ID, count: 1 },
    ]);
  });

  it('pins the second seed’s sequence, which draws no grouped row', () => {
    let run = baseRun('pkm-111');
    const outcomes = [];
    for (let i = 0; i < 3; i++) {
      const spin = casinoSpin(run);
      outcomes.push(spin.outcome);
      run = spin.run;
    }
    expect(outcomes).toEqual([
      { kind: 'item', itemId: 'ultraball' },
      { kind: 'item', itemId: 'fullrestore' },
      { kind: 'egg' },
    ]);
  });

  it('pays one member of the band’s own pool when the pick lands on the grouped row', () => {
    const band = bandForMap(MAP).id;
    const pool = casinoHeldPool(band);
    for (const seed of GROUPED_SEEDS) {
      const run = baseRun(seed);
      const spin = casinoSpin(run);
      expect(spin.ok, seed).toBe(true);
      expect(spin.outcome?.kind, seed).toBe('item');
      const itemId = paidId(spin.outcome);
      // The paid id is the shelf's, never one of the band's fixed rows.
      expect(pool, seed).toContain(itemId);
      expect(
        CASINO.prizes[band].some((row: CasinoPrize) => row.itemId === itemId),
        seed,
      ).toBe(false);
      // And the spin behaves like any other: price spent, mark written, item in the bag.
      expect(spin.run.money, seed).toBe(run.money - priceFor(run));
      expect(spin.run.pickedItems, seed).toEqual([casinoSpinId(MAP, 0)]);
      expect(spin.run.bag, seed).toEqual([{ itemId, count: 1 }]);
    }
  });

  it('takes the grouped id from the spin stream’s last int, after the pick', () => {
    const band = bandForMap(MAP).id;
    const total = totalOf(band);
    const pool = casinoHeldPool(band);
    for (const seed of GROUPED_SEEDS) {
      const rng = new Rng(hashSeed(`${seed}:casino:${MAP}:0`));
      rng.next();
      rng.int(0, total - 1);
      const expected = pool[rng.int(0, pool.length - 1)];
      expect(paidId(casinoSpin(baseRun(seed)).outcome), seed).toBe(expected);
    }
    // One extra draw that varies: two different shelf members are paid on this floor.
    const paid = GROUPED_SEEDS.map((seed) => paidId(casinoSpin(baseRun(seed)).outcome));
    expect(new Set(paid).size).toBeGreaterThan(1);
  });

  it('is a pure function of the run: the same run pays the same grouped id twice', () => {
    const run = baseRun(GROUPED_SEEDS[0]);
    const first = casinoSpin(run);
    const second = casinoSpin(run);
    expect(first.outcome).toEqual(second.outcome);
    expect(first.run.bag).toEqual(second.run.bag);
    expect(first.run.money).toBe(second.run.money);
  });

  it('pays the fallback shelf on an early floor', () => {
    const run = baseRun(SEED, 1);
    expect(bandForMap(1).id).toBe('early');
    const outcome = casinoSpin(run).outcome;
    expect(outcome).toEqual({ kind: 'item', itemId: 'muscleband' });
    // `early` has no equipable of its own: the id comes from `mid`'s shelf.
    expect(casinoHeldPool('early')).toContain('muscleband');
    expect(SHOP_ROTATION.early.map((entry) => entry.itemId)).not.toContain('muscleband');
  });

  it('locks the floor on the battle outcome and answers locked afterwards', () => {
    const run = baseRun('casino-a');
    const spin = casinoSpin(run);
    expect(spin.ok).toBe(true);
    expect(spin.outcome).toEqual({ kind: 'battle' });
    expect(spin.run.pickedItems).toEqual([casinoSpinId(MAP, 0), casinoLockId(MAP)]);
    expect(spin.run.money).toBe(run.money - priceFor(run));
    expect(spin.run.bag).toEqual([]);
    const again = casinoSpin(spin.run);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('locked');
    expect(again.run).toBe(spin.run);
  });

  it("counts only the floor's own marks, so another floor's spin and lock are ignored", () => {
    const run: RunState = {
      ...baseRun(),
      pickedItems: [casinoSpinId(10, 0), casinoSpinId(10, 1), casinoLockId(10)],
    };
    const spin = casinoSpin(run);
    // A map 10 mark never reads against the `casino-spin-5-` prefix, so the map 5
    // machine still serves its own first spin (the 10's is a different stream).
    expect(spin.outcome).toEqual({ kind: 'item', itemId: 'nugget' });
    expect(spin.run.pickedItems).toEqual([
      casinoSpinId(10, 0),
      casinoSpinId(10, 1),
      casinoLockId(10),
      casinoSpinId(MAP, 0),
    ]);
    // The floor's own mark is what advances it: the next spin is the next rung.
    expect(casinoSpin(spin.run).outcome).toEqual({ kind: 'item', itemId: 'ultraball' });
  });
});

describe('hatchEgg', () => {
  it('returns null when the bag holds no Egg', () => {
    const run = baseRun('pkm-111');
    expect(hatchEgg(run)).toBeNull();
  });

  it("turns one Egg into one member of the new floor's wild pool, at the squad's level", () => {
    const run = addItem(baseRun('pkm-111'), EGG_ITEM_ID);
    const hatch = hatchEgg(run);
    expect(hatch).not.toBeNull();
    const { run: next, member } = hatch!;
    // The Egg leaves the bag, exactly once.
    expect(next.bag).toEqual([]);
    // One member joins the party, at the squad's level, from the band's own pool.
    expect(next.party).toHaveLength(run.party.length + 1);
    expect(next.party[next.party.length - 1]).toBe(member);
    expect(next.box).toHaveLength(0);
    expect(member.fighter.level).toBe(squadLevel(run));
    expect(member.fighter.id).toBe('catch-1');
    expect(speciesPool(bandForMap(run.mapIndex), 'wild')).toContain(member.fighter.speciesId);
    expect(member.fighter.speciesId).toBe('obstagoon');
    // It is not a catch: no counter, no record, no room.
    expect(next.stats.catches).toBe(run.stats.catches);
    expect(next.caughtSpecies).toEqual(run.caughtSpecies);
    expect(next.capturedRooms).toEqual([]);
    // The run's own pokémon are untouched.
    expect(next.party[0]).toBe(run.party[0]);
    expect(next.money).toBe(run.money);
  });

  it('sends the hatched member to the box when the party is full (D7)', () => {
    const party = Array.from({ length: MAX_PARTY_SIZE }, (_, i) =>
      createRunPokemon({
        id: `member-${i}`,
        speciesId: 'charmander',
        level: 5,
        moves: ['scratch'],
      }),
    );
    const run = addItem({ ...baseRun('pkm-111'), party }, EGG_ITEM_ID);
    const hatch = hatchEgg(run);
    expect(hatch).not.toBeNull();
    const { run: next, member } = hatch!;
    expect(next.party).toHaveLength(MAX_PARTY_SIZE);
    expect(next.box).toEqual([member]);
    expect(next.bag).toEqual([]);
  });

  it('is a pure function of the run: the same Egg hatches the same member', () => {
    const run = addItem(baseRun('pkm-64'), EGG_ITEM_ID);
    const first = hatchEgg(run);
    const second = hatchEgg(run);
    expect(first!.member.fighter.speciesId).toBe(second!.member.fighter.speciesId);
    expect(first!.run.bag).toEqual(second!.run.bag);
    expect(hatchEgg(run)!.member.fighter.level).toBe(squadLevel(run));
  });
});
