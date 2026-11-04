import { describe, expect, it } from 'vitest';
import { NPC_ROWS } from '../../data/npcs';
import { planNodeContent, POI_KINDS, type NodeContent } from './content';
import { planRegion, type RegionPlan } from './plan';
import { planRouteScreens } from './routeScreens';

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

const TIER_SEEDS = Array.from({ length: 200 }, (_, index) => `tier-${index}`);

const TIER_PLANS: readonly RegionPlan[] = TIER_SEEDS.map((seed) => planRegion(seed));

const NPC_IDS: ReadonlySet<string> = new Set(NPC_ROWS.map((row) => row.id));

function contentOf(plan: RegionPlan, key: string): NodeContent {
  const node = plan.nodes.find((candidate) => candidate.key === key);
  if (!node) throw new Error(`no node ${key} in ${plan.seed}`);
  return planNodeContent(plan, key, node.tier ?? 1);
}

function digestOf(plan: RegionPlan): string {
  return plan.nodes
    .map((node) => {
      const content = contentOf(plan, node.key);
      return `${node.key}|${content.npcs.map((npc) => npc.npcId).join(',')}|${content.specials
        .map((npc) => npc.npcId)
        .join(',')}|${content.poi ?? '-'}|${content.grass ? 'g' : '-'}|${content.shops.join(',')}|t${
        content.trainers
      }`;
    })
    .join('\n');
}

describe('node content counts', () => {
  it('sizes a city’s NPCs by its tier, the late band standing the most', () => {
    const means = [0, 0, 0];
    for (const plan of TIER_PLANS) {
      const key = plan.nodes.find((node) => node.kind === 'city')?.key ?? '';
      const counts = [1, 2, 3].map((tier) => planNodeContent(plan, key, tier as 1 | 2 | 3).npcs.length);
      const [tier1, tier2, tier3] = counts;
      expect(tier1, plan.seed).toBeGreaterThanOrEqual(2);
      expect(tier1, plan.seed).toBeLessThanOrEqual(3);
      expect(tier2, plan.seed).toBeGreaterThanOrEqual(4);
      expect(tier2, plan.seed).toBeLessThanOrEqual(6);
      expect(tier3, plan.seed).toBeGreaterThanOrEqual(7);
      expect(tier3, plan.seed).toBeLessThanOrEqual(10);
      means[0] += tier1;
      means[1] += tier2;
      means[2] += tier3;
    }
    expect(means[2] / TIER_PLANS.length).toBeGreaterThan(means[0] / TIER_PLANS.length);
  });

  it('stands the town exactly one NPC and rolls its ids without replacement', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      const town = contentOf(plan, plan.townKey);
      expect(town.npcs, seed).toEqual([{ npcId: NPC_ROWS[0].id }]);
      for (const node of plan.nodes) {
        const ids = contentOf(plan, node.key).npcs.map((npc) => npc.npcId);
        expect(new Set(ids).size, `${seed} ${node.key}`).toBe(ids.length);
        for (const id of ids) expect(NPC_IDS.has(id), `${seed} ${node.key} ${id}`).toBe(true);
      }
    }
  });

  it('offers a city one or two distinct special NPCs and no other kind any', () => {
    for (const plan of TIER_PLANS) {
      for (const city of plan.nodes.filter((node) => node.kind === 'city')) {
        const ids = contentOf(plan, city.key).specials.map((npc) => npc.npcId);
        expect(ids.length, `${plan.seed} ${city.key}`).toBeGreaterThanOrEqual(1);
        expect(ids.length, `${plan.seed} ${city.key}`).toBeLessThanOrEqual(2);
        expect(new Set(ids).size, `${plan.seed} ${city.key}`).toBe(ids.length);
        for (const id of ids) expect(NPC_IDS.has(id), `${plan.seed} ${city.key} ${id}`).toBe(true);
      }
      for (const node of plan.nodes) {
        if (node.kind === 'city') continue;
        expect(contentOf(plan, node.key).specials, `${plan.seed} ${node.key}`).toEqual([]);
      }
    }
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      expect(contentOf(plan, plan.townKey).specials, seed).toEqual([]);
      expect(contentOf(plan, 'route:1').specials, seed).toEqual([]);
      expect(contentOf(plan, 'city:1').specials.length, seed).toBeGreaterThanOrEqual(1);
      expect(contentOf(plan, 'city:1').specials.length, seed).toBeLessThanOrEqual(2);
    }
  });

  it('posts trainers on the routes and the cities, by the city’s tier and nothing else', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const node of plan.nodes) {
        const trainers = contentOf(plan, node.key).trainers;
        if (node.kind === 'town' || node.kind === 'league') {
          expect(trainers, `${seed} ${node.key}`).toBe(0);
        } else if (node.kind === 'tower') {
          expect(trainers, `${seed} ${node.key}`).toBe(0);
        } else if (node.kind === 'route' || node.kind === 'lateral' || node.kind === 'victory-road') {
          expect(trainers, `${seed} ${node.key}`).toBeGreaterThanOrEqual(2);
          expect(trainers, `${seed} ${node.key}`).toBeLessThanOrEqual(4);
        } else {
          const ranges: Readonly<Record<1 | 2 | 3, readonly [number, number]>> = {
            1: [1, 2],
            2: [2, 3],
            3: [3, 4],
          };
          const [min, max] = ranges[node.tier ?? 1];
          expect(trainers, `${seed} ${node.key}`).toBeGreaterThanOrEqual(min);
          expect(trainers, `${seed} ${node.key}`).toBeLessThanOrEqual(max);
        }
      }
    }
  });
});

