import { allMoves, effectiveness, getMove, type Move, type MoveEffect } from '../../data/dex';
import {
  applyDamage,
  applyHeal,
  hasAbility,
  resetBattleState,
  takesIndirectDamage,
  BOOST_IDS,
  type BattleFighter,
  type BoostId,
  type MoveSlot,
  type StatusId,
} from './fighter';
import {
  makeContext,
  runAfterMove,
  runFaint,
  runFractionalPriority,
  runModifyCrit,
  runModifyCritRatio,
  runModifyDamage,
  runModifyEffectiveness,
  runModifyMultihit,
  runModifyPriority,
  runModifyRecoil,
  runModifyTrapDamage,
  runResidual,
  runStart,
  runSwitchIn,
  runSwitchOut,
  runTryHit,
  runTrySecondary,
  runTrySubstitute,
  runTryVolatile,
  runModifySecondaryChance,
  runModifyMove,
  runModifyMoveType,
} from './effects/registry';
import { multiHitPower, rollHitWith } from './modifiers';
import { applyBoostEffect, applyStatusEffect } from './effects/apply';
import {
  CHARGE_SELF_BOOSTS,
  CONDITIONAL_FAILS,
  FIELD_CONDITION_MOVES,
  SIDE_CONDITION_MOVES,
  isProtectMove,
  protectBlocks,
} from './effects/moves';
import { setFieldCondition, setSideCondition, tickConditions } from './effects/conditions';
import { setTerrain, terrainFromMove, terrainHeal, tickTerrain } from './effects/terrain';
import {
  setWeather,
  tickWeather,
  weatherChip,
  weatherFromMove,
  WEATHER_CHIP_MESSAGES,
} from './effects/weather';
import {
  computeDamage,
  isFixedDamageMove,
  resolvesToDamage,
  rollCrit,
  type DamageContext,
  type DamageResult,
} from './damage';
import { orderActions } from './order';
import {
  barredMovesFor,
  selectedMove,
  useBagItem,
  validateCommand,
  withLeadSlot,
  type Command,
  type FightCommand,
  type SelectedMove,
} from './commands';
import { megaEvolve } from './mega';
import { gigantamax } from './gmax';
import {
  SIDE_IDS,
  SLOTS,
  activeFighter,
  effectiveWeather,
  finishBattle,
  hasHealthy,
  liveSlots,
  opponent,
  opponentOf,
  pushEvent,
  pushText,
  slotActiveIndex,
  type BattleState,
  type BattleText,
  type BattleTextKey,
  type SideId,
  type Slot,
} from './state';
import { beforeMoveStatus, residualDamage } from './status';
import {
  absorbWithSubstitute,
  applyAttract,
  applyConfusion,
  applyDisable,
  applyElectrify,
  applyEmbargo,
  applyEncore,
  applyFlinch,
  applyForesight,
  applyGastroAcid,
  applyLeechSeed,
  applyNightmare,
  applyNoRetreat,
  applyOctolock,
  applyPartialTrap,
  applyPerish,
  applyTaunt,
  applyTelekinesis,
  applyTorment,
  applyTrap,
  beforeMoveVolatile,
  endOfTurnVolatile,
  hasSubstitute,
  isTaunted,
  leechSeedDamage,
  makeSubstitute,
  nightmareDamage,
  PARTIAL_TRAP_FRACTION,
  SEMI_INVULNERABLE_CHARGES,
  SEMI_INVULNERABLE_COUNTER_MULTIPLIER,
  semiInvulnerableOutcome,
  tickPartialTrap,
  tickPerish,
} from './volatile';
import { rollRun } from './runAway';

/** The party indices a side currently has on the field. */
function activeIndices(state: BattleState, side: SideId): readonly number[] {
  return liveSlots(state, side).map((slot) => slotActiveIndex(state, side, slot));
}

/** The first healthy party member that is not already on the field, or -1. */
function reserveIndex(state: BattleState, side: SideId): number {
  const battleSide = state.sides[side];
  const active = activeIndices(state, side);
  return battleSide.party.findIndex((fighter, index) => fighter.hp > 0 && !active.includes(index));
}

/**
 * True when a slot holds a fainted fighter that a reserve could still replace.
 * A side with one live slot and no reserve keeps fighting: it never waits on a
 * replacement that does not exist.
 */
function sideNeedsReplacement(state: BattleState, side: SideId): boolean {
  if (reserveIndex(state, side) < 0) return false;
  return liveSlots(state, side).some((slot) => activeFighter(state, side, slot).hp <= 0);
}

export function performSwitch(
  state: BattleState,
  side: SideId,
  partyIndex: number,
  slot: Slot = 0,
): void {
  const battleSide = state.sides[side];
  const outgoing = activeFighter(state, side, slot);
  runSwitchOut(makeContext(state, side, { source: outgoing, target: opponent(state, side) }));
  if (slot === 0) battleSide.activeIndex = partyIndex;
  else battleSide.secondActiveIndex = partyIndex;
  battleSide.awaitingReplacement = sideNeedsReplacement(state, side);
  resetBattleState(outgoing);

  const incoming = activeFighter(state, side, slot);
  if (side === 'player' && !state.usedFighterIds.includes(incoming.id)) {
    state.usedFighterIds.push(incoming.id);
  }
  if (!state.switchedSides.includes(side)) state.switchedSides.push(side);
  pushEvent(state, { kind: 'switch', side, fighterId: incoming.id });
  pushText(state, 'battle.log.sendOut', { name: state.sides[side].name, target: incoming.name });

  const ctx = makeContext(state, side, { source: incoming, target: opponent(state, side) });
  runStart(ctx);
  runSwitchIn(ctx);

  const passed = battleSide.batonPassBoosts;
  if (passed) {
    battleSide.batonPassBoosts = null;
    applyBoostEffect(state, side, incoming, passed, {
      self: true,
      message: { key: 'battle.log.move.batonpass', params: { name: incoming.name } },
    });
  }
}

export type SlotCommands = Readonly<Partial<Record<Slot, Command>>>;

/** The command as the slot that issued it, so a keyed record and the field agree. */
function slotCommand(command: Command | undefined, slot: Slot): Command | undefined {
  if (!command) return undefined;
  if (command.type !== 'fight' && command.type !== 'switch') return command;
  return command.slot === slot ? command : { ...command, slot };
}

function slotCommands(commands: SlotCommands): SlotCommands {
  const out: Partial<Record<Slot, Command>> = {};
  for (const slot of SLOTS) {
    const command = slotCommand(commands[slot], slot);
    if (command) out[slot] = command;
  }
  return out;
}

function resolvePreMoveActions(
  state: BattleState,
  commands: Readonly<Record<SideId, SlotCommands>>,
): void {
  const entries: { side: SideId; slot: Slot; priority: number }[] = [];
  for (const side of SIDE_IDS) {
    for (const slot of SLOTS) {
      const command = commands[side][slot];
      if (!command || command.type === 'fight') continue;
      entries.push({ side, slot, priority: 6 });
    }
  }
  for (const entry of orderActions(state, entries, state.rng)) {
    if (state.winner !== null) return;
    const command = commands[entry.side][entry.slot ?? 0];
    if (!command) continue;
    switch (command.type) {
      case 'switch':
        performSwitch(state, entry.side, command.partyIndex, entry.slot ?? 0);
        break;
      case 'bag':
        useBagItem(state, entry.side, command.itemId);
        break;
      case 'run': {
        const success = rollRun(state, entry.side);
        pushEvent(state, { kind: 'run', side: entry.side, success });
        pushText(
          state,
          success ? 'battle.log.runAway' : 'battle.log.runFailed',
          success ? undefined : { name: state.sides[entry.side].name },
        );
        if (success) finishBattle(state, 'draw');
        break;
      }
      case 'fight':
        break;
    }
  }
}

function blockedMessage(fighter: BattleFighter, reason: 'slp' | 'frz' | 'par'): BattleText {
  return {
    key:
      reason === 'slp'
        ? 'battle.log.blockedSlp'
        : reason === 'frz'
          ? 'battle.log.blockedFrz'
          : 'battle.log.blockedPar',
    params: { name: fighter.name },
  };
}

function damageMessage(move: Move, result: DamageResult, defender: BattleFighter): BattleText {
  const superEffective = result.effectiveness > 1;
  const weak = result.effectiveness < 1;
  const key: BattleTextKey = result.crit
    ? superEffective
      ? 'battle.log.hitCritSuper'
      : weak
        ? 'battle.log.hitCritWeak'
        : 'battle.log.hitCrit'
    : superEffective
      ? 'battle.log.hitSuper'
      : weak
        ? 'battle.log.hitWeak'
        : 'battle.log.hit';
  return { key, params: { move: move.id, name: defender.name } };
}

function multihitHits(move: Move, rng: BattleState['rng']): number {
  if (!move.multihit) return 1;
  if (typeof move.multihit === 'number') return move.multihit;
  return rng.int(move.multihit[0], move.multihit[1]);
}

