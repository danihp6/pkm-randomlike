import {
  BOOST_IDS,
  applyBoosts,
  type BattleFighter,
  type BoostChange,
  type BoostId,
  type StatusId,
} from '../fighter';
import { applyStatus, canApplyStatus, isStatusId } from '../status';
import {
  opponent,
  pushEvent,
  pushText,
  type BattleState,
  type BattleText,
  type BattleTextKey,
  type SideId,
} from '../state';
import { hasSubstitute } from '../volatile';
import { makeContext, runAfterStatus, runBoost, runModifyBoost, runStatus } from './registry';
import { terrainBlocksStatus } from './terrain';

const BOOST_ROSE: Readonly<Record<BoostId, BattleTextKey>> = {
  atk: 'battle.log.boostRose.atk',
  def: 'battle.log.boostRose.def',
  spa: 'battle.log.boostRose.spa',
  spd: 'battle.log.boostRose.spd',
  spe: 'battle.log.boostRose.spe',
  accuracy: 'battle.log.boostRose.accuracy',
  evasion: 'battle.log.boostRose.evasion',
};

const BOOST_FELL: Readonly<Record<BoostId, BattleTextKey>> = {
  atk: 'battle.log.boostFell.atk',
  def: 'battle.log.boostFell.def',
  spa: 'battle.log.boostFell.spa',
  spd: 'battle.log.boostFell.spd',
  spe: 'battle.log.boostFell.spe',
  accuracy: 'battle.log.boostFell.accuracy',
  evasion: 'battle.log.boostFell.evasion',
};

const STATUS_AFFLICTED: Readonly<Record<StatusId, BattleTextKey>> = {
  brn: 'battle.log.statusAfflicted.brn',
  psn: 'battle.log.statusAfflicted.psn',
  tox: 'battle.log.statusAfflicted.tox',
  par: 'battle.log.statusAfflicted.par',
  slp: 'battle.log.statusAfflicted.slp',
  frz: 'battle.log.statusAfflicted.frz',
};

export type BoostOptions = Readonly<{ self?: boolean; message?: BattleText }>;

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
    const raw = boosts[stat];
    if (!raw) continue;
    const ctx = makeContext(state, side, { source: target, target: opponent(state, side) });
    const stages = runModifyBoost(ctx, stat, raw, self);
    if (!stages) continue;
    if (!runBoost(ctx, stat, stages, self)) continue;
    allowed[stat] = stages;
  }

  const changes: readonly BoostChange[] = applyBoosts(target, allowed);
  for (const change of changes) {
    pushEvent(state, { kind: 'boost', side, stat: change.stat, stages: change.stages });
  }
  if (changes.length > 0) {
    if (options.message) {
      pushText(state, options.message.key, options.message.params);
    } else {
      const rose = changes.every((change) => change.stages > 0);
      const key = rose ? BOOST_ROSE[changes[0].stat] : BOOST_FELL[changes[0].stat];
      pushText(state, key, { name: target.name });
    }
  }
}

/** Applies a primary status through `onStatus`, honouring type immunities. */
export function applyStatusEffect(
  state: BattleState,
  side: SideId,
  target: BattleFighter,
  status: string | undefined,
  message?: BattleText,
): void {
  if (!isStatusId(status)) return;
  if (hasSubstitute(target)) return;
  const terrainBlock = terrainBlocksStatus(state.terrain, target, status);
  if (terrainBlock) {
    pushText(state, terrainBlock.key, terrainBlock.params);
    return;
  }
  const ctx = makeContext(state, side, { source: target, target: opponent(state, side) });
  if (!runStatus(ctx, status)) return;
  if (!canApplyStatus(target, status)) return;
  if (applyStatus(target, status, state.rng)) {
    pushEvent(state, { kind: 'status', side, status });
    pushText(state, message?.key ?? STATUS_AFFLICTED[status], message?.params ?? { name: target.name });
    runAfterStatus(makeContext(state, side, { source: target, target: opponent(state, side) }), status);
  }
}
