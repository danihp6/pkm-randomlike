import { getMove, type Move } from '../../data/dex';
import type { AiFlag } from '../../data/trainers';
import { estimateDamage } from './damage';
import { legalMoveIndices, selectedMove, type Command } from './commands';
import { canGigantamax } from './gmax';
import { canMegaEvolve } from './mega';
import { activeFighter, isTrapped, opponent, type BattleState, type SideId } from './state';
import { STATUS_IDS, canApplyStatus } from './status';
import { BOOST_IDS, type BattleFighter, type StatusId } from './fighter';

/** The difficulty the run's settings select (D46). */
export type AiLevel = 'normal' | 'hard';

export interface AiOptions {
  /** Default `'normal'`. */
  readonly level?: AiLevel;
  /** The archetype's own flags (`TrainerArchetype.aiFlags`). Default `[]`. */
  readonly flags?: readonly AiFlag[];
}

/** What the cartridge's Hard Mode is, exactly: the trio added at `hard`. */
export const HARD_MODE_FLAGS: readonly AiFlag[] = ['checkBadMove', 'tryToFaint', 'checkViability'];

function isStatusId(value: string | undefined): value is StatusId {
  return value !== undefined && (STATUS_IDS as readonly string[]).includes(value);
}

function bestOffense(attacker: BattleFighter, defender: BattleFighter): number {
  let best = 0;
  for (const slot of attacker.moves) {
    if (slot.pp <= 0) continue;
    const move = getMove(slot.moveId);
    if (!move || move.category === 'Status') continue;
    const estimate = estimateDamage(attacker, defender, move);
    if (estimate.effectiveness === 0) continue;
    best = Math.max(best, estimate.damage);
  }
  return best;
}

/** A move that raises the user's stats (self-target) or lowers the foe's. */
function isFavourableBoost(move: Move): boolean {
  if (!move.boosts) return false;
  const boosts = Object.values(move.boosts);
  return move.target === 'self' ? boosts.some((value) => value > 0) : boosts.some((value) => value < 0);
}

function hasPositiveStage(fighter: BattleFighter): boolean {
  return BOOST_IDS.some((stat) => fighter.boosts[stat] > 0);
}

/**
 * The cartridge's *check bad move*: whether the move could do anything at all
 * right now. A damage move the foe is immune to, a status it already carries, a
 * heal at full HP and a boost already at its cap are all refused.
 */
function canDoSomething(attacker: BattleFighter, defender: BattleFighter, move: Move): boolean {
  if (move.category !== 'Status') return estimateDamage(attacker, defender, move).effectiveness > 0;
  if (move.status !== undefined) return isStatusId(move.status) && canApplyStatus(defender, move.status);
  if (move.heal !== undefined) return attacker.hp < attacker.maxHp;
  if (move.boosts !== undefined) {
    const selfTarget = move.target === 'self';
    for (const stat of BOOST_IDS) {
      const delta = move.boosts[stat];
      if (delta === undefined) continue;
      if (selfTarget) {
        if (delta > 0 && attacker.boosts[stat] < 6) return true;
      } else if (delta < 0 && defender.boosts[stat] > -6) {
        return true;
      }
    }
    return false;
  }
  return true;
}

/** The expected value of one legal move under the given flag set. */
function moveScore(
  state: BattleState,
  attacker: BattleFighter,
  defender: BattleFighter,
  index: number,
  flags: ReadonlySet<AiFlag>,
): number {
  const selected = selectedMove(attacker, { type: 'fight', moveIndex: index });
  if (!selected) return -1;
  const { move } = selected;
  const accuracy = move.accuracy === true ? 1 : move.accuracy / 100;

  if (flags.has('checkBadMove') && !canDoSomething(attacker, defender, move)) return 0;

  if (move.category !== 'Status') {
    const estimate = estimateDamage(attacker, defender, move);
    if (estimate.effectiveness === 0) return 0;
    let score = estimate.damage * accuracy;
    if (flags.has('tryToFaint') && estimate.damage >= defender.hp) score += 1000;
    if (flags.has('risky') && (move.selfdestruct !== undefined || move.recoil !== undefined)) score += 60;
    if (flags.has('preferBatonPass') && move.selfSwitch !== undefined && hasPositiveStage(attacker)) {
      score += 60;
    }
    return score;
  }

  let score = 0;
  if (flags.has('checkViability')) {
    if (move.status !== undefined && isStatusId(move.status) && canApplyStatus(defender, move.status)) {
      score = Math.max(score, 60 * accuracy);
    }
    if (move.boosts !== undefined && isFavourableBoost(move)) score = Math.max(score, 40 * accuracy);
    if (move.heal !== undefined && attacker.hp * 4 <= attacker.maxHp) {
      score = Math.max(score, 50 * accuracy);
    }
    if (move.volatileStatus !== undefined) score = Math.max(score, 25 * accuracy);
  }
  if (
    flags.has('setupFirstTurn') &&
    state.turn === 0 &&
    move.target === 'self' &&
    isFavourableBoost(move)
  ) {
    score += 80;
  }
  if (flags.has('preferBatonPass') && move.selfSwitch !== undefined && hasPositiveStage(attacker)) {
    score = Math.max(score, 60);
  }
  return score;
}

