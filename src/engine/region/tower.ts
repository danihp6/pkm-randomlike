import { TOWER, type TowerRow } from '../../data/league';
import { LEAGUE_LEVEL } from '../../data/region';
import { bandForLevel } from '../../data/run';
import { hashSeed, Rng } from '../rng';
import { healParty, needsHealing } from '../run/heal';
import type { BattleReward } from '../run/resolve';
import { trainerRoster, type RosterEntry } from '../run/roster';
import { hasLivingParty, type RunState } from '../run/state';
import { leagueCleared } from './league';
import { nodeKey, nodeOf, planRegion } from './plan';

/**
 * The tower behind the Champion (`docs/region-spec.md` §7.11): the region's one
 * **endless** node, `tower:1`, a chain of level-`LEAGUE_LEVEL` trainer fights with
 * no leader, no badge and no shop behind them. The run only enters it once
 * `leagueCleared` is true, and it only ends when the party does (`D5`).
 *
 * Pure and total: no Phaser, no DOM and no clock. The only draw is the roster of
 * the rung being asked for, off that rung's own stream (`D11`, `D60`), so a rung
 * replays alone and appending a rung cannot move an earlier one.
 */

/** The tower's node: the plan holds exactly one, `tower:1`. */
export const TOWER_NODE_KEY: string = nodeKey('tower', 1);

/**
 * The five the tower fields: the backlog's own figure. The region's size table
 * (`src/data/region.ts`) moves it there when the batch closes.
 */
const TOWER_PARTY_SIZE = 5;

/** One tower fight, resolved to the five-member party it fields. */
export type TowerFoe = Readonly<{
  /** The fight's rung: `streak + 1`, so the first fight after the Champion is 1. */
  rung: number;
  /** `tower:<rung>` — the battle seed's entity key and the mark a win leaves. */
  trainerId: string;
  /** The plan's own name for the node the fight happens on (`'Tower'`). */
  name: string;
  /** The level every member of the party carries: `LEAGUE_LEVEL` (60). */
  level: number;
  /** The shipped `TOWER` row: no leader, no badge, no fixed party. */
  row: TowerRow;
  /** The party it fields, drawn off `${seed}:tower:<rung>`. */
  roster: readonly RosterEntry[];
}>;

/** What a finished tower fight does to the run. */
export type TowerResult = Readonly<{
  /** The run after the fight: the streak bumped on a win, healed; a loss is unchanged. */
  run: RunState;
  /** True exactly when nobody in the party is living: the run is over. */
  over: boolean;
}>;

/** The tower's door: open only once the Champion has fallen (`leagueCleared`). */
export function towerOpen(run: RunState): boolean {
  return leagueCleared(run);
}

/** The fight after `streak` wins, or null before the Champion down to row 5. */
export function towerStep(run: RunState, streak: number): TowerFoe | null {
  if (!towerOpen(run)) return null;
  const rung = rungAfter(streak);
  const trainerId = `tower:${rung}`;
  const level = LEAGUE_LEVEL;
  return {
    rung,
    trainerId,
    name: nodeOf(planRegion(run.seed), TOWER_NODE_KEY)?.name ?? 'Tower',
    level,
    row: TOWER,
    roster: trainerRoster(
      bandForLevel(LEAGUE_LEVEL),
      new Rng(hashSeed(`${run.seed}:tower:${rung}`)),
      trainerId,
      { count: TOWER_PARTY_SIZE, levelFor: () => level },
    ),
  };
}

/** The run after a won fight: `towerStreak` steps to `streak + 1`, never backwards. */
export function towerWin(run: RunState, streak: number): RunState {
  const next = Math.max(run.towerStreak, rungAfter(streak));
  return next === run.towerStreak ? run : { ...run, towerStreak: next };
}

/** The heal between two fights: HP/PP, party and box, no status cure, no revival. */
export function towerHeal(run: RunState): RunState {
  return needsHealing(run) ? healParty(run) : run;
}

/** The whole rule of one finished fight: bump and heal on a win, `over` on a wipe. */
export function towerResolve(run: RunState, foe: TowerFoe, won: boolean): TowerResult {
  const next = won ? towerHeal(towerWin(run, foe.rung - 1)) : run;
  return { run: next, over: !hasLivingParty(next) };
}

/** What a beaten tower fight folds into the run through `resolveBattle`. */
export function towerReward(foe: TowerFoe): BattleReward {
  return {
    enemyLevels: foe.roster.map((entry) => entry.level),
    isTrainer: true,
    trainerId: foe.trainerId,
  };
}

/** The rung a fight after `streak` wins sits on: a streak that is not a number asks for the first. */
function rungAfter(streak: number): number {
  return Math.max(1, Math.floor(Number.isFinite(streak) ? streak : 0) + 1);
}
