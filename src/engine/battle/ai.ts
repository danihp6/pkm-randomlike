import { getMove } from '../../data/dex';
import { estimateDamage } from './damage';
import { legalMoveIndices, selectedMove, type Command } from './commands';
import { activeFighter, opponent, type BattleState, type SideId } from './state';
import { STATUS_IDS, canApplyStatus } from './status';
import type { BattleFighter, StatusId } from './fighter';

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

function moveScore(attacker: BattleFighter, defender: BattleFighter, index: number): number {
  const selected = selectedMove(attacker, { type: 'fight', moveIndex: index });
  if (!selected) return -1;
  const { move } = selected;
  const accuracy = move.accuracy === true ? 1 : move.accuracy / 100;

  if (move.category !== 'Status') {
    const estimate = estimateDamage(attacker, defender, move);
    if (estimate.effectiveness === 0) return 0;
    let score = estimate.damage * accuracy;
    if (estimate.damage >= defender.hp) score += 1000;
    return score;
  }

  if (isStatusId(move.status) && canApplyStatus(defender, move.status)) return 60 * accuracy;
  if (move.boosts) {
    const selfTarget = move.target === 'self';
    const boosts = Object.values(move.boosts);
    const favourable = selfTarget ? boosts.some((v) => v > 0) : boosts.some((v) => v < 0);
    if (favourable) return 40 * accuracy;
  }
  if (move.heal && attacker.hp < attacker.maxHp) return 50 * accuracy;
  if (move.volatileStatus) return 25 * accuracy;
  return 0;
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
 * Trainer AI: expected value over legal moves, switching only when the active
 * Pokémon cannot hurt the foe and a reserve can. It reads nothing but legal
 * state, so it never sees hidden information.
 */
export function chooseAiCommand(state: BattleState, side: SideId): Command {
  if (state.sides[side].awaitingReplacement) {
    return { type: 'switch', partyIndex: Math.max(0, bestReserve(state, side)) };
  }

  const attacker = activeFighter(state, side);
  const defender = opponent(state, side);
  const legal = legalMoveIndices(attacker);
  if (legal.length === 0) return { type: 'fight', moveIndex: 0 };

  const scores = new Map<number, number>();
  for (const index of legal) scores.set(index, moveScore(attacker, defender, index));
  const bestScore = Math.max(...scores.values());

  if (bestScore <= 0) {
    const reserve = bestReserve(state, side);
    if (reserve >= 0 && bestOffense(state.sides[side].party[reserve], defender) > 0) {
      return { type: 'switch', partyIndex: reserve };
    }
  }

  let bestIndex = legal[0];
  for (const index of legal) {
    if ((scores.get(index) ?? 0) > (scores.get(bestIndex) ?? 0)) bestIndex = index;
  }
  return { type: 'fight', moveIndex: bestIndex };
}
