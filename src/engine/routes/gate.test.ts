import { describe, expect, it } from 'vitest';
import { GATES, GATE_KINDS, type GateKind } from '../../data/gates';
import type { Tile } from '../grid';
import { FLOOR, mapFromSketch, tileAt } from '../map';
import { hashSeed, Rng } from '../rng';
import {
  GATE_INSET,
  carveGatedVault,
  gateId,
  gateKindFor,
  gateRewardId,
  type GatedVaultOptions,
} from './gate';
import { tileKey } from './routeMap';
import { sketchRoute, type RouteRequest } from './sketch';
import { reachableTiles } from './validate';

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'] as const;
const MAPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * A 9x9 open room with a wall mass three wide and three tall at its centre. The site
 * rule accepts exactly four sites - the four floor tiles looking straight at the mass,
 * each sealing the mass's own edge cell - and every one of them opens onto the same
 * chamber, the mass's centre.
 */
const ROOM = [
  '#########',
  '#.......#',
  '#.......#',
  '#..###..#',
  '#..###..#',
  '#..###..#',
  '#.......#',
  '#.......#',
  '#########',
];

/** The four corridor mouths (the floor tiles) the room above offers, W, E, N, S. */
const MOUTHS: readonly Tile[] = [
  { x: 2, y: 4 },
  { x: 6, y: 4 },
  { x: 4, y: 2 },
  { x: 4, y: 6 },
];

/** The four seals those mouths lead to: the mass's own edge cells. */
const SEALS: readonly Tile[] = [
  { x: 3, y: 4 },
  { x: 5, y: 4 },
  { x: 4, y: 3 },
  { x: 4, y: 5 },
];

const CHAMBER: Tile = { x: 4, y: 4 };

const ENTRY: Tile = { x: 1, y: 1 };

/** A mutable copy of a sketch, since the carve writes in place. */
function mutable(rows: readonly string[]): number[][] {
  return mapFromSketch(rows).map((row) => [...row]);
}

/** The request a plan room makes for a gated leaf, at a room-sized build. */
function gatedRequest(seed: string, routeIndex: number, gate: 'sealed' | 'open'): RouteRequest {
  return {
    seed,
    routeIndex,
    biomeId: 'forest',
    width: 30,
    height: 30,
    grassPatches: 12,
    ledges: 6,
    loot: [{ itemId: 'potion', weight: 1 }],
    hiddenChance: 0.5,
    trainerArchetypes: ['youngster', 'lass'],
    gate,
  };
}

function options(overrides: Partial<GatedVaultOptions> = {}): GatedVaultOptions {
  return {
    seed: 'pkm-111',
    routeIndex: 3,
    entry: ENTRY,
    reserved: new Set<string>(),
    sealed: true,
    ...overrides,
  };
}

describe('gateKindFor', () => {
  it('draws the kind off its own named stream, one value', () => {
    for (const seed of SEEDS) {
      for (let routeIndex = 0; routeIndex < 8; routeIndex++) {
        const kind = gateKindFor(seed, routeIndex);
        const expected =
          GATE_KINDS[new Rng(hashSeed(`${seed}:gate:${routeIndex}`)).int(0, GATE_KINDS.length - 1)];
        expect(kind, `${seed} #${routeIndex}`).toBe(expected);
        expect(GATE_KINDS).toContain(kind);
      }
    }
  });

  it('uses every kind across a sweep of seeds', () => {
    const seen = new Set<GateKind>();
    for (let i = 0; i < 64; i++) seen.add(gateKindFor(`kind-sweep-${i}`, 3));
    expect([...seen].sort()).toEqual([...GATE_KINDS].sort());
  });
});

describe('the gate ids', () => {
  it('names the floor mark and the reward, per map and room', () => {
    expect(gateId(2, 7)).toBe('gate-2-7');
    expect(gateRewardId(2, 7)).toBe('gate-loot-2-7');
    expect(gateId(11, 3)).toBe('gate-11-3');
    expect(gateRewardId(11, 3)).toBe('gate-loot-11-3');
  });
});

