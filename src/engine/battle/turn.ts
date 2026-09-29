import { effectiveness, getMove, type Move, type MoveEffect } from '../../data/dex';
import {
  applyDamage,
  applyHeal,
  resetBattleState,
  BOOST_IDS,
  type BattleFighter,
  type BoostId,
} from './fighter';
import {
  makeContext,
  runAfterMove,
  runModifyCrit,
  runModifyCritRatio,
  runModifyDamage,
  runModifyMultihit,
  runModifyPriority,
  runModifyRecoil,
  runResidual,
  runStart,
  runSwitchIn,
  runSwitchOut,
  runTryHit,
  runTrySecondary,
  runTrySubstitute,
  runTryVolatile,
} from './effects/registry';
import { rollHitWith } from './modifiers';
import { applyBoostEffect, applyStatusEffect } from './effects/apply';
import { isProtectMove, protectBlocks } from './effects/moves';
import { setTerrain, terrainFromMove, terrainHeal, tickTerrain } from './effects/terrain';
import { setWeather, tickWeather, weatherChip, weatherFromMove, weatherLabel } from './effects/weather';
import { computeDamage, rollCrit, type DamageResult } from './damage';
import { orderActions } from './order';
import {
  selectedMove,
  useBagItem,
  validateCommand,
  type Command,
  type FightCommand,
  type SelectedMove,
} from './commands';
import {
  SIDE_IDS,
  activeFighter,
  finishBattle,
  hasHealthy,
  opponent,
  opponentOf,
  pushEvent,
  pushText,
  type BattleState,
  type SideId,
} from './state';
import { beforeMoveStatus, residualDamage, statusName } from './status';
import {
  absorbWithSubstitute,
  applyConfusion,
  applyEncore,
  applyFlinch,
  applyLeechSeed,
  applyPerish,
  applyTaunt,
  applyTrap,
  beforeMoveVolatile,
  endOfTurnVolatile,
  hasSubstitute,
  isTaunted,
  leechSeedDamage,
  makeSubstitute,
  tickPerish,
} from './volatile';
import { rollRun } from './runAway';

export function performSwitch(state: BattleState, side: SideId, partyIndex: number): void {
  const battleSide = state.sides[side];
  const outgoing = activeFighter(state, side);
  runSwitchOut(makeContext(state, side, { source: outgoing, target: opponent(state, side) }));
  battleSide.activeIndex = partyIndex;
  battleSide.awaitingReplacement = false;
  resetBattleState(outgoing);

  const incoming = activeFighter(state, side);
  if (!state.switchedSides.includes(side)) state.switchedSides.push(side);
  pushEvent(state, { kind: 'switch', side, fighterId: incoming.id });
  pushText(state, `${state.sides[side].name} sent out ${incoming.name}!`);

  const ctx = makeContext(state, side, { source: incoming, target: opponent(state, side) });
  runStart(ctx);
  runSwitchIn(ctx);

  const passed = battleSide.batonPassBoosts;
  if (passed) {
    battleSide.batonPassBoosts = null;
    applyBoostEffect(state, side, incoming, passed, {
      self: true,
      message: `${incoming.name} inherited the raised stats!`,
    });
  }
}

function resolvePreMoveActions(
  state: BattleState,
  commands: Readonly<Record<SideId, Command>>,
): void {
  const entries = SIDE_IDS.filter((side) => commands[side].type !== 'fight').map((side) => ({
    side,
    priority: 6,
  }));
  for (const entry of orderActions(state, entries, state.rng)) {
    if (state.winner !== null) return;
    const command = commands[entry.side];
    switch (command.type) {
      case 'switch':
        performSwitch(state, entry.side, command.partyIndex);
        break;
      case 'bag':
        useBagItem(state, entry.side, command.itemId);
        break;
      case 'run': {
        const success = rollRun(state, entry.side);
        pushEvent(state, { kind: 'run', side: entry.side, success });
        pushText(
          state,
          success
            ? 'Got away safely!'
            : `${state.sides[entry.side].name} couldn't get away!`,
        );
        if (success) finishBattle(state, 'draw');
        break;
      }
      case 'fight':
        break;
    }
  }
}

function blockedMessage(fighter: BattleFighter, reason: 'slp' | 'frz' | 'par'): string {
  if (reason === 'slp') return `${fighter.name} is fast asleep.`;
  if (reason === 'frz') return `${fighter.name} is frozen solid!`;
  return `${fighter.name} is paralyzed! It can't move!`;
}

