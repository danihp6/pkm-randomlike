import { describe, expect, it } from 'vitest';
import type { Species } from '../data/dex';
import { ITEMS } from '../data/items';
import { RUN_CHAIN } from '../data/run';
import { ROUTE_SHAPES } from '../engine/routes/layout';
import { setLocale } from '../i18n';
import {
  clampItemCount,
  clampLevel,
  DEBUG_DEFAULT_LEVEL,
  DEBUG_MAX_ITEM_COUNT,
  DEBUG_MAX_LEVEL,
  DEBUG_MIN_LEVEL,
  DEBUG_ROUTE_HEIGHT,
  DEBUG_ROUTE_WIDTH,
  debugLocationLabel,
  matchAbility,
  matchItem,
  matchMove,
  matchNature,
  matchPartyMember,
  matchSpecies,
  parseOptionalInt,
  parseOptionalText,
  partyMemberLabel,
  partyMemberLabels,
  randomRouteInput,
  type DebugPartyMember,
} from './debugMenu';

function species(id: string, name: string, num: number): Species {
  return {
    id,
    name,
    num,
    types: ['Normal'],
    baseStats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
    abilities: {},
    tags: [],
    bst: 6,
    prevo: '',
    evos: [],
    evolutions: [],
    weightkg: 1,
    heightm: 1,
    genderRatio: { M: 1, F: 1 },
    nfe: false,
    forme: '',
    isCosmeticForme: false,
    catchRate: 255,
  };
}

const CATALOG: readonly Species[] = [
  species('charmander', 'Charmander', 4),
  species('charmeleon', 'Charmeleon', 5),
  species('charizard', 'Charizard', 6),
  species('mrmime', 'Mr. Mime', 122),
];

describe('matchSpecies', () => {
  it('matches an exact name regardless of case', () => {
    expect(matchSpecies('Charmander', CATALOG)?.id).toBe('charmander');
  });

  it('matches an exact id, punctuation ignored', () => {
    expect(matchSpecies('charizard', CATALOG)?.id).toBe('charizard');
    expect(matchSpecies('mr mime', CATALOG)?.id).toBe('mrmime');
  });

  it('falls back to a name prefix, then to a substring', () => {
    expect(matchSpecies('charm', CATALOG)?.id).toBe('charmander');
    expect(matchSpecies('izard', CATALOG)?.id).toBe('charizard');
  });

  it('returns null for a blank or unknown query', () => {
    expect(matchSpecies('   ', CATALOG)).toBeNull();
    expect(matchSpecies('mewtwo', CATALOG)).toBeNull();
  });
});

describe('matchItem', () => {
  it('matches the item catalog by name and by id', () => {
    expect(matchItem('Poke Ball', ITEMS)?.id).toBe('pokeball');
    expect(matchItem('greatball', ITEMS)?.id).toBe('greatball');
  });

  it('resolves an unambiguous prefix', () => {
    expect(matchItem('super', ITEMS)?.id).toBe('superpotion');
  });

  it('returns null for a blank or unknown query', () => {
    expect(matchItem('', ITEMS)).toBeNull();
    expect(matchItem('potion of god', ITEMS)).toBeNull();
  });
});

describe('matchMove / matchAbility / matchNature', () => {
  it('resolves a move by name, id and prefix', () => {
    expect(matchMove('Thunderbolt')?.id).toBe('thunderbolt');
    expect(matchMove('thunderbolt')?.id).toBe('thunderbolt');
    expect(matchMove('thunderb')?.id).toBe('thunderbolt');
    expect(matchMove('not-a-move')).toBeNull();
  });

  it('resolves an ability by name and id', () => {
    expect(matchAbility('Levitate')?.id).toBe('levitate');
    expect(matchAbility('levitate')?.name).toBe('Levitate');
    expect(matchAbility('not-an-ability')).toBeNull();
  });

  it('resolves a nature by name and id', () => {
    expect(matchNature('Adamant')?.id).toBe('adamant');
    expect(matchNature('adamant')?.plus).toBe('atk');
    expect(matchNature('not-a-nature')).toBeNull();
  });
});

describe('matchPartyMember', () => {
  const party: readonly DebugPartyMember[] = [
    {
      id: 'a',
      speciesId: 'pikachu',
      name: 'Pikachu',
      level: 12,
      nature: 'serious',
      ability: 'Static',
      moves: ['thunderbolt'],
    },
    {
      id: 'b',
      speciesId: 'pikachu',
      name: 'Pikachu',
      level: 20,
      nature: 'timid',
      ability: 'Static',
      moves: ['quickattack'],
    },
  ];

  it('resolves an exact label first, so duplicates pick the right level', () => {
    expect(partyMemberLabel(party[0])).toBe('Pikachu Lv12');
    expect(matchPartyMember(partyMemberLabel(party[1]), party)?.id).toBe('b');
    expect(matchPartyMember(partyMemberLabel(party[1]).toLowerCase(), party)?.id).toBe('b');
  });

  it('falls back to a species name, prefix then substring', () => {
    expect(matchPartyMember('Pikachu', party)?.id).toBe('a');
    expect(matchPartyMember('pika', party)?.id).toBe('a');
    expect(matchPartyMember('chu', party)?.id).toBe('a');
  });

  it('returns null for a blank or unknown query', () => {
    expect(matchPartyMember('  ', party)).toBeNull();
    expect(matchPartyMember('missingno', party)).toBeNull();
  });

  it('disambiguates identical labels and matches each twin', () => {
    const twins: readonly DebugPartyMember[] = [
      { id: 'x', speciesId: 'eevee', name: 'Eevee', level: 20, nature: 'serious', ability: 'Run Away', moves: [] },
      { id: 'y', speciesId: 'eevee', name: 'Eevee', level: 20, nature: 'adamant', ability: 'Run Away', moves: [] },
      { id: 'z', speciesId: 'pikachu', name: 'Pikachu', level: 12, nature: 'serious', ability: 'Static', moves: [] },
    ];
    expect(partyMemberLabels(twins)).toEqual(['Eevee Lv20 (1)', 'Eevee Lv20 (2)', 'Pikachu Lv12']);
    expect(matchPartyMember('Eevee Lv20 (2)', twins)?.id).toBe('y');
    expect(matchPartyMember('eevee lv20 (1)', twins)?.id).toBe('x');
    expect(matchPartyMember('Eevee Lv20', twins)?.id).toBe('x');
    expect(matchPartyMember('Eevee', twins)?.id).toBe('x');
  });
});

