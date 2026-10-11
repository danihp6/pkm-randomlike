import { levelCapForMap } from '../../data/maps';
import { arrivalEdgeFor, isArrivalEdge, planMap, type MapEdge } from '../maps/plan';
import type { BagCounts } from './battleLink';
import { POKEVIAL_MAX_CHARGES, fillPokevial, healParty } from './heal';
import { clampToCap } from './levelCap';
import {
  levelForXp,
  levelUpPokemon,
  xpForLevel,
  type ProgressionEvent,
  type RunPokemon,
} from './progression';

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
 * `money` is the Poké Dollars beat out of trainers, `defeatedTrainers` /
 * `pickedItems` / `capturedRooms` are the **per-floor** bookkeeping and `stats`
 * is the running score the end-of-run screen reports.
 * Every helper here is pure and returns a new state (D11: no hidden randomness).
 *
 * A route is a room of a **map** (a Binding of Isaac-style floor), so the global
 * `routeIndex` counter travels beside the run's actual position — `mapIndex` and
 * `routeInMap` — and `discoveredRooms` is the floor's fog of discovery (D32).
 */
export type RunState = Readonly<{
  seed: string;
  mode: RunMode;
  /** Global counter of rooms entered (changes on every transition). */
  routeIndex: number;
  /** The floor the run is on, 1-based (`docs/maps-spec.md` §1). */
  mapIndex: number;
  /** The room of `mapIndex` the run occupies. */
  routeInMap: number;
  /**
   * The edge the current room was entered through (`docs/maps-spec.md` §2): the
   * scene spawns the player at that door, so leaving East always arrives West.
   */
  arrivalEdge: MapEdge;
  /** Room ids of `mapIndex` entered so far (fog of discovery, D32). Resets per map. */
  discoveredRooms: readonly number[];
  /** True once `mapIndex`'s boss has fallen, so its portal stays open (D31). Resets per map. */
  bossDefeated: boolean;
  /**
   * True once the run has left the floor's entry room. The PC can be rearranged
   * freely only on the **first** visit to the entry room, so a return visit finds
   * the box locked (`docs/routes-spec.md` §6). Resets per map.
   */
  entryDeparted: boolean;
  /**
   * Ids of the Pokémon caught on `mapIndex` while the party was full. Each stays
   * swappable out of the PC for the rest of the floor — the catch itself is never
   * locked in — even after the entry room is left. Resets per map.
   */
  pcUnlocked: readonly string[];
  /** Cached level cap for `mapIndex` (D9/D29); kept in sync on a map advance. */
  levelCap: number;
  /**
   * Pokevial charges left: up to `POKEVIAL_MAX_CHARGES`, one earned per beaten
   * trainer and filled by a boss. `usePokevial` **only drinks a full meter**,
   * resting the party and the box and curing status while emptying it. A run's
   * meter **survives the floor change** (`docs/routes-spec.md` §6); only a fresh
   * run starts full.
   */
  pokevialCharges: number;
  /**
   * The squad's shared XP: the whole party and box level together off this one
   * bar (`squadLevel` derives the level). A catch is rebuilt at that level, so
   * there is no per-member XP.
   */
  xp: number;
  party: readonly RunPokemon[];
  box: readonly RunPokemon[];
  bag: readonly BagCounts[];
  /**
   * Poké Dollars, earned only by beating trainers and spent in the shop
   * (`docs/maps-spec.md` §7, D33). A run starts with none and it carries across
   * floors; a lost run carries nothing over (D5).
   */
  money: number;
  /** Trainer ids already beaten on `mapIndex`. Resets per map, so revisits stay clear. */
  defeatedTrainers: readonly string[];
  /** Ground-item ids already taken on `mapIndex`. Resets per map. */
  pickedItems: readonly string[];
  /** Room ids of `mapIndex` whose single capture has been spent. Resets per map. */
  capturedRooms: readonly number[];
  stats: RunStats;
}>;

export type RunInit = Readonly<{
  seed: string;
  starter: RunPokemon;
  mode?: RunMode;
  bag?: readonly BagCounts[];
  /** Starting Poké Dollars; a fresh run has none (`docs/maps-spec.md` §7). */
  money?: number;
  /** The squad's starting XP; defaults to the starter's own level curve. */
  xp?: number;
}>;