function damageMessage(
  moveName: string,
  result: DamageResult,
  defender: BattleFighter,
): string {
  const parts: string[] = [];
  if (result.crit) parts.push('A critical hit!');
  if (result.effectiveness > 1) parts.push("It's super effective!");
  else if (result.effectiveness < 1) parts.push("It's not very effective...");
  const head = `${moveName} hit ${defender.name}`;
  return parts.length > 0 ? `${head}! ${parts.join(' ')}` : `${head}!`;
}

function multihitHits(move: Move, rng: BattleState['rng']): number {
  if (!move.multihit) return 1;
  if (typeof move.multihit === 'number') return move.multihit;
  return rng.int(move.multihit[0], move.multihit[1]);
}

function applyVolatileEffect(
  state: BattleState,
  targetSide: SideId,
  target: BattleFighter,
  volatileStatus: string | undefined,
): void {
  if (!volatileStatus) return;
  const ctx = makeContext(state, targetSide, { source: target, target: opponent(state, targetSide) });
  if (!runTryVolatile(ctx, volatileStatus)) return;
  const applied = ((): boolean => {
    switch (volatileStatus) {
      case 'confusion':
        return applyConfusion(target, state.rng);
      case 'leechseed':
        return hasSubstitute(target) ? false : applyLeechSeed(target);
      case 'taunt':
        return hasSubstitute(target) ? false : applyTaunt(target);
      case 'encore':
        return hasSubstitute(target) ? false : applyEncore(target);
      case 'trapped':
      case 'partiallytrapped':
        applyTrap(target);
        return true;
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
      case 'substitute': {
        const cost = makeSubstitute(target);
        if (cost > 0) pushText(state, `${target.name} put in a substitute!`);
        return cost > 0;
      }
      default:
        return false;
    }
  })();
  if (applied) {
    pushText(
      state,
      volatileStatus === 'yawn'
        ? `${target.name} grew drowsy!`
        : `${target.name} was affected by ${volatileStatus}!`,
    );
  }
}

function applySecondary(
  state: BattleState,
  side: SideId,
  effect: MoveEffect,
  attacker: BattleFighter,
  defender: BattleFighter,
): void {
  if (effect.chance !== undefined && state.rng.int(1, 100) > effect.chance) return;
  if (effect.self) {
    if (effect.self.boosts) applyBoostEffect(state, side, attacker, effect.self.boosts, { self: true });
    if (effect.self.status) applyStatusEffect(state, side, attacker, effect.self.status);
  }
  const secondaryCtx = makeContext(state, side, { source: attacker, target: defender });
  if (!runTrySecondary(secondaryCtx, effect)) return;
  if (effect.status) applyStatusEffect(state, opponentOf(side), defender, effect.status);
  if (effect.volatileStatus) {
    applyVolatileEffect(state, opponentOf(side), defender, effect.volatileStatus);
  }
  if (effect.boosts) applyBoostEffect(state, opponentOf(side), defender, effect.boosts);
}

