import { describe, expect, it } from 'vitest';
import { getMove } from './dex/moves';
import { TYPE_NAMES } from './dex/types';
import { en, es, setLocale, t, translationParams, type TranslationKey } from '../i18n';
import { normalizeId } from './dex/species';
import { getItem } from './items';
import { OVERWORLD_SPRITE_KEYS, overworldSpriteFrame } from './overworldSprites';
import { effectiveNpcChance, roomNpc } from '../engine/routes/npcs';
import {
  BERRY_IDS,
  BERRY_TREE_CAP,
  BERRY_TREE_ENEMY_BOOSTS,
  BERRY_TREE_MIN,
  CHEF_BERRY_COUNT,
  CHEF_DISH_ITEM_ID,
  CITY_SPECIAL_CHANCE_DEFAULT,
  CURSE_ENEMY_BOOST,
  GENERIC_LINES,
  MAGICIAN_TYPES,
  NPC_ROWS,
  SACRIFICE_REWARDS,
  SPECIAL_NPCS,
  TUTOR_MOVES,
  cityChanceOf,
  genericLines,
  getNpcRow,
  specialNpcRow,
  type GenericTier,
  type NpcRow,
} from './npcs';
import { MEGA_STONE_IDS } from './items';

/** The rows this table ships, in the order the roll breaks its ties (`docs/maps-spec.md` §7). */
const ROW_IDS = [
  'merchant',
  'rocket',
  'tutor',
  'nature',
  'ability',
  'iv-judge',
  'species',
  'sacrifice',
  'exorcist',
  'weather-man',
  'magician',
  'type-gate',
  'medic',
  'chef',
  'berry-tree',
  'mega-stone',
];

const MERCHANT = NPC_ROWS[0];

function rowOf(id: string): NpcRow {
  const row = getNpcRow(id);
  expect(row, id).toBeDefined();
  return row!;
}

