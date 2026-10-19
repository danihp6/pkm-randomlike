import { describe, expect, it } from 'vitest';
import { UNMODELLED_ITEMS } from '../engine/battle/effects/items';
import { COMPETITIVE_HELD_IDS, GMAX_STONE_IDS, GMAX_STONE_LOOT, ITEMS, MEMORY_DRIVE_IDS } from './items';
import { ROUTE_LOOT } from './loot';
import { LEVEL_BANDS } from './run';
import { SHOP_ROTATION } from './shop';

const KNOWN = new Set(ITEMS.map((item) => item.id));

describe('ROUTE_LOOT', () => {
  it('covers every level band', () => {
    for (const band of LEVEL_BANDS) expect(ROUTE_LOOT[band.id]).toBeDefined();
  });

  it('draws from known items with positive weights', () => {
    for (const band of LEVEL_BANDS) {
      const loot = ROUTE_LOOT[band.id];
      expect(loot.pool.length).toBeGreaterThan(0);
      for (const entry of loot.pool) {
        expect(KNOWN.has(entry.itemId), `${band.id} ${entry.itemId}`).toBe(true);
        expect(entry.weight, `${band.id} ${entry.itemId}`).toBeGreaterThan(0);
      }
    }
  });

  it('never repeats an id inside one band', () => {
    for (const band of LEVEL_BANDS) {
      const ids = ROUTE_LOOT[band.id].pool.map((entry) => entry.itemId);
      expect(new Set(ids).size, band.id).toBe(ids.length);
    }
  });

  it('thins the two on-ramp bands, leaving the later four at 0.75', () => {
    expect(ROUTE_LOOT.early.itemChance).toBe(0.5);
    expect(ROUTE_LOOT.low.itemChance).toBe(0.6);
    expect(ROUTE_LOOT.mid.itemChance).toBe(0.75);
    expect(ROUTE_LOOT.high.itemChance).toBe(0.75);
    expect(ROUTE_LOOT.late.itemChance).toBe(0.75);
    expect(ROUTE_LOOT.end.itemChance).toBe(0.75);
  });

  it('keeps the on-ramp rows hidden at 0.35 with the pools they ship', () => {
    expect(ROUTE_LOOT.early.hiddenChance).toBe(0.35);
    expect(ROUTE_LOOT.low.hiddenChance).toBe(0.35);
    expect(ROUTE_LOOT.early.pool.map((entry) => entry.itemId)).toEqual([
      'potion',
      'pokeball',
      'antidote',
      'stardust',
      'tm032',
    ]);
    expect(ROUTE_LOOT.low.pool.map((entry) => entry.itemId)).toEqual([
      'pokeball',
      'potion',
      'superpotion',
      'paralyzeheal',
      'stardust',
      'pearl',
      'tm020',
    ]);
  });

  it('keeps the hidden chance a probability', () => {
    for (const band of LEVEL_BANDS) {
      const chance = ROUTE_LOOT[band.id].hiddenChance;
      expect(chance).toBeGreaterThanOrEqual(0);
      expect(chance).toBeLessThanOrEqual(1);
    }
  });

  it('never offers a Revive (D5)', () => {
    for (const band of LEVEL_BANDS) {
      for (const entry of ROUTE_LOOT[band.id].pool) {
        expect(entry.itemId).not.toMatch(/revive/i);
      }
    }
  });

  it('names none of the deleted X-items', () => {
    for (const band of LEVEL_BANDS) {
      for (const entry of ROUTE_LOOT[band.id].pool) {
        expect(['xattack', 'xdefense', 'xspeed'], `${band.id} ${entry.itemId}`).not.toContain(
          entry.itemId,
        );
      }
    }
  });

  it('makes every competitive held item reachable from the ground or the Mart', () => {
    const reachable = new Set<string>();
    for (const band of LEVEL_BANDS) {
      for (const entry of ROUTE_LOOT[band.id].pool) reachable.add(entry.itemId);
      for (const entry of SHOP_ROTATION[band.id]) reachable.add(entry.itemId);
    }
    for (const id of [...COMPETITIVE_HELD_IDS, ...MEMORY_DRIVE_IDS]) {
      expect(reachable.has(id), id).toBe(true);
    }
  });

  it('drops the Memories and Drives as end-band ground treasure only (D37)', () => {
    const endIds = ROUTE_LOOT.end.pool.map((entry) => entry.itemId);
    for (const id of MEMORY_DRIVE_IDS) {
      expect(endIds, id).toContain(id);
      for (const band of LEVEL_BANDS) {
        expect(
          SHOP_ROTATION[band.id].some((entry) => entry.itemId === id),
          `${band.id} ${id}`,
        ).toBe(false);
      }
    }
  });

  it('hands the unmodelled items out on the ground only, never from the Mart (D16)', () => {
    for (const band of LEVEL_BANDS) {
      for (const entry of SHOP_ROTATION[band.id]) {
        expect(UNMODELLED_ITEMS, `${band.id} ${entry.itemId}`).not.toContain(entry.itemId);
      }
    }
  });

  it('drops the Plates as late-game treasure', () => {
    for (const band of LEVEL_BANDS) {
      const ids = ROUTE_LOOT[band.id].pool.map((entry) => entry.itemId);
      const plateIds = ids.filter((id) => id.endsWith('plate'));
      if (band.id === 'late' || band.id === 'end') expect(plateIds.length, band.id).toBe(17);
      else expect(plateIds.length, band.id).toBe(0);
    }
  });

  it('leaves the four earlier shelves byte-identical and stone-free', () => {
    expect(ROUTE_LOOT.mid.pool.map((entry) => entry.itemId)).toEqual([
      'greatball',
      'superpotion',
      'potion',
      'fullheal',
      'pearl',
      'nugget',
      'starpiece',
      'tm058',
      'tm085',
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
      'absorbbulb',
      'airballoon',
      'bindingband',
      'brightpowder',
      'cellbattery',
      'gripclaw',
      'kingsrock',
      'loadeddice',
      'luminousmoss',
      'mentalherb',
      'metronome',
      'powerherb',
      'quickclaw',
      'razorfang',
      'roomservice',
      'snowball',
      'whiteherb',
      'mirrorherb',
    ]);
    expect(ROUTE_LOOT.high.pool.map((entry) => entry.itemId)).toEqual([
      'greatball',
      'superpotion',
      'hyperpotion',
      'fullheal',
      'sitrusberry',
      'nugget',
      'starpiece',
      'bigpearl',
      'tm114',
      'tm065',
      'abilityshield',
      'assaultvest',
      'bigroot',
      'blacksludge',
      'blunderpolicy',
      'boosterenergy',
      'clearamulet',
      'covertcloak',
      'damprock',
      'ejectbutton',
      'ejectpack',
      'electricseed',
      'eviolite',
      'floatstone',
      'grassyseed',
      'heavydutyboots',
      'heatrock',
      'icyrock',
      'lightclay',
      'mistyseed',
      'protectivepads',
      'psychicseed',
      'punchingglove',
      'redcard',
      'ringtarget',
      'rockyhelmet',
      'safetygoggles',
      'shedshell',
      'shellbell',
      'stickybarb',
      'terrainextender',
      'throatspray',
      'utilityumbrella',
      'weaknesspolicy',
    ]);
    for (const bandId of ['early', 'low', 'mid', 'high'] as const) {
      expect(GMAX_STONE_LOOT[bandId], bandId).toEqual([]);
      const ids = ROUTE_LOOT[bandId].pool.map((entry) => entry.itemId);
      for (const stone of GMAX_STONE_IDS) {
        expect(ids, `${bandId} ${stone}`).not.toContain(stone);
      }
    }
  });

  it('drops the G-Max Stones as late/end ground treasure at weight 1 (D44)', () => {
    expect(ROUTE_LOOT.late.pool).toHaveLength(39);
    expect(ROUTE_LOOT.end.pool).toHaveLength(56);

    const late = ROUTE_LOOT.late.pool;
    const end = ROUTE_LOOT.end.pool;
    for (const id of GMAX_STONE_LOOT.late) {
      expect(
        late.filter((entry) => entry.itemId === id),
        id,
      ).toEqual([{ itemId: id, weight: 1 }]);
      expect(
        end.some((entry) => entry.itemId === id),
        id,
      ).toBe(false);
    }
    for (const id of GMAX_STONE_LOOT.end) {
      expect(
        end.filter((entry) => entry.itemId === id),
        id,
      ).toEqual([{ itemId: id, weight: 1 }]);
      expect(
        late.some((entry) => entry.itemId === id),
        id,
      ).toBe(false);
    }

    // The two shelves are disjoint, are subsets of the catalogue and are the
    // *only* stones the ground hands out: every other G-Max Stone is Mart-only.
    const shelved = [...GMAX_STONE_LOOT.late, ...GMAX_STONE_LOOT.end];
    expect(new Set(shelved).size).toBe(10);
    for (const id of shelved) expect(GMAX_STONE_IDS, id).toContain(id);
    const onGround = [...late, ...end].map((entry) => entry.itemId);
    for (const id of GMAX_STONE_IDS) {
      expect(onGround.includes(id), id).toBe(shelved.includes(id));
    }
    // The G-Max rows are the only addition: each band's last row is the tail of
    // its own shelf and the row before it is still the last Plates row.
    expect(late[late.length - 1]!.itemId).toBe(GMAX_STONE_LOOT.late[3]);
    expect(late[late.length - 5]!.itemId).toBe('pixieplate');
    expect(end[end.length - 1]!.itemId).toBe(GMAX_STONE_LOOT.end[5]);
    expect(end[end.length - 7]!.itemId).toBe('pixieplate');
  });
});
