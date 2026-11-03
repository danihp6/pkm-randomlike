import type { Tile } from '../grid';
import { exitGate } from '../run/gates';
import { compatForNode, type RunState } from '../run/state';
import { planCity } from './city';
import { nodeOf, type RegionNode, type RegionPlan } from './plan';
import { generateRoute } from './route';

/**
 * The region's one travel seam (`docs/region-spec.md` §4, §5 and `D67`): whether a run
 * may leave its node on foot through an exit band, or fly from the region map to a
 * settlement it has already visited, and what the next run state and spawn tile are.
 *
 * Pure and total: no RNG, no clock, no DOM and no Phaser. A refusal answers why and
 * touches nothing, so the scene keeps its run, its save and its map (`D11`).
 */

/** How the run arrives at the node it is entering. */
export type TravelMode = 'walk' | 'fly';

/** Why a travel was refused. */
export type TravelRefusalReason =
  'same-node' | 'no-such-node' | 'not-neighbour' | 'gate' | 'unvisited' | 'not-settlement';

export type TravelRefusal = Readonly<{
  ok: false;
  reason: TravelRefusalReason;
  /** The badge the closed gate asks for, or null when the refusal is not a gate. */
  badge: number | null;
}>;

export type TravelArrival = Readonly<{
  ok: true;
  /** The run, standing on `key`, with its compat floor fields refreshed. */
  run: RunState;
  /** The node entered (`nodeKey`). */
  key: string;
  /** Where the player is placed: the settlement's/route's own entry, or a door on a flight. */
  spawn: Tile;
  mode: TravelMode;
}>;

function refusal(reason: TravelRefusalReason, badge: number | null = null): TravelRefusal {
  return { ok: false, reason, badge };
}

/** The two node kinds a flight may reach: the town and the eight cities. */
function isSettlement(node: RegionNode): boolean {
  return node.kind === 'town' || node.kind === 'city';
}

/**
 * A settlement's Centre door — the laboratory, in the town, which has no Centre
 * (`docs/region-spec.md` §5). A settlement plan that holds neither is a spec bug: its
 * spawn is answered instead of throwing, so the caller still stands somewhere legal.
 */
function settlementDoor(plan: RegionPlan, key: string): Tile {
  const city = planCity(plan, key);
  const building = city.buildings.find((entry) => entry.kind === 'centre' || entry.kind === 'lab');
  return building ? { ...building.door } : { ...city.spawn };
}

/**
 * Where a walk in through an exit band lands: the settlement's own spawn, or the
 * carver's entry for a route and a lateral — the same tile `preloadNode` reports as
 * `NodeWorld.spawn`. The Victory Road, the League and the tower have no carver yet,
 * so no scene can draw them either (`preloadNode` answers null) and the scene refuses
 * that walk; the origin stands in for the tile no map will place.
 */
function walkSpawn(plan: RegionPlan, node: RegionNode): Tile {
  if (isSettlement(node)) return { ...planCity(plan, node.key).spawn };
  if (node.kind === 'route' || node.kind === 'lateral') {
    return { ...generateRoute(plan, node.key).entry };
  }
  return { x: 0, y: 0 };
}

/** The spawn of one legal travel, or the refusal that keeps the run where it is. */
function resolveTravel(
  plan: RegionPlan,
  run: RunState,
  toKey: string,
  mode: TravelMode,
): TravelRefusal | Readonly<{ ok: true; spawn: Tile }> {
  // A refusal answers no run at all: the caller's run stays the object it passed, so a
  // same-node travel leaves no new state and no dirty save behind.
  if (toKey === run.nodeKey) return refusal('same-node');
  const target = nodeOf(plan, toKey);
  if (target === undefined) return refusal('no-such-node');

  if (mode === 'fly') {
    if (!isSettlement(target)) return refusal('not-settlement');
    if (!run.visitedNodes.includes(toKey)) return refusal('unvisited');
    // A flight is free (`D67`): a visited settlement behind a closed gate is legal.
    return { ok: true, spawn: settlementDoor(plan, toKey) };
  }

  const from = nodeOf(plan, run.nodeKey);
  if (from === undefined || !from.edges.includes(toKey)) return refusal('not-neighbour');
  // Only a main-chain step forward out of a city is gated; a lateral and a step back
  // answer null, so walking back always works (`docs/region-spec.md` §4).
  const gate = exitGate(plan, run.nodeKey, toKey, run.badges);
  if (gate !== null && !gate.open) return refusal('gate', gate.badge);
  return { ok: true, spawn: walkSpawn(plan, target) };
}

/** Whether `run` may enter `toKey` this way, and where it lands. Never throws. */
export function canTravel(
  plan: RegionPlan,
  run: RunState,
  toKey: string,
  mode: TravelMode,
): TravelRefusal | Readonly<{ ok: true; spawn: Tile }> {
  return resolveTravel(plan, run, toKey, mode);
}

/** `canTravel`, committed: the next run state and the spawn. Pure; a refusal mutates nothing. */
export function travel(
  plan: RegionPlan,
  run: RunState,
  toKey: string,
  mode: TravelMode,
): TravelRefusal | TravelArrival {
  const resolved = resolveTravel(plan, run, toKey, mode);
  if (!resolved.ok) return resolved;
  const visitedNodes = run.visitedNodes.includes(toKey)
    ? run.visitedNodes
    : [...run.visitedNodes, toKey];
  return {
    ok: true,
    run: {
      ...run,
      nodeKey: toKey,
      visitedNodes,
      ...compatForNode(run.seed, toKey),
    },
    key: toKey,
    spawn: resolved.spawn,
    mode,
  };
}