export function createRun(init: RunInit): RunState {
  const plan = planMap(init.seed, FIRST_MAP);
  const entryRoom = plan.entryRoom;
  return {
    seed: init.seed,
    mode: init.mode ?? 'finite',
    routeIndex: FIRST_ROUTE,
    mapIndex: FIRST_MAP,
    routeInMap: entryRoom,
    arrivalEdge: plan.entryEdge,
    discoveredRooms: [entryRoom],
    bossDefeated: false,
    entryDeparted: false,
    pcUnlocked: [],
    levelCap: levelCapForMap(FIRST_MAP),
    pokevialCharges: POKEVIAL_MAX_CHARGES,
    xp: init.xp ?? xpForLevel(init.starter.fighter.level),
    party: [init.starter],
    box: [],
    bag: [...(init.bag ?? [])],
    money: Math.max(0, Math.floor(init.money ?? 0)),
    defeatedTrainers: [],
    pickedItems: [],
    capturedRooms: [],
    stats: emptyRunStats(),
  };
}

/**
 * Enters another room of the **same map** (`docs/maps-spec.md` §2): the global
 * counter steps, the room is marked **discovered** (D32) and the door the player
 * came through is stored. The floor's marks (beaten trainers, taken items, spent
 * captures) **stay** — revisiting a room rebuilds it identically and its content
 * does not respawn — and only the map advance clears them.
 *
 * `arrivalEdge` is the door the player arrives through (the opposite of the one
 * they left by); it is kept when it is a real door of the room, else the
 * plan-derived arrival is used so a bad value never opens a wall onto nothing.
 */
export function advanceRoute(run: RunState, roomInMap: number, arrivalEdge?: MapEdge): RunState {
  const room = Math.max(0, Math.floor(roomInMap));
  const plan = planMap(run.seed, run.mapIndex);
  const arrival = isArrivalEdge(plan, room, arrivalEdge) ? (arrivalEdge as MapEdge) : arrivalEdgeFor(plan, room);
  return {
    ...run,
    routeIndex: run.routeIndex + 1,
    routeInMap: room,
    arrivalEdge: arrival,
    // Leaving a room (even the entry back into another) departs the entry room,
    // so the PC is only fully editable on the very first visit.
    entryDeparted: true,
    discoveredRooms: discoverRoom(run.discoveredRooms, room),
  };
}

/**
 * Steps through the map's portal onto the next floor (`docs/maps-spec.md` §6,
 * D31): the next map's entry room, a fresh discovery set and its own cap. This is
 * also the **heal stop** — HP/PP restored across the party and the box, never a
 * resurrection (D5) — while the old floor's marks go with it. The Pokevial's
 * charges **carry over** instead: only a boss or a beaten trainer tops the meter
 * up (`docs/routes-spec.md` §6).
 */
export function advanceMap(run: RunState): RunState {
  const mapIndex = run.mapIndex + 1;
  const plan = planMap(run.seed, mapIndex);
  const advanced: RunState = {
    ...run,
    routeIndex: run.routeIndex + 1,
    mapIndex,
    routeInMap: plan.entryRoom,
    arrivalEdge: plan.entryEdge,
    discoveredRooms: [plan.entryRoom],
    bossDefeated: false,
    entryDeparted: false,
    pcUnlocked: [],
    levelCap: levelCapForMap(mapIndex),
    defeatedTrainers: [],
    pickedItems: [],
    capturedRooms: [],
  };
  return healParty(advanced);
}

/** True once a room of the current map has been entered (fog of discovery, D32). */
export function isRoomDiscovered(run: RunState, roomId: number): boolean {
  return run.discoveredRooms.includes(roomId);
}

/** Marks the current map's boss beaten, so its portal opens (D31); also tops the Pokevial up. */
export function markBossDefeated(run: RunState): RunState {
  return run.bossDefeated ? run : fillPokevial({ ...run, bossDefeated: true });
}

/** The squad's shared level: the run XP read through the medium-fast curve, capped per map. */
export function squadLevel(run: RunState): number {
  return clampToCap(levelForXp(run.xp), run.levelCap);
}

export type ExperienceGain = Readonly<{ run: RunState; events: readonly ProgressionEvent[] }>;