function applyMoveEffects(
  state: BattleState,
  side: SideId,
  move: Move,
  totalDamage: number,
  defenderDamaged: boolean,
): void {
  const attacker = activeFighter(state, side);
  const defender = opponent(state, side);
  const selfTarget = move.target === 'self';

  if (move.status) applyStatusEffect(state, opponentOf(side), defender, move.status);

  if (move.volatileStatus) {
    applyVolatileEffect(state, selfTarget ? side : opponentOf(side), selfTarget ? attacker : defender, move.volatileStatus);
  }

  if (move.boosts) {
    applyBoostEffect(state, selfTarget ? side : opponentOf(side), selfTarget ? attacker : defender, move.boosts, {
      self: selfTarget,
    });
  }

  if (move.heal && move.heal.length === 2) {
    const healed = applyHeal(attacker, Math.floor((attacker.maxHp * move.heal[0]) / move.heal[1]));
    if (healed > 0) {
      pushEvent(state, { kind: 'heal', side, amount: healed, hp: attacker.hp, maxHp: attacker.maxHp });
      pushText(state, `${attacker.name} regained health!`);
    }
  }

  if (move.id === 'wish') {
    state.sides[side].wishTurns = 2;
    pushText(state, `${attacker.name} made a wish!`);
  }

  if (move.self?.boosts) applyBoostEffect(state, side, attacker, move.self.boosts, { self: true });

  const secondaries: MoveEffect[] = [];
  if (move.secondaries) secondaries.push(...move.secondaries);
  const sheerForce = attacker.ability === 'Sheer Force' && move.basePower > 0;
  if (defenderDamaged && !sheerForce) {
    for (const secondary of secondaries) applySecondary(state, side, secondary, attacker, defender);
  }

  if (move.drain && move.drain.length === 2 && totalDamage > 0) {
    const drained = Math.max(1, Math.floor((totalDamage * move.drain[0]) / move.drain[1]));
    if (defender.ability === 'Liquid Ooze') {
      const dealt = applyDamage(attacker, drained);
      pushEvent(state, {
        kind: 'damage',
        side,
        amount: dealt,
        hp: attacker.hp,
        maxHp: attacker.maxHp,
        effectiveness: 1,
        crit: false,
      });
      pushText(state, `${attacker.name} sucked up the liquid ooze!`);
    } else {
      const healed = applyHeal(attacker, drained);
      if (healed > 0) {
        pushEvent(state, { kind: 'heal', side, amount: healed, hp: attacker.hp, maxHp: attacker.maxHp });
        pushText(state, `${attacker.name} had its energy drained!`);
      }
    }
  }

  if (move.recoil && move.recoil.length === 2 && totalDamage > 0) {
    const raw = Math.max(1, Math.floor((totalDamage * move.recoil[0]) / move.recoil[1]));
    const recoil = runModifyRecoil(
      makeContext(state, side, { source: attacker, target: opponent(state, side), move }),
      move,
      raw,
    );
    if (recoil > 0) {
      const dealt = applyDamage(attacker, recoil);
      pushEvent(state, { kind: 'damage', side, amount: dealt, hp: attacker.hp, maxHp: attacker.maxHp, effectiveness: 1, crit: false });
      pushText(state, `${attacker.name} is damaged by recoil!`);
    }
  }

  if (move.struggleRecoil && attacker.hp > 0) {
    const recoil = Math.max(1, Math.floor(attacker.maxHp / 4));
    const dealt = applyDamage(attacker, recoil);
    pushEvent(state, { kind: 'damage', side, amount: dealt, hp: attacker.hp, maxHp: attacker.maxHp, effectiveness: 1, crit: false });
    pushText(state, `${attacker.name} is damaged by recoil!`);
  }

  if (move.selfdestruct) {
    applyDamage(attacker, attacker.hp);
    pushText(state, `${attacker.name} fainted!`);
    pushEvent(state, { kind: 'faint', side, fighterId: attacker.id });
  }

  const newWeather = weatherFromMove(move);
  if (newWeather) {
    if (state.weather === newWeather) pushText(state, 'But it failed!');
    else setWeather(state, newWeather);
  }

  const newTerrain = terrainFromMove(move);
  if (newTerrain) {
    if (state.terrain === newTerrain) pushText(state, 'But it failed!');
    else setTerrain(state, newTerrain);
  }
}

const CHARGE_VERBS: Readonly<Record<string, string>> = {
  solarbeam: 'absorbed light!',
  solarblade: 'absorbed light!',
  fly: 'flew up high!',
  dig: 'burrowed its way under the ground!',
  dive: 'hid underwater!',
  bounce: 'sprang up!',
  phantomforce: 'vanished instantly!',
  shadowforce: 'vanished instantly!',
  meteorbeam: 'is overflowing with space power!',
  electroshot: 'absorbed electricity!',
  skyattack: 'became cloaked in a harsh light!',
  freezeshock: 'became cloaked in a freezing light!',
  iceburn: 'became cloaked in a freezing light!',
};

function chargeVerb(moveId: string): string {
  return CHARGE_VERBS[moveId] ?? 'is charging up!';
}

/** Solar Beam and Solar Blade skip the charge in harsh sunlight. */
function chargesInstantly(state: BattleState, move: Move): boolean {
  if (move.id !== 'solarbeam' && move.id !== 'solarblade') return false;
  return state.weather === 'sun';
}

/** The move a charging fighter is locked into, ignoring the chosen command. */
function lockedMove(attacker: BattleFighter, moveId: string): SelectedMove | null {
  const move = getMove(moveId);
  if (!move) return null;
  const slot = attacker.moves.find((entry) => entry.moveId === moveId) ?? null;
  return { move, slot };
}

