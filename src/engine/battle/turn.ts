import { allMoves, effectiveness, getMove, type Move, type MoveEffect } from '../../data/dex';
import {
  applyDamage,
  applyHeal,
  resetBattleState,
  takesIndirectDamage,
  BOOST_IDS,
  type BattleFighter,
  type BoostId,
  type MoveSlot,
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
import { rollHitWith } from './modifiers';
import { applyBoostEffect, applyStatusEffect } from './effects/apply';
import {
  FIELD_CONDITION_MOVES,
  SIDE_CONDITION_MOVES,
  isProtectMove,
  protectBlocks,
} from './effects/moves';
import { setFieldCondition, setSideCondition, tickConditions } from './effects/conditions';
import { setTerrain, terrainFromMove, terrainHeal, tickTerrain } from './effects/terrain';
import { setWeather, tickWeather, weatherChip, weatherFromMove, weatherLabel } from './effects/weather';
import { computeDamage, rollCrit, type DamageContext, type DamageResult } from './damage';
import { orderActions } from './order';
import {
  barredMovesFor,
  selectedMove,
  useBagItem,
  validateCommand,
  type Command,
  type FightCommand,
  type SelectedMove,
} from './commands';
import { megaEvolve } from './mega';
import { gigantamax } from './gmax';
import {
  SIDE_IDS,
  activeFighter,
  effectiveWeather,
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

function resolvePreMoveActions(state: BattleState, commands: Readonly<Record<SideId, Command>>): void {
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
          success ? 'Got away safely!' : `${state.sides[entry.side].name} couldn't get away!`,
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

function damageMessage(moveName: string, result: DamageResult, defender: BattleFighter): string {
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

const VOLATILE_MESSAGES: Readonly<Record<string, (name: string) => string>> = {
  aquaring: (name) => `${name} surrounded itself with a veil of water!`,
  ingrain: (name) => `${name} planted its roots!`,
  destinybond: (name) => `${name} is trying to take its foe down with it!`,
  dragoncheer: (name) => `${name} cheered and sharpened its focus!`,
  focusenergy: (name) => `${name} is getting pumped!`,
  laserfocus: (name) => `${name} concentrated intensely!`,
  endure: (name) => `${name} braced itself!`,
  grudge: (name) => `${name} wants to take its foe's move down with it!`,
  imprison: (name) => `${name} sealed the foe's moves!`,
  magiccoat: (name) => `${name} shrouded itself with Magic Coat!`,
  snatch: (name) => `${name} waits for its foe to make a move!`,
  magnetrise: (name) => `${name} levitated with electromagnetism!`,
  powertrick: (name) => `${name} switched its Attack and Defense!`,
};

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
    const custom = VOLATILE_MESSAGES[volatileStatus];
    pushText(
      state,
      custom
        ? custom(target.name)
        : volatileStatus === 'yawn'
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
  if (effect.chance !== undefined) {
    const chance = runModifySecondaryChance(
      makeContext(state, side, { source: attacker, target: defender }),
      effect.chance,
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

  // Magic Bounce and Magic Coat send a reflectable status move back at its user.
  const reflects =
    !selfTarget &&
    move.category === 'Status' &&
    Boolean(move.flags.reflectable) &&
    (defender.volatiles.magicCoat ||
      (defender.ability === 'Magic Bounce' &&
        attacker.ability !== 'Neutralizing Gas' &&
        state.abilityPierce !== defender));
  if (reflects) {
    if (defender.volatiles.magicCoat) {
      defender.volatiles.magicCoat = false;
      pushText(state, `${defender.name} shrouded itself with Magic Coat!`);
    } else {
      pushText(state, `${defender.name}'s Magic Bounce reflected the move!`);
    }
  }

  // Snatch steals the move: the defender becomes its user.
  const snatches =
    !reflects && move.category === 'Status' && Boolean(move.flags.snatch) && defender.volatiles.snatch;
  if (snatches) {
    defender.volatiles.snatch = false;
    pushText(state, `${defender.name} snatched the move!`);
  }

  const actingSide = snatches ? opponentOf(side) : side;
  const acting = snatches ? defender : attacker;
  const targetSide = reflects ? side : opponentOf(actingSide);
  const target = reflects ? attacker : opponent(state, actingSide);
  const effectSide = selfTarget ? actingSide : targetSide;
  const effectTarget = selfTarget ? acting : target;

  if (move.status) applyStatusEffect(state, effectSide, effectTarget, move.status);

  if (move.volatileStatus) {
    applyVolatileEffect(state, effectSide, effectTarget, move.volatileStatus);
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
      pushText(state, `${acting.name} regained health!`);
    }
  }

  if (move.id === 'wish') {
    state.sides[actingSide].wishTurns = 2;
    pushText(state, `${acting.name} made a wish!`);
  }

  if (move.self?.boosts) applyBoostEffect(state, actingSide, acting, move.self.boosts, { self: true });

  const secondaries: MoveEffect[] = [];
  if (move.secondaries) secondaries.push(...move.secondaries);
  const sheerForce = acting.ability === 'Sheer Force' && move.basePower > 0;
  if (defenderDamaged && !sheerForce) {
    for (const secondary of secondaries) applySecondary(state, actingSide, secondary, acting, target);
  }

  if (move.drain && move.drain.length === 2 && totalDamage > 0) {
    const drained = Math.max(1, Math.floor((totalDamage * move.drain[0]) / move.drain[1]));
    if (target.ability === 'Liquid Ooze') {
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
        pushText(state, `${acting.name} sucked up the liquid ooze!`);
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
        pushText(state, `${acting.name} had its energy drained!`);
      }
    }
  }

  if (move.recoil && move.recoil.length === 2 && totalDamage > 0 && takesIndirectDamage(acting)) {
    const raw = Math.max(1, Math.floor((totalDamage * move.recoil[0]) / move.recoil[1]));
    const recoil = runModifyRecoil(
      makeContext(state, actingSide, { source: acting, target: opponent(state, actingSide), move }),
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
      pushText(state, `${acting.name} is damaged by recoil!`);
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
    pushText(state, `${acting.name} is damaged by recoil!`);
  }

  if (move.selfdestruct) {
    applyDamage(acting, acting.hp);
    pushText(state, `${acting.name} fainted!`);
    pushEvent(state, { kind: 'faint', side: actingSide, fighterId: acting.id });
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

  const sideCondition = SIDE_CONDITION_MOVES[move.id];
  if (sideCondition) {
    if (sideCondition === 'auroraveil' && effectiveWeather(state) !== 'snow') {
      pushText(state, 'But it failed!');
    } else if (state.sides[actingSide].sideConditions[sideCondition] > 0) {
      pushText(state, 'But it failed!');
    } else {
      setSideCondition(state, actingSide, sideCondition);
    }
  }

  const fieldCondition = FIELD_CONDITION_MOVES[move.id];
  if (fieldCondition) {
    if (state.field[fieldCondition] > 0) pushText(state, 'But it failed!');
    else setFieldCondition(state, fieldCondition);
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
function maybeSelfSwitch(state: BattleState, side: SideId, attacker: BattleFighter, move: Move): void {
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
  const selected = chosenMove(attacker, command, barredMovesFor(state, side));
  if (!selected) return;
  const { move, slot } = selected;
  state.abilityPierce = piercesTargetAbility(state, side, attacker, move) ? attacker : null;
  try {
    resolveMove(state, side, attacker, move, slot);
  } finally {
    state.abilityPierce = null;
  }
  dancerFollowUp(state, side, move);
}

let dancerCopyActive = false;

/** Dancer copies a dance move the foe just used; the guard stops a mirror loop. */
function dancerFollowUp(state: BattleState, side: SideId, move: Move): void {
  if (dancerCopyActive || !move.flags.dance || state.winner !== null) return;
  const foeSide = opponentOf(side);
  const dancer = activeFighter(state, foeSide);
  if (dancer.hp <= 0 || dancer.ability !== 'Dancer') return;
  const copy = getMove(move.id);
  if (!copy) return;
  dancerCopyActive = true;
  try {
    pushText(state, `${dancer.name} joined in the dance with Dancer!`);
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
  if (opponent(state, side).ability === 'Neutralizing Gas') return false;
  if (['Mold Breaker', 'Teravolt', 'Turboblaze'].includes(attacker.ability)) return true;
  return attacker.ability === 'Mycelium Might' && move.category === 'Status';
}

function gasSuppresses(state: BattleState, side: SideId): boolean {
  return opponent(state, side).ability === 'Neutralizing Gas';
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
  const attackerUnaware = attacker.ability === 'Unaware' && !gasSuppresses(state, side);
  const defenderUnaware = defender.ability === 'Unaware' && alive(defender, foeSide);

  let attackMultiplier = 1;
  let defenseMultiplier = 1;
  if (alive(defender, foeSide)) {
    if (defender.ability === 'Tablets of Ruin' || defender.ability === 'Vessel of Ruin') {
      attackMultiplier *= 0.75;
    }
  }
  if (alive(attacker, side)) {
    if (attacker.ability === 'Sword of Ruin' || attacker.ability === 'Beads of Ruin') {
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

function resolveMove(
  state: BattleState,
  side: SideId,
  attacker: BattleFighter,
  move: Move,
  slot: MoveSlot | null,
): void {
  // Truant alternates: after a turn in which it acts, the next one is lost.
  if (attacker.ability === 'Truant') {
    if (attacker.volatiles.truant) {
      attacker.volatiles.truant = false;
      pushText(state, `${attacker.name} is loafing around!`);
      return;
    }
    attacker.volatiles.truant = true;
  }

  const previousMove = state.lastMove;
  pushEvent(state, { kind: 'move', side, moveId: move.id });
  pushText(state, `${attacker.name} used ${move.name}!`);
  state.lastMove = move.id;
  if (!isProtectMove(move.id)) attacker.volatiles.protectStreak = 0;

  if (move.category === 'Status' && isTaunted(attacker)) {
    pushText(state, `${attacker.name} can't use status moves while taunted!`);
    return;
  }

  const statusCheck = beforeMoveStatus(attacker, state.rng);
  if (statusCheck && 'blocked' in statusCheck) {
    // Sleep Talk and Snore are the two moves usable while asleep.
    const usableWhileAsleep =
      statusCheck.blocked === 'slp' && (move.id === 'sleeptalk' || move.id === 'snore');
    if (!usableWhileAsleep) {
      pushText(state, blockedMessage(attacker, statusCheck.blocked));
      return;
    }
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
  if (volatileCheck && 'attracted' in volatileCheck) {
    pushText(state, `${attacker.name} is infatuated and can't bring itself to attack!`);
    return;
  }
  if (volatileCheck && 'confusionDamage' in volatileCheck) {
    if (slot) slot.pp = Math.max(0, slot.pp - ppCost(state, side, move));
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

  // Imprison seals any move the foe knows.
  const foe = opponent(state, side);
  if (foe.volatiles.imprison && foe.moves.some((entry) => entry.moveId === move.id)) {
    pushText(state, `${attacker.name} can't use the sealed ${move.name}!`);
    return;
  }

  const calledId = calledMoveId(state, side, attacker, move, previousMove);
  if (calledId !== null) {
    const called = getMove(calledId);
    if (called && called.id !== move.id) {
      pushText(state, `${attacker.name} used ${called.name}!`);
      resolveMove(state, side, attacker, called, null);
    } else {
      pushText(state, 'But it failed!');
    }
    return;
  }

  if (protectBlocks(state, side, move)) return;

  const defender = opponent(state, side);
  if (move.category !== 'Status' && !rollHitWith(state, side, move)) {
    pushText(state, `${attacker.name}'s attack missed!`);
    return;
  }

  // Type-changing abilities (Galvanize, Pixilate, Liquid Voice) and item-driven
  // rewrites (a berry's Natural Gift) apply before any immunity check, so the
  // move is treated as its new type throughout.
  const moveContext = makeContext(state, side, { source: attacker, target: defender, move });
  const modified = runModifyMove(moveContext, move);
  const moveType = runModifyMoveType(moveContext, modified);
  const activeMove: Move = moveType === modified.type ? modified : { ...modified, type: moveType };

  const hitContext = makeContext(state, side, { source: attacker, target: defender, move: activeMove });
  if (!runTryHit(hitContext, activeMove)) return;

  // Protean and Libero change the user's type, once per switch-in in Gen 9.
  if (
    (attacker.ability === 'Protean' || attacker.ability === 'Libero') &&
    !attacker.volatiles.proteanUsed
  ) {
    attacker.volatiles.proteanUsed = true;
    attacker.types = [activeMove.type];
    pushText(state, `${attacker.name} transformed into the ${activeMove.type} type!`);
  }

  if (COUNTER_MOVES.has(move.id)) {
    useCounterMove(state, side, attacker, defender, activeMove);
    return;
  }

  let totalDamage = 0;
  if (activeMove.category !== 'Status' && activeMove.basePower > 0) {
    const rolled = multihitHits(activeMove, state.rng);
    const hits = runModifyMultihit(
      makeContext(state, side, { source: attacker, target: defender, move: activeMove }),
      activeMove,
      rolled,
    );
    const statContext = damageStatContext(state, side, attacker, defender);
    for (let hit = 0; hit < hits; hit++) {
      const target = opponent(state, side);
      if (target.hp <= 0) break;
      const critRatio =
        activeMove.critRatio +
        (attacker.volatiles.focusEnergy ? 2 : 0) +
        (attacker.volatiles.dragonCheer ? 1 : 0);
      const crit = runModifyCrit(
        makeContext(state, side, { source: attacker, target, move: activeMove }),
        activeMove,
        attacker.volatiles.laserFocus ||
          rollCrit(
            state.rng,
            runModifyCritRatio(
              makeContext(state, side, { source: attacker, target, move: activeMove }),
              activeMove,
              critRatio,
            ),
          ),
      );
      const result = computeDamage(attacker, target, activeMove, state.rng, {
        weather: effectiveWeather(state),
        terrain: state.terrain,
        critical: crit,
        reflect: state.sides[opponentOf(side)].sideConditions.reflect > 0,
        lightScreen: state.sides[opponentOf(side)].sideConditions.lightscreen > 0,
        auroraVeil: state.sides[opponentOf(side)].sideConditions.auroraveil > 0,
        wonderRoom: state.field.wonderroom > 0,
        ...statContext,
        effectiveness: runModifyEffectiveness(
          makeContext(state, side, { source: attacker, target, move: activeMove }),
          activeMove,
          effectiveness(activeMove.type, target.types),
        ),
      });
      if (result.effectiveness === 0) {
        if (hit === 0) pushText(state, `It doesn't affect ${target.name}...`);
        break;
      }
      let damage = runModifyDamage(
        makeContext(state, side, { source: attacker, target, move: activeMove }),
        activeMove,
        result.damage,
        result.effectiveness,
        result.crit,
      );
      if (target.volatiles.endure && damage >= target.hp) {
        damage = Math.max(0, target.hp - 1);
        pushText(state, `${target.name} endured the hit!`);
      }
      const bypassSubstitute = runTrySubstitute(
        makeContext(state, side, { source: attacker, target, move: activeMove }),
        activeMove,
      );
      if (!bypassSubstitute && hasSubstitute(target)) {
        absorbWithSubstitute(target, damage);
        pushText(state, `It hit ${target.name}'s substitute!`);
        if (target.volatiles.substitute === 0) pushText(state, `${target.name}'s substitute faded!`);
        continue;
      }
      const dealt = applyDamage(target, damage);
      target.volatiles.lastDamageTaken = dealt;
      totalDamage += dealt;
      if (activeMove.category === 'Physical') target.volatiles.physicalDamageTaken += dealt;
      else if (activeMove.category === 'Special') target.volatiles.specialDamageTaken += dealt;
      pushEvent(state, {
        kind: 'damage',
        side: opponentOf(side),
        amount: dealt,
        hp: target.hp,
        maxHp: target.maxHp,
        effectiveness: result.effectiveness,
        crit: result.crit,
      });
      pushText(state, damageMessage(activeMove.name, result, target));
      if (target.hp <= 0) {
        const bonded = target.volatiles.destinyBond;
        const grudged = target.volatiles.grudge;
        faint(state, opponentOf(side));
        if (bonded && attacker.hp > 0) {
          pushText(state, `${target.name} took its attacker down with it!`);
          applyDamage(attacker, attacker.hp);
          faint(state, side);
        }
        if (grudged && slot) {
          slot.pp = 0;
          pushText(state, `${attacker.name}'s ${activeMove.name} lost all its PP due to the grudge!`);
        }
        break;
      }
    }
  }

  if (activeMove.category !== 'Status') attacker.volatiles.laserFocus = false;

  applyMoveEffects(state, side, activeMove, totalDamage, totalDamage > 0);
  // Contact reactions are not "the move's effect", so Mold Breaker stops piercing here.
  state.abilityPierce = null;
  runAfterMove(hitContext, activeMove, totalDamage > 0);
  maybeSelfSwitch(state, side, attacker, activeMove);
}

function faint(state: BattleState, side: SideId): void {
  const fighter = activeFighter(state, side);
  pushEvent(state, { kind: 'faint', side, fighterId: fighter.id });
  pushText(state, `${fighter.name} fainted!`);
  // Survivors react to the faint (Soul-Heart); the fainted side cannot.
  const other = opponentOf(side);
  runFaint(makeContext(state, other, { source: activeFighter(state, other), target: fighter }));
}

function applyWeatherResidual(state: BattleState): void {
  const weather = effectiveWeather(state);
  if (!weather) return;
  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
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
    pushText(state, `${fighter.name} is buffeted by the ${weatherLabel(weather)}!`);
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
    const residual =
      fighter.ability === 'Poison Heal' || !takesIndirectDamage(fighter)
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
    if (fighter.hp <= 0 || !takesIndirectDamage(fighter)) continue;
    const drain = leechSeedDamage(fighter);
    if (drain <= 0) continue;
    applyDamage(fighter, drain);
    pushText(state, `${fighter.name}'s health is sapped by Leech Seed!`);
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
    if (fighter.hp <= 0) continue;
    if (fighter.volatiles.aquaRing || fighter.volatiles.ingrain) {
      const healed = applyHeal(fighter, Math.max(1, Math.floor(fighter.maxHp / 16)));
      if (healed > 0) {
        pushEvent(state, { kind: 'heal', side, amount: healed, hp: fighter.hp, maxHp: fighter.maxHp });
        pushText(
          state,
          `${fighter.name} restored a little HP with ${fighter.volatiles.aquaRing ? 'Aqua Ring' : 'Ingrain'}!`,
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
      pushText(state, `${fighter.name} is afflicted by the curse!`);
      if (fighter.hp <= 0) faint(state, side);
    }
  }

  for (const side of SIDE_IDS) {
    const fighter = activeFighter(state, side);
    if (fighter.hp > 0) endOfTurnVolatile(fighter);
  }
  tickWeather(state);
  tickTerrain(state);
  tickConditions(state);
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

  // Mega Evolution resolves before any move, so the turn's order and damage read
  // the Mega's stats, type and ability (D34).
  for (const side of SIDE_IDS) {
    const command = commands[side];
    if (command.type === 'fight' && command.mega) megaEvolve(state, side);
  }
  if (state.winner !== null) return;

  // Gigantamax resolves at the same point (D44): the doubled pool and the forme's
  // name are in place before the turn's first move.
  for (const side of SIDE_IDS) {
    const command = commands[side];
    if (command.type === 'fight' && command.gmax) gigantamax(state, side);
  }
  if (state.winner !== null) return;

  const moveEntries = SIDE_IDS.filter((side) => commands[side].type === 'fight').map((side) => {
    const fighter = activeFighter(state, side);
    const selected = chosenMove(fighter, commands[side] as FightCommand, barredMovesFor(state, side));
    if (!selected) return { side, priority: 0, fractional: 0 };
    const ctx = makeContext(state, side, {
      source: fighter,
      target: opponent(state, side),
      move: selected.move,
    });
    return {
      side,
      priority: runModifyPriority(ctx, selected.move, selected.move.priority),
      fractional: runFractionalPriority(ctx),
    };
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
