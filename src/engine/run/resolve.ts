import type { FighterSnapshot } from '../battle/fighter';
import type { BattleReturn } from './battleLink';
import { releaseFainted } from './perms';
import {
  addExperience,
  experienceAward,
  runPokemonFromSnapshot,
  type ProgressionEvent,
  type RunPokemon,
} from './progression';
import { addPokemon, markTrainerDefeated, recordCatch, useCapture, type RunState } from './state';

export type BattleReward = Readonly<{
  /** Levels of the defeated side, for the XP award. */
  enemyLevels: readonly number[];
  isTrainer: boolean;
  /** Set for a trainer battle, so a win marks the trainer beaten. */
  trainerId?: string;
}>;

export type BattleResolution = Readonly<{
  run: RunState;
  released: readonly RunPokemon[];
  events: readonly ProgressionEvent[];
}>;

/**
 * Folds a finished battle back into the run: adopts the party and bag as the
 * battle left them (HP, PP, status), enforces permanence (fallen members leave
 * party and box), places a catch and spends the route's capture, marks a beaten
 * trainer and awards XP to the survivors. Pure, so a replay yields the same run
 * (D11).
 */
export function resolveBattle(
  run: RunState,
  result: BattleReturn,
  reward: BattleReward,
): BattleResolution {
  let next: RunState = adoptBattleParty(run, result.player);
  next = { ...next, bag: [...result.bag] };

  const death = releaseFainted(next);
  next = death.run;

  if (result.captured) {
    next = addPokemon(next, runPokemonFromSnapshot(result.captured));
    next = useCapture(next);
    next = recordCatch(next);
  }

  if (reward.isTrainer && reward.trainerId !== undefined && result.outcome === 'win') {
    next = markTrainerDefeated(next, reward.trainerId);
  }

  const events: ProgressionEvent[] = [];
  const won = result.outcome === 'win' || result.outcome === 'capture';
  if (won && next.party.length > 0 && reward.enemyLevels.length > 0) {
    // The battle does not yet report which members took part, so the award is
    // split across the whole surviving party (docs/battle-spec.md §7).
    const participants = next.party.length;
    const amount = reward.enemyLevels.reduce(
      (total, level) => total + experienceAward(level, participants, reward.isTrainer),
      0,
    );
    next = {
      ...next,
      party: next.party.map((member) => {
        const grown = addExperience(member, amount, next.levelCap, next.seed);
        events.push(...grown.events);
        return grown.pokemon;
      }),
    };
  }

  return { run: next, released: death.released, events };
}

/**
 * Swaps the run's party snapshots for the ones the battle returned, matching by
 * member id, so the HP, PP and status the battle left persist into the route
 * (and permadeath sees a 0-HP member). XP lives on the run member, not the
 * snapshot, so it survives the swap; a member the battle did not report (or the
 * box, which never fights) is left untouched.
 */
export function adoptBattleParty(
  run: RunState,
  player: readonly FighterSnapshot[],
): RunState {
  const returned = new Map(player.map((fighter) => [fighter.id, fighter]));
  return {
    ...run,
    party: run.party.map((member) => {
      const fighter = returned.get(member.fighter.id);
      return fighter ? { ...member, fighter } : member;
    }),
  };
}