describe('node content place', () => {
  it('ends every lateral on exactly one point of interest and no chain node on any', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      const chain = new Set(plan.chain);
      for (const node of plan.nodes) {
        const poi = contentOf(plan, node.key).poi;
        if (node.kind === 'lateral') {
          expect(node.lateralOf, `${seed} ${node.key}`).not.toBeNull();
          expect(POI_KINDS, `${seed} ${node.key}`).toContain(poi);
        } else {
          expect(chain.has(node.key), `${seed} ${node.key}`).toBe(true);
          expect(poi, `${seed} ${node.key}`).toBeNull();
        }
      }
    }
  });

  it('holds grass on the settlements and every route kind, and none on the last two', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      const lateral = plan.nodes.find((node) => node.kind === 'lateral');
      expect(lateral, seed).toBeDefined();
      for (const key of [plan.townKey, 'city:1', 'route:1', lateral?.key ?? '', 'victory-road:1']) {
        expect(contentOf(plan, key).grass, `${seed} ${key}`).toBe(true);
      }
      for (const key of ['league:1', 'tower:1']) {
        expect(contentOf(plan, key).grass, `${seed} ${key}`).toBe(false);
      }
    }
  });

  it('keeps the mart in the cities and no shop anywhere else', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const node of plan.nodes) {
        expect(contentOf(plan, node.key).shops, `${seed} ${node.key}`).toEqual(
          node.kind === 'city' ? ['mart'] : [],
        );
      }
      expect(contentOf(plan, plan.townKey).shops, seed).toEqual([]);
      expect(contentOf(plan, 'route:1').shops, seed).toEqual([]);
      expect(contentOf(plan, 'city:1').shops, seed).toEqual(['mart']);
    }
  });
});

