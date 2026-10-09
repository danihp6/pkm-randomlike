import { levelCapForMap } from '../../data/maps';
import { planMap } from '../maps/plan';
import type { BagCounts } from './battleLink';
import { healParty } from './heal';
import type { RunPokemon } from './progression';

export type RunMode = 'finite' | 'infinite';

export const MAX_PARTY_SIZE = 6;

/** The starter route index; a run begins on route 1 (docs/routes-spec.md §4). */
export const FIRST_ROUTE = 1;

/** The starter map; a run's first floor is map 1 (docs/maps-spec.md §1). */
export const FIRST_MAP = 1;

/** What the run summary counts: caught along the way, and lost for good (D5). */
export type RunStats = Readonly<{
  catches: number;
  casualties: number;
}>;

export function emptyRunStats(): RunStats {
  return { catches: 0, casualties: 0 };
}

/**
 * The run: everything that survives a route. The party/box hold run members
 * (battle snapshot + XP), the bag is the item stacks the scene passes to battle,
 * `defeatedTrainers` / `captureUsed` are the per-route bookkeeping and `stats`
 * is the running score the end-of-run screen reports. Every helper here is pure
 * and returns a new state (D11: no hidden randomness).
 *
 * A route is a room of a **map** (a Binding of Isaac-style floor), so the global
 * `routeIndex` counter travels beside the run's actual position — `mapIndex` and
 * `routeInMap` — and `discoveredRooms` is the floor's fog of discovery (D32).
 */
export type RunState = Readonly<{
  seed: string;
  mode: RunMode;
  /** Global counter of rooms entered; the key for route-scoped RNG streams. */
  routeIndex: number;
  /** The floor the run is on, 1-based (`docs/maps-spec.md` §1). */
  mapIndex: number;
  /** The room of `mapIndex` the run occupies. */
  routeInMap: number;
  /** Room ids of `mapIndex` entered so far (fog of discovery, D32). Resets per map. */
  discoveredRooms: readonly number[];
  /** True once `mapIndex`'s boss has fallen, so its portal stays open (D31). Resets per map. */
  bossDefeated: boolean;
  /** Cached level cap for `mapIndex` (D9/D29); kept in sync on a map advance. */
  levelCap: number;
  party: readonly RunPokemon[];
  box: readonly RunPokemon[];
  bag: readonly BagCounts[];
  defeatedTrainers: readonly string[];
  /** Ground-item ids already taken on this route. Resets on advance. */
  pickedItems: readonly string[];
  /** True once this route's single capture has been spent. Resets on advance. */
  captureUsed: boolean;
  stats: RunStats;
}>;

export type RunInit = Readonly<{
  seed: string;
  starter: RunPokemon;
  mode?: RunMode;
  bag?: readonly BagCounts[];
}>;

export function createRun(init: RunInit): RunState {
  const entryRoom = planMap(init.seed, FIRST_MAP).entryRoom;
  return {
    seed: init.seed,
    mode: init.mode ?? 'finite',
    routeIndex: FIRST_ROUTE,
    mapIndex: FIRST_MAP,
    routeInMap: entryRoom,
    discoveredRooms: [entryRoom],
    bossDefeated: false,
    levelCap: levelCapForMap(FIRST_MAP),
    party: [init.starter],
    box: [],
    bag: [...(init.bag ?? [])],
    defeatedTrainers: [],
    pickedItems: [],
    captureUsed: false,
    stats: emptyRunStats(),
  };
}

/**
 * Enters another room of the **same map** (`docs/maps-spec.md` §2): the global
 * counter steps, the room is marked **discovered** (D32) and the per-room marks
 * (the capture, the beaten trainers, the picked items) reset. The map and its cap
 * stay put — the heal stop is a map event, not a room one.
 */
export function advanceRoute(run: RunState, roomInMap: number): RunState {
  const room = Math.max(0, Math.floor(roomInMap));
  return {
    ...run,
    routeIndex: run.routeIndex + 1,
    routeInMap: room,
    discoveredRooms: discoverRoom(run.discoveredRooms, room),
    captureUsed: false,
    defeatedTrainers: [],
    pickedItems: [],
  };
}

/**
 * Steps through the map's portal onto the next floor (`docs/maps-spec.md` §6,
 * D31): the next map's entry room, a fresh discovery set and its own cap. This is
 * also the **heal stop** — HP/PP restored across the party and the box, never a
 * resurrection (D5) — and the old floor's per-room marks go with it.
 */