/**
 * Adds XP to the squad's single bar and levels the whole party **and** box to the
 * level it reaches, learning moves and evolving as they go. The per-map cap clamps
 * gain (D9): overflow is parked at the ceiling instead of banked. Pure and
 * deterministic, like the rest of the run (D11).
 */
export function gainExperience(run: RunState, amount: number, learnsetSeed?: string): ExperienceGain {
  const events: ProgressionEvent[] = [];
  const gain = Math.max(0, Math.floor(amount));
  const rawXp = run.xp + gain;
  const rawLevel = levelForXp(rawXp);
  const level = clampToCap(rawLevel, run.levelCap);
  let xp = rawXp;
  if (rawLevel > level) {
    xp = xpForLevel(level);
    events.push({ kind: 'capped', level });
  }
  events.push({ kind: 'xp', amount: gain, xp });
  const levelMember = (member: RunPokemon): RunPokemon => {
    const grown = levelUpPokemon(member, level, learnsetSeed);
    events.push(...grown.events);
    return grown.pokemon;
  };
  return {
    run: { ...run, xp, party: run.party.map(levelMember), box: run.box.map(levelMember) },
    events,
  };
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

/** True while the room the run stands in has not spent its single capture (D5). */
export function canCapture(run: RunState): boolean {
  return !run.capturedRooms.includes(run.routeInMap);
}

/** Spends the room's single capture; the same room again is a no-op. */
export function useCapture(run: RunState): RunState {
  if (!canCapture(run)) return run;
  return { ...run, capturedRooms: [...run.capturedRooms, run.routeInMap] };
}

/**
 * True while the PC is fully editable: the run still stands in the floor's
 * **entry room** on its first visit (`docs/routes-spec.md` §6). Leaving the room
 * and coming back locks it for the rest of the floor. The entry room is id 0.
 */
export function pcFullyEditable(run: RunState): boolean {
  return !run.entryDeparted && run.routeInMap === 0;
}

/**
 * True when `memberId` may be moved between the party and the PC: either the PC is
 * fully editable or the member is the floor's own catch, which is never locked in.
 */
export function pcMemberEditable(run: RunState, memberId: string): boolean {
  return pcFullyEditable(run) || run.pcUnlocked.includes(memberId);
}

/** Remembers that a member (the floor's catch) stays swappable out of the PC. */
export function unlockPcMember(run: RunState, memberId: string): RunState {
  return run.pcUnlocked.includes(memberId)
    ? run
    : { ...run, pcUnlocked: [...run.pcUnlocked, memberId] };
}

/**
 * Places a caught Pokémon: the party when it has room, otherwise the PC, and
 * always unlocks it so the floor's catch stays swappable (`docs/routes-spec.md`
 * §6). The capture screen's "leave it in the PC" choice.
 */
export function addCaughtPokemon(run: RunState, pokemon: RunPokemon): RunState {
  return unlockPcMember(addPokemon(run, pokemon), pokemon.fighter.id);
}

/**
 * Places a caught Pokémon by trading it for the party member at `partyIndex` (the
 * replaced member goes to the PC), and unlocks the catch. The capture screen's
 * "swap for a party member" choice.
 */
export function swapCaughtIntoParty(run: RunState, pokemon: RunPokemon, partyIndex: number): RunState {
  const placed = addPokemon(run, pokemon);
  const boxIndex = placed.box.findIndex((member) => member.fighter.id === pokemon.fighter.id);
  if (boxIndex < 0) return unlockPcMember(placed, pokemon.fighter.id);
  return unlockPcMember(swapPartyBox(placed, partyIndex, boxIndex), pokemon.fighter.id);
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

/** Adds Poké Dollars (a beaten trainer's drop). A negative or zero amount is a no-op. */
export function addMoney(run: RunState, amount: number): RunState {
  const gain = Math.max(0, Math.floor(amount));
  return gain === 0 ? run : { ...run, money: run.money + gain };
}

/** Spends Poké Dollars; refused (a no-op) when the run cannot afford `amount`. */
export function spendMoney(run: RunState, amount: number): RunState {
  const cost = Math.max(0, Math.floor(amount));
  if (cost === 0) return run;
  return run.money < cost ? run : { ...run, money: run.money - cost };
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