/** Beat Up hits once per healthy party member; the reference skips a statused one. */
function beatUpHits(state: BattleState, side: SideId): number {
  return Math.max(
    1,
    state.sides[side].party.filter((fighter) => fighter.hp > 0 && fighter.status === null).length,
  );
}

const VOLATILE_MESSAGES: Readonly<Record<string, BattleTextKey>> = {
  aquaring: 'battle.log.volatile.aquaring',
  ingrain: 'battle.log.volatile.ingrain',
  destinybond: 'battle.log.volatile.destinybond',
  dragoncheer: 'battle.log.volatile.dragoncheer',
  focusenergy: 'battle.log.volatile.focusenergy',
  laserfocus: 'battle.log.volatile.laserfocus',
  endure: 'battle.log.volatile.endure',
  grudge: 'battle.log.volatile.grudge',
  imprison: 'battle.log.volatile.imprison',
  magiccoat: 'battle.log.volatile.magiccoat',
  snatch: 'battle.log.volatile.snatch',
  magnetrise: 'battle.log.volatile.magnetrise',
  powertrick: 'battle.log.volatile.powertrick',
  attract: 'battle.log.volatile.attract',
  charge: 'battle.log.volatile.charge',
  disable: 'battle.log.volatile.disable',
  electrify: 'battle.log.volatile.electrify',
  embargo: 'battle.log.volatile.embargo',
  foresight: 'battle.log.volatile.foresight',
  gastroacid: 'battle.log.volatile.gastroacid',
  nightmare: 'battle.log.volatile.nightmare',
  noretreat: 'battle.log.volatile.noretreat',
  octolock: 'battle.log.volatile.octolock',
  telekinesis: 'battle.log.volatile.telekinesis',
  torment: 'battle.log.volatile.torment',
};

/** The end-of-turn line each primary status keys, its own sentence per status. */
const STATUS_RESIDUAL: Readonly<Record<StatusId, BattleTextKey>> = {
  brn: 'battle.log.statusResidual.brn',
  psn: 'battle.log.statusResidual.psn',
  tox: 'battle.log.statusResidual.tox',
  par: 'battle.log.statusResidual.par',
  slp: 'battle.log.statusResidual.slp',
  frz: 'battle.log.statusResidual.frz',
};

/**
 * Writes one volatile from the move's own data. Returns true when the volatile
 * was written and false when the engine has no case for it (the coverage ledger
 * reads this switch, so a missing case is a visible gap, never a silent no-op).
 */
function applyVolatileEffect(
  state: BattleState,
  side: SideId,
  target: BattleFighter,
  volatile: string,
  moveId: string,
): boolean {
  const ctx = makeContext(state, side, { source: target, target: opponent(state, side) });
  if (!runTryVolatile(ctx, volatile)) return false;
  const applied = ((): boolean => {
    switch (volatile) {
      case 'confusion':
        return applyConfusion(target, state.rng);
      case 'leechseed':
        return hasSubstitute(target) ? false : applyLeechSeed(target);
      case 'taunt':
        return hasSubstitute(target) ? false : applyTaunt(target);
      case 'encore':
        return hasSubstitute(target) ? false : applyEncore(target);
      case 'trapped':
        applyTrap(target);
        return true;
      case 'partiallytrapped':
        return applyPartialTrap(target, moveId, state.rng);
      case 'perishsong':
      case 'perish':
        applyPerish(target);
        return true;
      case 'flinch':
        applyFlinch(target);
        return true;
      case 'yawn':
        target.volatiles.yawn = 2;
        return true;
      case 'aquaring':
        target.volatiles.aquaRing = true;
        return true;
      case 'ingrain':
        target.volatiles.ingrain = true;
        return true;
      case 'destinybond':
        target.volatiles.destinyBond = true;
        return true;
      case 'dragoncheer':
        target.volatiles.dragonCheer = true;
        return true;
      case 'focusenergy':
        target.volatiles.focusEnergy = true;
        return true;
      case 'laserfocus':
        target.volatiles.laserFocus = true;
        return true;
      case 'endure':
        target.volatiles.endure = true;
        return true;
      case 'grudge':
        target.volatiles.grudge = true;
        return true;
      case 'imprison':
        target.volatiles.imprison = true;
        return true;
      case 'magiccoat':
        target.volatiles.magicCoat = true;
        return true;
      case 'snatch':
        target.volatiles.snatch = true;
        return true;
      case 'magnetrise':
        target.volatiles.magnetRise = 5;
        return true;
      case 'powertrick':
        if (target.volatiles.powerTrick) return false;
        target.volatiles.powerTrick = true;
        target.stats = { ...target.stats, atk: target.stats.def, def: target.stats.atk };
        return true;
      case 'attract': {
        const foe = opponent(state, side);
        if (foe.gender === target.gender) return false;
        if (foe.gender === 'genderless' || target.gender === 'genderless') return false;
        return applyAttract(target);
      }
      case 'charge':
        target.volatiles.charge = true;
        return true;
      case 'disable': {
        // The reference disables the move the target last used; a target that has
        // not moved yet has none, so one usable slot is drawn — the family's one
        // new Rng draw, in slot order so a seed reproduces the pick.
        const usable = target.moves.filter((slot) => slot.pp > 0);
        if (usable.length === 0) return false;
        const remembered = usable.find((slot) => slot.moveId === target.lastMoveId);
        const chosen = remembered ?? usable[state.rng.int(0, usable.length - 1)];
        return applyDisable(target, chosen.moveId);
      }
      case 'electrify':
        return applyElectrify(target);
      case 'embargo':
        return applyEmbargo(target);
      case 'foresight':
        return applyForesight(target);
      case 'gastroacid':
        return applyGastroAcid(target);
      case 'nightmare':
        if (target.status !== 'slp') return false;
        return applyNightmare(target);
      case 'noretreat':
        return applyNoRetreat(target);
      case 'octolock':
        return applyOctolock(target);
      case 'telekinesis':
        return applyTelekinesis(target);
      case 'torment':
        return applyTorment(target);
      case 'substitute': {
        const cost = makeSubstitute(target);
        if (cost > 0) pushText(state, 'battle.log.substitutePlaced', { name: target.name });
        return cost > 0;
      }
      default:
        return false;
    }
  })();
  if (applied) {
    const custom = VOLATILE_MESSAGES[volatile];
    const drowsy = !custom && volatile === 'yawn';
    pushText(
      state,
      custom ?? (drowsy ? 'battle.log.volatile.drowsy' : 'battle.log.volatile.default'),
      custom || drowsy ? { name: target.name } : { name: target.name, volatile },
    );
  }
  return applied;
}

/** Percentage points a repeated party type adds to its status side-effect's chance. */
export const TEAM_TYPE_STATUS_BONUS = 20;

/** The status each repeated party type boosts: the four the team-type rule covers. */
const TEAM_TYPE_STATUS: Readonly<Record<string, string>> = {
  Fire: 'brn',
  Ice: 'frz',
  Electric: 'par',
  Poison: 'psn',
};

/**
 * The chance a status side-effect actually rolls, in whole percent: `chance` plus
 * `TEAM_TYPE_STATUS_BONUS` when `moveType` is in `state.teamTypes` and `status` is
 * that type's status (Fire→brn, Ice→frz, Electric→par, Poison→psn). Clamped to
 * 0..100. Pure; never reads the RNG.
 */
export function teamTypeStatusChance(
  state: BattleState,
  moveType: string,
  status: string | undefined,
  chance: number,
): number {
  if (status === undefined) return chance;
  if (TEAM_TYPE_STATUS[moveType] !== status) return chance;
  if (!state.teamTypes.includes(moveType)) return chance;
  return Math.max(0, Math.min(100, chance + TEAM_TYPE_STATUS_BONUS));
}

function applySecondary(
  state: BattleState,
  side: SideId,
  effect: MoveEffect,
  attacker: BattleFighter,
  defender: BattleFighter,
  moveType: string,
  moveId: string,
): void {
  if (effect.chance !== undefined) {
    const chance = teamTypeStatusChance(
      state,
      moveType,
      effect.status,
      runModifySecondaryChance(
        makeContext(state, side, { source: attacker, target: defender }),
        effect.chance,
      ),
    );
    if (state.rng.int(1, 100) > chance) return;
  }
  if (effect.self) {
    if (effect.self.boosts) applyBoostEffect(state, side, attacker, effect.self.boosts, { self: true });
    if (effect.self.status) applyStatusEffect(state, side, attacker, effect.self.status);
  }
  const secondaryCtx = makeContext(state, side, { source: attacker, target: defender });
  if (!runTrySecondary(secondaryCtx, effect)) return;
  if (effect.status) applyStatusEffect(state, opponentOf(side), defender, effect.status);
  if (effect.volatileStatus) {
    applyVolatileEffect(state, opponentOf(side), defender, effect.volatileStatus, moveId);
  }
  if (effect.boosts) applyBoostEffect(state, opponentOf(side), defender, effect.boosts);
}

