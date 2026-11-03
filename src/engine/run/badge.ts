import { gymForBadge, type GymRow } from '../../data/gyms';
import { BADGE_CAPS } from '../../data/region';
import type { LevelBand } from '../../data/run';
import {
  getTrainerArchetype,
  leaderIdentity,
  TRAINER_MONEY_BAND_SCALE,
  type TrainerItemReward,
} from '../../data/trainers';
import { nodeOf, planRegion, type RegionNode, type RegionPlan } from '../region/plan';
import { hashSeed, Rng } from '../rng';
import { nextBadge } from './gates';
import { bandForNode, leaderLevel } from './levelCurve';
import { trainerRoster, type RosterEntry } from './roster';
import type { RunState } from './state';

/**
 * A gym as a run fact (`docs/region-spec.md` §3, §7.4): who hands over which badge,
 * the roster a gym's trainers and its leader field, the money and the TM one win
 * pays, and the guard that keeps `RunState.badges` the ladder's own prefix.
 *
 * Pure and total: no Phaser, no DOM, no clock, no storage. The only draws are the
 * two roster families, each off `hashSeed` of the run seed **and its own city key
 * and role** — so no other generator's stream moves, two gyms never share a draw, and
 * a third family appended later could not move the first two (`D11`, `D60`). Gym 1's
 * fixed party draws nothing at all, so its team is seed-independent.
 */

/** One gym fight, resolved to the roster it fields. */
export type GymFoe = Readonly<{
  /** The trainer id it is remembered by in `RunState.defeatedTrainers`. */
  id: string;
  role: 'trainer' | 'leader';
  /** Room 1's trainer is `0`; the leader is `-1`. */
  index: number;
  /** The badge this gym hands over, 1..8: the number `grantBadge` guards. */
  badge: number;
  /** The gym's own `GYMS` row (`src/data/gyms.ts`). */
  row: GymRow;
  /** The archetype whose sprite, AI flags and money base the fight borrows. */
  archetypeId: string;
  /** What the battle prints: the leader's own name, or the archetype's class. */
  name: string;
  /** The band the fight is posted on: the gym city node's own band. */
  band: LevelBand;
  roster: readonly RosterEntry[];
}>;

/** What a beaten gym fight folds into the run (`resolveBattle`'s reward). */
export type GymReward = Readonly<{
  enemyLevels: readonly number[];
  isTrainer: true;
  trainerId: string;
  money: number;
  item?: TrainerItemReward;
}>;

/** The trainer id a gym's leader is remembered by: `gym-leader:<cityKey>`. */
export function gymLeaderId(cityKey: string): string {
  return `gym-leader:${cityKey}`;
}

/** The trainer id a gym's room-1 trainer is remembered by: `gym-trainer:<cityKey>:<index>`. */
export function gymTrainerId(cityKey: string, index: number): string {
  return `gym-trainer:${cityKey}:${safeIndex(index)}`;
}

/** True when the run carries `badge`. */
export function hasBadge(run: RunState, badge: number): boolean {
  return run.badges.includes(badge);
}

/** The badge the city's gym hands over, or null when the key is no gym city. */
export function gymBadge(plan: RegionPlan, cityKey: string): number | null {
  const node = nodeOf(plan, cityKey);
  if (node === undefined || node.kind !== 'city' || !node.gym) return null;
  return node.badge;
}

/**
 * Adds `badge` to the run — the ladder's next rung, handed over by the gym the run
 * stands in — or returns the run **it was given** (`===`) when it may not.
 */
export function grantBadge(run: RunState, badge: number): RunState {
  if (!Number.isInteger(badge) || badge < 1 || badge > BADGE_CAPS.length) return run;
  if (run.badges.includes(badge)) return run;
  if (badge !== run.badges.length + 1) return run;

  const plan = planRegion(run.seed);
  const node = nodeOf(plan, run.nodeKey);
  if (node === undefined || !node.gym || node.badge !== badge) return run;
  // The shipped gate's own rule, quoted: the badge and the way out of the city can
  // never disagree on which rung this stretch asks for.
  if (nextBadge(plan, run.nodeKey) !== badge) return run;

  return { ...run, badges: [...run.badges, badge] };
}

