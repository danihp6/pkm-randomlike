import { describe, expect, it } from 'vitest';
import { getMove } from './dex/moves';
import { TYPE_NAMES } from './dex/types';
import { en, es, setLocale, t } from '../i18n';
import { normalizeId } from './dex/species';
import { getItem } from './items';
import { OVERWORLD_SPRITE_KEYS } from './overworldSprites';
import {
  CURSE_ENEMY_BOOST,
  MAGICIAN_TYPES,
  NPC_ROWS,
  SACRIFICE_REWARDS,
  TUTOR_MOVES,
  getNpcRow,
  type NpcRow,
} from './npcs';

/** The rows this table ships, in the order the roll breaks its ties (`docs/maps-spec.md` §7). */
const ROW_IDS = [
  'merchant',
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
    expect(MERCHANT.guaranteedFromMap).toBe(2);
    expect(MERCHANT.requires).toBeUndefined();
    expect(MERCHANT.choices).toEqual([{ id: 'mart', label: 'npc.merchant.trade' }]);
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

  it('marks the merchant as the only repeatable row', () => {
    expect(MERCHANT.repeatable).toBe(true);
    const repeatable = NPC_ROWS.filter((row) => row.repeatable === true).map((row) => row.id);
    expect(repeatable).toEqual(['merchant']);
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
    expect(NPC_ROWS.slice(-ids.length).map((row) => row.id)).toEqual(ids);
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
    expect(getNpcRow('medic')).toBeUndefined();
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
