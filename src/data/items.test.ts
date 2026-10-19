import { describe, expect, it } from 'vitest';
import frlgIcons from './frlg/item-icons.json';
import { GMAX_FORMES, MEGA_FORMES, TYPE_NAMES, getDexItem } from './dex';
import {
  COMPETITIVE_HELD,
  COMPETITIVE_HELD_IDS,
  GMAX_STONE_IDS,
  GMAX_STONE_LOOT,
  GMAX_STONE_PRICE,
  ITEMS,
  MEMORY_DRIVE_IDS,
  MEMORY_DRIVE_ITEMS,
  MEGA_STONE_IDS,
  buyPrice,
  getItem,
  isForSale,
  sellPrice,
  type ItemKind,
} from './items';
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
      expect(row.price, row.id).toBe(getDexItem(row.id)?.isBerry ? 200 : 4000);
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
