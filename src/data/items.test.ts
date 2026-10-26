import { describe, expect, it } from 'vitest';
import frlgIcons from './frlg/item-icons.json';
import { GMAX_FORMES, MEGA_FORMES, TYPE_NAMES, getDexItem } from './dex';
import {
  CANDY_COLOURS,
  CANDY_ITEMS,
  CANDY_ITEM_IDS,
  CANDY_POSITIVE_CHANCE,
  CANDY_STATS,
  COMPETITIVE_HELD,
  COMPETITIVE_HELD_IDS,
  GMAX_STONE_IDS,
  GMAX_STONE_LOOT,
  GMAX_STONE_PRICE,
  ITEMS,
  MEMORY_DRIVE_IDS,
  MEMORY_DRIVE_ITEMS,
  MEGA_STONE_IDS,
  ROUTE_CONSUMABLE_IDS,
  ROUTE_CONSUMABLE_ITEMS,
  TERA_CRYSTALS,
  TERA_CRYSTAL_IDS,
  buyPrice,
  candyItemId,
  getItem,
  isForSale,
  sellPrice,
  teraTypeOf,
  type ItemKind,
} from './items';
import { ROOM_BATTLEFIELDS } from './battlefields';
import type { BandId } from './run';
import { LEVEL_BANDS } from './run';

const KINDS: readonly ItemKind[] = ['ball', 'heal', 'status', 'held', 'valuable', 'tm'];