function applyMoveEffects(
  state: BattleState,
  side: SideId,
  move: Move,
  totalDamage: number,
  defenderDamaged: boolean,
  aimedAt?: BattleFighter,
): void {
  const attacker = activeFighter(state, side);
  const defender = aimedAt ?? opponent(state, side);
  const selfTarget = move.target === 'self';

  // Magic Bounce and Magic Coat send a reflectable status move back at its user.
  const reflects =
    !selfTarget &&
    move.category === 'Status' &&
    Boolean(move.flags.reflectable) &&
    (defender.volatiles.magicCoat ||
      (hasAbility(defender, 'Magic Bounce') &&
        !hasAbility(attacker, 'Neutralizing Gas') &&
        state.abilityPierce !== defender));
  if (reflects) {
    if (defender.volatiles.magicCoat) {
      defender.volatiles.magicCoat = false;
      pushText(state, 'battle.log.magicCoat', { name: defender.name });
    } else {
      pushText(state, 'battle.log.magicBounce', { name: defender.name });
    }
  }

  // Snatch steals the move: the defender becomes its user.
  const snatches =
    !reflects && move.category === 'Status' && Boolean(move.flags.snatch) && defender.volatiles.snatch;
  if (snatches) {
    defender.volatiles.snatch = false;
    pushText(state, 'battle.log.snatched', { name: defender.name });
  }

  const actingSide = snatches ? opponentOf(side) : side;
  const acting = snatches ? defender : attacker;
  const targetSide = reflects ? side : opponentOf(actingSide);
  // A reflected or snatched move turns on its user, whatever slot it was aimed at.
  const effectTargetOfMove = reflects || snatches ? attacker : defender;
  // An ally-aimed move never lands on the foe: `allies` includes the user (Howl),
  // `adjacentAlly` needs a partner the single battle does not field (Aromatic Mist).
  const allyMove = move.target === 'allies' || move.target === 'adjacentAlly' || move.target === 'ally';
  const partner = liveSlots(state, side)
    .map((slot) => activeFighter(state, side, slot))
    .find((fighter) => fighter !== acting && fighter.hp > 0);
  if (allyMove && move.target !== 'allies' && !partner) {
    pushText(state, 'battle.log.fail');
    return;
  }
  const effectSide = selfTarget || allyMove ? actingSide : targetSide;
  const effectTarget = selfTarget ? acting : allyMove ? (partner ?? acting) : effectTargetOfMove;

  if (move.status) applyStatusEffect(state, effectSide, effectTarget, move.status);

  if (move.volatileStatus) {
    applyVolatileEffect(state, effectSide, effectTarget, move.volatileStatus, move.id);
  }

  if (move.boosts) {
    applyBoostEffect(state, effectSide, effectTarget, move.boosts, { self: selfTarget });
  }

  if (move.heal && move.heal.length === 2) {
    const healed = applyHeal(acting, Math.floor((acting.maxHp * move.heal[0]) / move.heal[1]));
    if (healed > 0) {
      pushEvent(state, {
        kind: 'heal',
        side: actingSide,
        amount: healed,
        hp: acting.hp,
        maxHp: acting.maxHp,
      });
      pushText(state, 'battle.log.regainedHealth', { name: acting.name });
    }
  }

  if (move.id === 'wish') {
    state.sides[actingSide].wishTurns = 2;
    pushText(state, 'battle.log.madeWish', { name: acting.name });
  }

  if (move.self?.boosts) applyBoostEffect(state, actingSide, acting, move.self.boosts, { self: true });

  const secondaries: MoveEffect[] = [];
  if (move.secondaries) secondaries.push(...move.secondaries);
  const sheerForce = hasAbility(acting, 'Sheer Force') && move.basePower > 0;
  if (defenderDamaged && !sheerForce) {
    for (const secondary of secondaries) {
      applySecondary(state, actingSide, secondary, acting, effectTargetOfMove, move.type, move.id);
    }
  }

  if (move.drain && move.drain.length === 2 && totalDamage > 0) {
    const drained = Math.max(1, Math.floor((totalDamage * move.drain[0]) / move.drain[1]));
    if (hasAbility(effectTargetOfMove, 'Liquid Ooze')) {
      if (takesIndirectDamage(acting)) {
        const dealt = applyDamage(acting, drained);
        pushEvent(state, {
          kind: 'damage',
          side: actingSide,
          amount: dealt,
          hp: acting.hp,
          maxHp: acting.maxHp,
          effectiveness: 1,
          crit: false,
        });
        pushText(state, 'battle.log.liquidOoze', { name: acting.name });
      }
    } else {
      const healed = applyHeal(acting, drained);
      if (healed > 0) {
        pushEvent(state, {
          kind: 'heal',
          side: actingSide,
          amount: healed,
          hp: acting.hp,
          maxHp: acting.maxHp,
        });
        pushText(state, 'battle.log.energyDrained', { name: acting.name });
      }
    }
  }

  if (move.recoil && move.recoil.length === 2 && totalDamage > 0 && takesIndirectDamage(acting)) {
    const raw = Math.max(1, Math.floor((totalDamage * move.recoil[0]) / move.recoil[1]));
    const recoil = runModifyRecoil(
      makeContext(state, actingSide, { source: acting, target: effectTargetOfMove, move }),
      move,
      raw,
    );
    if (recoil > 0) {
      const dealt = applyDamage(acting, recoil);
      pushEvent(state, {
        kind: 'damage',
        side: actingSide,
        amount: dealt,
        hp: acting.hp,
        maxHp: acting.maxHp,
        effectiveness: 1,
        crit: false,
      });
      pushText(state, 'battle.log.recoil', { name: acting.name });
    }
  }

  if (move.struggleRecoil && acting.hp > 0 && takesIndirectDamage(acting)) {
    const recoil = Math.max(1, Math.floor(acting.maxHp / 4));
    const dealt = applyDamage(acting, recoil);
    pushEvent(state, {
      kind: 'damage',
      side: actingSide,
      amount: dealt,
      hp: acting.hp,
      maxHp: acting.maxHp,
      effectiveness: 1,
      crit: false,
    });
    pushText(state, 'battle.log.recoil', { name: acting.name });
  }

  if (move.selfdestruct) {
    applyDamage(acting, acting.hp);
    pushText(state, 'battle.log.fainted', { name: acting.name });
    pushEvent(state, { kind: 'faint', side: actingSide, fighterId: acting.id });
  }

  const newWeather = weatherFromMove(move);
  if (newWeather) {
    if (state.weather === newWeather) pushText(state, 'battle.log.fail');
    else setWeather(state, newWeather);
  }

  const newTerrain = terrainFromMove(move);
  if (newTerrain) {
    if (state.terrain === newTerrain) pushText(state, 'battle.log.fail');
    else setTerrain(state, newTerrain);
  }

  const sideCondition = SIDE_CONDITION_MOVES[move.id];
  if (sideCondition) {
    if (sideCondition === 'auroraveil' && effectiveWeather(state) !== 'snow') {
      pushText(state, 'battle.log.fail');
    } else if (state.sides[actingSide].sideConditions[sideCondition] > 0) {
      pushText(state, 'battle.log.fail');
    } else {
      setSideCondition(state, actingSide, sideCondition);
    }
  }

  const fieldCondition = FIELD_CONDITION_MOVES[move.id];
  if (fieldCondition) {
    if (state.field[fieldCondition] > 0) pushText(state, 'battle.log.fail');
    else setFieldCondition(state, fieldCondition);
  }
}

const CHARGE_VERBS: Readonly<Record<string, BattleTextKey>> = {
  solarbeam: 'battle.log.charge.solarbeam',
  solarblade: 'battle.log.charge.solarblade',
  fly: 'battle.log.charge.fly',
  dig: 'battle.log.charge.dig',
  dive: 'battle.log.charge.dive',
  bounce: 'battle.log.charge.bounce',
  phantomforce: 'battle.log.charge.phantomforce',
  shadowforce: 'battle.log.charge.shadowforce',
  meteorbeam: 'battle.log.charge.meteorbeam',
  electroshot: 'battle.log.charge.electroshot',
  skyattack: 'battle.log.charge.skyattack',
  freezeshock: 'battle.log.charge.freezeshock',
  iceburn: 'battle.log.charge.iceburn',
};

/** The charge line's key; the caller supplies the charging fighter's name. */
function chargeVerb(moveId: string): BattleText {
  return { key: CHARGE_VERBS[moveId] ?? 'battle.log.charge.default' };
}

/** Solar Beam and Solar Blade skip the charge in harsh sunlight. */
function chargesInstantly(state: BattleState, move: Move): boolean {
  if (move.id !== 'solarbeam' && move.id !== 'solarblade') return false;
  return effectiveWeather(state) === 'sun';
}

/** The move a charging fighter is locked into, ignoring the chosen command. */
function lockedMove(attacker: BattleFighter, moveId: string): SelectedMove | null {
  const move = getMove(moveId);
  if (!move) return null;
  const slot = attacker.moves.find((entry) => entry.moveId === moveId) ?? null;
  return { move, slot };
}