describe('carveGatedVault', () => {
  it('keeps the seal one cell off the fence', () => {
    expect(GATE_INSET).toBe(1);
  });

  it('carves the room’s one vault: a chamber behind a single seal', () => {
    const tiles = mutable(ROOM);
    const gate = carveGatedVault(tiles, options());
    expect(gate).not.toBeNull();
    // Every candidate the rule accepts opens onto the mass's own centre.
    expect(gate!.pocket).toEqual(CHAMBER);
    expect(tileAt(tiles, gate!.pocket)).toBe(FLOOR);
    expect(tileAt(tiles, gate!.tile)).toBe(GATES[gate!.kind].tile);
    expect(SEALS.some((seal) => tileKey(seal) === tileKey(gate!.tile))).toBe(true);
    // Sealed: the chamber is a closed box the entry cannot flood into.
    expect(reachableTiles(tiles, ENTRY).has(tileKey(gate!.pocket))).toBe(false);
  });

  it('leaves the chamber open when the floor’s gate is already open', () => {
    const tiles = mutable(ROOM);
    const gate = carveGatedVault(tiles, options({ sealed: false }));
    expect(gate).not.toBeNull();
    expect(tileAt(tiles, gate!.tile)).toBe(FLOOR);
    expect(tileAt(tiles, gate!.pocket)).toBe(FLOOR);
    expect(reachableTiles(tiles, ENTRY).has(tileKey(gate!.pocket))).toBe(true);
  });

  it('is deterministic: the same build draws the same seal and chamber', () => {
    const first = carveGatedVault(mutable(ROOM), options())!;
    const second = carveGatedVault(mutable(ROOM), options())!;
    expect(second).toEqual(first);
  });

  it('takes its site off its own stream, so a seed change moves only the vault', () => {
    const seals = SEEDS.map(
      (seed, index) => carveGatedVault(mutable(ROOM), options({ seed, routeIndex: index }))!.tile,
    );
    expect(new Set(seals.map(tileKey)).size).toBeGreaterThan(1);
    for (const seal of seals) {
      expect(SEALS.some((candidate) => tileKey(candidate) === tileKey(seal))).toBe(true);
    }
  });

  it('never takes a reserved cell as the corridor’s mouth', () => {
    const reserved = new Set(MOUTHS.map(tileKey));
    expect(carveGatedVault(mutable(ROOM), options({ reserved }))).toBeNull();
    // Only the east mouth is left, so the seal is the mass's east edge cell.
    const allButEast = new Set(MOUTHS.filter((mouth) => mouth.x !== 6).map(tileKey));
    expect(carveGatedVault(mutable(ROOM), options({ reserved: allButEast }))!.tile).toEqual({
      x: 5,
      y: 4,
    });
  });

  it('never takes the entry as the corridor’s mouth', () => {
    // The west mouth is the entry and every other mouth is spoken for: no vault.
    const entry = MOUTHS[0];
    const reserved = new Set(MOUTHS.filter((mouth) => mouth.x !== 2).map(tileKey));
    expect(carveGatedVault(mutable(ROOM), options({ entry, reserved }))).toBeNull();
    // Without the other mouths reserved, the entry is still refused as a mouth: the
    // west mouth would have sealed the mass's west edge cell.
    const gate = carveGatedVault(mutable(ROOM), options({ entry }))!;
    expect(tileKey(gate.tile)).not.toBe(tileKey(SEALS[0]));
    expect(SEALS.slice(1).some((seal) => tileKey(seal) === tileKey(gate.tile))).toBe(true);
    expect(gate.pocket).toEqual(CHAMBER);
  });

  it('answers null and writes nothing when the room has no vault site', () => {
    const tiles = mutable([
      '#########',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '#.......#',
      '#########',
    ]);
    const before = tiles.map((row) => [...row]);
    expect(carveGatedVault(tiles, options())).toBeNull();
    expect(tiles).toEqual(before);
  });

  it('keeps the seal and the chamber inside the fence, never on the ring', () => {
    for (const seed of SEEDS) {
      for (const sealed of [true, false]) {
        const gate = carveGatedVault(mutable(ROOM), options({ seed, sealed }))!;
        for (const cell of [gate.tile, gate.pocket]) {
          expect(cell.x).toBeGreaterThanOrEqual(GATE_INSET);
          expect(cell.y).toBeGreaterThanOrEqual(GATE_INSET);
          expect(cell.x).toBeLessThanOrEqual(8 - GATE_INSET);
          expect(cell.y).toBeLessThanOrEqual(8 - GATE_INSET);
        }
      }
    }
  });
});

