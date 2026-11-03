import { beforeAll, describe, expect, it } from 'vitest';
import { BARRED_HEALING_MOVES } from '../../data/noHeal';
import { POI_ROWS } from '../../data/pois';
import { LEGENDARY_SPECIES, STATIC_SPECIES } from '../../data/staticSpecies';
import { POI_KINDS, planNodeContent, type NodeContent, type PoiKind } from './content';
import { planRegion, type RegionPlan } from './plan';
import {
  inPoiRect,
  nodePoi,
  poiAt,
  poiBattleRules,
  poiRect,
  regionStatics,
  regionVaultGate,
  type NodePoi,
} from './pois';
import { generateRoute, type RegionRouteMap } from './route/map';

const GEOMETRY_SEEDS = Array.from({ length: 64 }, (_, index) => `poi-${index}`);

const QUOTA_SEEDS = Array.from({ length: 1000 }, (_, index) => `quota-${index}`);

const CHAIN_KEYS = ['town:1', 'city:1', 'route:1', 'victory-road:1', 'league:1', 'tower:1'];

type PoiCase = Readonly<{
  plan: RegionPlan;
  key: string;
  content: NodeContent;
  poi: NodePoi;
  route: RegionRouteMap;
}>;

let cached: readonly PoiCase[] | undefined;

/** Every terminus of 64 seeds, resolved once: one carve and one POI per lateral. */
function cases(): readonly PoiCase[] {
  if (cached) return cached;
  const built: PoiCase[] = [];
  for (const seed of GEOMETRY_SEEDS) {
    const plan = planRegion(seed);
    for (const node of plan.nodes) {
      if (node.kind !== 'lateral') continue;
      const content = planNodeContent(plan, node.key, node.tier ?? 1);
      built.push({
        plan,
        key: node.key,
        content,
        poi: nodePoi(plan, node.key, content),
        route: generateRoute(plan, node.key),
      });
    }
  }
  cached = built;
  return built;
}

function firstOf(kind: PoiKind): PoiCase {
  const found = cases().find((entry) => entry.poi.kind === kind);
  if (!found) throw new Error(`no terminus ended on ${kind}`);
  return found;
}

function digest(poi: NodePoi): string {
  return JSON.stringify([poi.nodeKey, poi.kind, poi.rect, poi.marker, poi.gateKind, poi.speciesId]);
}

beforeAll(() => {
  cases();
}, 300_000);

describe('a terminus resolves one point of interest', () => {
  it('answers one POI per lateral, of exactly the kind its content drew', () => {
    const held = new Map<string, number>();
    for (const entry of cases()) {
      expect(entry.poi.nodeKey, entry.key).toBe(entry.key);
      expect(entry.poi.kind, entry.key).toBe(entry.content.poi as PoiKind);
      expect(entry.poi.row.kind, entry.key).toBe(entry.poi.kind);
      const at = `${entry.plan.seed}/${entry.key}`;
      held.set(at, (held.get(at) ?? 0) + 1);
    }
    expect(cases().length).toBeGreaterThan(GEOMETRY_SEEDS.length);
    for (const [at, count] of held) expect(count, at).toBe(1);
  });

  it('reaches all nine POI kinds over 64 seeds', () => {
    const reached = new Set<PoiKind>(cases().map((entry) => entry.poi.kind));
    expect([...reached].sort()).toEqual([...POI_KINDS].sort());
  });

  it('refuses every node that is not a terminus, and every key the plan lacks', () => {
    const plan = planRegion(GEOMETRY_SEEDS[0]);
    for (const key of CHAIN_KEYS) {
      const content = planNodeContent(plan, key, 1);
      expect(content.poi, key).toBeNull();
      expect(() => nodePoi(plan, key, content)).toThrow(`not a terminus: ${key}`);
    }
    const terminal = firstOf('vault');
    expect(() => nodePoi(plan, 'nope:1', terminal.content)).toThrow('unknown node: nope:1');
    expect(() => nodePoi(plan, 'city:9', terminal.content)).toThrow('unknown node: city:9');
  });

  // The "one mini-boss per stretch" target is the review item `TODO.md` carries, not
  // this table's: the content pass draws a kind per lateral uniformly, so a two-lateral
  // stretch draws `miniboss` twice with probability 1/81 and no table can forbid it.
  it('draws a mini-boss on one ninth of the termini, one per lateral at most', () => {
    let termini = 0;
    let minibosses = 0;
    for (const seed of QUOTA_SEEDS) {
      const plan = planRegion(seed);
      const perParent = new Map<string, number>();
      for (const node of plan.nodes) {
        if (node.kind !== 'lateral') continue;
        termini += 1;
        const poi = planNodeContent(plan, node.key, node.tier ?? 1).poi;
        expect(POI_KINDS, `${seed} ${node.key}`).toContain(poi);
        if (poi !== 'miniboss') continue;
        minibosses += 1;
        const parent = node.lateralOf ?? '';
        perParent.set(parent, (perParent.get(parent) ?? 0) + 1);
      }
      for (const [parent, count] of perParent) {
        expect(count, `${seed} ${parent}`).toBeLessThanOrEqual(2);
      }
    }
    expect(termini).toBeGreaterThan(QUOTA_SEEDS.length);
    expect(Math.abs(minibosses / termini - 1 / 9)).toBeLessThanOrEqual(0.02);
  });
});