/** The selected move, honouring a charge-move lock before the command. */
function chosenMove(
  fighter: BattleFighter,
  command: FightCommand,
  barred: ReadonlySet<string>,
): SelectedMove | null {
  const charging = fighter.volatiles.charging;
  return charging ? lockedMove(fighter, charging) : selectedMove(fighter, command, barred);
}

const PRESSURED_TARGETS = new Set([
  'normal',
  'any',
  'allAdjacent',
  'allAdjacentFoes',
  'adjacentFoe',
  'randomNormal',
]);

/** Pressure makes foe-targeting moves cost an extra PP. */
function ppCost(state: BattleState, side: SideId, move: Move): number {
  const foe = opponent(state, side);
  if (hasAbility(foe, 'Pressure') && PRESSURED_TARGETS.has(move.target)) return 2;
  return 1;
}

const COUNTER_MOVES = new Set(['counter', 'mirrorcoat', 'metalburst', 'comeuppance']);

/**
 * Counter and Mirror Coat pay back double the physical/special damage taken this
 * turn; Metal Burst and Comeuppance pay back 1.5x the total.
 */
function useCounterMove(
  state: BattleState,
  side: SideId,
  attacker: BattleFighter,
  defender: BattleFighter,
  move: Move,
  targetSlot: Slot = 0,
): void {
  const physical = attacker.volatiles.physicalDamageTaken;
  const special = attacker.volatiles.specialDamageTaken;
  let reflected = 0;
  let multiplier = 2;
  if (move.id === 'counter') reflected = physical;
  else if (move.id === 'mirrorcoat') reflected = special;
  else {
    reflected = physical + special;
    multiplier = 1.5;
  }
  if (reflected <= 0) {
    pushText(state, 'battle.log.fail');
    return;
  }
  const eff = effectiveness(move.type, defender.types);
  if (eff === 0) {
    pushText(state, 'battle.log.noEffect', { name: defender.name });
    return;
  }
  const dealt = applyDamage(defender, Math.max(1, Math.floor(reflected * multiplier)));
  pushEvent(state, {
    kind: 'damage',
    side: opponentOf(side),
    amount: dealt,
    hp: defender.hp,
    maxHp: defender.maxHp,
    effectiveness: eff,
    crit: false,
  });
  pushText(state, 'battle.log.countered', { name: defender.name });
  if (defender.hp <= 0) faint(state, opponentOf(side), targetSlot);
}

/** U-turn and friends hand the turn over to the bench; Baton Pass carries boosts. */
function maybeSelfSwitch(state: BattleState, side: SideId, attacker: BattleFighter, move: Move): void {
  if (!move.selfSwitch || state.winner !== null || attacker.hp <= 0) return;
  const battleSide = state.sides[side];
  const active = activeIndices(state, side);
  const hasBench = battleSide.party.some(
    (fighter, index) => !active.includes(index) && fighter.hp > 0,
  );
  if (!hasBench) return;
  if (move.selfSwitch === 'copyvolatile') {
    const passed: Partial<Record<BoostId, number>> = {};
    for (const stat of BOOST_IDS) {
      if (attacker.boosts[stat] !== 0) passed[stat] = attacker.boosts[stat];
    }
    battleSide.batonPassBoosts = passed;
  }
  battleSide.awaitingReplacement = true;
}

export function useMove(
  state: BattleState,
  side: SideId,
  command: FightCommand,
  commands?: Readonly<Record<SideId, SlotCommands>>,
): void {
  const attacker = activeFighter(state, side, command.slot ?? 0);
  const selected = chosenMove(attacker, command, barredMovesFor(state, side));
  if (!selected) return;
  const { move, slot } = selected;
  state.abilityPierce = piercesTargetAbility(state, side, attacker, move) ? attacker : null;
  try {
    resolveMove(
      state,
      side,
      attacker,
      move,
      slot,
      commandedTarget(state, side, command),
      commands,
    );
  } finally {
    state.abilityPierce = null;
  }
  dancerFollowUp(state, side, move);
}

/** The fighter a fight command names, or undefined for the default (the foe's slot 0). */
function commandedTarget(
  state: BattleState,
  side: SideId,
  command: FightCommand,
): BattleFighter | undefined {
  const ref = command.target;
  if (!ref || ref.side !== opponentOf(side)) return undefined;
  return activeFighter(state, ref.side, ref.slot);
}

/** The slot a fighter fills on its side. */
function slotOf(state: BattleState, side: SideId, fighter: BattleFighter): Slot {
  const battleSide = state.sides[side];
  return battleSide.secondActiveIndex >= 0 &&
    fighter === battleSide.party[battleSide.secondActiveIndex]
    ? 1
    : 0;
}

type MoveAim = Readonly<{ side: SideId; slot: Slot }>;

/** The slots a spread move hits, or null when the move is single-target. */
function spreadAims(
  state: BattleState,
  side: SideId,
  attacker: BattleFighter,
  move: Move,
): readonly MoveAim[] | null {
  if (move.target !== 'allAdjacentFoes' && move.target !== 'allAdjacent' && move.target !== 'all') {
    return null;
  }
  const foeSide = opponentOf(side);
  const aims: MoveAim[] = [];
  for (const slot of liveSlots(state, foeSide)) {
    if (activeFighter(state, foeSide, slot).hp > 0) aims.push({ side: foeSide, slot });
  }
  if (move.target !== 'allAdjacentFoes') {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      if (fighter !== attacker && fighter.hp > 0) aims.push({ side, slot });
    }
  }
  return aims;
}

/** Every (side, slot) the move applies to, foes first and ascending by slot. */
function moveAims(
  state: BattleState,
  side: SideId,
  attacker: BattleFighter,
  move: Move,
  primary: BattleFighter,
): readonly MoveAim[] {
  if (move.target === 'self') return [{ side, slot: slotOf(state, side, attacker) }];
  const spread = spreadAims(state, side, attacker, move);
  if (spread !== null) return spread;
  const foeSide = opponentOf(side);
  return [{ side: foeSide, slot: slotOf(state, foeSide, primary) }];
}

/**
 * True when the aimed fighter's protection stops `move`. The shipped helper reads
 * the foe's lead, so a partner's own protection is checked here with the same rule.
 */
function protectStops(
  state: BattleState,
  side: SideId,
  move: Move,
  defender: BattleFighter,
): boolean {
  if (defender === opponent(state, side)) return protectBlocks(state, side, move);
  if (!defender.volatiles.protect || !move.flags.protect) return false;
  if (!FOE_TARGETS.has(move.target)) return false;
  pushText(state, 'battle.log.protectedItself', { name: defender.name });
  return true;
}

const FOE_TARGETS: ReadonlySet<string> = new Set(['normal', 'any', 'adjacentFoe']);

