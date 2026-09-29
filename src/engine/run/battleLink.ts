import type { FighterSnapshot } from '../battle/fighter';
import { hashSeed } from '../rng';

/** A bag stack in run terms: the scene resolves the item id through `getItem`. */
export type BagCounts = Readonly<{ itemId: string; count: number }>;

export type WildTrigger = Readonly<{
  kind: 'wild';
  speciesId: string;
  level: number;
  /** Where the encounter happened, for the message and the battle seed. */
  key: string;
}>;

export type TrainerTrigger = Readonly<{
  kind: 'trainer';
  trainerId: string;
  trainerName: string;
  roster: readonly Readonly<{ id: string; speciesId: string; level: number }>[];
}>;

export type BattleTrigger = WildTrigger | TrainerTrigger;

/**
 * What the route hands the battle scene: the run-persistent party and bag, the
 * opponent, and the seed. The battle scene never rolls outside this seed, so
 * the same route inputs always replay the same battle (D11).
 */
export type BattleLaunch = Readonly<{
  trigger: BattleTrigger;
  player: readonly FighterSnapshot[];
  bag: readonly BagCounts[];
  seed: number;
  /** False once the route's single capture has been spent. */
  canCapture: boolean;
}>;

export type BattleOutcome = 'win' | 'lose' | 'run' | 'capture';

/** What the battle hands back: the party and bag as they stand afterwards. */
export type BattleReturn = Readonly<{
  outcome: BattleOutcome;
  message: string;
  player: readonly FighterSnapshot[];
  bag: readonly BagCounts[];
  captured: FighterSnapshot | null;
}>;

/** One battle's Rng seed, derived from the run seed, route and entity key. */
export function battleSeed(runSeed: string, routeIndex: number, key: string): number {
  return hashSeed(`${runSeed}:battle:${routeIndex}:${key}`);
}