describe('a POI owns a zone inside the route', () => {
  it('keeps every zone inside the border ring, its marker inside the zone', () => {
    for (const { key, poi, route } of cases()) {
      const label = `${route.seed} ${key}`;
      const rect = poi.rect;
      expect(rect.x, label).toBeGreaterThanOrEqual(1);
      expect(rect.y, label).toBeGreaterThanOrEqual(1);
      expect(rect.x + rect.width, label).toBeLessThanOrEqual(route.width - 1);
      expect(rect.y + rect.height, label).toBeLessThanOrEqual(route.height - 1);
      expect(rect.width, label).toBe(7);
      expect(rect.height, label).toBe(5);

      expect(poi.marker.x, label).toBeGreaterThanOrEqual(rect.x);
      expect(poi.marker.x, label).toBeLessThanOrEqual(rect.x + rect.width - 1);
      expect(poi.marker.y, label).toBeGreaterThanOrEqual(rect.y);
      expect(poi.marker.y, label).toBeLessThanOrEqual(rect.y + rect.height - 1);

      expect(inPoiRect(rect, poi.marker), label).toBe(true);
      expect(inPoiRect(rect, { x: rect.x - 1, y: rect.y }), label).toBe(false);
      expect(inPoiRect(rect, { x: rect.x + rect.width, y: rect.y }), label).toBe(false);
      expect(inPoiRect(rect, { x: rect.x, y: rect.y + rect.height }), label).toBe(false);
      expect(poiRect(route), label).toEqual(rect);
    }
  });

  it('finds the zone a tile stands in, and none outside every zone', () => {
    for (const { key, poi } of cases()) {
      expect(poiAt([poi], poi.marker), key).toBe(poi);
      expect(poiAt([], poi.marker), key).toBeNull();
      expect(poiAt([poi], { x: poi.rect.x - 1, y: poi.rect.y - 1 }), key).toBeNull();
      expect(poiAt([poi], { x: poi.rect.x + poi.rect.width, y: poi.rect.y }), key).toBeNull();
    }
  });
});

describe('a POI feeds the battle its rules', () => {
  it('bars the bag and the healing moves inside a no-heal zone and nowhere else', () => {
    const noHeal = firstOf('no-heal');
    const rules = poiBattleRules([noHeal.poi], noHeal.poi.marker);
    expect(rules.noHeal).toBe(true);
    expect(rules.barredMoves).toBe(BARRED_HEALING_MOVES);
    expect(poiBattleRules([noHeal.poi], { x: 0, y: 0 })).toEqual({
      noHeal: false,
      barredMoves: [],
    });
    expect(poiBattleRules([noHeal.poi], { x: noHeal.poi.rect.x - 1, y: noHeal.poi.rect.y - 1 })).toEqual(
      { noHeal: false, barredMoves: [] },
    );
  });

  it('answers the plain battle rules for every other kind', () => {
    for (const entry of cases()) {
      if (entry.poi.kind === 'no-heal') continue;
      expect(poiBattleRules([entry.poi], entry.poi.marker), entry.key).toEqual({
        noHeal: false,
        barredMoves: [],
      });
    }
  });
});