function resolveMove(
  state: BattleState,
  side: SideId,
  attacker: BattleFighter,
  move: Move,
  moveSlot: MoveSlot | null,
  target?: BattleFighter,
  commands?: Readonly<Record<SideId, SlotCommands>>,
): void {
  // Truant alternates: after a turn in which it acts, the next one is lost.
  if (hasAbility(attacker, 'Truant')) {
    if (attacker.volatiles.truant) {
      attacker.volatiles.truant = false;
      pushText(state, 'battle.log.loafing', { name: attacker.name });
      return;
    }
    attacker.volatiles.truant = true;
  }

  const previousMove = state.lastMove;
  pushEvent(state, { kind: 'move', side, moveId: move.id });
  pushText(state, 'battle.log.used', { name: attacker.name, move: move.id });
  state.lastMove = move.id;
  if (!isProtectMove(move.id)) attacker.volatiles.protectStreak = 0;

  if (move.category === 'Status' && isTaunted(attacker)) {
    pushText(state, 'battle.log.taunted', { name: attacker.name });
    return;
  }

  // Torment bars the same move on two consecutive turns.
  if (attacker.volatiles.torment && attacker.lastMoveId === move.id) {
    pushText(state, 'battle.log.encoreLocked', { name: attacker.name });
    return;
  }

  const statusCheck = beforeMoveStatus(attacker, state.rng);
  if (statusCheck && 'blocked' in statusCheck) {
    // Sleep Talk and Snore are the two moves usable while asleep.
    const usableWhileAsleep =
      statusCheck.blocked === 'slp' && (move.id === 'sleeptalk' || move.id === 'snore');
    if (!usableWhileAsleep) {
      const blocked = blockedMessage(attacker, statusCheck.blocked);
      pushText(state, blocked.key, blocked.params);
      return;
    }
  }
  if (statusCheck && 'cured' in statusCheck) {
    pushText(state, statusCheck.cured === 'slp' ? 'battle.log.wokeUp' : 'battle.log.thawedOut', {
      name: attacker.name,
    });
  }

  const volatileCheck = beforeMoveVolatile(attacker, state.rng);
  if (volatileCheck && 'flinched' in volatileCheck) {
    pushText(state, 'battle.log.flinched', { name: attacker.name });
    return;
  }
  if (volatileCheck && 'attracted' in volatileCheck) {
    pushText(state, 'battle.log.infatuated', { name: attacker.name });
    return;
  }
  if (volatileCheck && 'confusionDamage' in volatileCheck) {
    if (moveSlot) moveSlot.pp = Math.max(0, moveSlot.pp - ppCost(state, side, move));
    attacker.lastMoveId = move.id;
    pushEvent(state, {
      kind: 'damage',
      side,
      amount: volatileCheck.confusionDamage,
      hp: attacker.hp,
      maxHp: attacker.maxHp,
      effectiveness: 1,
      crit: false,
    });
    pushText(state, 'battle.log.confusedHurtSelf', { name: attacker.name });
    if (attacker.hp <= 0) faint(state, side, slotOf(state, side, attacker));
    return;
  }
  if (volatileCheck && 'confusionEnded' in volatileCheck) {
    pushText(state, 'battle.log.snappedOut', { name: attacker.name });
  }

  if (move.flags.charge) {
    if (attacker.volatiles.charging !== move.id && !chargesInstantly(state, move)) {
      attacker.volatiles.charging = move.id;
      attacker.volatiles.semiInvulnerable = SEMI_INVULNERABLE_CHARGES.has(move.id) ? move.id : null;
      pushText(state, chargeVerb(move.id).key, { name: attacker.name });
      const chargeBoosts = CHARGE_SELF_BOOSTS[move.id];
      if (chargeBoosts) {
        applyBoostEffect(state, side, attacker, chargeBoosts, { self: true });
      }
      return;
    }
    attacker.volatiles.charging = null;
    attacker.volatiles.semiInvulnerable = null;
  }

  if (moveSlot) moveSlot.pp = Math.max(0, moveSlot.pp - ppCost(state, side, move));
  attacker.lastMoveId = move.id;

  // Imprison seals any move the foe knows. The whole foe side is read, so a
  // partner's Imprison counts even when the move is aimed at the lead.
  const imprisoners = liveSlots(state, opponentOf(side)).map((slot) =>
    activeFighter(state, opponentOf(side), slot),
  );
  if (imprisoners.some((foe) => foe.volatiles.imprison && foe.moves.some((e) => e.moveId === move.id))) {
    pushText(state, 'battle.log.sealed', { name: attacker.name, move: move.id });
    return;
  }

  const calledId = calledMoveId(state, side, attacker, move, previousMove);
  if (calledId !== null) {
    const called = getMove(calledId);
    if (called && called.id !== move.id) {
      pushText(state, 'battle.log.used', { name: attacker.name, move: called.id });
      resolveMove(state, side, attacker, called, null, target, commands);
    } else {
      pushText(state, 'battle.log.fail');
    }
    return;
  }

  if (move.id === 'spitup' && attacker.volatiles.stockpile === 0) {
    pushText(state, 'battle.log.fail');
    return;
  }

  // A conditional fail reads the turn's commands, never a roll, and takes the same
  // branch Spit Up does: the PP is already spent above, and nothing is aimed.
  const conditionalFail = CONDITIONAL_FAILS[move.id];
  if (conditionalFail) {
    const failContext = makeContext(state, side, {
      source: attacker,
      target: target ?? opponent(state, side),
      move,
      ...(commands ? { commands } : {}),
    });
    if (conditionalFail(failContext)) {
      pushText(state, 'battle.log.fail');
      return;
    }
  }

  const aims = moveAims(state, side, attacker, move, target ?? opponent(state, side));
  if (aims.length === 0) return;

  // Lock-On and Mind Reader guarantee the user's next damaging move; it is spent
  // by that move, so a status move in between never wastes it.
  const lockedOn = move.category !== 'Status' && attacker.volatiles.lockOn;
  if (lockedOn) attacker.volatiles.lockOn = false;

  const attackerSlot = slotOf(state, side, attacker);
  let totalDamage = 0;
  let damaged = false;
  let countered = false;
  let effectMove: Move | null = null;
  let effectTarget: BattleFighter | null = null;
  let lastHitContext: ReturnType<typeof makeContext> | null = null;

  for (const aim of aims) {
    const defender = activeFighter(state, aim.side, aim.slot);
    if (protectStops(state, side, move, defender)) continue;

    const hiding = aim.side === side ? 'hit' : semiInvulnerableOutcome(defender, move);
    if (hiding === 'miss') {
      pushText(state, 'battle.log.missed', { name: attacker.name });
      continue;
    }

    const sure = lockedOn || (defender.volatiles.telekinesis > 0 && move.ohko !== true);
    if (move.category !== 'Status' && !sure && !rollHitWith(state, side, move, attacker, defender)) {
      pushText(state, 'battle.log.missed', { name: attacker.name });
      continue;
    }

    // Type-changing abilities (Galvanize, Pixilate, Liquid Voice) and item-driven
    // rewrites (a berry's Natural Gift) apply before any immunity check, so the
    // move is treated as its new type throughout. Electrify overrides them for one
    // move and is spent by it.
    const moveContext = makeContext(state, side, {
      source: attacker,
      target: defender,
      move,
      ...(commands ? { commands } : {}),
    });
    const modified = runModifyMove(moveContext, move);
    const electrified = attacker.volatiles.electrify;
    if (electrified) attacker.volatiles.electrify = false;
    const moveType = electrified ? 'Electric' : runModifyMoveType(moveContext, modified);
    const activeMove: Move = moveType === modified.type ? modified : { ...modified, type: moveType };

    const hitContext = makeContext(state, side, {
      source: attacker,
      target: defender,
      move: activeMove,
      ...(commands ? { commands } : {}),
    });
    if (!runTryHit(hitContext, activeMove)) continue;

    // Protean and Libero change the user's type, once per switch-in in Gen 9.
    if (
      (hasAbility(attacker, 'Protean') || hasAbility(attacker, 'Libero')) &&
      !attacker.volatiles.proteanUsed
    ) {
      attacker.volatiles.proteanUsed = true;
      attacker.types = [activeMove.type];
      pushText(state, 'battle.log.typeChanged', { name: attacker.name, type: activeMove.type });
    }

    if (COUNTER_MOVES.has(move.id)) {
      useCounterMove(state, side, attacker, defender, activeMove, aim.slot);
      countered = true;
      break;
    }

    effectMove = activeMove;
    effectTarget = defender;
    lastHitContext = hitContext;

    // Present rolls its own outcome: a quarter heal, or a bullet of 40, 80 or 120.
    let hitMove = activeMove;
    if (activeMove.id === 'present') {
      const roll = state.rng.int(1, 100);
      if (roll <= 20) {
        const healed = applyHeal(defender, Math.max(1, Math.floor(defender.maxHp / 4)));
        if (healed > 0) {
          pushEvent(state, {
            kind: 'heal',
            side: aim.side,
            amount: healed,
            hp: defender.hp,
            maxHp: defender.maxHp,
          });
        }
        continue;
      }
      hitMove = { ...activeMove, basePower: roll <= 60 ? 40 : roll <= 90 ? 80 : 120 };
    }

    if (hitMove.category !== 'Status' && resolvesToDamage(hitMove)) {
      const hits =
        hitMove.id === 'beatup'
          ? beatUpHits(state, side)
          : runModifyMultihit(
              makeContext(state, side, { source: attacker, target: defender, move: hitMove }),
              hitMove,
              multihitHits(hitMove, state.rng),
            );
      const statContext = damageStatContext(state, side, attacker, defender);
      for (let hit = 0; hit < hits; hit++) {
        const hitTarget = defender;
        if (hitTarget.hp <= 0) break;
        // A multiaccuracy move rolls again before every hit after the first; the
        // first hit already rolled at the aim level, so it is never rolled twice.
        if (
          hit > 0 &&
          hitMove.multiaccuracy === true &&
          !sure &&
          !rollHitWith(state, side, hitMove, attacker, hitTarget)
        ) {
          pushText(state, 'battle.log.missed', { name: attacker.name });
          break;
        }
        // Triple Kick and Triple Axel ramp their power per hit; a move whose power
        // does not move reuses the object it already has.
        const power = multiHitPower(hitMove, hit);
        const perHitMove = power === hitMove.basePower ? hitMove : { ...hitMove, basePower: power };
        const defenderTypes = state.roomField.overrideType
          ? [state.roomField.overrideType]
          : hitTarget.types;
        const critRatio =
          perHitMove.critRatio +
          (attacker.volatiles.focusEnergy ? 2 : 0) +
          (attacker.volatiles.dragonCheer ? 1 : 0) +
          state.roomField.critStage;
        // A fixed amount takes no roll: the crit is skipped entirely, not rolled dry.
        const crit = isFixedDamageMove(perHitMove)
          ? false
          : runModifyCrit(
              makeContext(state, side, { source: attacker, target: hitTarget, move: perHitMove }),
              perHitMove,
              attacker.volatiles.laserFocus ||
                rollCrit(
                  state.rng,
                  runModifyCritRatio(
                    makeContext(state, side, {
                      source: attacker,
                      target: hitTarget,
                      move: perHitMove,
                    }),
                    perHitMove,
                    critRatio,
                  ),
                ),
            );
        const result = computeDamage(attacker, hitTarget, perHitMove, state.rng, {
          weather: effectiveWeather(state),
          terrain: state.terrain,
          critical: crit,
          reflect: state.sides[opponentOf(side)].sideConditions.reflect > 0,
          lightScreen: state.sides[opponentOf(side)].sideConditions.lightscreen > 0,
          auroraVeil: state.sides[opponentOf(side)].sideConditions.auroraveil > 0,
          wonderRoom: state.field.wonderroom > 0,
          overrideType: state.roomField.overrideType,
          darkAura: state.roomField.darkAura,
          fairyAura: state.roomField.fairyAura,
          party: state.sides[side].party,
          targetMovedFirst: state.movedSides.includes(opponentOf(side)),
          userDamagedThisTurn:
            attacker.volatiles.physicalDamageTaken + attacker.volatiles.specialDamageTaken > 0,
          ...(side === 'player' ? { teamTypes: state.teamTypes } : {}),
          ...statContext,
          effectiveness: runModifyEffectiveness(
            makeContext(state, side, { source: attacker, target: hitTarget, move: perHitMove }),
            perHitMove,
            effectiveness(perHitMove.type, defenderTypes),
          ),
        });
        if (result.effectiveness === 0) {
          if (hit === 0) pushText(state, 'battle.log.noEffect', { name: hitTarget.name });
          break;
        }
        if (result.damage === 0) {
          pushText(state, 'battle.log.fail');
          break;
        }
        let damage = runModifyDamage(
          makeContext(state, side, { source: attacker, target: hitTarget, move: perHitMove }),
          perHitMove,
          result.damage,
          result.effectiveness,
          result.crit,
        );
        if (hiding === 'double') damage = damage * SEMI_INVULNERABLE_COUNTER_MULTIPLIER;
        // The Endure move spares the user for the rest of the turn, even at 1 HP,
        // and drops off before the next one. The room's `endure` condition lasts
        // the whole battle, so it only spares a target still above 1 HP: clamping
        // `hp - 1` to 0 at 1 HP made it immortal and the boss arena unwinnable.
        const moveEndure = hitTarget.volatiles.endure;
        const roomEndure = state.roomField.endure && hitTarget.hp > 1;
        if ((moveEndure || roomEndure) && damage >= hitTarget.hp) {
          damage = Math.max(0, hitTarget.hp - 1);
          pushText(state, 'battle.log.enduredHit', { name: hitTarget.name });
        }
        const bypassSubstitute = runTrySubstitute(
          makeContext(state, side, { source: attacker, target: hitTarget, move: perHitMove }),
          perHitMove,
        );
        if (!bypassSubstitute && hasSubstitute(hitTarget)) {
          absorbWithSubstitute(hitTarget, damage);
          pushText(state, 'battle.log.hitSubstitute', { name: hitTarget.name });
          if (hitTarget.volatiles.substitute === 0) {
            pushText(state, 'battle.log.substituteFaded', { name: hitTarget.name });
          }
          continue;
        }
        const dealt = applyDamage(hitTarget, damage);
        hitTarget.volatiles.lastDamageTaken = dealt;
        totalDamage += dealt;
        if (perHitMove.category === 'Physical') hitTarget.volatiles.physicalDamageTaken += dealt;
        else if (perHitMove.category === 'Special') hitTarget.volatiles.specialDamageTaken += dealt;
        pushEvent(state, {
          kind: 'damage',
          side: aim.side,
          amount: dealt,
          hp: hitTarget.hp,
          maxHp: hitTarget.maxHp,
          effectiveness: result.effectiveness,
          crit: result.crit,
        });
        const line = damageMessage(perHitMove, result, hitTarget);
        pushText(state, line.key, line.params);
        if (hitTarget.hp <= 0) {
          const bonded = hitTarget.volatiles.destinyBond;
          const grudged = hitTarget.volatiles.grudge;
          faint(state, aim.side, aim.slot);
          if (bonded && attacker.hp > 0) {
            pushText(state, 'battle.log.downWithIt', { name: hitTarget.name });
            applyDamage(attacker, attacker.hp);
            faint(state, side, attackerSlot);
          }
          if (grudged && moveSlot) {
            moveSlot.pp = 0;
            pushText(state, 'battle.log.grudgePp', { name: attacker.name, move: perHitMove.id });
          }
          break;
        }
      }
      if (hitMove.id === 'spitup' && totalDamage > 0) attacker.volatiles.stockpile = 0;
    }
    damaged = damaged || totalDamage > 0;
  }

  if (countered) return;
  if (!effectMove) return;

  if (effectMove.category !== 'Status') attacker.volatiles.laserFocus = false;

  applyMoveEffects(state, side, effectMove, totalDamage, damaged, effectTarget ?? undefined);
  if (effectMove.id === 'instruct') {
    instructTarget(state, side, effectTarget);
  }
  // Contact reactions are not "the move's effect", so Mold Breaker stops piercing here.
  state.abilityPierce = null;
  if (lastHitContext) runAfterMove(lastHitContext, effectMove, damaged);
  maybeSelfSwitch(state, side, attacker, effectMove);
}

