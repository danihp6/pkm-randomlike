import { describe, expect, it } from 'vitest';
import { getBiome } from '../../data/biomes';
import { GATES, GATE_KINDS, type GateKind } from '../../data/gates';
import { getItem } from '../../data/items';
import { ROUTE_LOOT } from '../../data/loot';
import { SECRET_SHOP } from '../../data/shop';
import { TILESETS } from '../../data/tilesets';
import { TRAINER_ARCHETYPE_IDS } from '../../data/trainers';
import { isTmItemId } from '../../data/tms';
import { planMap, roomView, specialRoom } from '../maps';
import { createRun, createRunPokemon, partyHasType, type RunState } from '../run';
import { bandForMap, routeIndexForRoom } from '../run/floors';
import { sketchRoute, type RouteRequest, type RouteMap } from './index';
import { secretShopGateOpen, secretShopSealId, secretShopStock } from './secretShop';

/**
 * The literals QA's `[live]` protocol reads (`docs/agent-ci.md`): a seed whose
 * floor 3 hangs the secret-shop leaf, the leaf's room, the obstacle its vault is
 * sealed with, the walkable tile the seal faces (`mouth`), the vault's own tile
 * (`pocket`) and the cardinal from `mouth` to the seal. The last test re-derives
 * every field from the plan and the room's own build, so they cannot rot.
 *
 * The room's counter is a **fixture** on `pocket` (the trade and static leaves do the
 * same), so it blocks that tile: the protocol's two steps land on the **seal**
 * (one tile in from `mouth`, along `direction`) and the interact key then opens the
 * card across it. The `pocket` literal is the counter the card belongs to, not a
 * tile the player stands on.
 *
 * **Re-pinned by Task-117**: the slot machine's room retired, so this seed's floor 3
 * hangs the leaf one room earlier and its vault carves on a different site (a pond
 * instead of a rock).
 */
export const SECRET_SHOP_QA = {
  seed: 'secret-shop-qa-3',
  mapIndex: 3,
  roomId: 9,
  obstacle: 'water',
  mouth: { x: 15, y: 21 },
  pocket: { x: 13, y: 21 },
  direction: 'W',
} as const;

/** A run whose party is exactly the species the case needs, standing on map 3. */
function runWith(speciesIds: readonly string[]): RunState {
  const members = speciesIds.map((speciesId, index) =>
    createRunPokemon({ id: `member-${index}`, speciesId, level: 5, moves: ['tackle'] }),
  );
  const base = createRun({ seed: 'secret-shop', starter: members[0] });
  return { ...base, mapIndex: 3, party: members };
}

/** One member of each listed type, and one species that holds none of them. */
const PARTIES: Readonly<Record<GateKind, { open: readonly string[]; closed: string }>> = {
  bush: { open: ['caterpie', 'chikorita'], closed: 'squirtle' },
  rock: { open: ['geodude', 'machop'], closed: 'squirtle' },
  water: { open: ['magikarp', 'squirtle'], closed: 'caterpie' },
};

/**
 * The request `RouteScene.buildRoute` makes for a plan room: the room's own size,
 * opening set, biome layout and wall motif, its band's loot and the whole trainer
 * archetype list, role and `quiet`, plus the vault flag. Rebuilt here so the pinned
 * `mouth` and `pocket` are the ones the live scene carves.
 */
function roomRequest(seed: string, mapIndex: number, roomId: number): RouteRequest {
  const plan = planMap(seed, mapIndex);
  const view = roomView(plan, roomId, false);
  const biome = getBiome(view.biomeId);
  const pattern = TILESETS[biome.tilesetId].config.wallPattern;
  const wall = pattern
    ? { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) }
    : undefined;
  const loot = ROUTE_LOOT[bandForMap(view.mapIndex).id];
  return {
    seed,
    routeIndex: routeIndexForRoom(plan, view.roomId),
    biomeId: view.biomeId,
    layout: biome.layout,
    openings: view.openings,
    width: view.width,
    height: view.height,
    loot: loot.pool,
    hiddenChance: loot.hiddenChance,
    itemChance: loot.itemChance,
    role: view.role,
    trainerArchetypes: TRAINER_ARCHETYPE_IDS,
    quiet: true,
    gate: 'sealed',
    ...(wall ? { wall } : {}),
  };
}

/** The cardinal from `from` to `to` (they are one step apart). */
function directionFrom(from: { x: number; y: number }, to: { x: number; y: number }): string {
  if (to.x > from.x) return 'E';
  if (to.x < from.x) return 'W';
  return to.y > from.y ? 'S' : 'N';
}

describe('the secret shop ids', () => {
  it('names the seal per map and room', () => {
    expect(secretShopSealId(3, 10)).toBe('secret-shop-3-10');
    expect(secretShopSealId(1, 0)).toBe('secret-shop-1-0');
    expect(secretShopSealId(12, 7)).toBe('secret-shop-12-7');
  });
});

