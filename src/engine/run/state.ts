import { normalizeId } from '../../data/dex';
import { getItem } from '../../data/items';
import { nodeOf, planRegion, type RegionNode } from '../region/plan';
import type { BagCounts } from './battleLink';
import { POKEVIAL_MAX_CHARGES, autoPokevial, fillPokevial } from './heal';
import { clampToCap } from './levelCap';
import { missionForMap, type MissionProgress } from './missions';
import { emptyModifiers, type RunModifiers } from './modifiers';
import {
  evolvePokemon,
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

/**
 * The four compass doors a screen opens on. Cardinally ordered, so every derivation
 * over an opening set is deterministic (`docs/routes-spec.md` §1).
 */
export type MapEdge = 'N' | 'E' | 'S' | 'W';

export const MAP_EDGES: readonly MapEdge[] = ['N', 'E', 'S', 'W'];

/** What the run summary counts: caught along the way, and lost for good (D5). */
export type RunStats = Readonly<{
  catches: number;
  casualties: number;
  /**
   * Enemies this run has fainted, the run's own counter (`Task-181`). Optional so
   * every save written before `SAVE_VERSION` 26 and every run built by an older
   * caller stays legal: absent reads as 0 (`runFaints`).
   */
  faints?: number;
}>;

export function emptyRunStats(): RunStats {
  return { catches: 0, casualties: 0, faints: 0 };
}

/** The run's faint counter as a whole number of at least zero; absent counts as none. */
export function runFaints(stats: RunStats): number {
  const faints = stats.faints;
  return typeof faints === 'number' && Number.isFinite(faints) && faints > 0 ? Math.floor(faints) : 0;
}

/**
 * Adds `faints` to the run's faint counter, clamped at 0. A non-positive gain
 * returns the run **as the same object**, so a caller cannot dirty a save for
 * nothing (`Task-181`).
 */
export function addFaints(run: RunState, faints: number): RunState {
  const gain = Math.max(0, Math.floor(Number.isFinite(faints) ? faints : 0));
  if (gain === 0) return run;
  return { ...run, stats: { ...run.stats, faints: runFaints(run.stats) + gain } };
}

/**
 * The run: everything that survives a node. The party/box hold run members
 * (battle snapshot + XP), the bag is the item stacks the scene passes to battle,
 * `money` is the Poké Dollars beat out of trainers, `defeatedTrainers` /
 * `pickedItems` are the node's bookkeeping and `stats` is the running score the
 * end-of-run screen reports.
 * Every helper here is pure and returns a new state (D11: no hidden randomness).
 *
 * A run stands on a **region node** (`nodeKey`, `docs/region-spec.md` §1) and that
 * key is its only position: it carries the nodes it has entered, the badges it
 * holds, the nodes whose single catch is spent and the tower's own streak. A node
 * entry resets the four fields `NodeEntry` names — the door the run arrived
 * through, its discovered rooms, its boss flag and its level cap.
 */
export type RunState = Readonly<{
  seed: string;
  /** @deprecated the endless run is retired; the record is the badge count. */
  mode: RunMode;
  /**
   * The edge the current room was entered through (`docs/maps-spec.md` §2): the
   * scene spawns the player at that door, so leaving East always arrives West.
   */
  arrivalEdge: MapEdge;
  /** Room ids of the node entered so far (fog of discovery, D32). Resets per node. */
  discoveredRooms: readonly number[];
  /** True once the node's boss has fallen, so its portal stays open (D31). Resets per node. */
  bossDefeated: boolean;
  /** The level cap the node enforces (`node.cap`), reset on every node entry. */
  levelCap: number;
  /** The region node the run stands on: `nodeKey(kind, id)` of a `planRegion` node. */
  nodeKey: string;
  /** Every node the run has entered, in first-entry order, starting with `nodeKey`. */
  visitedNodes: readonly string[];
  /** The badges held, ascending, deduplicated; badge `n` is gym `city:n`'s. */
  badges: readonly number[];
  /** The nodes whose single catch has been spent. */
  capturedNodes: readonly string[];
  /** The tower's own streak, kept apart from the record (`D62`). */
  towerStreak: number;
  /**
   * Pokevial charges left: up to `POKEVIAL_MAX_CHARGES`, one earned per beaten
   * trainer and filled by a boss. The vial is **automatic** (`autoPokevial`): a
   * full meter drinks itself the instant the party or the box has something to
   * cure — missing HP, missing PP or a primary status — resting both and
   * emptying the meter, and never resurrecting a fallen member (D5). A run's
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
  /**
   * True once the professor's starter has been taken. A prologue run is `false`:
   * it stands in the laboratory with no party at all (`src/engine/run/prologue.ts`).
   */
  starterTaken: boolean;
  party: readonly RunPokemon[];
  box: readonly RunPokemon[];
  /**
   * The fallen, in **party-then-box order**, appended only by `releaseFainted`
   * (`src/engine/run/perms.ts`), at the same place `stats.casualties` is bumped, so
   * the list and the count can never disagree. Permadeath is permanent (D5): the
   * dead are read-only everywhere — never healed, never evolved, never renamed,
   * never re-equipped, never moved back into the party — and shown by the PC's RIP
   * tab (`docs/routes-spec.md` §6).
   */
  rip: readonly RunPokemon[];
  /**
   * The species id of every **successful** catch, in catch order, deduped. A run-long
   * fact: entering a node never clears it (unlike `defeatedTrainers`, `pickedItems`
   * and `bossDefeated`); only a fresh run starts it empty. A different fact from
   * `rip` (the dead **members**) and from `stats.casualties`.
   */
  caughtSpecies: readonly string[];
  /**
   * The candy colours this run has **tried**, in the order it tried them
   * (`Task-103`). Run-long: entering a node never clears it; only a fresh run
   * starts empty. A colour's own stat mapping is never stored — it is derived from
   * the seed by `candyTreat`.
   */
  discoveredCandy: readonly string[];
  bag: readonly BagCounts[];
  /**
   * Poké Dollars, earned only by beating trainers and spent in the shop
   * (`docs/maps-spec.md` §7, D33). A run starts with none and it carries across
   * nodes; a lost run carries nothing over (D5).
   */
  money: number;
  /** Trainer ids already beaten on `nodeKey`. Resets per node, so revisits stay clear. */
  defeatedTrainers: readonly string[];
  /** Ground-item ids already taken on `nodeKey`. Resets per node. */
  pickedItems: readonly string[];
  /**
   * @deprecated the old floor scene's spent rooms: no rule reads or writes it since
   * the capture rule became the node (`capturedNodes`), and nothing resets it any
   * more. Only a save carries it.
   */
  capturedRooms: readonly number[];
  /** The node's mission and whether the run has met it, or null on an old save. */
  mission: MissionProgress | null;
  /** How many missions this run has completed. Run-long: entering a node never clears it. */
  missionsCompleted: number;
  /**
   * The nodes whose mission this run met, in the order it met them (oldest first).
   * Run-long: entering a node never clears it; only a fresh run starts it empty, and
   * it is appended where `missionsCompleted` steps so the two never disagree.
   */
  completedMissions: readonly CompletedMission[];
  /** HP the party lost on `nodeKey` — the `flawless` mission's progress. Resets per node. */
  hpLost: number;
  /** `stats.casualties` when `nodeKey` was entered, so a death on this node is visible. Resets per node. */
  floorCasualties: number;
  /**
   * The facts the special NPCs leave behind (`docs/maps-spec.md` §7): the curse,
   * the forced sky and the narrowed wild type. A run-long record: entering a node
   * carries it, and only `decayModifiers` spends a node of the forced sky.
   */
  modifiers: RunModifiers;
  stats: RunStats;
  /**
   * The ISO-8601 instant the run was created, passed **in** by its caller: the
   * engine reads no clock (`D11`). `''` means the run came from a save written
   * before `SAVE_VERSION` 26 and its playtime is unknown (reported as 0).
   */
  startedAt: string;
}>;

/** One floor whose mission the run met: the row's id and the floor it was drawn on. */
export type CompletedMission = Readonly<{ id: string; mapIndex: number }>;

export type RunInit = Readonly<{
  seed: string;
  /** A prologue run passes no `starter`: its party is empty until `takeStarter`. */
  starter?: RunPokemon;
  mode?: RunMode;
  bag?: readonly BagCounts[];
  /** Starting Poké Dollars; a fresh run has none (`docs/maps-spec.md` §7). */
  money?: number;
  /** The squad's starting XP; defaults to the starter's own level curve. */
  xp?: number;
  /** The ISO instant the run begins; absent or `''` means unknown. */
  startedAt?: string;
}>;

/** The four run fields a node entry resets; the run's position is `nodeKey` alone. */
export type NodeEntry = Readonly<{
  /** The compass door the run arrives through; a node has no room to derive one from. */
  arrivalEdge: MapEdge;
  /** The rooms of the node discovered so far: only the entry room. */
  discoveredRooms: readonly number[];
  /** The node's boss flag: a node entry starts with its boss standing. */
  bossDefeated: boolean;
  /** `node.cap`, the level cap the node enforces. */
  levelCap: number;
}>;

/**
 * The four fields entering a node resets, read off the node the key names: its cap,
 * a fresh discovery set, a closed boss and the compass fallback the screens open on.
 * A key the plan does not hold reads as the town, never an error, and the function
 * draws nothing from any Rng and reads no clock (D11).
 */
export function nodeEntry(seed: string, key: string): NodeEntry {
  const plan = planRegion(seed);
  const node = nodeOf(plan, key) ?? nodeOf(plan, plan.townKey)!;
  return {
    // The compass door is the fallback a save with no readable edge lands on
    // (`readArrivalEdge`); a region node has no floor room to derive one from.
    arrivalEdge: 'N',
    discoveredRooms: [0],
    bossDefeated: false,
    levelCap: node.cap,
  };
}

/**
 * The plan node the run stands on: `nodeOf(planRegion(run.seed), run.nodeKey)`,
 * falling back to the region's town so a stale or hand-edited key still answers a
 * node. Total: never throws, draws nothing and reads no clock (D11).
 */
export function runNode(run: RunState): RegionNode {
  const plan = planRegion(run.seed);
  return nodeOf(plan, run.nodeKey) ?? nodeOf(plan, plan.townKey)!;
}

export function createRun(init: RunInit): RunState {
  const plan = planRegion(init.seed);
  const entry = nodeEntry(init.seed, plan.townKey);
  return {
    seed: init.seed,
    mode: init.mode ?? 'finite',
    arrivalEdge: entry.arrivalEdge,
    discoveredRooms: entry.discoveredRooms,
    bossDefeated: entry.bossDefeated,
    levelCap: entry.levelCap,
    nodeKey: plan.townKey,
    visitedNodes: [plan.townKey],
    badges: [],
    capturedNodes: [],
    towerStreak: 0,
    pokevialCharges: POKEVIAL_MAX_CHARGES,
    xp: init.xp ?? xpForLevel(init.starter?.fighter.level ?? 1),
    starterTaken: init.starter !== undefined,
    party: init.starter === undefined ? [] : [init.starter],
    box: [],
    rip: [],
    caughtSpecies: [],
    discoveredCandy: [],
    bag: [...(init.bag ?? [])],
    money: Math.max(0, Math.floor(init.money ?? 0)),
    defeatedTrainers: [],
    pickedItems: [],
    capturedRooms: [],
    mission: missionForMap(init.seed, FIRST_MAP),
    missionsCompleted: 0,
    completedMissions: [],
    hpLost: 0,
    floorCasualties: 0,
    modifiers: emptyModifiers(),
    stats: emptyRunStats(),
    startedAt: init.startedAt ?? '',
  };
}

/** True once a room of the current node has been entered (fog of discovery, D32). */
export function isRoomDiscovered(run: RunState, roomId: number): boolean {
  return run.discoveredRooms.includes(roomId);
}

/**
 * Marks the current map's boss beaten, so its portal opens (D31); also tops the
 * Pokevial up, and the full meter drinks itself on the spot (`autoPokevial`). A
 * boss already marked leaves the run **as the same object**.
 */
export function markBossDefeated(run: RunState): RunState {
  if (run.bossDefeated) return run;
  return autoPokevial(fillPokevial({ ...run, bossDefeated: true }));
}

/** The squad's shared level: the run XP read through the medium-fast curve, capped by the node. */
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

/** Adds a Pokémon to the party, or to the box once the party is full (D7). */
export function addPokemon(run: RunState, pokemon: RunPokemon): RunState {
  if (run.party.length < MAX_PARTY_SIZE) {
    return { ...run, party: [...run.party, pokemon] };
  }
  return { ...run, box: [...run.box, pokemon] };
}

/**
 * The run id the next caught member is minted under: `catch-<n>`, where `n` starts at
 * the run's own catch count + 1 (`RunState.stats.catches`) and steps up while the id is
 * already held by a member of the party or the box. Pure: it reads the run and draws
 * nothing from any Rng (D11). The id is unique across the party **and** the box, and
 * stable for the life of the member, because it is stored in the snapshot and never
 * re-derived.
 */
export function nextMemberId(run: RunState): string {
  const taken = new Set<string>();
  for (const member of run.party) taken.add(member.fighter.id);
  for (const member of run.box) taken.add(member.fighter.id);
  let counter = Math.max(0, Math.floor(run.stats.catches)) + 1;
  let id = `catch-${counter}`;
  while (taken.has(id)) {
    counter += 1;
    id = `catch-${counter}`;
  }
  return id;
}

/**
 * Re-keys every party/box member whose id another member already holds, in party-then-box
 * order. The **first** member holding an id keeps it; a later one is re-minted with an id
 * that is guaranteed not to collide with any id the run held when the repair started.
 * Pure and deterministic — the same run always repairs to the same ids — and a run whose
 * ids are already unique is returned **as the same object** (`===`), so a decoder call
 * site is free.
 */
export function dedupeMemberIds(run: RunState): RunState {
  const original = new Set<string>();
  for (const member of run.party) original.add(member.fighter.id);
  for (const member of run.box) original.add(member.fighter.id);

  const claimed = new Set<string>();
  let counter = 0;
  const mint = (): string => {
    let candidate = '';
    do {
      counter += 1;
      candidate = `catch-${counter}`;
    } while (original.has(candidate) || claimed.has(candidate));
    return candidate;
  };
  const dedupeList = (members: readonly RunPokemon[]): readonly RunPokemon[] => {
    let touched = false;
    const next = members.map((member) => {
      const id = member.fighter.id;
      if (!claimed.has(id)) {
        claimed.add(id);
        return member;
      }
      const newId = mint();
      claimed.add(newId);
      touched = true;
      return { ...member, fighter: { ...member.fighter, id: newId } };
    });
    return touched ? next : members;
  };

  const party = dedupeList(run.party);
  const box = dedupeList(run.box);
  if (party === run.party && box === run.box) return run;
  return { ...run, party, box };
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

/**
 * Evolves a party or box member into `into` when its level allows that branch
 * (`docs/battle-spec.md` §7). The clicked branch is validated by `evolvePokemon`,
 * so an unready or unknown target leaves the run untouched. Pure.
 */
export function evolveMember(run: RunState, memberId: string, into: string): RunState {
  const member =
    run.party.find((entry) => entry.fighter.id === memberId) ??
    run.box.find((entry) => entry.fighter.id === memberId);
  if (!member) return run;
  const evolved = evolvePokemon(member, into, run.seed);
  return evolved === member ? run : updatePokemon(run, evolved);
}

export function setParty(run: RunState, party: readonly RunPokemon[]): RunState {
  return { ...run, party: [...party] };
}

/**
 * Whether the run still has someone standing: a member with `hp > 0`. An **empty
 * party is alive while the starter has not been taken** — the prologue stands in the
 * laboratory with no Pokémon and is not a loss — while an empty party that already
 * took its starter (a hand-edited save) is still a loss.
 */
export function hasLivingParty(run: RunState): boolean {
  if (run.party.length === 0) return !run.starterTaken;
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

/**
 * Swaps two party slots. Index 0 is the lead (it opens the next battle), so a
 * swap with 0 changes who leads. A same-index or out-of-range swap is a no-op and
 * returns the run it was given.
 */
export function reorderParty(run: RunState, from: number, to: number): RunState {
  const size = run.party.length;
  if (from === to || from < 0 || from >= size || to < 0 || to >= size) return run;
  const party = [...run.party];
  party[from] = run.party[to]!;
  party[to] = run.party[from]!;
  return { ...run, party };
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

/** True while the node the run stands on has not spent its single capture (D5). */
export function canCapture(run: RunState): boolean {
  return !run.capturedNodes.includes(run.nodeKey);
}

/** Spends the node's single capture; the same node again is a no-op. */
export function useCapture(run: RunState): RunState {
  if (!canCapture(run)) return run;
  return { ...run, capturedNodes: [...run.capturedNodes, run.nodeKey] };
}

/**
 * True **inside a Pokémon Centre**, the only place the party and the PC may trade
 * members (`docs/region-spec.md` §6). The flag belongs to the scene — it is the room
 * the run stands in — so outside a Centre every box edit is refused, and a Centre
 * allows it on every visit.
 */
export function pcFullyEditable(run: RunState, inCentre = false): boolean {
  void run;
  return inCentre === true;
}

/** The same rule under the name the boxes call: a Centre's PC, and nowhere else. */
export function pcMemberEditable(run: RunState, inCentre = false): boolean {
  return pcFullyEditable(run, inCentre);
}

/**
 * Places a caught Pokémon, the classic way (D7): the party while it has room, else
 * the PC. A catch that lands in the box is withdrawable from a Pokémon Centre like
 * any other boxed member, and **only** there (`pcMemberEditable`,
 * `docs/region-spec.md` §6). Pure, like the rest of the run (D11).
 */
export function addCaughtPokemon(run: RunState, pokemon: RunPokemon): RunState {
  return addPokemon(run, pokemon);
}

/**
 * Grows the record and the counter together, so they can never disagree: `stats.catches`
 * counts every successful catch, while `caughtSpecies` keeps its deduped id once.
 */
export function recordCatch(run: RunState, speciesId: string): RunState {
  const id = normalizeId(speciesId);
  const caughtSpecies =
    id !== '' && !run.caughtSpecies.includes(id) ? [...run.caughtSpecies, id] : run.caughtSpecies;
  return { ...run, caughtSpecies, stats: { ...run.stats, catches: run.stats.catches + 1 } };
}

/**
 * Adds a colour to the run's discovered set, in order, deduped (`Task-103`). A
 * colour the run already tried leaves the run as the same object.
 */
export function discoverCandy(run: RunState, colour: string): RunState {
  const name = colour.trim();
  if (name === '' || run.discoveredCandy.includes(name)) return run;
  return { ...run, discoveredCandy: [...run.discoveredCandy, name] };
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
  return isItemPicked(run, itemId) ? run : { ...run, pickedItems: [...run.pickedItems, itemId] };
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
export function memberById(run: RunState, id: string): RunPokemon | undefined {
  return (
    run.party.find((member) => member.fighter.id === id) ??
    run.box.find((member) => member.fighter.id === id)
  );
}

/**
 * Equips a bag stack to a party/box member: a unit leaves the bag, and whatever
 * the member already held returns to it, so an equip is a swap, never a loss.
 * A member already holding `itemId`, an unknown member or an empty stack is a
 * no-op. Pure, like the rest of the run state (D11).
 */
export function equipHeldItem(run: RunState, memberId: string, itemId: string): RunState {
  if (getItem(itemId)?.kind !== 'held') return run;
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
  return updatePokemon(addItem(run, held), {
    ...member,
    fighter: { ...member.fighter, heldItem: null },
  });
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
  return moves === member.fighter.moves
    ? run
    : updatePokemon(run, { ...member, fighter: { ...member.fighter, moves } });
}