describe('a gated build', () => {
  it('carves a vault for every seed and map, sealed and unsealed alike', () => {
    for (const seed of SEEDS) {
      for (const routeIndex of MAPS) {
        const sealed = sketchRoute(gatedRequest(seed, routeIndex, 'sealed'));
        const open = sketchRoute(gatedRequest(seed, routeIndex, 'open'));
        const where = `${seed} #${routeIndex}`;

        expect(sealed.gate, `${where} sealed gate`).toBeDefined();
        expect(open.gate, `${where} open gate`).toBeDefined();
        const gate = sealed.gate!;
        // One kind and one site per `(seed, routeIndex)`, whatever the flag.
        expect(open.gate, `${where} same gate`).toEqual(gate);
        expect(GATE_KINDS, `${where} kind`).toContain(gate.kind);

        expect(tileAt(sealed.tiles, gate.tile), `${where} sealed seal`).toBe(GATES[gate.kind].tile);
        expect(tileAt(open.tiles, gate.tile), `${where} open seal`).toBe(FLOOR);
        expect(tileAt(sealed.tiles, gate.pocket), `${where} pocket`).toBe(FLOOR);

        const sealedReached = reachableTiles(sealed.tiles, sealed.entry);
        const openReached = reachableTiles(open.tiles, open.entry);
        expect(sealedReached.has(tileKey(gate.pocket)), `${where} sealed pocket`).toBe(false);
        expect(openReached.has(tileKey(gate.pocket)), `${where} open pocket`).toBe(true);
        expect(sealedReached.has(tileKey(gate.tile)), `${where} sealed mouth`).toBe(false);
        expect(openReached.has(tileKey(gate.tile)), `${where} open mouth`).toBe(true);

        // The vault is nobody else's tile: not the entry, an exit or a pocket.
        expect(tileKey(sealed.entry), `${where} entry`).not.toBe(tileKey(gate.tile));
        expect(sealed.exits.map(tileKey), `${where} exits`).not.toContain(tileKey(gate.tile));
        expect(sealed.pockets.map(tileKey), `${where} pockets`).not.toContain(tileKey(gate.tile));
        expect(sealed.pockets.map(tileKey), `${where} pocket list`).not.toContain(tileKey(gate.pocket));
        // No trainer or ground item ever stands in the vault.
        expect(sealed.trainers.length, `${where} trainers`).toBeGreaterThan(0);
        expect(sealed.trainers.map((trainer) => tileKey(trainer.position))).not.toContain(
          tileKey(gate.pocket),
        );
        expect(sealed.trainers.map((trainer) => tileKey(trainer.position))).not.toContain(
          tileKey(gate.tile),
        );
        expect(sealed.items.map((item) => tileKey(item.position))).not.toContain(tileKey(gate.pocket));
      }
    }
  }, 60_000);

  it('draws the same vault every time the room is built', () => {
    for (const seed of SEEDS) {
      expect(sketchRoute(gatedRequest(seed, 4, 'sealed')).gate, seed).toEqual(
        sketchRoute(gatedRequest(seed, 4, 'sealed')).gate,
      );
    }
  });
});
