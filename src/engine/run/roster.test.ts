import { describe, expect, it } from 'vitest';
import { megaFormsForBase } from '../../data/dex/megas';
import { getSpecies, normalizeId } from '../../data/dex/species';
import { badgeCap } from '../../data/region';
import { LEVEL_BANDS } from '../../data/run';
import { nodeOf, planRegion, type RegionNode } from '../region/plan';
import { Rng } from '../rng';
import { bandForNode, trainerLevel } from './levelCurve';
import { speciesPool } from './pool';
import { assignMegaStone, trainerRoster, type RosterEntry } from './roster';

const early = LEVEL_BANDS[0];
const end = LEVEL_BANDS[5];

describe('trainerRoster', () => {
  it('is deterministic for the same Rng seed', () => {
    const a = trainerRoster(LEVEL_BANDS[2], new Rng(1234), 't1');
    const b = trainerRoster(LEVEL_BANDS[2], new Rng(1234), 't1');
    expect(a).toEqual(b);
  });

  it('fills the band party size with distinct, in-band species', () => {
    const roster = trainerRoster(end, new Rng(7), 't1');
    expect(roster).toHaveLength(end.trainerSize);
    expect(new Set(roster.map((entry) => entry.speciesId)).size).toBe(roster.length);
    for (const entry of roster) {
      expect(getSpecies(entry.speciesId)).toBeDefined();
      expect(entry.level).toBeGreaterThanOrEqual(end.minLevel);
      expect(entry.level).toBeLessThanOrEqual(end.maxLevel);
      expect(entry.id).toMatch(/^t1:/);
    }
  });

  it('draws from the band BST pool, the same one every archetype uses', () => {
    const pool = speciesPool(end, 'trainer');
    const roster = trainerRoster(end, new Rng(3), 't1');
    for (const entry of roster) expect(pool).toContain(entry.speciesId);
  });

  it('climbs the BST window with the band', () => {
    const earlyPool = speciesPool(early, 'trainer');
    const endPool = speciesPool(end, 'trainer');
    for (const entry of trainerRoster(early, new Rng(3), 't1'))
      expect(earlyPool).toContain(entry.speciesId);
    for (const entry of trainerRoster(end, new Rng(3), 't1')) expect(endPool).toContain(entry.speciesId);
    expect(getSpecies(endPool[0])!.bst).toBeGreaterThan(getSpecies(earlyPool[0])!.bst);
  });

  it('raises a boss to the upper half of the band window', () => {
    const pool = speciesPool(end, 'trainer', { boss: true });
    const roster = trainerRoster(end, new Rng(11), 'boss', { boss: true });
    for (const entry of roster) expect(pool).toContain(entry.speciesId);
  });

  it('overrides the band party size with count', () => {
    const roster = trainerRoster(end, new Rng(7), 't1', { count: 6 });
    expect(roster).toHaveLength(6);
    expect(roster.map((entry) => entry.id)).toEqual(['t1:0', 't1:1', 't1:2', 't1:3', 't1:4', 't1:5']);
    expect(roster.length).toBeGreaterThan(end.trainerSize);
  });

  it('clamps count to at least one member', () => {
    expect(trainerRoster(end, new Rng(7), 't1', { count: 0 })).toHaveLength(1);
    expect(trainerRoster(end, new Rng(7), 't1', { count: -3 })).toHaveLength(1);
  });

  it('repeats species once the count passes the pool', () => {
    const pool = speciesPool(end, 'trainer');
    const count = pool.length + 3;
    const roster = trainerRoster(end, new Rng(5), 't1', { count });
    expect(roster).toHaveLength(count);
    for (const entry of roster) expect(getSpecies(entry.speciesId)).toBeDefined();
    expect(new Set(roster.map((entry) => entry.speciesId)).size).toBeLessThanOrEqual(pool.length);
  });

  it('draws a fixed boss party from the boss window, stable for a fixed Rng', () => {
    const pool = speciesPool(end, 'trainer', { boss: true });
    const build = (): readonly RosterEntry[] =>
      trainerRoster(end, new Rng(42), 'boss', { boss: true, count: 6 });
    const roster = build();
    expect(roster).toHaveLength(6);
    expect(roster).toEqual(build());
    for (const entry of roster) {
      expect(pool).toContain(entry.speciesId);
      expect(entry.level).toBeGreaterThanOrEqual(end.minLevel);
      expect(entry.level).toBeLessThanOrEqual(end.maxLevel);
    }
  });

  it('appends when the count grows, so the stream keeps its prefix', () => {
    const short = trainerRoster(end, new Rng(21), 't1', { count: 3 });
    const long = trainerRoster(end, new Rng(21), 't1', { count: 6 });
    expect(long.slice(0, 3)).toEqual(short);
  });

  it('still hands out at most one Mega Stone with a count', () => {
    const roster = trainerRoster(end, new Rng(9), 'boss', {
      allowMega: true,
      boss: true,
      count: 6,
    });
    const held = roster.filter((entry) => entry.heldItem !== undefined);
    expect(held.length).toBeLessThanOrEqual(1);
  });
});

