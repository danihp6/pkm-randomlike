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
  /** The grass patch tile, so the battle backdrop can pick a floor (Phase 8). */
  tile?: Readonly<{ x: number; y: number }>;
}>;

export type TrainerTrigger = Readonly<{
  kind: 'trainer';
  trainerId: string;
  trainerName: string;
  roster: readonly Readonly<{ id: string; speciesId: string; level: number }>[];
  /** The archetype whose overworld colour frames the battle, when known. */
  archetypeId?: string;
}>;

export type BattleTrigger = WildTrigger | TrainerTrigger;

/**
 * What the route hands the battle scene: the run-persistent party and bag, the
 * opponent, and the seed. The battle scene never rolls outside this seed, so
 * the same route inputs always replay the same battle (D11). `runSeed` and
 * `routeIndex` are also carried so anything the battle scene needs to draw that
 * lives outside the battle itself (the trainer sprite this battle represents,
 * Phase 8 O1) can be resolved with the same inputs the route used, without the
 * battle taking run state.
 */
export type BattleLaunch = Readonly<{
  trigger: BattleTrigger;
  player: readonly FighterSnapshot[];
  bag: readonly BagCounts[];
  /** XP per party member, so the battle can draw the XP bar before any award. */
  experience: readonly Readonly<{ id: string; xp: number }>[];
  seed: number;
  /** The run's seed and route, for art the battle resolves through the route. */
  runSeed: string;
  routeIndex: number;
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