/** The selected move, honouring a charge-move lock before the command. */
function chosenMove(fighter: BattleFighter, command: FightCommand): SelectedMove | null {
  const charging = fighter.volatiles.charging;
  return charging ? lockedMove(fighter, charging) : selectedMove(fighter, command);
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
  if (foe.ability === 'Pressure' && PRESSURED_TARGETS.has(move.target)) return 2;
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
    pushText(state, 'But it failed!');
    return;
  }
  const eff = effectiveness(move.type, defender.types);
  if (eff === 0) {
    pushText(state, `It doesn't affect ${defender.name}...`);
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
  pushText(state, `${defender.name} was hit by the countered attack!`);
  if (defender.hp <= 0) faint(state, opponentOf(side));
}

/** U-turn and friends hand the turn over to the bench; Baton Pass carries boosts. */
function maybeSelfSwitch(
  state: BattleState,
  side: SideId,
  attacker: BattleFighter,
  move: Move,
): void {
  if (!move.selfSwitch || state.winner !== null || attacker.hp <= 0) return;
  const battleSide = state.sides[side];
  const hasBench = battleSide.party.some(
    (fighter, index) => index !== battleSide.activeIndex && fighter.hp > 0,
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

export function useMove(state: BattleState, side: SideId, command: FightCommand): void {
  const attacker = activeFighter(state, side);
  const selected = chosenMove(attacker, command);
  if (!selected) return;
  const { move, slot } = selected;

  pushEvent(state, { kind: 'move', side, moveId: move.id });
  pushText(state, `${attacker.name} used ${move.name}!`);
  if (!isProtectMove(move.id)) attacker.volatiles.protectStreak = 0;

  if (move.category === 'Status' && isTaunted(attacker)) {
    pushText(state, `${attacker.name} can't use status moves while taunted!`);
    return;
  }

  const statusCheck = beforeMoveStatus(attacker, state.rng);
  if (statusCheck && 'blocked' in statusCheck) {
    pushText(state, blockedMessage(attacker, statusCheck.blocked));
    return;
  }
  if (statusCheck && 'cured' in statusCheck) {
    pushText(
      state,
      statusCheck.cured === 'slp' ? `${attacker.name} woke up!` : `${attacker.name} thawed out!`,
    );
  }

  const volatileCheck = beforeMoveVolatile(attacker, state.rng);
  if (volatileCheck && 'flinched' in volatileCheck) {
    pushText(state, `${attacker.name} flinched and couldn't move!`);
    return;
  }
  if (volatileCheck && 'confusionDamage' in volatileCheck) {
    if (slot) slot.pp = Math.max(0, slot.pp - ppCost(state, side, move));
    attacker.lastMoveId = move.id;
    pushEvent(state, { kind: 'damage', side, amount: volatileCheck.confusionDamage, hp: attacker.hp, maxHp: attacker.maxHp, effectiveness: 1, crit: false });
    pushText(state, `${attacker.name} is confused. It hurt itself in its confusion!`);
    if (attacker.hp <= 0) faint(state, side);
    return;
  }
  if (volatileCheck && 'confusionEnded' in volatileCheck) {
    pushText(state, `${attacker.name} snapped out of its confusion!`);
  }

  if (move.flags.charge) {
    if (attacker.volatiles.charging !== move.id && !chargesInstantly(state, move)) {
      attacker.volatiles.charging = move.id;
      pushText(state, `${attacker.name} ${chargeVerb(move.id)}`);
      return;
    }
    attacker.volatiles.charging = null;
  }

  if (slot) slot.pp = Math.max(0, slot.pp - ppCost(state, side, move));
  attacker.lastMoveId = move.id;

  if (protectBlocks(state, side, move)) return;

  const defender = opponent(state, side);
  if (move.category !== 'Status' && !rollHitWith(state, side, move.accuracy)) {
    pushText(state, `${attacker.name}'s attack missed!`);
    return;
  }

  const hitContext = makeContext(state, side, { source: attacker, target: defender, move });
  if (!runTryHit(hitContext, move)) return;

  if (COUNTER_MOVES.has(move.id)) {
    useCounterMove(state, side, attacker, defender, move);
    return;
  }

  let totalDamage = 0;
  if (move.category !== 'Status' && move.basePower > 0) {
    const rolled = multihitHits(move, state.rng);
    const hits = runModifyMultihit(makeContext(state, side, { source: attacker, target: defender, move }), move, rolled);
    for (let hit = 0; hit < hits; hit++) {
      const target = opponent(state, side);
      if (target.hp <= 0) break;
      const crit = runModifyCrit(
        makeContext(state, side, { source: attacker, target, move }),
        move,
        rollCrit(
          state.rng,
          runModifyCritRatio(
            makeContext(state, side, { source: attacker, target, move }),
            move,
            move.critRatio,
          ),
        ),
      );
      const result = computeDamage(attacker, target, move, state.rng, {
        weather: state.weather,
        terrain: state.terrain,
        critical: crit,
      });
      if (result.effectiveness === 0) {
        if (hit === 0) pushText(state, `It doesn't affect ${target.name}...`);
        break;
      }
      const damage = runModifyDamage(
        makeContext(state, side, { source: attacker, target, move }),
        move,
        result.damage,
        result.effectiveness,
        result.crit,
      );
      const bypassSubstitute = runTrySubstitute(
        makeContext(state, side, { source: attacker, target, move }),
        move,
      );
      if (!bypassSubstitute && hasSubstitute(target)) {
        absorbWithSubstitute(target, damage);
        pushText(state, `It hit ${target.name}'s substitute!`);
        if (target.volatiles.substitute === 0) pushText(state, `${target.name}'s substitute faded!`);
        continue;
      }
      const dealt = applyDamage(target, damage);
      totalDamage += dealt;
      if (move.category === 'Physical') target.volatiles.physicalDamageTaken += dealt;
      else if (move.category === 'Special') target.volatiles.specialDamageTaken += dealt;
      pushEvent(state, { kind: 'damage', side: opponentOf(side), amount: dealt, hp: target.hp, maxHp: target.maxHp, effectiveness: result.effectiveness, crit: result.crit });
      pushText(state, damageMessage(move.name, result, target));
      if (target.hp <= 0) {
        faint(state, opponentOf(side));
        break;
      }
    }
  }

  applyMoveEffects(state, side, move, totalDamage, totalDamage > 0);
  runAfterMove(hitContext, move, totalDamage > 0);
  maybeSelfSwitch(state, side, attacker, move);
}

function faint(state: BattleState, side: SideId): void {
  const fighter = activeFighter(state, side);
  pushEvent(state, { kind: 'faint', side, fighterId: fighter.id });
  pushText(state, `${fighter.name} fainted!`);
}

function applyWeatherResidual(state: BattleState): void {
  if (!state.weather) return;
  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    const chip = weatherChip(fighter, state.weather);
    if (chip <= 0) continue;
    const dealt = applyDamage(fighter, chip);
    pushEvent(state, { kind: 'damage', side, amount: dealt, hp: fighter.hp, maxHp: fighter.maxHp, effectiveness: 1, crit: false });
    pushText(state, `${fighter.name} is buffeted by the ${weatherLabel(state.weather)}!`);
    if (fighter.hp <= 0) faint(state, side);
  }
}

function applyTerrainResidual(state: BattleState): void {
  if (!state.terrain) return;
  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    const amount = terrainHeal(fighter, state.terrain);
    if (amount <= 0) continue;
    const healed = applyHeal(fighter, amount);
    if (healed > 0) {
      pushEvent(state, { kind: 'heal', side, amount: healed, hp: fighter.hp, maxHp: fighter.maxHp });
      pushText(state, `${fighter.name} is restored by the grassy terrain!`);
    }
  }
}