/**
 * The gym leader's fight: `count` members at the node's cap, off the gym's own stream.
 * Refuses a key that is not a gym city with `Error("not a gym: <cityKey>")`.
 */
export function gymLeaderFoe(plan: RegionPlan, run: RunState, cityKey: string): GymFoe {
  const node = gymCity(plan, cityKey);
  const row = gymForBadge(node.badge);
  const archetype = getTrainerArchetype(row.archetypeId);
  const id = gymLeaderId(cityKey);
  const band = bandForNode(node);
  const level = leaderLevel(node.cap);
  const fixed = row.fixedParty;
  const roster: readonly RosterEntry[] =
    fixed !== undefined
      ? fixed.map((speciesId, index) => ({ id: `${id}:${index}`, speciesId, level }))
      : trainerRoster(band, new Rng(hashSeed(`${run.seed}:gym:${cityKey}:leader`)), id, {
          count: row.partySize,
          levelFor: () => level,
          boss: true,
          allowMega: archetype?.carriesMega === true,
        });
  return {
    id,
    role: 'leader',
    index: -1,
    badge: row.badge,
    row,
    archetypeId: row.archetypeId,
    name: leaderIdentity(row.leaderId)?.name ?? row.leaderId,
    band,
    roster,
  };
}

/**
 * The gym's room-1 trainer `index`: the band's own party size at this node's distance.
 * Refuses a key that is not a gym city with `Error("not a gym: <cityKey>")`.
 */
export function gymTrainerFoe(plan: RegionPlan, run: RunState, cityKey: string, index: number): GymFoe {
  const node = gymCity(plan, cityKey);
  const row = gymForBadge(node.badge);
  const archetype = getTrainerArchetype(row.archetypeId);
  const room = safeIndex(index);
  const id = gymTrainerId(cityKey, room);
  const band = bandForNode(node);
  // No `count` and no `levelFor`: the band's own `trainerSize` at
  // `trainerLevel(cap, gymDistance, size)`, straight off the node (`roster.ts`).
  const roster = trainerRoster(
    band,
    new Rng(hashSeed(`${run.seed}:gym:${cityKey}:trainer:${room}`)),
    id,
    {
      node,
      allowMega: archetype?.carriesMega === true,
    },
  );
  return {
    id,
    role: 'trainer',
    index: room,
    badge: row.badge,
    row,
    archetypeId: row.archetypeId,
    name: archetype?.className ?? archetype?.name ?? row.archetypeId,
    band,
    roster,
  };
}

/** What a beaten gym fight pays: its roster's levels, the mark, the money, and a leader's TM. */
export function gymReward(foe: GymFoe): GymReward {
  const money = gymMoney(foe.archetypeId, foe.band, foe.role === 'leader' ? foe.row.moneyMultiplier : 1);
  return {
    enemyLevels: foe.roster.map((entry) => entry.level),
    isTrainer: true,
    trainerId: foe.id,
    money,
    ...(foe.role === 'leader' ? { item: { itemId: foe.row.tmItemId, count: 1 } } : {}),
  };
}

/** A room index as a non-negative whole number; anything unreadable counts as the first room. */
function safeIndex(index: number): number {
  return Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
}

/** The gym city's node, or a throw when the key is not one. */
function gymCity(plan: RegionPlan, cityKey: string): RegionNode {
  const node = nodeOf(plan, cityKey);
  if (node === undefined || !node.gym) throw new Error(`not a gym: ${cityKey}`);
  return node;
}

/**
 * The expected value of `trainerMoney`'s roll — the archetype's base plus half of its
 * jitter, at the band's scale, times the row's multiplier — so a gym pays without
 * spending a draw outside its roster streams (`D11`, `D33`), exactly as `leagueMoney`
 * does it (`src/engine/region/league.ts`).
 */
function gymMoney(archetypeId: string, band: LevelBand, multiplier: number): number {
  const archetype = getTrainerArchetype(archetypeId);
  const scale = TRAINER_MONEY_BAND_SCALE[band.id];
  if (archetype === undefined) return Math.max(1, Math.round(band.maxLevel * scale));
  return Math.max(
    1,
    Math.round((archetype.money.base + archetype.money.jitter / 2) * scale * Math.max(1, multiplier)),
  );
}
