import { LEAGUE, type LeagueRow } from '../../data/league';
import { LEAGUE_LEVEL } from '../../data/region';
import { bandForLevel, type LevelBand } from '../../data/run';
import { getTrainerArchetype, TRAINER_MONEY_BAND_SCALE } from '../../data/trainers';
import { hashSeed, Rng } from '../rng';
import { healParty, needsHealing } from '../run/heal';
import { trainerRoster, type RosterEntry } from '../run/roster';
import { markTrainerDefeated, type RunState } from '../run/state';
import { nodeKey, nodeOf, type RegionNode, type RegionPlan } from './plan';

/**
 * The League's five fights as one rule (`docs/region-spec.md` §7.6): the four
 * Elite Four members and the Champion, in `src/data/league.ts`'s order, each
 * fought once and in order, with a full heal between two of them and the way out
 * that only opens once the Champion has fallen.
 *
 * Pure and total: no Phaser, no DOM, no clock. The only draw is the roster of the
 * row being asked for, off its own stream on the run seed (`D11`), so a replay
 * fields the same five teams and a sixth row could never move the first five
 * (`D60`).
 */

/** One League fight, resolved to the roster it fields. */
export type LeagueFoe = Readonly<{
  /** 1..5, the row's own index. */
  index: number;
  row: LeagueRow;
  roster: readonly RosterEntry[];
}>;

/** What a beaten row folds into the run (`resolveBattle`'s reward). */
export type LeagueReward = Readonly<{
  enemyLevels: readonly number[];
  isTrainer: true;
  trainerId: string;
  money: number;
}>;

/** The League node: the plan holds exactly one, `league:1`. */
const LEAGUE_NODE_KEY = nodeKey('league', 1);

/** Every row's id, in order, built once: the ids never change. */
const LEAGUE_IDS: readonly string[] = LEAGUE.map((row) => leagueTrainerId(row.index));

/** The trainer id a League row is remembered by: `league:<index>`. */
export function leagueTrainerId(index: number): string {
  return `league:${index}`;
}

/** Every row's `leagueTrainerId`, in order. */
export function leagueIds(): readonly string[] {
  return LEAGUE_IDS;
}

/** The row at a 1-based `index`, clamped into the five: an engine never throws. */
function leagueRow(index: number): LeagueRow {
  const found = LEAGUE.find((row) => row.index === index);
  if (found !== undefined) return found;
  const position = Number.isFinite(index) ? Math.floor(index) : 1;
  return LEAGUE[Math.min(LEAGUE.length, Math.max(1, position)) - 1];
}

/**
 * The band a League roster draws its species from: the League node's own cap, or
 * `LEAGUE_LEVEL` when the plan has no `league` node (a plan is a spec bug, not a
 * reason to throw). Both roads lead to the last band, because the League's cap
 * **is** `LEAGUE_LEVEL`.
 */
function leagueBand(node?: RegionNode): LevelBand {
  return bandForLevel(node?.cap ?? LEAGUE_LEVEL);
}

/** How many rows the run has beaten, 0..5 (a prefix: a later win never completes an earlier one). */
export function leagueProgress(run: RunState): number {
  let beaten = 0;
  for (const id of LEAGUE_IDS) {
    if (!run.defeatedTrainers.includes(id)) break;
    beaten += 1;
  }
  return beaten;
}

/** The next unbeaten row's index (1..5), or null once the Champion has fallen. */
export function leagueNext(run: RunState): number | null {
  const beaten = leagueProgress(run);
  return beaten >= LEAGUE_IDS.length ? null : beaten + 1;
}

/** True once every row is beaten. */
export function leagueCleared(run: RunState): boolean {
  return leagueProgress(run) >= LEAGUE_IDS.length;
}

/**
 * The fight at 1-based `index`: its roster at its own level, off the run's seed.
 * `plan` is read for the League node alone (its cap names the band); the roster's
 * level is the row's own `LEAGUE_LEVEL`, never a band draw.
 */
export function leagueFoe(plan: RegionPlan, run: RunState, index: number): LeagueFoe {
  const row = leagueRow(index);
  const rng = new Rng(hashSeed(`${run.seed}:league:${row.index}`));
  const roster = trainerRoster(
    leagueBand(nodeOf(plan, LEAGUE_NODE_KEY)),
    rng,
    leagueTrainerId(row.index),
    { count: row.partySize, levelFor: () => row.level },
  );
  return { index: row.index, row, roster };
}

/** The entry heal: `healParty`, never a revival, and a no-op when nothing is missing. */
export function leagueEnter(run: RunState): RunState {
  return needsHealing(run) ? healParty(run) : run;
}

/** Marks row `index` beaten; idempotent and never out of order. */
export function leagueWin(run: RunState, index: number): RunState {
  if (leagueNext(run) !== index) return run;
  return markTrainerDefeated(run, leagueTrainerId(index));
}

/**
 * The expected value of `trainerMoney`'s roll — the archetype's base plus half of
 * its jitter, at the League band's scale — so a row pays without spending a draw
 * outside its roster stream (`D11`, `D33`).
 */
function leagueMoney(archetypeId: string, band: LevelBand): number {
  const archetype = getTrainerArchetype(archetypeId);
  const scale = TRAINER_MONEY_BAND_SCALE[band.id];
  if (archetype === undefined) return Math.max(1, Math.round(band.maxLevel * scale));
  return Math.max(1, Math.round((archetype.money.base + archetype.money.jitter / 2) * scale));
}

/** The reward a beaten row folds into the run: its roster's levels, the trainer mark and its money. */
export function leagueReward(foe: LeagueFoe): LeagueReward {
  return {
    enemyLevels: foe.roster.map((entry) => entry.level),
    isTrainer: true,
    trainerId: leagueTrainerId(foe.index),
    money: leagueMoney(foe.row.archetypeId, leagueBand()),
  };
}
