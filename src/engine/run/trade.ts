import { allNatures } from '../../data/dex/natures';
import { hashSeed, Rng } from '../rng';
import { bandForMap } from './floors';
import { speciesPool } from './pool';
import { adoptAtLevel, createRunPokemon, type RunPokemon } from './progression';
import {
  addPokemon,
  isItemPicked,
  markItemPicked,
  nextMemberId,
  squadLevel,
  type RunState,
} from './state';

/**
 * The **trade** room's rule (`docs/maps-spec.md` §7, `docs/routes-spec.md` §6): a
 * party member is given away for good and one random species from the floor band's
 * wild pool is rolled **on acceptance** — never previewed — and placed in the party
 * at the squad's level, the rule a catch already follows. The window only reports;
 * every decision is here, pure and deterministic (D11).
 */

/**
 * The stable per-floor "this room's trade is done" mark in `pickedItems`. The same
 * shape the gated room's opening uses, so a revisit and a reload agree and
 * `advanceMap` clears it with the rest of the floor.
 */
export function tradeId(mapIndex: number, roomId: number): string {
  return `trade-${mapIndex}-${roomId}`;
}

/**
 * True when the party may give a member up: it holds **at least two**. Members are
 * counted, not living members — a 0-HP member cannot exist outside a battle
 * (`releaseFainted`, `src/engine/run/perms.ts`), so HP and status are irrelevant.
 */
export function canTrade(run: RunState): boolean {
  return run.party.length >= 2;
}

/**
 * The **deliberate** removal (`docs/routes-spec.md` §6): drops exactly the member
 * `memberId` names — `party` first, else `box` — and nothing else. Unlike
 * `releaseFainted` it is not a loss: `stats.casualties`, `stats.catches`, `rip`,
 * `caughtSpecies` and `xp` are untouched, and the party's remaining order is kept.
 * A miss returns the **same run reference** and `removed: null`. Nothing else about
 * the run is bookkept for the member: no PC window follows it out, because the
 * boxes read the entry room, not a member (`pcMemberEditable`, `state.ts`).
 */
export function removeMember(
  run: RunState,
  memberId: string,
): Readonly<{ run: RunState; removed: RunPokemon | null }> {
  const party = run.party.findIndex((member) => member.fighter.id === memberId);
  if (party >= 0) {
    return {
      run: { ...run, party: run.party.filter((_, index) => index !== party) },
      removed: run.party[party],
    };
  }
  const box = run.box.findIndex((member) => member.fighter.id === memberId);
  if (box >= 0) {
    return {
      run: { ...run, box: run.box.filter((_, index) => index !== box) },
      removed: run.box[box],
    };
  }
  return { run, removed: null };
}

/** Why a trade was refused. Every one is reachable from the shipped window. */
export type TradeRefusal = 'used' | 'single-member' | 'missing-member';

/** What the trade asks for: the giver and the room's own stable identity. */
export type TradeRequest = Readonly<{
  /** The party member the player picked. The panel only offers party ids. */
  memberId: string;
  /** The floor's index (`RoomView.mapIndex`). */
  mapIndex: number;
  /** The room's id inside the floor (`RoomView.roomId`). */
  roomId: number;
}>;

export type TradeResult =
  | Readonly<{ ok: true; run: RunState; given: RunPokemon; received: RunPokemon }>
  | Readonly<{ ok: false; reason: TradeRefusal }>;

/**
 * One trade, end to end and in one call, so the window can only report it. Checks,
 * in this order — `'used'`, then `'single-member'`, then `'missing-member'` — and a
 * refusal changes **nothing** (same run reference). A success, in this order:
 * resolve the pool, `removeMember`, roll, `adoptAtLevel`, `addPokemon`,
 * `markItemPicked(run, tradeId(...))`.
 */
export function tradePokemon(run: RunState, request: TradeRequest): TradeResult {
  if (isItemPicked(run, tradeId(request.mapIndex, request.roomId))) {
    return { ok: false, reason: 'used' };
  }
  if (!canTrade(run)) return { ok: false, reason: 'single-member' };
  if (!run.party.some((member) => member.fighter.id === request.memberId)) {
    return { ok: false, reason: 'missing-member' };
  }

  const band = bandForMap(request.mapIndex);
  const pool = speciesPool(band, 'wild');
  const rng = new Rng(hashSeed(`${run.seed}:trade:${request.mapIndex}:${request.roomId}`));
  const speciesId = pool[rng.int(0, pool.length - 1)];
  const natures = allNatures();
  const nature = natures[rng.int(0, natures.length - 1)].id;

  const removed = removeMember(run, request.memberId);
  const afterRemoval = removed.run;
  const given = removed.removed!;
  const level = squadLevel(afterRemoval);
  const received = adoptAtLevel(
    createRunPokemon({
      id: nextMemberId(afterRemoval),
      speciesId,
      level,
      nature,
      learnsetSeed: run.seed,
    }),
    level,
    run.seed,
  );
  const next = markItemPicked(
    addPokemon(afterRemoval, received),
    tradeId(request.mapIndex, request.roomId),
  );

  return { ok: true, run: next, given, received };
}
