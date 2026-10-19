import { describe, expect, it } from 'vitest';
import { CASINO, EGG_ITEM_ID } from '../data/casino';
import { levelCapForMap } from '../data/maps';
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
import { casinoGruntTrainerId, casinoLockId, casinoSpin, casinoSpinId, hatchEgg } from './casino';

/**
 * The casino's model pinned by seed (`pkm-64` on map 5 spins nugget → ultraball →
 * fullrestore → lifeorb → egg; `pkm-111` spins ultraball → fullrestore → egg;
 * `casino-a` spins the battle first). The values were read off this build and are
 * never re-derived: a moved stream is a defect, not a re-pin.
 */

const MAP = 5;
const SEED = 'pkm-64';

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

describe('the casino ids', () => {
  it("names the floor's own spin, lock and grunt", () => {
    expect(casinoSpinId(5, 0)).toBe('casino-spin-5-0');
    expect(casinoSpinId(10, 3)).toBe('casino-spin-10-3');
    expect(casinoLockId(5)).toBe('casino-lock-5');
    expect(casinoGruntTrainerId(5)).toBe('casino-grunt-5');
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
    expect(next.outcome).toEqual({ kind: 'item', itemId: 'lifeorb' });
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
    // It is not a catch: no counter, no record, no room, no PC window.
    expect(next.stats.catches).toBe(run.stats.catches);
    expect(next.caughtSpecies).toEqual(run.caughtSpecies);
    expect(next.capturedRooms).toEqual([]);
    expect(next.pcCatch).toBeNull();
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
    expect(next.pcCatch).toBeNull();
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