describe('item catalogue', () => {
  it('has unique ids and a known kind for every row', () => {
    const ids = ITEMS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of ITEMS) {
      expect(KINDS, entry.id).toContain(entry.kind);
      expect(entry.name.length, entry.id).toBeGreaterThan(0);
      expect(entry.shortDesc.length, entry.id).toBeGreaterThan(0);
    }
  });

  it('gives every item a non-negative integer price', () => {
    for (const entry of ITEMS) {
      expect(Number.isInteger(entry.price), entry.id).toBe(true);
      expect(entry.price, entry.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('sells everything except the Master Ball and the Mega Stones', () => {
    for (const entry of ITEMS) {
      const expected = entry.id !== 'masterball' && entry.id !== 'egg' && entry.mega === undefined;
      expect(isForSale(entry), entry.id).toBe(expected);
    }
  });

  it('prices balls by their catch bonus', () => {
    const ballPrices = ITEMS.filter((entry) => entry.kind === 'ball' && entry.id !== 'masterball').map(
      (entry) => entry.price,
    );
    const sorted = [...ballPrices].sort((a, b) => a - b);
    expect(ballPrices).toEqual(sorted);
    for (const entry of ITEMS) {
      if (entry.kind === 'ball') expect(entry.catchBonus, entry.id).toBeGreaterThan(0);
    }
    // The Premier Ball shares the Poke Ball's 1x rate and price.
    expect(getItem('premierball')!.catchBonus).toBe(getItem('pokeball')!.catchBonus);
    expect(getItem('premierball')!.price).toBe(getItem('pokeball')!.price);
  });

  it('never registers a Revive (D5)', () => {
    expect(ITEMS.some((entry) => /revive/i.test(entry.id) || /revive/i.test(entry.name))).toBe(false);
  });

  it('drops the X-items and the whole boost kind', () => {
    for (const id of ['xattack', 'xdefense', 'xspeed']) expect(getItem(id), id).toBeUndefined();
    expect(ITEMS.some((entry) => (entry.kind as string) === 'boost')).toBe(false);
  });

  it('packs no X-item into the FRLG icon atlas', () => {
    const manifest = frlgIcons as {
      frames: readonly string[];
      items: Readonly<Record<string, number>>;
    };
    expect(manifest.frames).not.toContain('battle_stat_item');
    for (const id of ['xattack', 'xdefense', 'xspeed']) {
      expect(manifest.items[id], id).toBeUndefined();
    }
  });
});

describe('prices', () => {
  it('buys at the listed price and sells at half, rounded down', () => {
    const potion = getItem('potion')!;
    expect(buyPrice(potion)).toBe(potion.price);
    expect(sellPrice(potion)).toBe(Math.floor(potion.price / 2));
    expect(sellPrice(getItem('antidote')!)).toBe(50);
    expect(sellPrice(getItem('masterball')!)).toBe(0);
  });

  it('sells a valuable for its whole price', () => {
    const nugget = getItem('nugget')!;
    expect(nugget.kind).toBe('valuable');
    expect(sellPrice(nugget)).toBe(nugget.price);
    expect(sellPrice(getItem('cometshard')!)).toBe(12000);
  });
});

describe('getItem', () => {
  it('resolves every catalogue id', () => {
    for (const entry of ITEMS) expect(getItem(entry.id), entry.id).toBe(entry);
  });

  it('normalises case and punctuation, and misses cleanly', () => {
    expect(getItem('Poke Ball')).toBe(getItem('pokeball'));
    expect(getItem('Never-Melt-Ice')).toBe(getItem('nevermeltice'));
    expect(getItem('revive')).toBeUndefined();
  });
});

describe('competitive held set', () => {
  it('catalogues 122 unique held rows, priced by the berry rule', () => {
    expect(COMPETITIVE_HELD.length).toBe(122);
    expect(new Set(COMPETITIVE_HELD.map((row) => row.id)).size).toBe(122);
    expect(COMPETITIVE_HELD_IDS).toEqual(COMPETITIVE_HELD.map((row) => row.id));
    for (const row of COMPETITIVE_HELD) {
      expect(row.kind, row.id).toBe('held');
      // A dex berry the battle spends is a 200 row. A berry-class no-op is spent by
      // nothing, so it holds its slot for the run and pays the 1000 held tier
      // (Task-178); everything else is a 4000 booster.
      const berry = getDexItem(row.id)?.isBerry === true;
      const expected = berry ? (row.consumed === true ? 200 : 1000) : 4000;
      expect(row.price, row.id).toBe(expected);
      expect(row.shortDesc.length, row.id).toBeGreaterThan(0);
    }
  });

  it('reaches the catalogue exactly once per row', () => {
    for (const row of COMPETITIVE_HELD) expect(getItem(row.id), row.id).toBe(row);
  });

  it('keeps the seventeen Plates literal, priced and without a damage boost', () => {
    const plates = COMPETITIVE_HELD.filter((row) => row.plate !== undefined);
    expect(plates.length).toBe(0);
    for (const id of [
      'flameplate',
      'splashplate',
      'zapplate',
      'meadowplate',
      'icicleplate',
      'fistplate',
      'toxicplate',
      'earthplate',
      'skyplate',
      'mindplate',
      'insectplate',
      'stoneplate',
      'spookyplate',
      'dracoplate',
      'dreadplate',
      'ironplate',
      'pixieplate',
    ]) {
      const plate = getItem(id)!;
      expect(plate.kind, id).toBe('held');
      expect(plate.plate, id).toBeDefined();
      expect(plate.typeBoost?.multiplier, id).toBe(1.2);
      expect(plate.damageBoost, id).toBeUndefined();
      expect(plate.price, id).toBe(4000);
      expect(plate.shortDesc, id).toContain('Judgment');
    }
  });
});

describe('the held tier (Task-178)', () => {
  /** The berry-class no-ops: held rows the engine never spends, so they never leave. */
  const NOOP_BERRIES = [
    'custapberry',
    'enigmaberry',
    'jabocaberry',
    'keeberry',
    'lansatberry',
    'leppaberry',
    'marangaberry',
    'persimberry',
    'rowapberry',
    'starfberry',
    'tamatoberry',
  ];

  it('never prices a held item the engine keeps under the 1000 held floor', () => {
    // A Mega Stone is held and unsold at 0: `isForSale` is the line the rule reads,
    // because a row no shop can sell has no price to set.
    const cheap = ITEMS.filter(
      (entry) =>
        entry.kind === 'held' && entry.consumed !== true && isForSale(entry) && entry.price < 1000,
    ).map((entry) => entry.id);
    expect(cheap).toEqual([]);
    expect(NOOP_BERRIES).toHaveLength(11);
    for (const id of NOOP_BERRIES) {
      const berry = getItem(id)!;
      expect(berry, id).toBeDefined();
      expect(berry.kind, id).toBe('held');
      expect(berry.consumed, id).toBeUndefined();
      expect(berry.price, id).toBe(1000);
      expect(buyPrice(berry), id).toBe(1000);
      expect(sellPrice(berry), id).toBe(500);
    }
  });

  it('keeps every consumed berry at its 100-200, because the battle spends it', () => {
    const samples = ['oranberry', 'sitrusberry', 'lumberry', 'pechaberry', 'chopleberry'] as const;
    for (const id of samples) {
      const berry = getItem(id)!;
      expect(berry.consumed, id).toBe(true);
      expect(berry.price, id).toBeLessThan(1000);
      expect(berry.price, id).toBeGreaterThanOrEqual(100);
    }
    expect(getItem('oranberry')!.price).toBe(100);
    expect(getItem('sitrusberry')!.price).toBe(200);
    expect(getItem('lumberry')!.price).toBe(200);
    const spentBerries = ITEMS.filter(
      (entry) => entry.kind === 'held' && entry.consumed === true && / Berry$/.test(entry.name),
    );
    expect(spentBerries.length).toBeGreaterThanOrEqual(30);
    for (const berry of spentBerries) {
      expect(berry.price, berry.id).toBeGreaterThanOrEqual(100);
      expect(berry.price, berry.id).toBeLessThanOrEqual(200);
    }
  });
});

describe('the medic and chef items', () => {
  it('ships the chef dish as a one-turn held buff', () => {
    const dish = getItem('chefstew')!;
    expect(dish.name).toBe('Spiced Stew');
    expect(dish.kind).toBe('held');
    expect(dish.price).toBe(1200);
    expect(dish.boosts).toEqual({ atk: 1, spa: 1 });
    expect(dish.below).toEqual([1, 1]);
    expect(dish.consumed).toBe(true);
    expect(dish.shortDesc).toContain('Attack');
    expect(dish.shortDesc).toContain('Sp. Atk');
  });

  it('ships the Smoke Ball as the one flee held item', () => {
    const ball = getItem('smokeball')!;
    expect(ball.name).toBe('Smoke Ball');
    expect(ball.kind).toBe('held');
    expect(ball.price).toBe(4000);
    expect(ball.flee).toBe(true);
    expect(ball.shortDesc).toContain('escape');
    const flee = ITEMS.filter((entry) => entry.flee === true).map((entry) => entry.id);
    expect(flee).toEqual(['smokeball']);
  });
});

describe('Memories and Drives', () => {
  it('is 21 held, 3000-priced rows, each with exactly one Memory or Drive type', () => {
    expect(MEMORY_DRIVE_ITEMS.length).toBe(21);
    expect(MEMORY_DRIVE_IDS).toEqual(MEMORY_DRIVE_ITEMS.map((row) => row.id));
    expect(new Set(MEMORY_DRIVE_IDS).size).toBe(21);
    for (const row of MEMORY_DRIVE_ITEMS) {
      expect(row.kind, row.id).toBe('held');
      expect(row.price, row.id).toBe(3000);
      const fields = [row.memory, row.drive].filter((value) => value !== undefined);
      expect(fields.length, row.id).toBe(1);
      expect(TYPE_NAMES, row.id).toContain(fields[0]);
      expect(row.shortDesc.length, row.id).toBeGreaterThan(0);
    }
  });

  it('stays out of the competitive held set and still resolves through getItem', () => {
    for (const row of COMPETITIVE_HELD) {
      expect(row.memory, row.id).toBeUndefined();
      expect(row.drive, row.id).toBeUndefined();
    }
    for (const id of [...MEMORY_DRIVE_IDS, ...COMPETITIVE_HELD_IDS]) {
      expect(getItem(id), id).toBeDefined();
      expect(ITEMS, id).toContain(getItem(id));
    }
  });

  it('says Multi-Attack for a Memory and Techno Blast for a Drive', () => {
    for (const row of MEMORY_DRIVE_ITEMS) {
      const moveName = row.memory ? 'Multi-Attack' : 'Techno Blast';
      expect(row.shortDesc, row.id).toContain(moveName);
      expect(row.shortDesc, row.id).not.toContain("holder's type");
    }
  });
});

describe('the fourth catalogue wave (Task-103)', () => {
  it('ships one held, 4000-priced Tera Crystal per battle type, in TYPE_NAMES order', () => {
    expect(TERA_CRYSTALS.length).toBe(18);
    expect(TERA_CRYSTALS.length).toBe(TYPE_NAMES.length);
    expect(TERA_CRYSTALS.map((row) => row.teraType)).toEqual([...TYPE_NAMES]);
    expect(TERA_CRYSTAL_IDS).toEqual(TERA_CRYSTALS.map((row) => row.id));
    expect(new Set(TERA_CRYSTAL_IDS).size).toBe(18);
    for (const row of TERA_CRYSTALS) {
      expect(row.id, row.id).toBe(`teracrystal${row.teraType!.toLowerCase()}`);
      expect(TYPE_NAMES, row.id).toContain(row.teraType);
      expect(row.kind, row.id).toBe('held');
      expect(row.price, row.id).toBe(4000);
      expect(isForSale(row), row.id).toBe(true);
      expect(row.shortDesc, row.id).toContain(row.teraType!);
      expect(getItem(row.id), row.id).toBe(row);
    }
  });

  it('ships the five candy colours, one 2400-priced row each', () => {
    expect(CANDY_COLOURS).toEqual(['red', 'blue', 'green', 'yellow', 'pink']);
    expect(CANDY_STATS).toEqual(['atk', 'def', 'spa', 'spd', 'spe']);
    expect(CANDY_POSITIVE_CHANCE).toBe(0.75);
    expect(CANDY_ITEMS.length).toBe(CANDY_COLOURS.length);
    expect(CANDY_ITEM_IDS).toEqual(CANDY_ITEMS.map((row) => row.id));
    for (const colour of CANDY_COLOURS) {
      const rows = ITEMS.filter((entry) => entry.candy === colour);
      expect(rows.length, colour).toBe(1);
      expect(rows[0].id, colour).toBe(candyItemId(colour));
      expect(rows[0].kind, colour).toBe('heal');
      expect(rows[0].price, colour).toBe(2400);
      expect(rows[0].name, colour).toBe(`${colour[0].toUpperCase()}${colour.slice(1)} Candy`);
      expect(getItem(candyItemId(colour)), colour).toBe(rows[0]);
    }
    expect(candyItemId('Red')).toBe('candyred');
    expect(new Set(CANDY_ITEM_IDS).size).toBe(5);
  });

  it('ships the three route consumables on the shipped writers', () => {
    expect(ROUTE_CONSUMABLE_IDS).toEqual(ROUTE_CONSUMABLE_ITEMS.map((row) => row.id));
    const hex = getItem('exorcistbottle')!;
    const sun = getItem('weatherbottle')!;
    const medic = getItem('medicbottle')!;
    expect(hex.name).toBe('Hex Bottle');
    expect(sun.name).toBe('Sun Bottle');
    expect(medic.name).toBe('Medic Bottle');
    expect(hex.routeEffect).toEqual({ kind: 'curse' });
    expect(sun.routeEffect).toEqual({ kind: 'sky', field: 'sun' });
    expect(medic.routeEffect).toEqual({ kind: 'heal' });
    // The gesture kind the route bag routes, not what the row does.
    for (const row of ROUTE_CONSUMABLE_ITEMS) {
      expect(row.kind, row.id).toBe('heal');
      expect(row.price, row.id).toBe(2000);
      expect(row.iconFallback, row.id).toBe('fullrestore');
      expect(row.shortDesc.length, row.id).toBeGreaterThan(0);
    }
    const field = (sun.routeEffect as { field: string }).field;
    expect(ROOM_BATTLEFIELDS.some((entry) => entry.id === field)).toBe(true);
  });

  it('reads the crystal type through teraTypeOf and nothing else', () => {
    expect(teraTypeOf(null)).toBeNull();
    expect(teraTypeOf('teracrystalfire')).toBe('Fire');
    expect(teraTypeOf('potion')).toBeNull();
    expect(teraTypeOf('gyaradosite')).toBeNull();
    for (const row of TERA_CRYSTALS) expect(teraTypeOf(row.id), row.id).toBe(row.teraType);
  });

  it('leaves the three new fields absent from every shipped row', () => {
    const crystals = ITEMS.filter((entry) => entry.teraType !== undefined);
    const candies = ITEMS.filter((entry) => entry.candy !== undefined);
    const route = ITEMS.filter((entry) => entry.routeEffect !== undefined);
    expect(crystals.length).toBe(18);
    expect(candies.length).toBe(5);
    expect(route.length).toBe(3);
    for (const row of [...crystals, ...candies, ...route]) expect(row.iconFallback, row.id).toBeDefined();
    for (const row of COMPETITIVE_HELD) {
      expect(row.teraType, row.id).toBeUndefined();
      expect(row.candy, row.id).toBeUndefined();
      expect(row.routeEffect, row.id).toBeUndefined();
    }
  });
});

describe('Mega Stones', () => {
  it('has one held, unsold stone per Mega forme', () => {
    const stones = ITEMS.filter((entry) => entry.mega !== undefined);
    expect(stones.length).toBe(MEGA_FORMES.length);
    for (const stone of stones) {
      expect(stone.kind, stone.id).toBe('held');
      expect(stone.price, stone.id).toBe(0);
      expect(stone.mega!.base, stone.id).not.toBe(stone.mega!.form);
    }
  });

  it('lists every Mega Stone id for the mega-stone room to draw from', () => {
    const stones = ITEMS.filter((entry) => entry.mega !== undefined).map((stone) => stone.id);
    expect(MEGA_STONE_IDS).toEqual(stones);
    expect(MEGA_STONE_IDS.length).toBe(MEGA_FORMES.length);
  });

  it('gives each Mega-capable species a matching stone', () => {
    expect(getItem('venusaurite')!.mega).toEqual({ base: 'venusaur', form: 'venusaurmega' });
    expect(getItem('gyaradosite')!.mega).toEqual({ base: 'gyarados', form: 'gyaradosmega' });
    expect(getItem('charizarditex')!.mega).toEqual({ base: 'charizard', form: 'charizardmegax' });
    expect(getItem('charizarditey')!.mega).toEqual({ base: 'charizard', form: 'charizardmegay' });
  });
});

describe('G-Max Stones (D44)', () => {
  it('has one held, 8000-priced stone per G-Max forme, all distinct', () => {
    const stones = ITEMS.filter((entry) => entry.gmax !== undefined);
    expect(stones.length).toBe(GMAX_FORMES.length);
    expect(GMAX_STONE_IDS.length).toBe(34);
    expect(GMAX_STONE_IDS).toEqual(stones.map((stone) => stone.id));
    expect(new Set(GMAX_STONE_IDS).size).toBe(GMAX_STONE_IDS.length);
    for (const stone of stones) {
      expect(stone.kind, stone.id).toBe('held');
      expect(stone.price, stone.id).toBe(GMAX_STONE_PRICE);
      expect(buyPrice(stone), stone.id).toBe(8000);
      expect(sellPrice(stone), stone.id).toBe(4000);
      expect(isForSale(stone), stone.id).toBe(true);
      expect(stone.gmax!.base, stone.id).not.toBe(stone.gmax!.form);
      expect(stone.shortDesc, stone.id).toContain('Gigantamax');
    }
    expect(getItem('gengariteg')!.gmax).toEqual({ base: 'gengar', form: 'gengargmax' });
    expect(getItem('venusauriteg')!.gmax).toEqual({ base: 'venusaur', form: 'venusaurgmax' });
  });

  it('keeps the two stone families disjoint', () => {
    expect(MEGA_STONE_IDS.length).toBe(MEGA_FORMES.length);
    expect(GMAX_STONE_IDS.filter((id) => MEGA_STONE_IDS.includes(id))).toEqual([]);
    for (const id of GMAX_STONE_IDS) {
      const stone = getItem(id)!;
      expect(stone.mega, id).toBeUndefined();
    }
    for (const id of MEGA_STONE_IDS) {
      expect(getItem(id)!.gmax, id).toBeUndefined();
    }
  });

  it('shelves four stones at late and six at end, and nothing earlier (D44)', () => {
    const empty: readonly BandId[] = ['early', 'low', 'mid', 'high'];
    for (const band of empty) expect(GMAX_STONE_LOOT[band], band).toEqual([]);
    expect(GMAX_STONE_LOOT.late).toEqual(GMAX_STONE_IDS.slice(0, 4));
    expect(GMAX_STONE_LOOT.end).toEqual(GMAX_STONE_IDS.slice(4, 10));
    expect(GMAX_STONE_LOOT.late.length).toBe(4);
    expect(GMAX_STONE_LOOT.end.length).toBe(6);
    const shelved = [...GMAX_STONE_LOOT.late, ...GMAX_STONE_LOOT.end];
    expect(new Set(shelved).size).toBe(10);
    for (const id of shelved) expect(GMAX_STONE_IDS, id).toContain(id);
    expect(LEVEL_BANDS.map((band) => band.id)).toEqual([...empty, 'late', 'end']);
  });
});
