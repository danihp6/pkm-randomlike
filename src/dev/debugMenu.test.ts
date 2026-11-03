import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Species } from '../data/dex';
import { ITEMS } from '../data/items';
import { BADGE_CAPS } from '../data/region';
import { RUN_CHAIN } from '../data/run';
import { planRegion } from '../engine/region/plan';
import { SHAPES, ROUTE_SHAPES } from '../engine/routes/layout';
import { createRun } from '../engine/run/state';
import { en } from '../i18n/en';
import { setLocale } from '../i18n';
import {
  changedRun,
  clampItemCount,
  clampLevel,
  DEBUG_DEFAULT_LEVEL,
  DEBUG_MAX_ITEM_COUNT,
  DEBUG_MAX_LEVEL,
  DEBUG_MIN_LEVEL,
  DEBUG_ROUTE_HEIGHT,
  DEBUG_ROUTE_WIDTH,
  debugNodeLabel,
  debugNodeOptionLabel,
  matchAbility,
  matchItem,
  matchMove,
  matchNature,
  matchPartyMember,
  matchSpecies,
  nodeContextFor,
  parseBadge,
  parseOptionalInt,
  parseOptionalText,
  partyMemberLabel,
  partyMemberLabels,
  randomRouteInput,
  withTowerStreak,
  withVisitedNode,
  type DebugMenuHandlers,
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
      {
        id: 'x',
        speciesId: 'eevee',
        name: 'Eevee',
        level: 20,
        nature: 'serious',
        ability: 'Run Away',
        moves: [],
      },
      {
        id: 'y',
        speciesId: 'eevee',
        name: 'Eevee',
        level: 20,
        nature: 'adamant',
        ability: 'Run Away',
        moves: [],
      },
      {
        id: 'z',
        speciesId: 'pikachu',
        name: 'Pikachu',
        level: 12,
        nature: 'serious',
        ability: 'Static',
        moves: [],
      },
    ];
    expect(partyMemberLabels(twins)).toEqual(['Eevee Lv20 (1)', 'Eevee Lv20 (2)', 'Pikachu Lv12']);
    expect(matchPartyMember('Eevee Lv20 (2)', twins)?.id).toBe('y');
    expect(matchPartyMember('eevee lv20 (1)', twins)?.id).toBe('x');
    expect(matchPartyMember('Eevee Lv20', twins)?.id).toBe('x');
    expect(matchPartyMember('Eevee', twins)?.id).toBe('x');
  });
});

describe('nodeContextFor', () => {
  const SEED = 'node-tab';
  const run = createRun({ seed: SEED });
  const plan = planRegion(SEED);
  const context = nodeContextFor(run);

  it('reads the node the run stands on, its badges, its streak and its visited keys', () => {
    expect(context.nodeKey).toBe(run.nodeKey);
    expect(context.nodeKey).toBe(plan.townKey);
    expect(context.badges).toEqual([]);
    expect(context.towerStreak).toBe(0);
    expect(context.visitedNodes).toEqual([plan.townKey]);
  });

  it('lists every plan node exactly once, with its kind, name and badge', () => {
    const keys = context.nodes.map((node) => node.key);
    expect(context.nodes).toHaveLength(plan.nodes.length);
    expect(new Set(keys).size).toBe(plan.nodes.length);
    expect(keys).toEqual(plan.nodes.map((node) => node.key));
    expect(keys).toContain('town:1');
    expect(keys).toContain('city:3');
    const city = context.nodes.find((node) => node.key === 'city:3');
    const planned = plan.nodes.find((node) => node.key === 'city:3')!;
    expect(city).toEqual({
      key: planned.key,
      kind: planned.kind,
      name: planned.name,
      badge: planned.badge,
    });
  });

  it('is drawn off the run alone, so a seed always lists the same nodes', () => {
    expect(nodeContextFor(createRun({ seed: SEED }))).toEqual(context);
  });
});

describe('debugNodeLabel', () => {
  it('prints the node key, never a floor', () => {
    expect(debugNodeLabel({ nodeKey: 'city:3' })).toBe('city:3');
  });

  it('draws the line in the current locale', () => {
    setLocale('es');
    expect(debugNodeLabel({ nodeKey: 'lateral:2' })).toBe('Nodo lateral:2');
    setLocale('en');
    expect(debugNodeLabel({ nodeKey: 'town:1' })).toBe('town:1');
  });
});