/**
 * End-of-turn order: primary status, weather, terrain, ability/item residuals,
 * Leech Seed, perish count, then volatile decay and field counters.
 */
function resolveResiduals(state: BattleState): void {
  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    if (fighter.hp <= 0) continue;
    const residual = fighter.ability === 'Poison Heal' ? null : residualDamage(fighter);
    if (!residual) continue;
    const dealt = applyDamage(fighter, residual.damage);
    pushEvent(state, { kind: 'damage', side, amount: dealt, hp: fighter.hp, maxHp: fighter.maxHp, effectiveness: 1, crit: false });
    pushText(state, `${fighter.name} is hurt by its ${statusName(residual.status)}!`);
    if (fighter.hp <= 0) faint(state, side);
  }

  applyWeatherResidual(state);
  applyTerrainResidual(state);

  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    if (fighter.hp <= 0) continue;
    runResidual(makeContext(state, side, { source: fighter, target: opponent(state, side) }));
    if (fighter.hp <= 0) faint(state, side);
  }

  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    if (fighter.hp <= 0 || fighter.volatiles.yawn <= 0) continue;
    fighter.volatiles.yawn -= 1;
    if (fighter.volatiles.yawn === 0) {
      applyStatusEffect(state, side, fighter, 'slp', `${fighter.name} fell asleep!`);
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
      pushText(state, `${fighter.name}'s wish came true!`);
    }
  }

  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    if (fighter.hp <= 0) continue;
    const drain = leechSeedDamage(fighter);
    if (drain <= 0) continue;
    applyDamage(fighter, drain);
    pushText(state, `${fighter.name}'s health is sapped by Leech Seed!`);
    const other = opponent(state, side);
    const healed = applyHeal(other, drain);
    if (healed > 0) {
      pushEvent(state, { kind: 'heal', side: opponentOf(side), amount: healed, hp: other.hp, maxHp: other.maxHp });
    }
    if (fighter.hp <= 0) faint(state, side);
  }

  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    if (fighter.hp <= 0) continue;
    if (tickPerish(fighter)) {
      applyDamage(fighter, fighter.hp);
      pushText(state, `${fighter.name} fainted from the perish count!`);
      faint(state, side);
    }
  }

  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    if (fighter.hp > 0) endOfTurnVolatile(fighter);
  }
  tickWeather(state);
  tickTerrain(state);
}

