import type { BattleReturn } from './battleLink';
import { releaseFainted } from './perms';
import {
  addExperience,
  experienceAward,
  runPokemonFromSnapshot,
  type ProgressionEvent,
  type RunPokemon,
} from './progression';
import { addPokemon, markTrainerDefeated, useCapture, type RunState } from './state';

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
 * Folds a finished battle back into the run: adopts the bag, enforces permanence
 * (fallen members leave party and box), places a catch and spends the route's
 * capture, marks a beaten trainer and awards XP to the survivors. Pure, so a
 * replay yields the same run (D11).
 */
export function resolveBattle(
  run: RunState,
  result: BattleReturn,
  reward: BattleReward,
): BattleResolution {
  let next: RunState = { ...run, bag: [...result.bag] };

  const death = releaseFainted(next);
  next = death.run;

  if (result.captured) {
    next = useCapture(addPokemon(next, runPokemonFromSnapshot(result.captured)));
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
        const grown = addExperience(member, amount, next.routeIndex);
        events.push(...grown.events);
        return grown.pokemon;
      }),
    };
  }

  return { run: next, released: death.released, events };
}