function bestReserve(state: BattleState, side: SideId): number {
  const battleSide = state.sides[side];
  const foe = opponent(state, side);
  let bestIndex = -1;
  let bestScore = -1;
  battleSide.party.forEach((fighter, index) => {
    if (index === battleSide.activeIndex || fighter.hp <= 0) return;
    const score = bestOffense(fighter, foe) + fighter.hp;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/**
 * Enemy AI: the cartridge's script flags, read as data off the archetype, scored
 * as expected value over the legal moves. A wild Pokémon at the default level
 * picks a random move that has PP left instead, exactly as the games do, so a
 * wild never out-thinks an Ace. The highest score wins; at `hard` an exact tie is
 * drawn from the battle's own `Rng`, at `normal` the lowest index wins it. It
 * reads nothing but legal state, so it never sees hidden information.
 */
export function chooseAiCommand(state: BattleState, side: SideId, options: AiOptions = {}): Command {
  const level = options.level ?? 'normal';
  const flags = new Set<AiFlag>(options.flags ?? []);
  if (level === 'hard') for (const flag of HARD_MODE_FLAGS) flags.add(flag);
  const wildPolicy = level === 'normal' && state.isWild && side === 'enemy';

  if (state.sides[side].awaitingReplacement) {
    return { type: 'switch', partyIndex: Math.max(0, bestReserve(state, side)) };
  }

  const attacker = activeFighter(state, side);
  const defender = opponent(state, side);
  // The AI spends its Mega Stone and its Gigantamax at the first opportunity it
  // can act, exactly as it spends the stone (D34, D44). A holder can have both
  // available; a Mega resolves first (`turn.ts`), so it is the only one the
  // command arms.
  const mega = canMegaEvolve(state, side);
  const gmax = canGigantamax(state, side);
  const fight = (moveIndex: number): Command => {
    if (mega) return { type: 'fight', moveIndex, mega: true };
    if (gmax) return { type: 'fight', moveIndex, gmax: true };
    return { type: 'fight', moveIndex };
  };

  if (wildPolicy) {
    const legal = legalMoveIndices(attacker);
    if (legal.length === 0) return fight(0);
    return fight(legal[state.rng.int(0, legal.length - 1)]);
  }

  // Perish Song is about to kill the active Pokémon: leave while it still can.
  if (attacker.volatiles.perish === 1) {
    const reserve = bestReserve(state, side);
    if (reserve >= 0 && !isTrapped(state, side)) return { type: 'switch', partyIndex: reserve };
  }

  const legal = legalMoveIndices(attacker);
  if (legal.length === 0) return fight(0);

  const scores = new Map<number, number>();
  let best = Number.NEGATIVE_INFINITY;
  for (const index of legal) {
    const score = moveScore(state, attacker, defender, index, flags);
    scores.set(index, score);
    if (score > best) best = score;
  }

  if (best <= 0) {
    const reserve = bestReserve(state, side);
    if (
      reserve >= 0 &&
      !isTrapped(state, side) &&
      bestOffense(state.sides[side].party[reserve], defender) > 0
    ) {
      return { type: 'switch', partyIndex: reserve };
    }
  }

  const tied = legal.filter((index) => scores.get(index) === best);
  const chosen = level === 'hard' ? tied[state.rng.int(0, tied.length - 1)] : tied[0];
  return fight(chosen);
}