function resolveFaints(state: BattleState): void {
  const playerAlive = hasHealthy(state, 'player');
  const enemyAlive = hasHealthy(state, 'enemy');
  if (!playerAlive && !enemyAlive) finishBattle(state, 'draw');
  else if (!playerAlive) finishBattle(state, 'enemy');
  else if (!enemyAlive) finishBattle(state, 'player');
  else {
    for (const side of SIDE_IDS) {
      if (activeFighter(state, side).hp <= 0) state.sides[side].awaitingReplacement = true;
    }
  }
}

/**
 * Resolves one turn from both sides' commands. Switches, items and runs act
 * before moves; moves run on priority then Speed; residuals tick last. The
 * caller must resolve any pending replacement before the next turn.
 */
export function takeTurn(state: BattleState, playerCommand: Command, enemyCommand: Command): void {
  if (state.winner !== null) return;

  const playerError = validateCommand(state, 'player', playerCommand);
  if (playerError) throw new Error(playerError);
  const enemyError = validateCommand(state, 'enemy', enemyCommand);
  if (enemyError) throw new Error(enemyError);

  state.turn += 1;
  pushEvent(state, { kind: 'turn', turn: state.turn });
  state.movedSides = [];
  state.switchedSides = [];
  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    fighter.volatiles.physicalDamageTaken = 0;
    fighter.volatiles.specialDamageTaken = 0;
  }

  const commands: Record<SideId, Command> = { player: playerCommand, enemy: enemyCommand };
  resolvePreMoveActions(state, commands);
  if (state.winner !== null) return;

  const moveEntries = SIDE_IDS.filter((side) => commands[side].type === 'fight').map((side) => {
    const fighter = activeFighter(state, side);
    const selected = chosenMove(fighter, commands[side] as FightCommand);
    if (!selected) return { side, priority: 0 };
    const ctx = makeContext(state, side, { source: fighter, target: opponent(state, side), move: selected.move });
    return { side, priority: runModifyPriority(ctx, selected.move, selected.move.priority) };
  });

  for (const entry of orderActions(state, moveEntries, state.rng)) {
    if (state.winner !== null) break;
    if (activeFighter(state, entry.side).hp <= 0) continue;
    if (opponent(state, entry.side).hp <= 0) continue;
    useMove(state, entry.side, commands[entry.side] as FightCommand);
    if (!state.movedSides.includes(entry.side)) state.movedSides.push(entry.side);
  }

  if (state.winner !== null) return;
  resolveResiduals(state);
  if (state.winner !== null) return;
  resolveFaints(state);
}

/** True while either side still owes a replacement before the next turn. */
export function needsReplacement(state: BattleState): readonly SideId[] {
  return SIDE_IDS.filter((side) => state.sides[side].awaitingReplacement);
}

export function autoReplace(state: BattleState): void {
  for (const side of needsReplacement(state)) {
    const battleSide = state.sides[side];
    // A self-switch (U-turn, Baton Pass) leaves the active healthy: never pick it
    // again, or the incoming never changes.
    const index = battleSide.party.findIndex(
      (fighter, i) => i !== battleSide.activeIndex && fighter.hp > 0,
    );
    if (index >= 0) performSwitch(state, side, index);
  }
}