/**
 * Instruct makes the target repeat the move it last used, right away. A move the
 * reference refuses to call (Instruct itself, a call-a-move, a charge move) or one
 * the target no longer has PP for makes the move fail instead.
 */
function instructTarget(state: BattleState, side: SideId, target: BattleFighter | null): void {
  if (!target || target.hp <= 0 || state.winner !== null) return;
  const last = target.lastMoveId ? getMove(target.lastMoveId) : undefined;
  const slot = last ? target.moves.find((entry) => entry.moveId === last.id) : undefined;
  if (!last || !slot || slot.pp <= 0) {
    pushText(state, 'battle.log.fail');
    return;
  }
  if (last.id === 'instruct' || CALLER_MOVES.has(last.id) || last.flags.failinstruct) {
    pushText(state, 'battle.log.fail');
    return;
  }
  pushText(state, 'battle.log.followedInstruction', { name: target.name });
  resolveMove(state, opponentOf(side), target, last, null);
}

function faint(state: BattleState, side: SideId, slot: Slot = 0): void {
  const fighter = activeFighter(state, side, slot);
  pushEvent(state, { kind: 'faint', side, fighterId: fighter.id });
  pushText(state, 'battle.log.fainted', { name: fighter.name });
  // Survivors react to the faint (Soul-Heart); the fainted side cannot.
  const other = opponentOf(side);
  for (const otherSlot of liveSlots(state, other)) {
    runFaint(
      makeContext(state, other, {
        source: activeFighter(state, other, otherSlot),
        target: fighter,
      }),
    );
  }
}

let dancerCopyActive = false;

/** Dancer copies a dance move the foe just used; the guard stops a mirror loop. */
function dancerFollowUp(state: BattleState, side: SideId, move: Move): void {
  if (dancerCopyActive || !move.flags.dance || state.winner !== null) return;
  const foeSide = opponentOf(side);
  const dancer = activeFighter(state, foeSide);
  if (dancer.hp <= 0 || !hasAbility(dancer, 'Dancer')) return;
  const copy = getMove(move.id);
  if (!copy) return;
  dancerCopyActive = true;
  try {
    pushText(state, 'battle.log.danceJoined', { name: dancer.name });
    resolveMove(state, foeSide, dancer, copy, null);
  } finally {
    dancerCopyActive = false;
  }
}

/** Mold Breaker, Teravolt and Turboblaze pierce the foe's ability; Mycelium Might only for status moves. */
function piercesTargetAbility(
  state: BattleState,
  side: SideId,
  attacker: BattleFighter,
  move: Move,
): boolean {
  if (hasAbility(opponent(state, side), 'Neutralizing Gas')) return false;
  if (['Mold Breaker', 'Teravolt', 'Turboblaze'].some((id) => hasAbility(attacker, id))) return true;
  return hasAbility(attacker, 'Mycelium Might') && move.category === 'Status';
}

function gasSuppresses(state: BattleState, side: SideId): boolean {
  return hasAbility(opponent(state, side), 'Neutralizing Gas');
}

/** Unaware and the Ruin auras, after ability suppression, as damage-context flags. */
function damageStatContext(
  state: BattleState,
  side: SideId,
  attacker: BattleFighter,
  defender: BattleFighter,
): Pick<
  DamageContext,
  'ignoreAttackBoosts' | 'ignoreDefenseBoosts' | 'attackMultiplier' | 'defenseMultiplier'
