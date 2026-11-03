import { describe, expect, it } from 'vitest';
import { cityChanceOf, genericLines, specialNpcRow, SPECIAL_NPCS } from '../../data/npcs';
import { isWalkable } from '../map';
import { hashSeed, Rng } from '../rng';
import { createRunPokemon } from '../run/progression';
import { addItem, createRun, itemCount, type RunState } from '../run/state';
import { planCity } from './city/plan';
import { planNodeContent } from './content';
import {
  markNpcUsed,
  nodeNpcs,
  npcPlacementId,
  npcUseId,
  npcUsed,
  useNpc,
  type NpcKind,
  type PlacedNpc,
} from './npcs';
import { nodeOf, planRegion } from './plan';

/**
 * The seed `docs/region-spec.md` §7.7 pins its placement table on: the town's one
 * person and the five people `city:1` stands, three generic and two special.
 */
const SEED = 'qa-288';
const PLAN = planRegion(SEED);

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

function contentOf(plan: ReturnType<typeof planRegion>, key: string) {
  const node = nodeOf(plan, key)!;
  return planNodeContent(plan, key, node.tier ?? 1);
}

/** The chance a special takes a city slot: one stream per row, one draw. */
function specialRoll(seed: string, key: string, rowId: string): number {
  return new Rng(hashSeed(`${seed}:node:${key}:npc-special:${rowId}`)).next();
}

/** A run carrying a wounded starter, so the medic has something to heal. */
function woundedRun(): RunState {
  const base = createRun({ seed: SEED, starter });
  return {
    ...base,
    party: base.party.map((member) => ({ ...member, fighter: { ...member.fighter, hp: 1 } })),
  };
}

/** A placed row, standing on a hand-picked tile, for the once-rule tests. */
function placedOf(rowId: string, kind: NpcKind = 'special'): PlacedNpc {
  const row = specialNpcRow(rowId)!;
  return {
    id: npcPlacementId('city:1', 0),
    nodeKey: 'city:1',
    index: 0,
    kind,
    rowId: row.id,
    spriteKey: row.spriteKey,
    nameKey: kind === 'generic' ? 'npc.generic.name' : row.nameKey,
    lineKey: kind === 'generic' ? genericLines(1)[0] : row.greetingKey,
    choiceId: kind === 'generic' ? null : (row.choices?.[0]?.id ?? null),
    tile: { x: 1, y: 1 },
    facing: 'S',
  };
}

/** The four columns the placement table pins, plus the node. */
type PinnedRow = Readonly<{
  node: string;
  index: number;
  id: string;
  kind: NpcKind;
  rowId: string;
  x: number;
  y: number;
}>;

const PINNED: readonly PinnedRow[] = [
  { node: 'town:1', index: 0, id: 'npc-town:1-0', kind: 'generic', rowId: 'merchant', x: 34, y: 26 },
  { node: 'city:1', index: 0, id: 'npc-city:1-0', kind: 'generic', rowId: 'rocket', x: 15, y: 27 },
  { node: 'city:1', index: 1, id: 'npc-city:1-1', kind: 'generic', rowId: 'species', x: 43, y: 32 },
  { node: 'city:1', index: 2, id: 'npc-city:1-2', kind: 'generic', rowId: 'merchant', x: 36, y: 38 },
  { node: 'city:1', index: 3, id: 'npc-city:1-3', kind: 'special', rowId: 'iv-judge', x: 36, y: 35 },
  { node: 'city:1', index: 4, id: 'npc-city:1-4', kind: 'special', rowId: 'ability', x: 4, y: 39 },
];

function slim(npc: PlacedNpc): Omit<PinnedRow, 'node'> {
  return {
    index: npc.index,
    id: npc.id,
    kind: npc.kind,
    rowId: npc.rowId,
    x: npc.tile.x,
    y: npc.tile.y,
  };
}