describe('trainerRoster Mega Stones', () => {
  it('gives no stone unless asked', () => {
    const roster = trainerRoster(end, new Rng(9), 't1');
    expect(roster.every((entry) => entry.heldItem === undefined)).toBe(true);
  });

  it('gives at most one stone, only to a Mega-capable member, deterministically', () => {
    const pick = (): readonly string[] =>
      trainerRoster(end, new Rng(9), 't1', { allowMega: true })
        .map((entry) => entry.heldItem)
        .filter((id): id is string => id !== undefined);
    const held = pick();
    expect(held).toEqual(pick());
    expect(held.length).toBeLessThanOrEqual(1);
  });
});

describe('trainerRoster variant roll (fixed seed)', () => {
  const band = LEVEL_BANDS[2];
  const FAMILIES: Readonly<Record<string, readonly string[]>> = {
    eiscue: ['eiscue', 'eiscuenoice'],
    morpeko: ['morpeko', 'morpekohangry'],
    minior: ['minior', 'miniormeteor'],
  };

  it('draws the band exactly as before, its individuals being variant formes', () => {
    const roster = trainerRoster(band, new Rng(6), 't1', { count: 10 });
    expect(roster).toEqual(trainerRoster(band, new Rng(6), 't1', { count: 10 }));

    const pool = speciesPool(band, 'trainer');
    const control = new Rng(6);
    const remaining = [...pool];
    let flipped = 0;
    for (const entry of roster) {
      const picked = remaining.splice(control.int(0, remaining.length - 1), 1)[0];
      expect(entry.level, entry.id).toBe(control.int(band.minLevel, band.maxLevel));
      const family = FAMILIES[picked];
      if (family === undefined) {
        expect(entry.speciesId, entry.id).toBe(picked);
      } else {
        expect(family, entry.id).toContain(entry.speciesId);
        if (entry.speciesId !== picked) flipped += 1;
      }
    }
    expect(flipped).toBeGreaterThan(0);
    expect(roster.map((entry) => entry.speciesId)).toContain('morpekohangry');
  });

  it('leaves every entry a member of the band pool or the forme of one', () => {
    const pool = speciesPool(band, 'trainer');
    const roster = trainerRoster(band, new Rng(6), 't1', { count: 10 });
    for (const entry of roster) {
      const base = getSpecies(entry.speciesId)!.battleOnly;
      const inPool = typeof base === 'string' ? normalizeId(base) : entry.speciesId;
      expect(pool, entry.id).toContain(inPool);
    }
  });

  it('still hands out at most one Mega Stone with the roll in place', () => {
    const roster = trainerRoster(band, new Rng(6), 'boss', { count: 10, allowMega: true });
    const held = roster.filter((entry) => entry.heldItem !== undefined);
    expect(held.length).toBeLessThanOrEqual(1);
    expect(roster).toEqual(trainerRoster(band, new Rng(6), 'boss', { count: 10, allowMega: true }));
  });
});