> {
  const foeSide = opponentOf(side);
  const alive = (fighter: BattleFighter, fighterSide: SideId): boolean =>
    state.abilityPierce !== fighter && !gasSuppresses(state, fighterSide);
  const attackerUnaware = hasAbility(attacker, 'Unaware') && !gasSuppresses(state, side);
  const defenderUnaware = hasAbility(defender, 'Unaware') && alive(defender, foeSide);

  let attackMultiplier = 1;
  let defenseMultiplier = 1;
  if (alive(defender, foeSide)) {
    if (hasAbility(defender, 'Tablets of Ruin') || hasAbility(defender, 'Vessel of Ruin')) {
      attackMultiplier *= 0.75;
    }
  }
  if (alive(attacker, side)) {
    if (hasAbility(attacker, 'Sword of Ruin') || hasAbility(attacker, 'Beads of Ruin')) {
      defenseMultiplier *= 0.75;
    }
  }
  return {
    ignoreAttackBoosts: defenderUnaware,
    ignoreDefenseBoosts: attackerUnaware,
    attackMultiplier,
    defenseMultiplier,
  };
}

/** Moves that call another move; never callable from one another. */
const CALLER_MOVES = new Set([
  'metronome',
  'copycat',
  'mirrormove',
  'assist',
  'sleeptalk',
  'naturepower',
  'sketch',
  'struggle',
]);

const TERRAIN_CALL_MOVES: Readonly<Record<string, string>> = {
  electric: 'thunderbolt',
  grassy: 'energyball',
  misty: 'moonblast',
  psychic: 'psychic',
};

/**
 * The id a call-a-move move resolves to, drawn from the seeded battle RNG so a
 * fixed seed reproduces the pick. `null` means the move fails.
 */
function calledMoveId(
  state: BattleState,
  side: SideId,
  attacker: BattleFighter,
  move: Move,
  previousMove: string | null,
): string | null {
  switch (move.id) {
    case 'metronome': {
      const pool = allMoves().filter(
        (entry) => Boolean(entry.flags.metronome) && !CALLER_MOVES.has(entry.id),
      );
      if (pool.length === 0) return null;
      return pool[state.rng.int(0, pool.length - 1)].id;
    }
    case 'copycat': {
      if (!previousMove || CALLER_MOVES.has(previousMove)) return null;
      return previousMove;
    }
    case 'mirrormove': {
      const last = opponent(state, side).lastMoveId;
      if (!last || CALLER_MOVES.has(last)) return null;
      return last;
    }
    case 'assist': {
      const pool: string[] = [];
      for (const member of state.sides[side].party) {
        if (member === attacker) continue;
        for (const entry of member.moves) {
          const candidate = getMove(entry.moveId);
          if (!candidate || candidate.flags.noassist || CALLER_MOVES.has(candidate.id)) continue;
          pool.push(candidate.id);
        }
      }
      if (pool.length === 0) return null;
      return pool[state.rng.int(0, pool.length - 1)];
    }
    case 'sleeptalk': {
      if (attacker.status !== 'slp') return null;
      const pool = attacker.moves
        .map((entry) => entry.moveId)
        .filter((id) => id !== 'sleeptalk' && !getMove(id)?.flags.nosleeptalk && !CALLER_MOVES.has(id));
      if (pool.length === 0) return null;
      return pool[state.rng.int(0, pool.length - 1)];
    }
    case 'naturepower':
      return state.terrain ? (TERRAIN_CALL_MOVES[state.terrain] ?? 'triattack') : 'triattack';
    default:
      return null;
  }
}

function applyWeatherResidual(state: BattleState): void {
  const weather = effectiveWeather(state);
  if (!weather) return;
  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      if (!takesIndirectDamage(fighter)) continue;
      const chip = weatherChip(fighter, weather);
      if (chip <= 0) continue;
      const dealt = applyDamage(fighter, chip);
      pushEvent(state, {
        kind: 'damage',
        side,
        amount: dealt,
        hp: fighter.hp,
        maxHp: fighter.maxHp,
        effectiveness: 1,
        crit: false,
      });
      pushText(state, WEATHER_CHIP_MESSAGES[weather], { name: fighter.name });
      if (fighter.hp <= 0) faint(state, side, slot);
    }
  }
}

function applyTerrainResidual(state: BattleState): void {
  if (!state.terrain) return;
  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      const amount = terrainHeal(fighter, state.terrain);
      if (amount <= 0) continue;
      const healed = applyHeal(fighter, amount);
      if (healed > 0) {
        pushEvent(state, {
          kind: 'heal',
          side,
          amount: healed,
          hp: fighter.hp,
          maxHp: fighter.maxHp,
        });
        pushText(state, 'battle.log.grassyHeal', { name: fighter.name });
      }
    }
  }
}

/**
 * End-of-turn order: primary status, weather, terrain, ability/item residuals,
 * Leech Seed, perish count, then volatile decay and field counters. Every loop
 * runs the side's live slots in ascending order.
 */
function resolveResiduals(state: BattleState): void {
  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      if (fighter.hp <= 0) continue;
      const residual =
        hasAbility(fighter, 'Poison Heal') || !takesIndirectDamage(fighter)
          ? null
          : residualDamage(fighter);
      if (!residual) continue;
      const dealt = applyDamage(fighter, residual.damage);
      pushEvent(state, {
        kind: 'damage',
        side,
        amount: dealt,
        hp: fighter.hp,
        maxHp: fighter.maxHp,
        effectiveness: 1,
        crit: false,
      });
      pushText(state, STATUS_RESIDUAL[residual.status], { name: fighter.name });
      if (fighter.hp <= 0) faint(state, side, slot);
    }
  }

  applyWeatherResidual(state);
  applyTerrainResidual(state);

  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      if (fighter.hp <= 0) continue;
      runResidual(makeContext(state, side, { source: fighter, target: opponent(state, side) }));
      if (fighter.hp <= 0) faint(state, side, slot);
    }
  }

  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      const trap = fighter.volatiles.partiallyTrapped;
      if (!trap || fighter.hp <= 0) continue;
      if (takesIndirectDamage(fighter)) {
        const base = Math.max(1, Math.floor(fighter.maxHp / PARTIAL_TRAP_FRACTION));
        const damage = runModifyTrapDamage(
          makeContext(state, side, { source: fighter, target: opponent(state, side) }),
          base,
        );
        const dealt = applyDamage(fighter, damage);
        pushEvent(state, {
          kind: 'damage',
          side,
          amount: dealt,
          hp: fighter.hp,
          maxHp: fighter.maxHp,
          effectiveness: 1,
          crit: false,
        });
        pushText(state, 'battle.log.partiallyTrapped', { name: fighter.name, move: trap.moveId });
      }
      const left = tickPartialTrap(fighter);
      if (fighter.hp <= 0) {
        faint(state, side, slot);
        continue;
      }
      if (left === 0) pushText(state, 'battle.log.partiallyTrappedEnd', { name: fighter.name });
    }
  }

  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      if (fighter.hp <= 0 || fighter.volatiles.yawn <= 0) continue;
      fighter.volatiles.yawn -= 1;
      if (fighter.volatiles.yawn === 0) {
        applyStatusEffect(state, side, fighter, 'slp', {
          key: 'battle.log.fellAsleep',
          params: { name: fighter.name },
        });
      }
    }
  }

  for (const side of SIDE_IDS) {
    const battleSide = state.sides[side];
    if (battleSide.wishTurns <= 0) continue;
    battleSide.wishTurns -= 1;
    if (battleSide.wishTurns > 0) continue;
    const fighter = activeFighter(state, side);
    if (fighter.hp <= 0) continue;
    const healed = applyHeal(fighter, Math.max(1, Math.floor(fighter.maxHp / 2)));
    if (healed > 0) {
      pushEvent(state, { kind: 'heal', side, amount: healed, hp: fighter.hp, maxHp: fighter.maxHp });
      pushText(state, 'battle.log.wishCameTrue', { name: fighter.name });
    }
  }

  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      if (fighter.hp <= 0 || !takesIndirectDamage(fighter)) continue;
      const drain = leechSeedDamage(fighter);
      if (drain <= 0) continue;
      applyDamage(fighter, drain);
      pushText(state, 'battle.log.leechSeed', { name: fighter.name });
      const other = opponent(state, side);
      const healed = applyHeal(other, drain);
      if (healed > 0) {
        pushEvent(state, {
          kind: 'heal',
          side: opponentOf(side),
          amount: healed,
          hp: other.hp,
          maxHp: other.maxHp,
        });
      }
      if (fighter.hp <= 0) faint(state, side, slot);
    }
  }

  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      if (fighter.hp <= 0) continue;
      if (tickPerish(fighter)) {
        applyDamage(fighter, fighter.hp);
        pushText(state, 'battle.log.faintedPerish', { name: fighter.name });
        faint(state, side, slot);
      }
    }
  }

  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      if (fighter.hp <= 0) continue;
      if (fighter.volatiles.aquaRing || fighter.volatiles.ingrain) {
        const healed = applyHeal(fighter, Math.max(1, Math.floor(fighter.maxHp / 16)));
        if (healed > 0) {
          pushEvent(state, {
            kind: 'heal',
            side,
            amount: healed,
            hp: fighter.hp,
            maxHp: fighter.maxHp,
          });
          pushText(
            state,
            fighter.volatiles.aquaRing ? 'battle.log.aquaRingHeal' : 'battle.log.ingrainHeal',
            { name: fighter.name },
          );
        }
      }
      if (fighter.volatiles.curse && takesIndirectDamage(fighter)) {
        const dealt = applyDamage(fighter, Math.max(1, Math.floor(fighter.maxHp / 4)));
        pushEvent(state, {
          kind: 'damage',
          side,
          amount: dealt,
          hp: fighter.hp,
          maxHp: fighter.maxHp,
          effectiveness: 1,
          crit: false,
        });
        pushText(state, 'battle.log.curse', { name: fighter.name });
        if (fighter.hp <= 0) faint(state, side, slot);
      }
      if (fighter.hp > 0 && fighter.volatiles.octolock) {
        applyBoostEffect(
          state,
          side,
          fighter,
          { def: -1, spd: -1 },
          {
            self: true,
            message: { key: 'battle.log.move.octolock', params: { name: fighter.name } },
          },
        );
      }
      if (fighter.hp > 0) {
        if (fighter.volatiles.nightmare && fighter.status !== 'slp') {
          fighter.volatiles.nightmare = false;
        }
        const nightmare = nightmareDamage(fighter);
        if (nightmare > 0) {
          const dealt = applyDamage(fighter, nightmare);
          pushEvent(state, {
            kind: 'damage',
            side,
            amount: dealt,
            hp: fighter.hp,
            maxHp: fighter.maxHp,
            effectiveness: 1,
            crit: false,
          });
          pushText(state, 'battle.log.nightmare', { name: fighter.name });
          if (fighter.hp <= 0) faint(state, side, slot);
        }
      }
    }
  }

  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      if (fighter.hp > 0) endOfTurnVolatile(fighter);
    }
  }
  tickWeather(state);
  tickTerrain(state);
  tickConditions(state);
}