describe('node content determinism', () => {
  it('replays a node on a second call and rolls another seed’s', () => {
    const plan = planRegion('alpha');
    const first = planNodeContent(plan, 'city:1', 1);
    const again = planNodeContent(plan, 'city:1', 1);
    expect(again).toEqual(first);
    expect(again.npcs).not.toBe(first.npcs);
    expect(again.specials).not.toBe(first.specials);
    expect(again.shops).not.toBe(first.shops);

    const values = new Set(SEEDS.map((seed) => JSON.stringify(contentOf(planRegion(seed), 'city:1'))));
    expect(values.size).toBeGreaterThanOrEqual(2);
  });

  it('pins a fixed seed’s whole-plan content', () => {
    expect(digestOf(planRegion('alpha'))).toBe(`town:1|merchant||-|g||t0
route:1|ability,mega-stone,medic||-|g||t3
lateral:1|ability,magician,sacrifice||vault|g||t3
city:1|merchant,weather-man,exorcist|magician,iv-judge|-|g|mart|t1
route:2|species,merchant||-|g||t4
lateral:2|exorcist,tutor||static|g||t2
lateral:3|nature,berry-tree,type-gate||banned|g||t2
city:2|berry-tree,merchant,medic|type-gate,tutor|-|g|mart|t1
route:3|nature,weather-man,ability||-|g||t2
lateral:4|chef,species,type-gate||banned|g||t4
lateral:5|ability,iv-judge||no-heal|g||t4
city:3|rocket,mega-stone,merchant,sacrifice,tutor|tutor,rocket|-|g|mart|t3
route:4|species,type-gate||-|g||t4
lateral:6|chef,iv-judge,merchant||vault|g||t4
lateral:7|mega-stone,medic||vault|g||t3
city:4|chef,type-gate,iv-judge,magician,exorcist,sacrifice|mega-stone|-|g|mart|t2
route:5|nature,chef||-|g||t4
lateral:8|iv-judge,rocket||trade|g||t2
lateral:9|chef,exorcist,nature||legendary|g||t2
city:5|nature,ability,merchant,species|type-gate,nature|-|g|mart|t2
route:6|medic,rocket,magician||-|g||t2
lateral:10|magician,species||trade|g||t4
lateral:11|rocket,nature||vault|g||t4
city:6|magician,mega-stone,nature,species,sacrifice,berry-tree,merchant,type-gate,rocket|medic,merchant|-|g|mart|t4
route:7|sacrifice,nature||-|g||t4
lateral:12|medic,species||banned|g||t3
lateral:13|weather-man,chef||no-heal|g||t3
city:7|chef,tutor,species,nature,ability,iv-judge,exorcist,medic,berry-tree,weather-man|chef|-|g|mart|t3
route:8|medic,species,chef||-|g||t3
lateral:14|nature,medic||trade|g||t4
city:8|iv-judge,species,tutor,exorcist,type-gate,sacrifice,rocket,mega-stone,ability|berry-tree,ability|-|g|mart|t4
victory-road:1|ability,rocket,tutor||-|g||t2
league:1|merchant,mega-stone,nature||-|-||t0
tower:1|rocket,berry-tree,tutor||-|-||t0`);
  });
});

describe('node content refuses', () => {
  it('a key the plan does not hold', () => {
    const plan = planRegion('alpha');
    expect(() => planNodeContent(plan, 'nope:1', 1)).toThrow('unknown node: nope:1');
    expect(() => planNodeContent(plan, 'city:9', 3)).toThrow('unknown node: city:9');
  });
});

describe('the Victory Road’s content (Task-303)', () => {
  it('rolls two to four trainers over its own tall grass, the same on a second call', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      const first = planNodeContent(plan, 'victory-road:1', 1);
      expect(first.grass, seed).toBe(true);
      expect(first.poi, seed).toBeNull();
      expect(first.specials, seed).toEqual([]);
      expect(first.shops, seed).toEqual([]);
      expect(first.trainers, seed).toBeGreaterThanOrEqual(2);
      expect(first.trainers, seed).toBeLessThanOrEqual(4);
      expect(planNodeContent(plan, 'victory-road:1', 1), seed).toEqual(first);
    }
  });

  it('posts exactly that many trainers on the screens, off the lane and the bands', () => {
    const plan = planRegion('alpha');
    const content = planNodeContent(plan, 'victory-road:1', 1);
    const planned = planRouteScreens(plan, 'victory-road:1');
    expect(planned.screens).toHaveLength(4);
    expect(planned.route.trainers).toHaveLength(content.trainers);

    const key = (tile: { x: number; y: number }): string => `${tile.x},${tile.y}`;
    const lane = new Set(planned.route.spine.map(key));
    const bands = new Set(planned.route.bands.flatMap((band) => band.tiles.map(key)));
    for (const trainer of planned.route.trainers) {
      expect(lane.has(key(trainer.position)), trainer.id).toBe(false);
      expect(bands.has(key(trainer.position)), trainer.id).toBe(false);
    }
  });
});