describe('the special-NPC table', () => {
  it('ships the merchant, the floor guarantee that carries the Mart', () => {
    expect(MERCHANT.id).toBe('merchant');
    expect(MERCHANT.nameKey).toBe('npc.merchant.name');
    expect(MERCHANT.greetingKey).toBe('npc.merchant.greeting');
    expect(MERCHANT.spriteKey).toBe('merchant');
    // A guaranteed row is placed, never rolled, so its chance stays 0.
    expect(MERCHANT.chance).toBe(0);
    expect(MERCHANT.floorStep).toBe(0);
    expect(MERCHANT.guaranteedFromMap).toBe(1);
    expect(MERCHANT.requires).toBeUndefined();
    expect(MERCHANT.choices).toEqual([{ id: 'mart', label: 'npc.merchant.trade' }]);
    // The scene drops a placement whose sprite the sheet lacks, so a missing merchant
    // frame would silently retire the Mart; this is the build-time check for it.
    expect(overworldSpriteFrame(MERCHANT.spriteKey)).not.toBeNull();
  });

  it('ships the five member-edit rows and the sacrifice after the merchant, in table order', () => {
    expect(NPC_ROWS.map((row) => row.id)).toEqual(ROW_IDS);
  });

  it('gives every rolled member-edit row the shipped fields', () => {
    const rows: Readonly<Record<string, Omit<NpcRow, 'id' | 'nameKey' | 'greetingKey' | 'requires'>>> = {
      tutor: {
        spriteKey: 'blackbelt',
        chance: 0.02,
        floorStep: 0.005,
        choices: [{ id: 'teach', label: 'npc.tutor.teach' }],
      },
      nature: {
        spriteKey: 'psychic',
        chance: 0.02,
        floorStep: 0.005,
        choices: [{ id: 'reroll', label: 'npc.nature.reroll' }],
      },
      ability: {
        spriteKey: 'ace',
        chance: 0.02,
        floorStep: 0.005,
        choices: [{ id: 'reroll', label: 'npc.ability.reroll' }],
      },
      'iv-judge': {
        spriteKey: 'iv-judge',
        chance: 0.02,
        floorStep: 0.005,
        choices: [{ id: 'reroll', label: 'npc.iv.reroll' }],
      },
      species: {
        spriteKey: 'camper',
        chance: 0.02,
        floorStep: 0.005,
        choices: [{ id: 'swap', label: 'npc.species.swap' }],
      },
    };
    for (const [id, fields] of Object.entries(rows)) {
      const row = rowOf(id);
      expect(row.spriteKey, id).toBe(fields.spriteKey);
      expect(row.chance, id).toBe(fields.chance);
      expect(row.floorStep, id).toBe(fields.floorStep);
      expect(row.choices, id).toEqual(fields.choices);
      expect(row.requires, id).toBeUndefined();
      expect(row.repeatable, id).toBeUndefined();
      expect(row.guaranteedFromMap, id).toBeUndefined();
    }
    const groups: Readonly<Record<string, string>> = {
      tutor: 'npc.tutor',
      nature: 'npc.nature',
      ability: 'npc.ability',
      'iv-judge': 'npc.iv',
      species: 'npc.species',
    };
    for (const [id, group] of Object.entries(groups)) {
      expect(rowOf(id).nameKey, id).toBe(`${group}.name`);
      expect(rowOf(id).greetingKey, id).toBe(`${group}.greeting`);
    }
  });

  it('gates the sacrifice on a completed floor mission', () => {
    const row = rowOf('sacrifice');
    expect(row.nameKey).toBe('npc.sacrifice.name');
    expect(row.greetingKey).toBe('npc.sacrifice.greeting');
    expect(row.spriteKey).toBe('sacrifice');
    expect(row.chance).toBe(0.04);
    expect(row.floorStep).toBe(0.005);
    expect(row.requires).toEqual({ kind: 'missionsCompleted', min: 1 });
    expect(row.choices).toEqual([{ id: 'offer', label: 'npc.sacrifice.offer' }]);
    expect(row.repeatable).toBeUndefined();
  });

  it('marks the merchant and the Team Rocket grunt as the repeatable rows', () => {
    expect(MERCHANT.repeatable).toBe(true);
    const repeatable = NPC_ROWS.filter((row) => row.repeatable === true).map((row) => row.id);
    expect(repeatable).toEqual(['merchant', 'rocket']);
  });

  it('ships the Team Rocket grunt as the row that carries the slot machine', () => {
    const row = rowOf('rocket');
    expect(row.nameKey).toBe('casino.title');
    expect(row.spriteKey).toBe('rocket');
    // The row raises no card at all: the scene opens the 460×300 machine straight
    // from the interact key, so the machine is not a choice and the row ships none.
    expect(row.choices).toBeUndefined();
    expect(row.greetingKey).toBe('casino.title');
    // A rolled row from map 2 on: 0 on map 1 and 3 points a floor after it.
    expect(row.chance).toBe(0);
    expect(row.floorStep).toBe(0.03);
    // No gate, no grant and no battle: the machine's own model decides the fight,
    // and the row writes no use mark, so a revisit can spin again.
    expect(row.requires).toBeUndefined();
    expect(row.grant).toBeUndefined();
    expect(row.battle).toBeUndefined();
    expect(row.guaranteedFromMap).toBeUndefined();
    expect(row.repeatable).toBe(true);
    expect(effectiveNpcChance(row, 1)).toBe(0);
    expect(effectiveNpcChance(row, 2)).toBe(0.03);
    expect(effectiveNpcChance(row, 8)).toBe(0.21);
  });

  it('renders the grunt greeting with no params, so it is never a key that needs them', () => {
    const row = rowOf('rocket');
    // `casino.controls` needs `{confirm}`/`{cancel}`, so it would throw here.
    for (const locale of [en, es]) {
      expect(translationParams(locale[row.greetingKey]), row.id).toEqual([]);
    }
    for (const locale of ['en', 'es'] as const) {
      setLocale(locale);
      expect(t(row.greetingKey)).not.toContain('{');
    }
    setLocale('en');
  });

  it('never rolls the grunt on map 1, where its weight is zero', () => {
    let others = 0;
    for (let i = 0; i < 60; i++) {
      const placement = roomNpc(`rocket-roll-${i}`, i, 1);
      if (placement) others += 1;
      expect(placement?.row.id, `room ${i}`).not.toBe('rocket');
    }
    expect(others).toBeGreaterThan(0);
  });

  it('ships the four run-modifier rows after the sacrifice, in table order', () => {
    const rows: Readonly<Record<string, Omit<NpcRow, 'id' | 'nameKey' | 'greetingKey' | 'requires'>>> = {
      exorcist: {
        spriteKey: 'exorcist',
        chance: 0.02,
        floorStep: 0.005,
        choices: [{ id: 'hex', label: 'npc.exorcist.cast' }],
      },
      'weather-man': {
        spriteKey: 'weather-man',
        chance: 0.02,
        floorStep: 0.005,
        choices: [{ id: 'sky', label: 'npc.weather.cast' }],
      },
      magician: {
        spriteKey: 'magician',
        chance: 0.02,
        floorStep: 0.005,
        choices: [{ id: 'type', label: 'npc.magician.cast' }],
      },
      'type-gate': {
        spriteKey: 'bugcatcher',
        chance: 0.02,
        floorStep: 0.005,
        choices: [{ id: 'claim', label: 'npc.gate.claim' }],
        grant: { types: ['bug'], itemId: 'silverpowder' },
      },
    };
    const ids = Object.keys(rows);
    expect(NPC_ROWS.slice(8, 12).map((row) => row.id)).toEqual(ids);
    const groups: Readonly<Record<string, string>> = {
      exorcist: 'npc.exorcist',
      'weather-man': 'npc.weather',
      magician: 'npc.magician',
      'type-gate': 'npc.gate',
    };
    for (const [id, fields] of Object.entries(rows)) {
      const row = rowOf(id);
      expect(row.nameKey, id).toBe(`${groups[id]}.name`);
      expect(row.greetingKey, id).toBe(`${groups[id]}.greeting`);
      expect(row.spriteKey, id).toBe(fields.spriteKey);
      expect(row.chance, id).toBe(fields.chance);
      expect(row.floorStep, id).toBe(fields.floorStep);
      expect(row.choices, id).toEqual(fields.choices);
      expect(row.requires, id).toBeUndefined();
      expect(row.repeatable, id).toBeUndefined();
      expect(row.guaranteedFromMap, id).toBeUndefined();
      expect(row.grant, id).toEqual(fields.grant);
    }
    for (const id of ['exorcist', 'weather-man', 'magician']) {
      expect(rowOf(id).grant, id).toBeUndefined();
    }
  });

  it('pays the type gate only to a party holding a Bug', () => {
    const grant = rowOf('type-gate').grant;
    expect(grant).toEqual({ types: ['bug'], itemId: 'silverpowder' });
    const item = getItem('silverpowder');
    expect(item, 'silverpowder').toBeDefined();
    expect(item?.kind).toBe('held');
    expect(item?.consumed).not.toBe(true);
  });

  it('draws the magician from the 18 battle type ids, in the dex order', () => {
    expect(MAGICIAN_TYPES).toEqual(TYPE_NAMES.map((name) => normalizeId(name)));
    expect(MAGICIAN_TYPES).toHaveLength(18);
    expect(new Set(MAGICIAN_TYPES).size).toBe(18);
    for (const id of MAGICIAN_TYPES) {
      expect(id, id).not.toBe('');
      expect(id).toBe(id.toLowerCase());
    }
    expect(MAGICIAN_TYPES[0]).toBe(normalizeId(TYPE_NAMES[0]));
    expect(MAGICIAN_TYPES).toContain('bug');
    expect(MAGICIAN_TYPES).toContain('normal');
  });

  it('keeps the curse a data row: one Attack stage down', () => {
    expect(CURSE_ENEMY_BOOST).toEqual({ atk: -1 });
  });

  it('answers a row by id and nothing else', () => {
    expect(getNpcRow('merchant')).toBe(MERCHANT);
    expect(getNpcRow('tutor')?.id).toBe('tutor');
    expect(getNpcRow('')).toBeUndefined();
    expect(getNpcRow('nurse')).toBeUndefined();
  });

  it('hands every row a unique stable id', () => {
    const ids = NPC_ROWS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getNpcRow(id)?.id).toBe(id);
  });

  it('draws every row through a key of the packed overworld atlas', () => {
    for (const row of NPC_ROWS) {
      expect(OVERWORLD_SPRITE_KEYS, row.id).toContain(row.spriteKey);
    }
  });

  it('keys every row name, greeting and choice in both locales', () => {
    for (const row of NPC_ROWS) {
      for (const locale of [en, es]) {
        expect(Object.prototype.hasOwnProperty.call(locale, row.nameKey), row.id).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(locale, row.greetingKey), row.id).toBe(true);
        for (const choice of row.choices ?? []) {
          expect(
            Object.prototype.hasOwnProperty.call(locale, choice.label),
            `${row.id}/${choice.id}`,
          ).toBe(true);
        }
      }
    }
  });

  it('renders the merchant copy through t() in both locales', () => {
    setLocale('en');
    expect(t('npc.merchant.name')).toBe('MERCHANT');
    expect(t('npc.merchant.greeting')).toBe('A merchant with a full pack. Pick what you carry.');
    expect(t('npc.merchant.trade')).toBe('TRADE');
    setLocale('es');
    expect(t('npc.merchant.name')).toBe('MERCADER');
    expect(t('npc.merchant.greeting')).toBe('Un mercader con la mochila llena. Elige que te llevas.');
    expect(t('npc.merchant.trade')).toBe('COMERCIAR');
    setLocale('en');
  });

  it('keeps every chance a probability and every step a per-floor increment', () => {
    for (const row of NPC_ROWS) {
      expect(row.chance, row.id).toBeGreaterThanOrEqual(0);
      expect(row.chance, row.id).toBeLessThanOrEqual(1);
      expect(row.floorStep, row.id).toBeGreaterThanOrEqual(-1);
      expect(row.floorStep, row.id).toBeLessThanOrEqual(1);
      if (row.guaranteedFromMap !== undefined) expect(row.chance, row.id).toBe(0);
    }
  });

  it('gives every choice row of a row its own id', () => {
    for (const row of NPC_ROWS) {
      const ids = (row.choices ?? []).map((choice) => choice.id);
      expect(new Set(ids).size, row.id).toBe(ids.length);
    }
  });
});