describe('trainerRoster levelFor', () => {
  it('carries the callback level on every member, once per member', () => {
    const sizes: number[] = [];
    const roster = trainerRoster(end, new Rng(7), 't1', {
      levelFor: (size) => {
        sizes.push(size);
        return 12;
      },
    });
    expect(roster).toHaveLength(4);
    expect(roster.map((entry) => entry.level)).toEqual([12, 12, 12, 12]);
    expect(roster.map((entry) => entry.id)).toEqual(['t1:0', 't1:1', 't1:2', 't1:3']);
    expect(sizes).toEqual([4, 4, 4, 4]);
  });

  it('passes the overridden count as the size', () => {
    const sizes: number[] = [];
    const roster = trainerRoster(end, new Rng(7), 't1', {
      count: 2,
      levelFor: (size) => {
        sizes.push(size);
        return 30;
      },
    });
    expect(roster).toHaveLength(2);
    expect(sizes).toEqual([2, 2]);
  });

  it('builds the identical roster twice from the same seed', () => {
    const build = (): readonly RosterEntry[] =>
      trainerRoster(LEVEL_BANDS[5], new Rng(7), 't1', { levelFor: () => 12 });
    expect(build()).toEqual(build());
  });

  it('pins the fixed-seed roster it builds (LEVEL_BANDS[5], Rng(7), levelFor 12)', () => {
    // Read off this build: without the level draw the species stream runs ahead,
    // so the picks differ from the no-`levelFor` roster from the second member on.
    const roster = trainerRoster(LEVEL_BANDS[5], new Rng(7), 't1', { levelFor: () => 12 });
    expect(roster.map(({ id, speciesId, level }) => ({ id, speciesId, level }))).toEqual([
      { id: 't1:0', speciesId: 'arcanine', level: 12 },
      { id: 't1:1', speciesId: 'moltres', level: 12 },
      { id: 't1:2', speciesId: 'archaludon', level: 12 },
      { id: 't1:3', speciesId: 'celesteela', level: 12 },
    ]);
  });
});

describe('assignMegaStone', () => {
  it('gives a lone Mega species its stone', () => {
    const roster: RosterEntry[] = [{ id: 't:0', speciesId: 'garchomp', level: 40 }];
    assignMegaStone(roster, new Rng(4));
    expect(roster[0].heldItem).toBe('garchompite');
  });

  it('picks a form for a two-Mega species, deterministically', () => {
    const roster: RosterEntry[] = [{ id: 't:0', speciesId: 'charizard', level: 40 }];
    assignMegaStone(roster, new Rng(4));
    expect(['charizarditex', 'charizarditey']).toContain(roster[0].heldItem);
  });

  it('leaves a roster with no Mega-capable species alone', () => {
    const roster: RosterEntry[] = [{ id: 't:0', speciesId: 'sentret', level: 3 }];
    assignMegaStone(roster, new Rng(1));
    expect(roster[0].heldItem).toBeUndefined();
  });

  it('assigns a stone a species with a Mega can actually use', () => {
    const roster: RosterEntry[] = [{ id: 't:0', speciesId: 'garchomp', level: 40 }];
    assignMegaStone(roster, new Rng(4));
    expect(megaFormsForBase('garchomp').map((form) => form.stoneId)).toContain(roster[0].heldItem);
  });
});

describe('trainerRoster node', () => {
  const plan = planRegion('alpha');
  const route = nodeOf(plan, 'route:2') as RegionNode;
  const gym = nodeOf(plan, 'city:2') as RegionNode;
  const league = nodeOf(plan, 'victory-road:1') as RegionNode;
  const NODES: readonly RegionNode[] = [route, gym, league];
  const band = LEVEL_BANDS[2];

  const levelForNode = (node: RegionNode, size: number): number =>
    trainerLevel(node.cap, node.gymDistance, Math.min(3, Math.max(1, size)) as 1 | 2 | 3);

  it('posts every member on the node, at the size-clamped trainer level', () => {
    for (const node of NODES) {
      for (const count of [undefined, 1, 2, 3, 6]) {
        const roster = trainerRoster(
          band,
          new Rng(7),
          'x',
          count === undefined ? { node } : { node, count },
        );
        const expected = levelForNode(node, roster.length);
        for (const entry of roster) expect(entry.level, `${node.key} ${entry.id}`).toBe(expected);
      }
    }
  });

  it('sits on the cap on a gym node and lower one step back', () => {
    const onGym = trainerRoster(band, new Rng(7), 'x', { node: gym, count: 3 });
    const onRoute = trainerRoster(band, new Rng(7), 'x', { node: route, count: 3 });
    for (const entry of onGym) expect(entry.level).toBe(gym.cap);
    for (const entry of onRoute) expect(entry.level).toBeLessThan(route.cap);
  });

  it('yields the same species as the equivalent levelFor: no level draw is taken', () => {
    for (const node of NODES) {
      const byNode = trainerRoster(band, new Rng(31), 'x', { node, count: 3 });
      const byLevel = trainerRoster(band, new Rng(31), 'x', {
        count: 3,
        levelFor: (size) => levelForNode(node, size),
      });
      expect(byNode, node.key).toEqual(byLevel);
    }
  });

  it('lets levelFor win over the node', () => {
    const roster = trainerRoster(band, new Rng(7), 'x', { node: league, levelFor: () => 5 });
    for (const entry of roster) expect(entry.level).toBe(5);
  });

  it('builds the identical roster twice from the same seed', () => {
    const build = (): readonly RosterEntry[] =>
      trainerRoster(LEVEL_BANDS[5], new Rng(7), 't1', { node: league, count: 4 });
    expect(build()).toEqual(build());
    for (const entry of build()) expect(entry.level).toBe(levelForNode(league, 4));
  });
});

