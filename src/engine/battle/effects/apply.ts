import {
  BOOST_IDS,
  applyBoosts,
  type BattleFighter,
  type BoostChange,
  type BoostId,
} from '../fighter';
import { applyStatus, canApplyStatus, isStatusId, statusName } from '../status';
import { opponent, pushEvent, pushText, type BattleState, type SideId } from '../state';
import { hasSubstitute } from '../volatile';
import { makeContext, runBoost, runStatus } from './registry';

export function statLabel(stat: BoostId): string {
  const labels: Readonly<Record<BoostId, string>> = {
    atk: 'Attack',
    def: 'Defense',
    spa: 'Sp. Atk',
    spd: 'Sp. Def',
    spe: 'Speed',
    accuracy: 'accuracy',
    evasion: 'evasiveness',
  };
  return labels[stat];
}

export type BoostOptions = Readonly<{ self?: boolean; message?: string }>;

/**
 * Applies stat stages through the `onBoost` hook so guard abilities can veto a
 * drop, then pushes the boost events and one message.
 */
export function applyBoostEffect(
  state: BattleState,
  side: SideId,
  target: BattleFighter,
  boosts: Partial<Record<BoostId, number>>,
  options: BoostOptions = {},
): void {
  const self = options.self ?? false;
  const allowed: Partial<Record<BoostId, number>> = {};
  for (const stat of BOOST_IDS) {
    const stages = boosts[stat];
    if (!stages) continue;
    const ctx = makeContext(state, side, { source: target, target: opponent(state, side) });
    if (!runBoost(ctx, stat, stages, self)) continue;
    allowed[stat] = stages;
  }

  const changes: readonly BoostChange[] = applyBoosts(target, allowed);
  for (const change of changes) {
    pushEvent(state, { kind: 'boost', side, stat: change.stat, stages: change.stages });
  }
  if (changes.length > 0) {
    if (options.message) {
      pushText(state, options.message);
    } else {
      const direction = changes.every((change) => change.stages > 0) ? 'rose' : 'fell';
      pushText(state, `${target.name}'s ${statLabel(changes[0].stat)} ${direction}!`);
    }
  }
}

/** Applies a primary status through `onStatus`, honouring type immunities. */
export function applyStatusEffect(
  state: BattleState,
  side: SideId,
  target: BattleFighter,
  status: string | undefined,
  message?: string,
): void {
  if (!isStatusId(status)) return;
  if (hasSubstitute(target)) return;
  const ctx = makeContext(state, side, { source: target, target: opponent(state, side) });
  if (!runStatus(ctx, status)) return;
  if (!canApplyStatus(target, status)) return;
  if (applyStatus(target, status, state.rng)) {
    pushEvent(state, { kind: 'status', side, status });
    pushText(state, message ?? `${target.name} was afflicted by ${statusName(status)}!`);
  }
}
