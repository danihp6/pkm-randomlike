import { levelCapForRoute } from '../../data/run';
import type { BagCounts } from './battleLink';
import type { RunPokemon } from './progression';

export type RunMode = 'finite' | 'infinite';

export const MAX_PARTY_SIZE = 6;

/** The starter route index; a run begins on route 1 (docs/routes-spec.md §5). */
export const FIRST_ROUTE = 1;

/**
 * The run: everything that survives a route. The party/box hold run members
 * (battle snapshot + XP), the bag is the item stacks the scene passes to battle,
 * and `defeatedTrainers` / `captureUsed` are the per-route bookkeeping. Every
 * helper here is pure and returns a new state (D11: no hidden randomness).
 */
export type RunState = Readonly<{
  seed: string;
  mode: RunMode;
  routeIndex: number;
  /** Cached level cap for `routeIndex` (D9); kept in sync on route advance. */
  levelCap: number;
  party: readonly RunPokemon[];
  box: readonly RunPokemon[];
  bag: readonly BagCounts[];
  defeatedTrainers: readonly string[];
  /** True once this route's single capture has been spent. Resets on advance. */
  captureUsed: boolean;
}>;

export type RunInit = Readonly<{
  seed: string;
  starter: RunPokemon;
  mode?: RunMode;
  bag?: readonly BagCounts[];
}>;

export function createRun(init: RunInit): RunState {
  return {
    seed: init.seed,
    mode: init.mode ?? 'finite',
    routeIndex: FIRST_ROUTE,
    levelCap: levelCapForRoute(FIRST_ROUTE),
    party: [init.starter],
    box: [],
    bag: [...(init.bag ?? [])],
    defeatedTrainers: [],
    captureUsed: false,
  };
}

/** Advances to the next route: raises the cap, clears the per-route capture and trainer marks. */
export function advanceRoute(run: RunState): RunState {
  const routeIndex = run.routeIndex + 1;
  return {
    ...run,
    routeIndex,
    levelCap: levelCapForRoute(routeIndex),
    captureUsed: false,
    defeatedTrainers: [],
  };
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

export function canCapture(run: RunState): boolean {
  return !run.captureUsed;
}

/** Spends the route's single capture; a second call is a no-op. */
export function useCapture(run: RunState): RunState {
  return run.captureUsed ? run : { ...run, captureUsed: true };
}

export function isTrainerDefeated(run: RunState, trainerId: string): boolean {
  return run.defeatedTrainers.includes(trainerId);
}

export function markTrainerDefeated(run: RunState, trainerId: string): RunState {
  return isTrainerDefeated(run, trainerId)
    ? run
    : { ...run, defeatedTrainers: [...run.defeatedTrainers, trainerId] };
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
