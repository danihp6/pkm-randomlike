import type { RoomBattlefield } from '../../data/battlefields';
import type { AiLevel } from '../battle/ai';
import type { BoostId, FighterSnapshot } from '../battle/fighter';
import type { BattleEvent } from '../battle/state';
import { hashSeed } from '../rng';

/** A bag stack in run terms: the scene resolves the item id through `getItem`. */
export type BagCounts = Readonly<{ itemId: string; count: number }>;

export type WildTrigger = Readonly<{
  kind: 'wild';
  speciesId: string;
  level: number;
  /** The wild roll came up shiny, so the battle draws the alternate palette. */
  shiny?: boolean;
  /** Where the encounter happened, for the message and the battle seed. */
  key: string;
  /** The grass patch tile, so the battle backdrop can pick a floor (Phase 8). */
  tile?: Readonly<{ x: number; y: number }>;
}>;

/** One member of a trainer's roster as the battle builds it. */
export type TrainerRosterEntry = Readonly<{
  id: string;
  speciesId: string;
  level: number;
  /** A held item the member starts with (a Mega Stone, D34). */
  heldItem?: string;
  /**
   * The ability name the member starts with, bypassing the run's `randomAbility` roll
   * (`createFighter` trusts a provided `ability`). Absent means the roll applies.
   */
  ability?: string;
}>;

export type TrainerTrigger = Readonly<{
  kind: 'trainer';
  trainerId: string;
  trainerName: string;
  roster: readonly TrainerRosterEntry[];
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
  /** The squad's shared XP, so the battle can draw the general bar before any award. */
  xp: number;
  seed: number;
  /** The run's seed and route, for art the battle resolves through the route. */
  runSeed: string;
  routeIndex: number;
  /** False once the route's single capture has been spent. */
  canCapture: boolean;
  /** The run has caught nothing yet, so its next capture is certain (Task-48). */
  firstCatch: boolean;
  /** The difficulty the battle's AI thinks at, read from the settings at launch (D46). */
  aiLevel: AiLevel;
  /** The condition the battle's room rolled, or null/absent when the room rolled none. */
  battlefield?: RoomBattlefield | null;
  /** The room bars the player's Bag and healing moves (the no-heal leaf, `docs/maps-spec.md` §7). */
  noHeal?: boolean;
  /** The wild cannot be fled (the berry tree's guardian), unless an escape effect grants it. */
  noFlee?: boolean;
  /** The exorcist's curse: the enemy lead starts one Attack stage down. */
  enemyBoosts?: Partial<Record<BoostId, number>>;
  /** The run's most-used species the room bars, or null/absent (Task-101). */
  bannedSpecies?: string | null;
  /**
   * The boss's fight fields **two actives per side** (`[Task-107]`'s engine rule,
   * `[Task-108]`'s screen). Absent or `false` is every other battle: one active,
   * the shipped layout and the shipped command flow. Default `false`.
   */
  double?: boolean;
  /**
   * The player's living party's repeated types (at least two living members each),
   * computed by the route through `livingTeamTypes`. Absent means none.
   */
  teamTypes?: readonly string[];
}>;

export type BattleOutcome = 'win' | 'lose' | 'run' | 'capture';

/** One member's contribution to the battle that just ended. */
export type MemberTally = Readonly<{
  /** The player member's `FighterSnapshot.id` — the same id the run's members carry. */
  memberId: string;
  /** Enemies this member fainted. */
  kos: number;
  /** Damage this member dealt. */
  damage: number;
  /** Damage this member took. */
  damageTaken: number;
}>;

/** What the battle hands back: the party and bag as they stand afterwards. */
export type BattleReturn = Readonly<{
  outcome: BattleOutcome;
  message: string;
  player: readonly FighterSnapshot[];
  bag: readonly BagCounts[];
  captured: FighterSnapshot | null;
  /**
   * The ids the battle fielded for the player (`BattleState.usedFighterIds`).
   * Absent means the battle did not report them and the fold counts every
   * member the returned party carries.
   */
  used?: readonly string[];
  /** The player's side only; absent means the battle reported no tallies. */
  tallies?: readonly MemberTally[];
}>;

/** One battle's Rng seed, derived from the run seed, route and entity key. */
export function battleSeed(runSeed: string, routeIndex: number, key: string): number {
  return hashSeed(`${runSeed}:battle:${routeIndex}:${key}`);
}

/**
 * The player's per-member tallies, read off the finished battle: the `damage`
 * events of the enemy side are credited to the player fighter that was on the
 * field, an enemy `faint` under that same fighter is a KO, and the player side's
 * own `damage` events are what that fighter took. Total and pure: an empty log
 * returns one entry per player fighter with three zeros.
 *
 * The **fielded** player fighter starts as `playerParty[0]` and changes on every
 * `switch` event whose side is `player`. Reads no RNG and no clock (`D11`), and
 * does not care how the battle ended: a capture and a flee still return the
 * damage that landed.
 */
export function battleTallies(
  log: readonly BattleEvent[],
  playerParty: readonly { id: string }[],
): readonly MemberTally[] {
  const order: string[] = [];
  const totals = new Map<string, { kos: number; damage: number; damageTaken: number }>();
  for (const member of playerParty) {
    if (totals.has(member.id)) continue;
    order.push(member.id);
    totals.set(member.id, { kos: 0, damage: 0, damageTaken: 0 });
  }

  let fielded = order[0] ?? '';
  const onField = (): { kos: number; damage: number; damageTaken: number } | undefined =>
    totals.get(fielded);

  for (const event of log) {
    if (event.kind === 'switch') {
      if (event.side === 'player') fielded = event.fighterId;
      continue;
    }
    if (event.kind === 'damage') {
      const tally = onField();
      if (!tally) continue;
      if (event.side === 'enemy') tally.damage += amountOf(event.amount);
      else if (event.side === 'player') tally.damageTaken += amountOf(event.amount);
      continue;
    }
    if (event.kind === 'faint' && event.side === 'enemy') {
      const tally = onField();
      if (tally) tally.kos += 1;
    }
  }

  return order.map((id) => {
    const tally = totals.get(id)!;
    return { memberId: id, kos: tally.kos, damage: tally.damage, damageTaken: tally.damageTaken };
  });
}

/** A damage figure as a whole number of at least zero; anything unreadable counts as none. */
function amountOf(value: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** The team-type list a launch carries into the battle: absent means none. */
export function launchTeamTypes(launch: Pick<BattleLaunch, 'teamTypes'>): readonly string[] {
  return launch.teamTypes ?? [];
}