describe('debugLocationLabel', () => {
  it('joins the floor, room and tile clauses with " · "', () => {
    expect(
      debugLocationLabel({ mapIndex: 3, roomInMap: 2, roomCount: 7, tile: { x: 14, y: 9 } }),
    ).toBe('map 3 · room 2/7 · (14,9)');
  });

  it('drops the room clause when the floor has no plan', () => {
    expect(
      debugLocationLabel({ mapIndex: 3, roomInMap: 2, roomCount: 0, tile: { x: 14, y: 9 } }),
    ).toBe('map 3 · (14,9)');
  });

  it('drops the tile clause when there is no tile', () => {
    expect(debugLocationLabel({ mapIndex: 3, roomInMap: 2, roomCount: 7, tile: null })).toBe(
      'map 3 · room 2/7',
    );
  });

  it('prints only the map clause with neither rooms nor a tile', () => {
    expect(debugLocationLabel({ mapIndex: 3, roomInMap: 2, roomCount: 0, tile: null })).toBe('map 3');
  });

  it('never pads a number', () => {
    expect(debugLocationLabel({ mapIndex: 1, roomInMap: 0, roomCount: 6, tile: { x: 4, y: 9 } })).toBe(
      'map 1 · room 0/6 · (4,9)',
    );
  });

  it('draws the clauses in the current locale', () => {
    setLocale('es');
    expect(
      debugLocationLabel({ mapIndex: 3, roomInMap: 2, roomCount: 7, tile: { x: 14, y: 9 } }),
    ).toBe('mapa 3 · sala 2/7 · (14,9)');
    setLocale('en');
    expect(debugLocationLabel({ mapIndex: 3, roomInMap: 2, roomCount: 7, tile: null })).toBe(
      'map 3 · room 2/7',
    );
  });
});

describe('clampLevel', () => {
  it('keeps a legal level', () => {
    expect(clampLevel(50)).toBe(50);
  });

  it('clamps out-of-range levels and truncates fractions', () => {
    expect(clampLevel(0)).toBe(DEBUG_MIN_LEVEL);
    expect(clampLevel(101)).toBe(DEBUG_MAX_LEVEL);
    expect(clampLevel(12.7)).toBe(12);
  });

  it('falls back to the default on a broken field', () => {
    expect(clampLevel(Number.NaN)).toBe(DEBUG_DEFAULT_LEVEL);
  });
});

describe('clampItemCount', () => {
  it('keeps a legal count and truncates fractions', () => {
    expect(clampItemCount(5)).toBe(5);
    expect(clampItemCount(3.9)).toBe(3);
  });

  it('floors at one and ceils at the debug maximum', () => {
    expect(clampItemCount(0)).toBe(1);
    expect(clampItemCount(-4)).toBe(1);
    expect(clampItemCount(DEBUG_MAX_ITEM_COUNT + 1)).toBe(DEBUG_MAX_ITEM_COUNT);
  });

  it('falls back to one on a broken field', () => {
    expect(clampItemCount(Number.NaN)).toBe(1);
  });
});

describe('parseOptionalInt / parseOptionalText', () => {
  it('treats a blank field as auto', () => {
    expect(parseOptionalInt('')).toBeUndefined();
    expect(parseOptionalInt('   ')).toBeUndefined();
    expect(parseOptionalText('   ')).toBeUndefined();
  });

  it('reads a number, truncates fractions and trims text', () => {
    expect(parseOptionalInt(' 12 ')).toBe(12);
    expect(parseOptionalInt('12.9')).toBe(12);
    expect(parseOptionalText(' seed ')).toBe('seed');
  });

  it('treats a non-numeric field as auto', () => {
    expect(parseOptionalInt('abc')).toBeUndefined();
  });
});

describe('randomRouteInput', () => {
  it('draws the low end of every range', () => {
    const input = randomRouteInput(() => 0);
    expect(input.routeIndex).toBe(1);
    expect(input.width).toBe(DEBUG_ROUTE_WIDTH);
    expect(input.height).toBe(DEBUG_ROUTE_HEIGHT);
  });

  it('draws the high end of every range', () => {
    const input = randomRouteInput(() => 0.999999);
    expect(input.routeIndex).toBe(RUN_CHAIN.finiteLength);
    expect(input.width).toBe(DEBUG_ROUTE_WIDTH);
    expect(input.height).toBe(DEBUG_ROUTE_HEIGHT);
    expect(ROUTE_SHAPES).toContain(input.shape);
  });
});