/**
 * The battle ends when a side has no healthy Pokémon left. Otherwise a side owes
 * a replacement only when a live slot holds a fainted fighter and a reserve is
 * left to send; one live slot with no reserve keeps fighting.
 */
function resolveFaints(state: BattleState): void {
  const playerAlive = hasHealthy(state, 'player');
  const enemyAlive = hasHealthy(state, 'enemy');
  if (!playerAlive && !enemyAlive) finishBattle(state, 'draw');
  else if (!playerAlive) finishBattle(state, 'enemy');
  else if (!enemyAlive) finishBattle(state, 'player');
  else {
    for (const side of SIDE_IDS) {
      if (sideNeedsReplacement(state, side)) state.sides[side].awaitingReplacement = true;
    }
  }
}

/** True once `side` has spent its one Mega Evolution of the battle. */
function megaUsed(state: BattleState, side: SideId): boolean {
  return state.sides[side].party.some((fighter) => fighter.mega);
}

/** True once `side` has spent its one Gigantamax of the battle. */
function gmaxUsed(state: BattleState, side: SideId): boolean {
  return state.sides[side].party.some((fighter) => fighter.gmax);
}

/** The first foe slot a command can still hit, or the command's own target when it lives. */
function aimedCommand(state: BattleState, side: SideId, command: FightCommand): FightCommand | null {
  const foeSide = opponentOf(side);
  const live = liveSlots(state, foeSide).filter((slot) => activeFighter(state, foeSide, slot).hp > 0);
  if (live.length === 0) return null;
  const target = command.target;
  if (target && target.side === foeSide && live.includes(target.slot)) return command;
  const wanted = target && target.side === foeSide ? target.slot : 0;
  const slot = live.includes(wanted) ? wanted : live[0];
  return { ...command, target: { side: foeSide, slot } };
}

/**
 * Resolves one turn with up to two commands per side: every provided slot is
 * validated, switches/items/runs act before moves in slot order, the commanded
 * slots' Mega and Gigantamax resolve, and the fighting slots act on priority then
 * Speed. The caller must resolve any pending replacement before the next turn.
 */
export function takeDoubleTurn(
  state: BattleState,
  playerCommands: SlotCommands,
  enemyCommands: SlotCommands,
): void {
  if (state.winner !== null) return;

  const commands: Record<SideId, SlotCommands> = {
    player: slotCommands(playerCommands),
    enemy: slotCommands(enemyCommands),
  };

  for (const side of SIDE_IDS) {
    for (const slot of SLOTS) {
      const command = commands[side][slot];
      if (!command) continue;
      const error = validateCommand(state, side, command);
      if (error) throw new Error(error);
    }
  }

  state.turn += 1;
  pushEvent(state, { kind: 'turn', turn: state.turn });
  state.movedSides = [];
  state.switchedSides = [];
  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      fighter.volatiles.physicalDamageTaken = 0;
      fighter.volatiles.specialDamageTaken = 0;
    }
  }

  resolvePreMoveActions(state, commands);
  if (state.winner !== null) return;

  // Mega Evolution resolves before any move, so the turn's order and damage read
  // the Mega's stats, type and ability (D34). One per side per battle, whatever
  // the slot: a partner can never spend a second stone.
  for (const side of SIDE_IDS) {
    if (megaUsed(state, side)) continue;
    for (const slot of SLOTS) {
      const command = commands[side][slot];
      if (command?.type !== 'fight' || !command.mega) continue;
      withLeadSlot(state, side, slot, () => megaEvolve(state, side));
      break;
    }
  }
  if (state.winner !== null) return;

  // Gigantamax resolves at the same point (D44): the doubled pool and the forme's
  // name are in place before the turn's first move.
  for (const side of SIDE_IDS) {
    if (gmaxUsed(state, side)) continue;
    for (const slot of SLOTS) {
      const command = commands[side][slot];
      if (command?.type !== 'fight' || !command.gmax) continue;
      withLeadSlot(state, side, slot, () => gigantamax(state, side));
      break;
    }
  }
  if (state.winner !== null) return;

  const moveEntries: { side: SideId; slot: Slot; priority: number; fractional: number }[] = [];
  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const command = commands[side][slot];
      if (command?.type !== 'fight') continue;
      const fighter = activeFighter(state, side, slot);
      const selected = chosenMove(fighter, command, barredMovesFor(state, side));
      if (!selected) {
        moveEntries.push({ side, slot, priority: 0, fractional: 0 });
        continue;
      }
      const ctx = makeContext(state, side, {
        source: fighter,
        target: commandedTarget(state, side, command) ?? opponent(state, side),
        move: selected.move,
      });
      moveEntries.push({
        side,
        slot,
        priority: runModifyPriority(ctx, selected.move, selected.move.priority),
        fractional: runFractionalPriority(ctx),
      });
    }
  }

  // Quash can land mid-turn, so the order is drained rather than walked: a quashed
  // entry is moved to the back while another entry is still waiting to act.
  const queue = orderActions(state, moveEntries, state.rng);
  while (queue.length > 0) {
    const entry = queue[0];
    const quashed = activeFighter(state, entry.side, entry.slot ?? 0).volatiles.quash;
    const waiting = queue
      .slice(1)
      .some((other) => !activeFighter(state, other.side, other.slot ?? 0).volatiles.quash);
    if (quashed && waiting) {
      queue.push(queue.shift() as (typeof queue)[number]);
      continue;
    }
    queue.shift();
    if (state.winner !== null) break;
    const slot = entry.slot ?? 0;
    if (activeFighter(state, entry.side, slot).hp <= 0) continue;
    const command = commands[entry.side][slot];
    if (!command || command.type !== 'fight') continue;
    const aimed = aimedCommand(state, entry.side, command);
    if (!aimed) continue;
    useMove(state, entry.side, aimed, commands);
    if (!state.movedSides.includes(entry.side)) state.movedSides.push(entry.side);
  }

  if (state.winner !== null) return;
  resolveResiduals(state);
  if (state.winner !== null) return;
  resolveFaints(state);
}

/**
 * Resolves one turn with one command per side — the single-battle entry point.
 * It is exactly `takeDoubleTurn(state, { 0: player }, { 0: enemy })`.
 */
export function takeTurn(state: BattleState, playerCommand: Command, enemyCommand: Command): void {
  takeDoubleTurn(state, { 0: playerCommand }, { 0: enemyCommand });
}

/** True while either side still owes a replacement before the next turn. */
export function needsReplacement(state: BattleState): readonly SideId[] {
  return SIDE_IDS.filter((side) => state.sides[side].awaitingReplacement);
}

/**
 * Fills every emptied live slot with the first healthy reserve that is not
 * already active, slot 0 first. A self-switch (U-turn, Baton Pass) leaves its
 * active healthy: then the lead is the slot that hands over, as it always has.
 */
export function autoReplace(state: BattleState): void {
  for (const side of needsReplacement(state)) {
    const slots = liveSlots(state, side);
    const emptied = slots.filter((slot) => activeFighter(state, side, slot).hp <= 0);
    for (const slot of emptied.length > 0 ? emptied : [0 as Slot]) {
      const index = reserveIndex(state, side);
      if (index >= 0) performSwitch(state, side, index, slot);
    }
  }
}