describe('nodeNpcs', () => {
  it('pins the placements the region spec records for its seed, line for line', () => {
    const town = nodeNpcs(PLAN, 'town:1', contentOf(PLAN, 'town:1')).map(slim);
    const city = nodeNpcs(PLAN, 'city:1', contentOf(PLAN, 'city:1')).map(slim);
    const expectedTown = PINNED.filter((row) => row.node === 'town:1').map(({ node, ...rest }) => {
      void node;
      return rest;
    });
    const expectedCity = PINNED.filter((row) => row.node === 'city:1').map(({ node, ...rest }) => {
      void node;
      return rest;
    });
    expect(town).toEqual(expectedTown);
    expect(city).toEqual(expectedCity);
  });

  it('stands the tier band of generic people the content pass rolled', () => {
    const bands: readonly Readonly<{ key: string; min: number; max: number }>[] = [
      { key: 'city:1', min: 2, max: 3 },
      { key: 'city:3', min: 4, max: 6 },
      { key: 'city:6', min: 7, max: 10 },
      { key: 'town:1', min: 1, max: 1 },
    ];
    for (let index = 0; index < 10; index++) {
      const seed = `npc-count-${index}`;
      const plan = planRegion(seed);
      for (const band of bands) {
        const content = contentOf(plan, band.key);
        const placed = nodeNpcs(plan, band.key, content);
        const generals = placed.filter((npc) => npc.kind === 'generic');
        const label = `${seed} ${band.key}`;
        expect(generals.length, label).toBeGreaterThanOrEqual(band.min);
        expect(generals.length, label).toBeLessThanOrEqual(band.max);
        // Every row the content pass rolled is stood: the settlement always has room.
        expect(generals.length, label).toBe(content.npcs.length);
      }
    }
  });

  it('gives a generic the row its id names, the generic title and a line of its tier', () => {
    const content = contentOf(PLAN, 'city:1');
    const placed = nodeNpcs(PLAN, 'city:1', content);
    for (const npc of placed) {
      expect(npc.id).toBe(npcPlacementId('city:1', npc.index));
      expect(npc.nodeKey).toBe('city:1');
      expect(SPECIAL_NPCS.map((row) => row.id)).toContain(npc.rowId);
      if (npc.kind !== 'generic') continue;
      expect(npc.nameKey).toBe('npc.generic.name');
      expect(npc.choiceId).toBeNull();
      expect(content.npcs.map((entry) => entry.npcId)).toContain(npc.rowId);
      expect(genericLines(1)).toContain(npc.lineKey);
    }
    // The specials keep their own title, greeting and first choice.
    for (const npc of placed.filter((entry) => entry.kind === 'special')) {
      const row = specialNpcRow(npc.rowId)!;
      expect(npc.nameKey).toBe(row.nameKey);
      expect(npc.lineKey).toBe(row.greetingKey);
      expect(npc.choiceId).toBe(row.choices?.[0]?.id ?? null);
    }
  });

  it('places a special by its own draw, and a line can never move it', () => {
    const content = contentOf(PLAN, 'city:1');
    const placed = nodeNpcs(PLAN, 'city:1', content);
    const expected = content.specials
      .map((entry) => specialNpcRow(entry.npcId)!)
      .filter((row) => specialRoll(SEED, 'city:1', row.id) < cityChanceOf(row))
      .map((row) => row.id);
    expect(expected.length).toBeGreaterThan(0);
    expect(placed.filter((npc) => npc.kind === 'special').map((npc) => npc.rowId)).toEqual(expected);

    // No generic at all: the same rows are still stood, still by their own draw.
    const withoutGenerics = nodeNpcs(PLAN, 'city:1', { ...content, npcs: [] });
    expect(withoutGenerics.map((npc) => npc.kind)).toEqual(expected.map(() => 'special' as const));
    expect(withoutGenerics.map((npc) => npc.rowId)).toEqual(expected);
  });

  it('replays the same people, and stands them on free, distinct tiles', () => {
    const content = contentOf(PLAN, 'city:1');
    const first = nodeNpcs(PLAN, 'city:1', content);
    expect(nodeNpcs(PLAN, 'city:1', content)).toEqual(first);
    // A call for another node in between must not move this one.
    nodeNpcs(PLAN, 'town:1', contentOf(PLAN, 'town:1'));
    expect(nodeNpcs(PLAN, 'city:1', content)).toEqual(first);

    const city = planCity(PLAN, 'city:1');
    const doors = new Set(city.buildings.map((building) => `${building.door.x},${building.door.y}`));
    const taken = new Set<string>();
    for (const npc of first) {
      expect(isWalkable(city.tiles, npc.tile), npc.id).toBe(true);
      expect(npc.tile, npc.id).not.toEqual(city.spawn);
      expect(doors.has(`${npc.tile.x},${npc.tile.y}`), npc.id).toBe(false);
      const cell = `${npc.tile.x},${npc.tile.y}`;
      expect(taken.has(cell), npc.id).toBe(false);
      taken.add(cell);
    }
    expect(first.map((npc) => npc.index)).toEqual(first.map((_npc, index) => index));
  });

  it('throws on a key the plan does not hold and on a node that is no settlement', () => {
    const content = contentOf(PLAN, 'city:1');
    expect(() => nodeNpcs(PLAN, 'nowhere:9', content)).toThrow('unknown node: nowhere:9');
    expect(() => nodeNpcs(PLAN, 'route:1', content)).toThrow('not a settlement: route:1');
  });
});