describe('a region holds one seal and one static each', () => {
  it('gives every static its own species and no two the same', () => {
    for (const seed of GEOMETRY_SEEDS) {
      const plan = planRegion(seed);
      const statics = regionStatics(plan);
      const species = [...statics.values()];
      expect(new Set(species).size, seed).toBe(species.length);
      for (const [key, speciesId] of statics) {
        const node = plan.nodes.find((candidate) => candidate.key === key);
        expect(node?.kind, `${seed} ${key}`).toBe('lateral');
        const content = planNodeContent(plan, key, node?.tier ?? 1);
        expect(content.poi, `${seed} ${key}`).toBe('static');
        expect(speciesId, `${seed} ${key}`).toBeTruthy();
      }
      expect(regionStatics(plan), seed).toEqual(statics);
    }
  });

  it('hands a static the region’s own species and no other kind a static’s', () => {
    let statics = 0;
    for (const entry of cases()) {
      if (entry.poi.kind !== 'static') {
        if (entry.poi.kind !== 'legendary') expect(entry.poi.speciesId, entry.key).toBeNull();
        continue;
      }
      statics += 1;
      expect(entry.poi.speciesId, entry.key).not.toBeNull();
      expect(STATIC_SPECIES, entry.key).toContain(entry.poi.speciesId);
      expect(entry.poi.speciesId, entry.key).toBe(regionStatics(entry.plan).get(entry.key));
    }
    expect(statics).toBeGreaterThan(0);
  });

  it('holds one legendary per legendary terminus, drawn off its own split', () => {
    const legendary = firstOf('legendary');
    expect(legendary.poi.speciesId).not.toBeNull();
    let legendaries = 0;
    for (const entry of cases()) {
      if (entry.poi.kind !== 'legendary') continue;
      legendaries += 1;
      expect(LEGENDARY_SPECIES, entry.key).toContain(entry.poi.speciesId);
      expect(entry.poi.row.kind, entry.key).toBe('legendary');
      expect(entry.poi.row, entry.key).toBe(POI_ROWS.legendary);
    }
    expect(legendaries).toBeGreaterThan(0);
  });

  it('seals every vault of a seed with the same gate, and none of another kind', () => {
    for (const entry of cases()) {
      const gate = regionVaultGate(entry.plan);
      expect(regionVaultGate(entry.plan), entry.key).toBe(gate);
      if (entry.poi.kind === 'vault') expect(entry.poi.gateKind, entry.key).toBe(gate);
      else expect(entry.poi.gateKind, entry.key).toBeNull();
    }
    const seed = [...new Set(cases().map((entry) => entry.plan.seed))].find(
      (candidate) =>
        cases().filter((entry) => entry.plan.seed === candidate && entry.poi.kind === 'vault').length >=
        2,
    );
    expect(seed).toBeDefined();
    const vaults = cases().filter((entry) => entry.plan.seed === seed && entry.poi.kind === 'vault');
    expect(new Set(vaults.map((entry) => entry.poi.gateKind)).size, seed).toBe(1);
  });
});

describe('a POI replays and moves no content draw', () => {
  it('answers the same twice, whatever else was built in between', () => {
    const [first, second] = cases();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    const content = planNodeContent(first.plan, first.key, 1);
    const one = nodePoi(first.plan, first.key, content);
    expect(Array.isArray(one)).toBe(false);
    expect(digest(one)).toBe(digest(first.poi));
    expect(digest(one)).toBe(digest(nodePoi(first.plan, first.key, content)));
    const other = nodePoi(second.plan, second.key, planNodeContent(second.plan, second.key, 1));
    expect(digest(other)).toBe(digest(second.poi));
    expect(digest(nodePoi(first.plan, first.key, content))).toBe(digest(one));
  });

  it('leaves the content pass where it found it, node by node', () => {
    for (const entry of cases().slice(0, 8)) {
      const before = planNodeContent(entry.plan, entry.key, 1);
      nodePoi(entry.plan, entry.key, before);
      expect(planNodeContent(entry.plan, entry.key, 1), entry.key).toEqual(before);
    }
    const [entry] = cases();
    if (!entry) return;
    const before = entry.plan.nodes.map((node) => digestContent(entry.plan, node.key, node.tier));
    nodePoi(entry.plan, entry.key, planNodeContent(entry.plan, entry.key, 1));
    const after = entry.plan.nodes.map((node) => digestContent(entry.plan, node.key, node.tier));
    expect(after).toEqual(before);
  });

  it('builds the same POI for a fixed seed for ever', () => {
    const plan = planRegion('alpha');
    const lateral = plan.nodes.find((node) => node.kind === 'lateral');
    if (!lateral) throw new Error('alpha planned no lateral');
    const content = planNodeContent(plan, lateral.key, 1);
    expect(digest(nodePoi(plan, lateral.key, content))).toBe(
      digest(nodePoi(planRegion('alpha'), lateral.key, content)),
    );
  });
});

function digestContent(plan: RegionPlan, key: string, tier: 1 | 2 | 3 | null): string {
  return JSON.stringify(planNodeContent(plan, key, tier ?? 1));
}