export function advanceMap(run: RunState): RunState {
  const mapIndex = run.mapIndex + 1;
  const entryRoom = planMap(run.seed, mapIndex).entryRoom;
  const advanced: RunState = {
    ...run,
    routeIndex: run.routeIndex + 1,
    mapIndex,
    routeInMap: entryRoom,
    discoveredRooms: [entryRoom],
    bossDefeated: false,
    levelCap: levelCapForMap(mapIndex),
    captureUsed: false,
    defeatedTrainers: [],
    pickedItems: [],
  };
  return healParty(advanced);
}

/** True once a room of the current map has been entered (fog of discovery, D32). */
export function isRoomDiscovered(run: RunState, roomId: number): boolean {
  return run.discoveredRooms.includes(roomId);
}

/** Marks the current map's boss beaten, so its portal opens (D31); idempotent. */
export function markBossDefeated(run: RunState): RunState {
  return run.bossDefeated ? run : { ...run, bossDefeated: true };
}

function discoverRoom(rooms: readonly number[], roomId: number): readonly number[] {
  return rooms.includes(roomId) ? rooms : [...rooms, roomId];
}

/** Adds a Pokémon to the party, or to the box once the party is full (D7). */
export function addPokemon(run: RunState, pokemon: RunPokemon): RunState {
  if (run.party.length < MAX_PARTY_SIZE) {
    return { ...run, party: [...run.party, pokemon] };
  }
  return { ...run, box: [...run.box, pokemon] };
}

/** Replaces a party or box member by id; a miss leaves the run untouched. */
export function updatePokemon(run: RunState, pokemon: RunPokemon): RunState {
  const id = pokemon.fighter.id;
  if (run.party.some((member) => member.fighter.id === id)) {
    return { ...run, party: run.party.map((member) => (member.fighter.id === id ? pokemon : member)) };
  }
  if (run.box.some((member) => member.fighter.id === id)) {
    return { ...run, box: run.box.map((member) => (member.fighter.id === id ? pokemon : member)) };
  }
  return run;
}

export function setParty(run: RunState, party: readonly RunPokemon[]): RunState {
  return { ...run, party: [...party] };
}

export function hasLivingParty(run: RunState): boolean {
  return run.party.some((member) => member.fighter.hp > 0);
}

/** Removes `from` and inserts it at `to`; an out-of-range move is a no-op. */
function moveWithin<T>(list: readonly T[], from: number, to: number): readonly T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Reorders the party in place (the lead matters: index 0 opens the next battle). */
export function moveInParty(run: RunState, from: number, to: number): RunState {
  const party = moveWithin(run.party, from, to);
  return party === run.party ? run : { ...run, party };
}

/** Reorders the box. */
export function moveInBox(run: RunState, from: number, to: number): RunState {
  const box = moveWithin(run.box, from, to);
  return box === run.box ? run : { ...run, box };
}

/**
 * Sends a party member to the box. The party is never left empty (D7): with a
 * single member the deposit is refused and the run comes back untouched.
 */
export function depositToBox(run: RunState, partyIndex: number): RunState {
  const member = run.party[partyIndex];
  if (!member || run.party.length <= 1) return run;
  return {
    ...run,
    party: run.party.filter((_, index) => index !== partyIndex),
    box: [...run.box, member],
  };
}

/** Brings a boxed member into the party; a full party refuses (D7). */
export function withdrawToParty(run: RunState, boxIndex: number): RunState {
  const member = run.box[boxIndex];
  if (!member || run.party.length >= MAX_PARTY_SIZE) return run;
  return {
    ...run,
    box: run.box.filter((_, index) => index !== boxIndex),
    party: [...run.party, member],
  };
}

/**
 * Trades a party member for a boxed one, each keeping the other's slot, so a
 * full party can still take a boxed member (the one it replaces goes to the
 * box). Unlike `withdrawToParty` this never changes the party size; it is
 * refused only when one of the two indices is empty. D7's "party is never
 * emptied" still holds, since the party stays the same size.
 */
export function swapPartyBox(run: RunState, partyIndex: number, boxIndex: number): RunState {
  const partyMember = run.party[partyIndex];
  const boxMember = run.box[boxIndex];
  if (!partyMember || !boxMember) return run;
  const party = [...run.party];
  const box = [...run.box];
  party[partyIndex] = boxMember;
  box[boxIndex] = partyMember;
  return { ...run, party, box };
}