describe('the item-and-battle rows', () => {
  const ROWS: Readonly<Record<string, Omit<NpcRow, 'id' | 'nameKey' | 'greetingKey'>>> = {
    medic: {
      spriteKey: 'medic',
      chance: 0.01,
      floorStep: 0.0025,
      choices: [{ id: 'heal', label: 'npc.medic.heal' }],
    },
    chef: {
      spriteKey: 'chef',
      chance: 0.01,
      floorStep: 0.0025,
      choices: [{ id: 'trade', label: 'npc.chef.trade' }],
    },
    'berry-tree': {
      spriteKey: 'berry-tree',
      chance: 0.01,
      floorStep: 0.0025,
      choices: [{ id: 'shake', label: 'npc.berry-tree.shake' }],
    },
    'mega-stone': {
      spriteKey: 'ace',
      chance: 0.01,
      floorStep: 0.0025,
      choices: [{ id: 'battle', label: 'npc.mega-stone.battle' }],
      battle: { archetypeId: 'ace', prizeIds: MEGA_STONE_IDS },
    },
  };
  const GROUPS: Readonly<Record<string, string>> = {
    medic: 'npc.medic',
    chef: 'npc.chef',
    'berry-tree': 'npc.berry-tree',
    'mega-stone': 'npc.mega-stone',
  };

  it('appends the four rows after the type gate, in table order', () => {
    expect(NPC_ROWS.slice(-4).map((row) => row.id)).toEqual(Object.keys(ROWS));
  });

  it('gives each one the shipped chance, step, sprite and single choice', () => {
    for (const [id, fields] of Object.entries(ROWS)) {
      const row = rowOf(id);
      expect(row.nameKey, id).toBe(`${GROUPS[id]}.name`);
      expect(row.greetingKey, id).toBe(`${GROUPS[id]}.greeting`);
      expect(row.spriteKey, id).toBe(fields.spriteKey);
      expect(row.chance, id).toBe(0.01);
      expect(row.floorStep, id).toBe(0.0025);
      expect(row.choices, id).toEqual(fields.choices);
      expect(row.requires, id).toBeUndefined();
      expect(row.repeatable, id).toBeUndefined();
      expect(row.guaranteedFromMap, id).toBeUndefined();
      expect(row.grant, id).toBeUndefined();
    }
  });

  it('keeps the battle a data row only on the Mega Stone keeper', () => {
    expect(rowOf('mega-stone').battle).toEqual({ archetypeId: 'ace', prizeIds: MEGA_STONE_IDS });
    const fighters = NPC_ROWS.filter((row) => row.battle !== undefined).map((row) => row.id);
    expect(fighters).toEqual(['mega-stone']);
    expect(MEGA_STONE_IDS.length).toBeGreaterThan(0);
    for (const id of MEGA_STONE_IDS) {
      const stone = getItem(id);
      expect(stone, id).toBeDefined();
      expect(stone?.kind, id).toBe('held');
      expect(stone?.mega, id).toBeDefined();
    }
  });

  it('ships the berry table in its own order, every id a held row', () => {
    expect(BERRY_IDS).toEqual([
      'cheriberry',
      'chestoberry',
      'pechaberry',
      'rawstberry',
      'aspearberry',
      'oranberry',
      'sitrusberry',
      'lumberry',
      'figyberry',
      'wikiberry',
      'magoberry',
      'aguavberry',
      'iapapaberry',
      'leppaberry',
    ]);
    for (const id of BERRY_IDS) expect(getItem(id)?.kind, id).toBe('held');
  });

  it('keeps the chef trade and the shake in data', () => {
    expect(CHEF_BERRY_COUNT).toBe(3);
    expect(BERRY_TREE_MIN).toBeLessThanOrEqual(BERRY_TREE_CAP);
    const dish = getItem(CHEF_DISH_ITEM_ID);
    expect(dish, CHEF_DISH_ITEM_ID).toBeDefined();
    expect(dish?.kind).toBe('held');
    expect(dish?.boosts).toBeDefined();
    expect(dish?.below).toBeDefined();
    expect(dish?.consumed).toBe(true);
    expect(BERRY_TREE_ENEMY_BOOSTS).toEqual({ def: 1, spd: 1 });
    expect(Object.keys(BERRY_TREE_ENEMY_BOOSTS)).not.toContain(Object.keys(CURSE_ENEMY_BOOST)[0]);
  });
});