/**
 * The roster each of the region's eight stretches posts on its main route, off
 * `bandForNode` (the previous stretch's cap up to this one's) and the node's own
 * `cap`/`gymDistance`. One fixed Rng per stretch, so the list is reproducible; a
 * re-pin recomputes it from the tree and asserts it, never loosens it.
 *
 * **Pinned by Task-297.** The stretch's band and cap are the region's, not a map's:
 * `band.trainerSize` is the party the route posts, and `trainerLevel(cap, 1, size)`
 * is the level every member carries — one level under the cap on the on-ramp bands,
 * further under it where the party is bigger.
 */
describe('trainerRoster region stretches (fixed seed)', () => {
  const plan = planRegion('curve-a');
  const routeOf = (badge: number): RegionNode => nodeOf(plan, `route:${badge}`) as RegionNode;

  const PINNED: readonly { badge: number; band: string; party: number; roster: string }[] = [
    { badge: 1, band: 'early', party: 1, roster: 'flabebe@8' },
    { badge: 2, band: 'low', party: 1, roster: 'deerlingautumn@15' },
    { badge: 3, band: 'mid', party: 2, roster: 'mawile@22 sableye@22' },
    { badge: 4, band: 'high', party: 2, roster: 'mimikyu@29 vileplume@29' },
    { badge: 5, band: 'late', party: 3, roster: 'arctozolt@36 minioryellow@36 scyther@36' },
    {
      badge: 6,
      band: 'end',
      party: 4,
      roster: 'kyuremwhite@42 glastrier@42 kommoototem@42 greninjabond@42',
    },
    { badge: 7, band: 'end', party: 4, roster: 'palkia@48 azelf@48 arceusfairy@48 tapukoko@48' },
    {
      badge: 8,
      band: 'end',
      party: 4,
      roster: 'genesectdouse@54 floetteeternal@54 metagross@54 pheromosa@54',
    },
  ];

  /** `species@level` per member, the one string a re-pin moves. */
  const digest = (roster: readonly RosterEntry[]): string =>
    roster.map((entry) => `${entry.speciesId}@${entry.level}`).join(' ');

  it('pins the party and the roster each stretch posts on its main route', () => {
    for (const row of PINNED) {
      const route = routeOf(row.badge);
      const band = bandForNode(route);
      expect(band.id, `route:${row.badge} band`).toBe(row.band);
      expect(band.trainerSize, `route:${row.badge} party`).toBe(row.party);
      const roster = trainerRoster(band, new Rng(290 + row.badge), 'route', { node: route });
      expect(roster, `route:${row.badge}`).toHaveLength(row.party);
      expect(digest(roster), `route:${row.badge}`).toBe(row.roster);
      expect(roster.map((entry) => entry.id)).toEqual(
        Array.from({ length: row.party }, (_, index) => `route:${index}`),
      );
    }
  });

  it('posts every member at the node’s own trainer level, off its cap and distance', () => {
    for (const row of PINNED) {
      const route = routeOf(row.badge);
      const roster = trainerRoster(bandForNode(route), new Rng(290 + row.badge), 'route', {
        node: route,
      });
      const level = trainerLevel(route.cap, route.gymDistance, roster.length as 1 | 2 | 3);
      for (const entry of roster) expect(entry.level, `route:${row.badge} ${entry.id}`).toBe(level);
      expect(level, `route:${row.badge} one under its cap`).toBeLessThan(route.cap);
      expect(route.gymDistance, `route:${row.badge} distance`).toBe(1);
      expect(route.cap, `route:${row.badge} cap`).toBe(badgeCap(row.badge));
    }
  });

  it('replays every stretch roster on a second build', () => {
    for (const row of PINNED) {
      const route = routeOf(row.badge);
      const build = (): readonly RosterEntry[] =>
        trainerRoster(bandForNode(route), new Rng(290 + row.badge), 'route', { node: route });
      expect(build(), `route:${row.badge}`).toEqual(build());
    }
  });
});