export function canCapture(run: RunState): boolean {
  return !run.captureUsed;
}

/** Spends the route's single capture; a second call is a no-op. */
export function useCapture(run: RunState): RunState {
  return run.captureUsed ? run : { ...run, captureUsed: true };
}

/** Counts a caught Pokémon for the run summary, beside the capture it spends. */
export function recordCatch(run: RunState): RunState {
  return { ...run, stats: { ...run.stats, catches: run.stats.catches + 1 } };
}

export function isTrainerDefeated(run: RunState, trainerId: string): boolean {
  return run.defeatedTrainers.includes(trainerId);
}

export function markTrainerDefeated(run: RunState, trainerId: string): RunState {
  return isTrainerDefeated(run, trainerId)
    ? run
    : { ...run, defeatedTrainers: [...run.defeatedTrainers, trainerId] };
}

export function isItemPicked(run: RunState, itemId: string): boolean {
  return run.pickedItems.includes(itemId);
}

/** Marks a route ground item as taken, so it cannot be picked twice. */
export function markItemPicked(run: RunState, itemId: string): RunState {
  return isItemPicked(run, itemId)
    ? run
    : { ...run, pickedItems: [...run.pickedItems, itemId] };
}

export function itemCount(run: RunState, itemId: string): number {
  return run.bag.find((slot) => slot.itemId === itemId)?.count ?? 0;
}

export function addItem(run: RunState, itemId: string, count = 1): RunState {
  if (count <= 0) return run;
  const existing = run.bag.find((slot) => slot.itemId === itemId);
  const bag = existing
    ? run.bag.map((slot) => (slot.itemId === itemId ? { itemId, count: slot.count + count } : slot))
    : [...run.bag, { itemId, count }];
  return { ...run, bag };
}

/** Removes up to `count`; empty stacks drop out of the bag. A miss is a no-op. */
export function consumeItem(run: RunState, itemId: string, count = 1): RunState {
  const existing = run.bag.find((slot) => slot.itemId === itemId);
  if (count <= 0 || !existing) return run;
  const remaining = existing.count - count;
  const bag =
    remaining > 0
      ? run.bag.map((slot) => (slot.itemId === itemId ? { itemId, count: remaining } : slot))
      : run.bag.filter((slot) => slot.itemId !== itemId);
  return { ...run, bag };
}

/** The party or box member with `id`, or undefined. */
function memberById(run: RunState, id: string): RunPokemon | undefined {
  return run.party.find((member) => member.fighter.id === id) ?? run.box.find((member) => member.fighter.id === id);
}

/**
 * Equips a bag stack to a party/box member: a unit leaves the bag, and whatever
 * the member already held returns to it, so an equip is a swap, never a loss.
 * A member already holding `itemId`, an unknown member or an empty stack is a
 * no-op. Pure, like the rest of the run state (D11).
 */
export function equipHeldItem(run: RunState, memberId: string, itemId: string): RunState {
  const member = memberById(run, memberId);
  if (!member || member.fighter.heldItem === itemId || itemCount(run, itemId) <= 0) return run;
  const previous = member.fighter.heldItem;
  let next = consumeItem(run, itemId);
  if (previous) next = addItem(next, previous);
  return updatePokemon(next, { ...member, fighter: { ...member.fighter, heldItem: itemId } });
}

/** Takes a member's held item back to the bag; a member holding nothing is a no-op. */
export function unequipHeldItem(run: RunState, memberId: string): RunState {
  const member = memberById(run, memberId);
  if (!member?.fighter.heldItem) return run;
  const held = member.fighter.heldItem;
  return updatePokemon(addItem(run, held), { ...member, fighter: { ...member.fighter, heldItem: null } });
}

/**
 * Reorders a member's moves in place; slot order is the order the battle menu
 * lists them in. An unknown member or an out-of-range move is a no-op, so a
 * drop on empty space changes nothing. Pure, like the rest of the run state
 * (D11).
 */
export function moveMoves(run: RunState, memberId: string, from: number, to: number): RunState {
  const member = memberById(run, memberId);
  if (!member) return run;
  const moves = moveWithin(member.fighter.moves, from, to);
  return moves === member.fighter.moves ? run : updatePokemon(run, { ...member, fighter: { ...member.fighter, moves } });
}