describe('debugNodeOptionLabel', () => {
  const node = planRegion('option-label').nodes.find((entry) => entry.key === 'city:3')!;

  it('names the kind, the node and its badge stretch', () => {
    expect(debugNodeOptionLabel(node)).toBe(`city · ${node.name} · Badge ${node.badge}`);
  });

  it('draws the badge word in the current locale', () => {
    setLocale('es');
    expect(debugNodeOptionLabel(node)).toBe(`city · ${node.name} · Insignia ${node.badge}`);
    setLocale('en');
  });
});

describe('withVisitedNode', () => {
  const run = createRun({ seed: 'visited' });

  it('appends the key once and returns the same run on a second call', () => {
    const once = withVisitedNode(run, 'city:2');
    expect(once.visitedNodes).toEqual([run.nodeKey, 'city:2']);
    const twice = withVisitedNode(once, 'city:2');
    expect(twice).toBe(once);
  });

  it('trims the key and ignores a blank one', () => {
    expect(withVisitedNode(run, '  city:2  ').visitedNodes).toContain('city:2');
    expect(withVisitedNode(run, '   ')).toBe(run);
  });

  it('keeps onMarkVisited idempotent: the second call changes nothing', () => {
    const first = changedRun(run, (current) => withVisitedNode(current, 'city:2'));
    expect(first).not.toBeNull();
    expect(changedRun(first!, (current) => withVisitedNode(current, 'city:2'))).toBeNull();
  });
});

describe('withTowerStreak', () => {
  const run = createRun({ seed: 'streak' });

  it('sets the streak, floors a fraction and clamps it at zero', () => {
    expect(withTowerStreak(run, 4).towerStreak).toBe(4);
    expect(withTowerStreak(run, 2.9).towerStreak).toBe(2);
    expect(withTowerStreak(run, -3).towerStreak).toBe(0);
  });

  it('returns the same run when the value does not move', () => {
    expect(withTowerStreak(run, 0)).toBe(run);
    expect(withTowerStreak(run, Number.NaN)).toBe(run);
  });
});

describe('changedRun', () => {
  const run = createRun({ seed: 'changed' });

  it('hands back the new run when the rule moved it', () => {
    expect(changedRun(run, (current) => withTowerStreak(current, 5))?.towerStreak).toBe(5);
  });

  it('hands back null when the rule refused', () => {
    expect(changedRun(run, (current) => withTowerStreak(current, 0))).toBeNull();
  });
});

