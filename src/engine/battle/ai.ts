import { getMove, type Move } from '../../data/dex';
import type { AiFlag } from '../../data/trainers';
import { estimateDamage } from './damage';
import { legalMoveIndices, selectedMove, withLeadSlot, type Command, type FightCommand } from './commands';
import { canGigantamax } from './gmax';
import { canMegaEvolve } from './mega';
import {
  activeFighter,
  isTrapped,
  liveSlots,
  opponent,
  opponentOf,
  slotActiveIndex,
  type BattleState,
  type SideId,
  type Slot,
} from './state';
import { STATUS_IDS, canApplyStatus } from './status';
import { BOOST_IDS, type BattleFighter, type StatusId } from './fighter';

/** The difficulty the run's settings select (D46). */
export type AiLevel = 'normal' | 'hard';

export interface AiOptions {
  /** Default `'normal'`. */
  readonly level?: AiLevel;
  /** The archetype's own flags (`TrainerArchetype.aiFlags`). Default `[]`. */
  readonly flags?: readonly AiFlag[];
  /** Which enemy active is choosing. Default 0. */
  readonly slot?: Slot;
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
    if (flags.has('risky') && (move.selfdestruct !== undefined || move.recoil !== undefined))
      score += 60;
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

/** The first healthy party member that is not already on the field, or -1. */
function bestReserve(state: BattleState, side: SideId): number {
  const battleSide = state.sides[side];
  const active = liveSlots(state, side).map((slot) => slotActiveIndex(state, side, slot));
  const foe = opponent(state, side);
  let bestIndex = -1;
  let bestScore = -1;
  battleSide.party.forEach((fighter, index) => {
    if (active.includes(index) || fighter.hp <= 0) return;
    const score = bestOffense(fighter, foe) + fighter.hp;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

const SPREAD_TARGETS: ReadonlySet<string> = new Set(['allAdjacentFoes', 'allAdjacent', 'all']);

/**
 * Enemy AI: the cartridge's script flags, read as data off the archetype, scored
 * as expected value over the legal moves. A wild Pokémon at the default level
 * picks a random move that has PP left instead, exactly as the games do, so a
 * wild never out-thinks an Ace. The highest score wins; at `hard` an exact tie is
 * drawn from the battle's own `Rng`, at `normal` the lowest index wins it. In a
 * double battle every legal `(move, target)` pair is scored over the live foe
 * slots and a spread move is scored once, with no target. It reads nothing but
 * legal state, so it never sees hidden information.
 */
export function chooseAiCommand(
  state: BattleState,
  side: SideId,
  options: AiOptions = {},
): Command {
  const level = options.level ?? 'normal';
  const flags = new Set<AiFlag>(options.flags ?? []);
  if (level === 'hard') for (const flag of HARD_MODE_FLAGS) flags.add(flag);
  const wildPolicy = level === 'normal' && state.isWild && side === 'enemy';

  const battleSide = state.sides[side];
  // A slot the battle does not field falls back to the lead: the caller asked for
  // a partner in a single battle.
  const slot: Slot =
    options.slot === 1 && battleSide.secondActiveIndex >= 0 ? 1 : 0;
  const foeSide = opponentOf(side);
  const foeSlots = liveSlots(state, foeSide).filter(
    (s) => activeFighter(state, foeSide, s).hp > 0,
  );

  const tag = <T extends Command>(command: T): Command =>
    slot === 1 ? ({ ...command, slot } as Command) : command;

  if (battleSide.awaitingReplacement || activeFighter(state, side, slot).hp <= 0) {
    return tag({ type: 'switch', partyIndex: Math.max(0, bestReserve(state, side)) });
  }

  const attacker = activeFighter(state, side, slot);
  const defender = opponent(state, side);
  // The AI spends its Mega Stone and its Gigantamax at the first opportunity it
  // can act, exactly as it spends the stone (D34, D44). Both are global: a battle
  // holds one of each, so the partner slot never arms them.
  const mega = withLeadSlot(state, side, slot, () => canMegaEvolve(state, side));
  const gmax = mega ? false : withLeadSlot(state, side, slot, () => canGigantamax(state, side));
  const arm = (command: FightCommand): Command => {
    if (mega) return { ...command, mega: true };
    if (gmax) return { ...command, gmax: true };
    return command;
  };
  const commanded = (moveIndex: number, target?: Slot): Command =>
    arm({
      type: 'fight',
      moveIndex,
      ...(slot === 1 ? { slot } : {}),
      ...(state.double && target !== undefined ? { target: { side: foeSide, slot: target } } : {}),
    });

  if (wildPolicy) {
    const legal = legalMoveIndices(attacker);
    if (legal.length === 0) return commanded(0);
    const pick = legal[state.rng.int(0, legal.length - 1)];
    return commanded(pick, foeSlots[0]);
  }

  // Perish Song is about to kill the active Pokémon: leave while it still can.
  if (attacker.volatiles.perish === 1) {
    const reserve = bestReserve(state, side);
    if (reserve >= 0 && !isTrapped(state, side)) {
      return tag({ type: 'switch', partyIndex: reserve });
    }
  }

  const legal = legalMoveIndices(attacker);
  if (legal.length === 0) return commanded(0);

  let best = Number.NEGATIVE_INFINITY;
  let tied: { index: number; target?: Slot }[] = [];

  if (state.double) {
    const pairs: { index: number; target?: Slot; score: number }[] = [];
    for (const index of legal) {
      const selected = selectedMove(attacker, { type: 'fight', moveIndex: index });
      if (!selected) continue;
      if (SPREAD_TARGETS.has(selected.move.target)) {
        const first = foeSlots[0];
        const foe = first === undefined ? defender : activeFighter(state, foeSide, first);
        pairs.push({ index, score: moveScore(state, attacker, foe, index, flags) });
        continue;
      }
      for (const foeSlot of foeSlots) {
        pairs.push({
          index,
          target: foeSlot,
          score: moveScore(state, attacker, activeFighter(state, foeSide, foeSlot), index, flags),
        });
      }
    }
    for (const pair of pairs) {
      if (pair.score > best) best = pair.score;
    }
    tied = pairs.filter((pair) => pair.score === best);
    if (tied.length === 0) return commanded(0);
  } else {
    const scores = new Map<number, number>();
    for (const index of legal) {
      const score = moveScore(state, attacker, defender, index, flags);
      scores.set(index, score);
      if (score > best) best = score;
    }
    tied = legal.filter((index) => scores.get(index) === best).map((index) => ({ index }));
  }

  if (best <= 0) {
    const reserve = bestReserve(state, side);
    if (
      reserve >= 0 &&
      !isTrapped(state, side) &&
      bestOffense(state.sides[side].party[reserve], defender) > 0
    ) {
      return tag({ type: 'switch', partyIndex: reserve });
    }
  }

  const chosen = level === 'hard' ? tied[state.rng.int(0, tied.length - 1)] : tied[0];
  return commanded(chosen.index, chosen.target);
}
