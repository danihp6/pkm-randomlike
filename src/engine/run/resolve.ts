import { trainerXpMultiplierForMap } from '../../data/run';
import type { TrainerItemReward } from '../../data/trainers';
import type { FighterSnapshot } from '../battle/fighter';
import type { BattleReturn } from './battleLink';
import { chargePokevial } from './heal';
import { releaseFainted } from './perms';
import {
  adoptAtLevel,
  experienceAward,
  runPokemonFromSnapshot,
  type CatchLocation,
  type ProgressionEvent,
  type RunPokemon,
} from './progression';
import {
  addCaughtPokemon,
  addItem,
  addMoney,
  gainExperience,
  isTrainerDefeated,
  markTrainerDefeated,
  nextMemberId,
  recordCatch,
  squadLevel,
  useCapture,
  type RunState,
} from './state';

export type BattleReward = Readonly<{
  /** Levels of the defeated side, for the XP award. */
  enemyLevels: readonly number[];
  isTrainer: boolean;
  /** Set for a trainer battle, so a win marks the trainer beaten. */
  trainerId?: string;
  /** Poké Dollars a trainer win drops, already rolled from its archetype/band (D33). */
  money?: number;
  /** The archetype's item row: one bag stack, paid with the first win (Task-99). */
  item?: TrainerItemReward;
}>;

export type BattleResolution = Readonly<{
  run: RunState;
  released: readonly RunPokemon[];
  events: readonly ProgressionEvent[];
  /**
   * The catch this battle placed, and where it landed: `toPc` is true when the
   * party was full and the member went to the box. Null when nothing was caught.
   */
  capture: Readonly<{ member: RunPokemon; toPc: boolean }> | null;
}>;

/** Options for folding a battle back into the run. */
export type ResolveBattleOptions = Readonly<{
  /** The biome and room the catch happened in, stored on the member's STATS tab. */
  catchLocation?: CatchLocation;
}>;

/**
 * Folds a finished battle back into the run: adopts the party and bag as the
 * battle left them (HP, PP, status), enforces permanence (fallen members leave
 * party and box), awards the squad's shared XP, places a catch at the squad's
 * level and spends the route's capture, and marks a beaten trainer. Pure, so a
 * replay yields the same run (D11).
 */
export function resolveBattle(
  run: RunState,
  result: BattleReturn,
  reward: BattleReward,
  options?: ResolveBattleOptions,
): BattleResolution {
  let next: RunState = adoptBattleParty(run, result.player);
  next = { ...next, bag: [...result.bag] };
  next = withBattleUsage(next, result.used);

  const death = releaseFainted(next);
  next = death.run;

  const events: ProgressionEvent[] = [];
  const won = result.outcome === 'win' || result.outcome === 'capture';
  if (won && next.party.length > 0 && reward.enemyLevels.length > 0) {
    // The squad shares one bar, so the award is not split by party size.
    const amount = reward.enemyLevels.reduce(
      (total, level) =>
        total + experienceAward(level, 1, reward.isTrainer, trainerXpMultiplierForMap(next.mapIndex)),
      0,
    );
    const grown = gainExperience(next, amount, next.seed);
    next = grown.run;
    events.push(...grown.events);
  }

  let capture: BattleResolution['capture'] = null;
  if (result.captured) {
    const base = runPokemonFromSnapshot(result.captured, options?.catchLocation);
    const keyed: RunPokemon = { ...base, fighter: { ...base.fighter, id: nextMemberId(next) } };
    const caught = adoptAtLevel(keyed, squadLevel(next), next.seed);
    const placed = addCaughtPokemon(next, caught);
    // Read the placement back off the run, so it cannot disagree with `pcCatch`.
    capture = {
      member: caught,
      toPc: placed.box.some((member) => member.fighter.id === caught.fighter.id),
    };
    next = placed;
    next = useCapture(next);
    next = recordCatch(next, result.captured.speciesId);
  }

  if (reward.isTrainer && reward.trainerId !== undefined && result.outcome === 'win') {
    // A beaten trainer tops the Pokevial up by one charge and drops its money.
    // Only a first win counts, so a replay or an already-marked trainer never
    // doubles either.
    const firstWin = !isTrainerDefeated(next, reward.trainerId);
    if (firstWin) {
      next = chargePokevial(next);
      if (reward.money !== undefined) next = addMoney(next, reward.money);
      if (reward.item !== undefined) next = addItem(next, reward.item.itemId, reward.item.count);
    }
    next = markTrainerDefeated(next, reward.trainerId);
  }

  return { run: next, released: death.released, events, capture };
}

/**
 * Swaps the run's party snapshots for the ones the battle returned, matching by
 * member id, so the HP, PP and status the battle left persist into the route
 * (and permadeath sees a 0-HP member). XP lives on the run member, not the
 * snapshot, so it survives the swap; a member the battle did not report (or the
 * box, which never fights) is left untouched.
 */
export function adoptBattleParty(run: RunState, player: readonly FighterSnapshot[]): RunState {
  const returned = new Map(player.map((fighter) => [fighter.id, fighter]));
  return {
    ...run,
    party: run.party.map((member) => {
      const fighter = returned.get(member.fighter.id);
      return fighter ? { ...member, fighter } : member;
    }),
  };
}

/**
 * Bumps the per-member usage counter of every party member the battle fielded
 * (Task-101): `used` lists the ids the battle actually sent out, and an absent
 * list counts the whole returned party (a battle that did not report its sends).
 * The box is never counted — only a party member can take the field — and every
 * member that did not fight comes back as the same object.
 */
function withBattleUsage(run: RunState, used: readonly string[] | undefined): RunState {
  const counted = used ? new Set(used) : null;
  return {
    ...run,
    party: run.party.map((member) => {
      if (counted && !counted.has(member.fighter.id)) return member;
      return { ...member, battlesUsed: (member.battlesUsed ?? 0) + 1 };
    }),
  };
}