describe('the tutor and the sacrifice tables', () => {
  it('ships the six tutor moves, in the order the card prints them, all dex-resolvable', () => {
    expect(TUTOR_MOVES).toEqual([
      'swordsdance',
      'earthquake',
      'icebeam',
      'thunderbolt',
      'shadowball',
      'roost',
    ]);
    for (const moveId of TUTOR_MOVES) {
      const move = getMove(moveId);
      expect(move, moveId).toBeDefined();
      expect(move?.id, moveId).toBe(moveId);
    }
  });

  it('ships the four sacrifice rewards in their table order', () => {
    expect(SACRIFICE_REWARDS).toEqual(['nature', 'second-ability', 'ivs', 'species']);
  });
});

/**
 * The table's other half (`docs/region-spec.md` §7.7): the sixteen rows keep their
 * identity and gain the chance a city stands them, and the generic people's lines
 * are one table per city tier.
 */
describe('the settlement people tables', () => {
  /** A row a later task could add to the legacy table alone, with no `cityChance`. */
  const PLAIN: NpcRow = {
    id: 'plain',
    nameKey: 'npc.generic.name',
    greetingKey: 'npc.generic.tier1.1',
    spriteKey: 'merchant',
    chance: 0,
    floorStep: 0,
  };

  const CITY_CHANCES: Readonly<Record<string, number>> = {
    merchant: 1,
    rocket: 1,
    tutor: 0.8,
    nature: 0.8,
    ability: 0.8,
    'iv-judge': 0.8,
    species: 0.8,
    sacrifice: 0.8,
    exorcist: 0.75,
    'weather-man': 0.75,
    magician: 0.75,
    'type-gate': 0.75,
    medic: 0.9,
    chef: 0.9,
    'berry-tree': 0.9,
    'mega-stone': 0.9,
  };

  it('keeps the sixteen rows under both names, as one array in one order', () => {
    expect(SPECIAL_NPCS).toBe(NPC_ROWS);
    expect(SPECIAL_NPCS.map((row) => row.id)).toEqual(ROW_IDS);
    expect(NPC_ROWS[0].id).toBe('merchant');
    expect(SPECIAL_NPCS.length).toBe(16);
  });

  it('gives every row the city chance the table records, all of them probabilities', () => {
    for (const row of SPECIAL_NPCS) {
      expect(row.cityChance, row.id).toBe(CITY_CHANCES[row.id]);
      expect(row.cityChance, row.id).toBeGreaterThanOrEqual(0);
      expect(row.cityChance, row.id).toBeLessThanOrEqual(1);
      expect(cityChanceOf(row), row.id).toBe(row.cityChance);
    }
  });

  it('answers the default chance, clamped, for a row without one', () => {
    expect(CITY_SPECIAL_CHANCE_DEFAULT).toBe(0.8);
    expect(cityChanceOf(PLAIN)).toBe(CITY_SPECIAL_CHANCE_DEFAULT);
    const over = { ...PLAIN, cityChance: 4 } as NpcRow;
    const under = { ...PLAIN, cityChance: -4 } as NpcRow;
    expect(cityChanceOf(over)).toBe(1);
    expect(cityChanceOf(under)).toBe(0);
  });

  it('answers a special row by id, and nothing else', () => {
    expect(specialNpcRow('medic')).toBe(SPECIAL_NPCS.find((row) => row.id === 'medic'));
    expect(specialNpcRow('tutor')?.cityChance).toBe(0.8);
    expect(specialNpcRow('')).toBeUndefined();
    expect(specialNpcRow('nurse')).toBeUndefined();
  });

  it('carries four generic lines for each of the three city tiers, in tier order', () => {
    const tiers: readonly GenericTier[] = [1, 2, 3];
    expect(Object.keys(GENERIC_LINES).sort()).toEqual(['1', '2', '3']);
    const keys: string[] = [];
    for (const tier of tiers) {
      expect(GENERIC_LINES[tier]).toHaveLength(4);
      expect(genericLines(tier)).toBe(GENERIC_LINES[tier]);
      for (let index = 1; index <= 4; index++) {
        expect(GENERIC_LINES[tier]).toContain(`npc.generic.tier${tier}.${index}`);
      }
      keys.push(...GENERIC_LINES[tier]);
    }
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(12);
  });

  it('keys the generic title and every generic line in both locales, with no token', () => {
    const all: readonly TranslationKey[] = ['npc.generic.name', ...Object.values(GENERIC_LINES).flat()];
    for (const locale of [en, es]) {
      for (const key of all) {
        expect(Object.prototype.hasOwnProperty.call(locale, key), key).toBe(true);
        expect(translationParams(locale[key]), key).toEqual([]);
      }
    }
    setLocale('en');
    expect(t('npc.generic.name')).toBe('PASSERBY');
    expect(t('npc.generic.tier2.3')).toBe('The Centre heals. Nothing brings them back.');
    setLocale('es');
    expect(t('npc.generic.name')).toBe('TRANSEUNTE');
    expect(t('npc.generic.tier3.4')).toBe('El Campeón cura entre combates. Tú no.');
    setLocale('en');
  });
});