describe('the secret shop stock', () => {
  it('maps the table in order: the four held rows, then the two machines', () => {
    const stock = secretShopStock();
    expect(stock.map((slot) => slot.itemId)).toEqual([...SECRET_SHOP.held, ...SECRET_SHOP.tm]);
    expect(stock).toHaveLength(6);
  });

  it('prices every row at the catalogue price, one unit each', () => {
    for (const slot of secretShopStock()) {
      const item = getItem(slot.itemId);
      expect(item, slot.itemId).toBeDefined();
      expect(slot.price, slot.itemId).toBe(item!.price);
      expect(slot.count, slot.itemId).toBe(1);
    }
    expect(secretShopStock().map((slot) => slot.price)).toEqual([4000, 4000, 4000, 4000, 3000, 3000]);
  });

  it('sells held items and machines, never a cure, a valuable or a stone', () => {
    const stock = secretShopStock();
    for (const itemId of SECRET_SHOP.held) {
      const item = getItem(itemId)!;
      // `consumed` alone is not the test: Focus Sash is spent once it fires, exactly as
      // the Mart's own late shelf sells it.
      expect(item.kind, itemId).toBe('held');
    }
    for (const itemId of SECRET_SHOP.tm) {
      expect(isTmItemId(itemId), itemId).toBe(true);
      expect(getItem(itemId)!.kind, itemId).toBe('tm');
    }
    expect(new Set(stock.map((slot) => slot.itemId)).size).toBe(stock.length);
  });

  it('draws no stream: two calls open the same counter', () => {
    expect(secretShopStock()).toEqual(secretShopStock());
  });
});

describe('the secret shop seal', () => {
  it('opens for a party member of any of the row’s types, for all three kinds', () => {
    for (const kind of GATE_KINDS) {
      for (const speciesId of PARTIES[kind].open) {
        const run = runWith([speciesId]);
        expect(secretShopGateOpen(run, kind), `${kind} ${speciesId}`).toBe(true);
        // The rule is the gated leaf's own predicate, never a second copy of it.
        expect(secretShopGateOpen(run, kind), `${kind} ${speciesId}`).toBe(
          partyHasType(run, GATES[kind].types),
        );
      }
    }
  });

  it('refuses a party that holds none of the row’s types, for all three kinds', () => {
    for (const kind of GATE_KINDS) {
      const run = runWith([PARTIES[kind].closed]);
      expect(secretShopGateOpen(run, kind), `${kind} ${PARTIES[kind].closed}`).toBe(false);
    }
  });

  it('counts a member at any HP: the box is never asked', () => {
    const run = runWith(['geodude']);
    const spent: RunState = {
      ...run,
      party: run.party.map((member) => ({
        ...member,
        fighter: { ...member.fighter, hp: 0, status: null },
      })),
    };
    expect(secretShopGateOpen(spent, 'rock')).toBe(true);
  });
});

describe('the pinned QA room', () => {
  it('re-derives the seed’s leaf, its obstacle, its mouth and its pocket', () => {
    const plan = planMap(SECRET_SHOP_QA.seed, SECRET_SHOP_QA.mapIndex);
    const roomId = specialRoom(plan, 'secret-shop');
    expect(roomId, `${SECRET_SHOP_QA.seed} floor ${SECRET_SHOP_QA.mapIndex}`).toBe(
      SECRET_SHOP_QA.roomId,
    );

    const route: RouteMap = sketchRoute(
      roomRequest(SECRET_SHOP_QA.seed, SECRET_SHOP_QA.mapIndex, SECRET_SHOP_QA.roomId),
    );
    const gate = route.gate;
    expect(gate, 'the room carves its vault').toBeDefined();
    expect(gate!.kind).toBe(SECRET_SHOP_QA.obstacle);
    expect(gate!.pocket).toEqual(SECRET_SHOP_QA.pocket);

    // The mouth is the walkable tile the seal faces; the direction is the cardinal
    // from it to the seal, so the protocol's one-step test lands on the seal itself.
    const seal = gate!.tile;
    const step = { x: seal.x - SECRET_SHOP_QA.mouth.x, y: seal.y - SECRET_SHOP_QA.mouth.y };
    const mouth = { x: seal.x - step.x, y: seal.y - step.y };
    expect(mouth).toEqual(SECRET_SHOP_QA.mouth);
    expect(directionFrom(SECRET_SHOP_QA.mouth, seal)).toBe(SECRET_SHOP_QA.direction);
    expect({ x: seal.x + step.x, y: seal.y + step.y }).toEqual(SECRET_SHOP_QA.pocket);
  });

  it('keeps the pinned room a dead-end leaf, below the boss', () => {
    const plan = planMap(SECRET_SHOP_QA.seed, SECRET_SHOP_QA.mapIndex);
    const room = plan.rooms[SECRET_SHOP_QA.roomId];
    expect(room.special).toBe('secret-shop');
    expect(room.shape).toBe('dead-end');
    expect(room.id).not.toBe(plan.entryRoom);
    expect(room.id).not.toBe(plan.bossRoom);
    expect(plan.links.filter(([a, b]) => a === room.id || b === room.id)).toHaveLength(1);
  });
});