describe('the once rule', () => {
  it('heals the medic once and keeps the mark', () => {
    const run = woundedRun();
    const medic = placedOf('medic');
    expect(npcUsed(run, medic)).toBe(false);
    const use = useNpc(run, medic);
    expect(use.ok).toBe(true);
    if (!use.ok) return;
    expect(use.run.party[0].fighter.hp).toBeGreaterThan(1);
    expect(npcUsed(use.run, medic)).toBe(true);
    expect(use.run.pickedItems).toContain(npcUseId(medic));
    expect(useNpc(use.run, medic)).toEqual({ ok: false, reason: 'once' });
  });

  it('answers a generic with its line and a scene row with its own scene', () => {
    const run = woundedRun();
    expect(useNpc(run, placedOf('merchant', 'generic'))).toEqual({ ok: false, reason: 'line-only' });
    expect(useNpc(run, placedOf('mega-stone'))).toEqual({ ok: false, reason: 'needs-scene' });
    expect(useNpc(run, placedOf('iv-judge'))).toEqual({ ok: false, reason: 'needs-scene' });
    expect(npcUsed(run, placedOf('iv-judge'))).toBe(false);
  });

  it('trades the chef once and refuses a second time', () => {
    const chef = placedOf('chef');
    const run = woundedRun();
    expect(useNpc(run, chef)).toEqual({ ok: false, reason: 'needs-member' });
    expect(useNpc(run, chef, 'nobody')).toEqual({ ok: false, reason: 'needs-member' });

    const memberId = run.party[0].fighter.id;
    const withBerries = addItem(addItem(addItem(run, 'cheriberry'), 'chestoberry'), 'pechaberry');
    const trade = useNpc(withBerries, chef, memberId);
    expect(trade.ok).toBe(true);
    if (!trade.ok) return;
    expect(trade.run.party[0].fighter.heldItem).toBe('chefstew');
    expect(itemCount(trade.run, 'cheriberry')).toBe(0);
    expect(itemCount(trade.run, 'chestoberry')).toBe(0);
    expect(itemCount(trade.run, 'pechaberry')).toBe(0);
    expect(npcUsed(trade.run, chef)).toBe(true);
    expect(useNpc(trade.run, chef, memberId)).toEqual({ ok: false, reason: 'once' });
  });

  it('marks the use through the shipped pickedItems record', () => {
    const run = woundedRun();
    const placed = placedOf('tutor');
    expect(npcUseId(placed)).toBe('npc-city:1-0-tutor');
    expect(npcUsed(run, placed)).toBe(false);
    const marked = markNpcUsed(run, placed);
    expect(marked.pickedItems).toContain('npc-city:1-0-tutor');
    expect(npcUsed(marked, placed)).toBe(true);
    expect(run.pickedItems).toEqual([]);
  });
});