describe('parseBadge', () => {
  it('accepts a rung the ladder carries', () => {
    expect(parseBadge('1')).toBe(1);
    expect(parseBadge(String(BADGE_CAPS.length))).toBe(BADGE_CAPS.length);
  });

  it('refuses a blank, a rung off the ladder and a non-number', () => {
    expect(parseBadge('')).toBeNull();
    expect(parseBadge('0')).toBeNull();
    expect(parseBadge(String(BADGE_CAPS.length + 1))).toBeNull();
    expect(parseBadge('badge')).toBeNull();
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

  it('keeps drawing a shape the generator can carve', () => {
    for (const unit of [0, 0.25, 0.5, 0.75, 0.999999]) {
      expect(Object.keys(SHAPES)).toContain(randomRouteInput(() => unit).shape);
    }
  });
});

/**
 * The handler surface is the contract `src/main.ts` implements: the node tools and
 * no floor teleport. The `Record` below fails to compile if a floor teleport comes
 * back, so the typecheck is half of this assertion.
 */
type NodeTeleportHandlers = Extract<keyof DebugMenuHandlers, `onTeleport${string}`>;
const TELEPORT_HANDLERS: Readonly<Record<NodeTeleportHandlers, true>> = { onTeleportNode: true };

const HERE = dirname(fileURLToPath(import.meta.url));
const MENU_SOURCE = readFileSync(join(HERE, 'debugMenu.ts'), 'utf8');
const IDS_SOURCE = readFileSync(join(HERE, 'ids.ts'), 'utf8');
const CALL_SITE = /(?<![\w.$])t\(\s*'([a-z][A-Za-z0-9.]*)'/g;
const USED_KEYS = [...MENU_SOURCE.matchAll(CALL_SITE)].map((match) => match[1]!);

/** The floor, room and tile keys this task retires: nothing may draw them again. */
const FLOOR_KEYS = [
  'dev.floor',
  'dev.floorTitle',
  'dev.room',
  'dev.roomTitle',
  'dev.x',
  'dev.tileXTitle',
  'dev.y',
  'dev.tileYTitle',
  'dev.go',
  'dev.teleportFloor',
  'dev.teleportRoom',
  'dev.teleportTile',
  'dev.location.map',
  'dev.location.room',
  'dev.location.tile',
  'dev.status.teleported',
];

/** The node group Task-295 pinned: the panel must draw these, not a floor. */
const NODE_KEYS = [
  'dev.node',
  'dev.nodeTitle',
  'dev.nodePlaceholder',
  'dev.teleportNode',
  'dev.markVisited',
  'dev.badge',
  'dev.badgeTitle',
  'dev.badgePlaceholder',
  'dev.grantBadge',
  'dev.streak',
  'dev.streakTitle',
  'dev.streakPlaceholder',
  'dev.setStreak',
  'dev.mode',
  'dev.modeLeague',
  'dev.modeTower',
  'dev.status.unknownNode',
  'dev.status.teleportedTo',
  'dev.status.badge',
  'dev.status.streak',
  'dev.status.visited',
  'dev.location.node',
];

describe('the node tab', () => {
  it('carries the node teleport and no floor, room or tile handler', () => {
    expect(Object.keys(TELEPORT_HANDLERS)).toEqual(['onTeleportNode']);
    for (const gone of ['onTeleportFloor', 'onTeleportRoom', 'onTeleportTile']) {
      expect(MENU_SOURCE, gone).not.toContain(gone);
    }
  });

  it('draws every label it shows through t() with a key the table carries', () => {
    expect(USED_KEYS.length).toBeGreaterThan(20);
    expect(USED_KEYS.filter((key) => !(key in en))).toEqual([]);
    expect(USED_KEYS.filter((key) => key.startsWith('dev.'))).not.toHaveLength(0);
  });

  it('supplies exactly the tokens each of its keys declares', () => {
    // The walker in `src/i18n/index.test.ts` compares every `t('<key>', { … })` call
    // site's params with the tokens its key declares; this panel is one of its files.
    expect(USED_KEYS.every((key) => key in en)).toBe(true);
  });

  it('draws the node, badge, streak and mode labels and none of the floor keys', () => {
    for (const key of NODE_KEYS) expect(USED_KEYS, key).toContain(key);
    for (const key of FLOOR_KEYS) expect(USED_KEYS, key).not.toContain(key);
  });

  it('mounts a node, a badge and a streak control, and nothing floor-shaped', () => {
    const ids = [...MENU_SOURCE.matchAll(/setAttribute\('data-debug-id', '([^']+)'\)/g)].map(
      (match) => match[1],
    );
    expect(ids).toEqual(['node', 'badge', 'streak']);
    expect(MENU_SOURCE).toContain("setAttribute('data-debug-node-option', node.kind)");
    expect(MENU_SOURCE).toContain("nodeList.id = 'debug-node-list'");
  });

  it('keeps the generator tab and the frame-map importer', () => {
    expect(USED_KEYS).toContain('dev.tab.route');
    expect(USED_KEYS).toContain('dev.export');
    expect(USED_KEYS).toContain('dev.import');
    expect(MENU_SOURCE).toContain('handlers.importFrameMap(mapArea.value)');
  });
});

describe('the debug ids', () => {
  function sourceFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...sourceFiles(path));
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(path);
    }
    return files;
  }

  const OTHERS = sourceFiles(join(HERE, '..'))
    .filter((file) => file !== join(HERE, 'ids.ts'))
    .map((file) => readFileSync(file, 'utf8'));

  it('exports no id nothing mints', () => {
    const exported = [...IDS_SOURCE.matchAll(/export (?:function|const) (\w+)/g)].map(
      (match) => match[1]!,
    );
    expect(exported).toEqual(['nextDebugPokemonId']);
    for (const name of exported) {
      expect(
        OTHERS.some((source) => source.includes(name)),
        name,
      ).toBe(true);
    }
    expect(OTHERS.some((source) => source.includes('nextDebugPokemonId'))).toBe(true);
  });

  it('mints the ids the panel-adjacent tools address a member by', () => {
    expect(IDS_SOURCE).toContain('debug:${speciesId}:${counter}');
  });
});
