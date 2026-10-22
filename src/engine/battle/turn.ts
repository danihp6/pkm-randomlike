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
  CHARGE_SELF_BOOSTS,
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
  type SideId,
  type Slot,
} from './state';
import { beforeMoveStatus, residualDamage, statusName } from './status';
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
  attract: (name) => `${name} fell in love!`,
  charge: (name) => `${name} began charging power!`,
  disable: (name) => `${name}'s move was disabled!`,
  electrify: (name) => `${name} was electrified!`,
  embargo: (name) => `${name} can't use its held item!`,
  foresight: (name) => `${name} was identified!`,
  gastroacid: (name) => `${name}'s Ability was suppressed!`,
  nightmare: (name) => `${name} began having a nightmare!`,
  noretreat: (name) => `${name} can no longer escape!`,
  octolock: (name) => `${name} is trapped by Octolock!`,
  telekinesis: (name) => `${name} was hurled into the air!`,
  torment: (name) => `${name} was subjected to torment!`,
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
        if (cost > 0) pushText(state, `${target.name} put in a substitute!`);
        return cost > 0;
      }
      default:
        return false;
    }
  })();
  if (applied) {
    const custom = VOLATILE_MESSAGES[volatile];
    pushText(
      state,
      custom
        ? custom(target.name)
        : volatile === 'yawn'
          ? `${target.name} grew drowsy!`
          : `${target.name} was affected by ${volatile}!`,
    );
  }
  return applied;
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
  // A reflected or snatched move turns on its user, whatever slot it was aimed at.
  const effectTargetOfMove = reflects || snatches ? attacker : defender;
  // An ally-aimed move never lands on the foe: `allies` includes the user (Howl),
  // `adjacentAlly` needs a partner the single battle does not field (Aromatic Mist).
  const allyMove = move.target === 'allies' || move.target === 'adjacentAlly' || move.target === 'ally';
  const partner = liveSlots(state, side)
    .map((slot) => activeFighter(state, side, slot))
    .find((fighter) => fighter !== acting && fighter.hp > 0);
  if (allyMove && move.target !== 'allies' && !partner) {
    pushText(state, 'But it failed!');
    return;
  }
  const effectSide = selfTarget || allyMove ? actingSide : targetSide;
  const effectTarget = selfTarget ? acting : allyMove ? (partner ?? acting) : effectTargetOfMove;

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
    for (const secondary of secondaries) {
      applySecondary(state, actingSide, secondary, acting, effectTargetOfMove);
    }
  }

  if (move.drain && move.drain.length === 2 && totalDamage > 0) {
    const drained = Math.max(1, Math.floor((totalDamage * move.drain[0]) / move.drain[1]));
    if (effectTargetOfMove.ability === 'Liquid Ooze') {
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

export function useMove(state: BattleState, side: SideId, command: FightCommand): void {
  const attacker = activeFighter(state, side, command.slot ?? 0);
  const selected = chosenMove(attacker, command, barredMovesFor(state, side));
  if (!selected) return;
  const { move, slot } = selected;
  state.abilityPierce = piercesTargetAbility(state, side, attacker, move) ? attacker : null;
  try {
    resolveMove(state, side, attacker, move, slot, commandedTarget(state, side, command));
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
  pushText(state, `${defender.name} protected itself!`);
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

  // Torment bars the same move on two consecutive turns.
  if (attacker.volatiles.torment && attacker.lastMoveId === move.id) {
    pushText(state, `${attacker.name} can't use the same move twice in a row!`);
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
    pushText(state, `${attacker.name} is confused. It hurt itself in its confusion!`);
    if (attacker.hp <= 0) faint(state, side, slotOf(state, side, attacker));
    return;
  }
  if (volatileCheck && 'confusionEnded' in volatileCheck) {
    pushText(state, `${attacker.name} snapped out of its confusion!`);
  }

  if (move.flags.charge) {
    if (attacker.volatiles.charging !== move.id && !chargesInstantly(state, move)) {
      attacker.volatiles.charging = move.id;
      pushText(state, `${attacker.name} ${chargeVerb(move.id)}`);
      const chargeBoosts = CHARGE_SELF_BOOSTS[move.id];
      if (chargeBoosts) {
        applyBoostEffect(state, side, attacker, chargeBoosts, { self: true });
      }
      return;
    }
    attacker.volatiles.charging = null;
  }

  if (moveSlot) moveSlot.pp = Math.max(0, moveSlot.pp - ppCost(state, side, move));
  attacker.lastMoveId = move.id;

  // Imprison seals any move the foe knows. The whole foe side is read, so a
  // partner's Imprison counts even when the move is aimed at the lead.
  const imprisoners = liveSlots(state, opponentOf(side)).map((slot) =>
    activeFighter(state, opponentOf(side), slot),
  );
  if (imprisoners.some((foe) => foe.volatiles.imprison && foe.moves.some((e) => e.moveId === move.id))) {
    pushText(state, `${attacker.name} can't use the sealed ${move.name}!`);
    return;
  }

  const calledId = calledMoveId(state, side, attacker, move, previousMove);
  if (calledId !== null) {
    const called = getMove(calledId);
    if (called && called.id !== move.id) {
      pushText(state, `${attacker.name} used ${called.name}!`);
      resolveMove(state, side, attacker, called, null, target);
    } else {
      pushText(state, 'But it failed!');
    }
    return;
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

    const sure = lockedOn || (defender.volatiles.telekinesis > 0 && move.ohko !== true);
    if (move.category !== 'Status' && !sure && !rollHitWith(state, side, move, attacker, defender)) {
      pushText(state, `${attacker.name}'s attack missed!`);
      continue;
    }

    // Type-changing abilities (Galvanize, Pixilate, Liquid Voice) and item-driven
    // rewrites (a berry's Natural Gift) apply before any immunity check, so the
    // move is treated as its new type throughout. Electrify overrides them for one
    // move and is spent by it.
    const moveContext = makeContext(state, side, { source: attacker, target: defender, move });
    const modified = runModifyMove(moveContext, move);
    const electrified = attacker.volatiles.electrify;
    if (electrified) attacker.volatiles.electrify = false;
    const moveType = electrified ? 'Electric' : runModifyMoveType(moveContext, modified);
    const activeMove: Move = moveType === modified.type ? modified : { ...modified, type: moveType };

    const hitContext = makeContext(state, side, {
      source: attacker,
      target: defender,
      move: activeMove,
    });
    if (!runTryHit(hitContext, activeMove)) continue;

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
      useCounterMove(state, side, attacker, defender, activeMove, aim.slot);
      countered = true;
      break;
    }

    effectMove = activeMove;
    effectTarget = defender;
    lastHitContext = hitContext;

    if (activeMove.category !== 'Status' && activeMove.basePower > 0) {
      const rolled = multihitHits(activeMove, state.rng);
      const hits = runModifyMultihit(
        makeContext(state, side, { source: attacker, target: defender, move: activeMove }),
        activeMove,
        rolled,
      );
      const statContext = damageStatContext(state, side, attacker, defender);
      for (let hit = 0; hit < hits; hit++) {
        const hitTarget = defender;
        if (hitTarget.hp <= 0) break;
        const defenderTypes = state.roomField.overrideType
          ? [state.roomField.overrideType]
          : hitTarget.types;
        const critRatio =
          activeMove.critRatio +
          (attacker.volatiles.focusEnergy ? 2 : 0) +
          (attacker.volatiles.dragonCheer ? 1 : 0) +
          state.roomField.critStage;
        const crit = runModifyCrit(
          makeContext(state, side, { source: attacker, target: hitTarget, move: activeMove }),
          activeMove,
          attacker.volatiles.laserFocus ||
            rollCrit(
              state.rng,
              runModifyCritRatio(
                makeContext(state, side, {
                  source: attacker,
                  target: hitTarget,
                  move: activeMove,
                }),
                activeMove,
                critRatio,
              ),
            ),
        );
        const result = computeDamage(attacker, hitTarget, activeMove, state.rng, {
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
          ...statContext,
          effectiveness: runModifyEffectiveness(
            makeContext(state, side, { source: attacker, target: hitTarget, move: activeMove }),
            activeMove,
            effectiveness(activeMove.type, defenderTypes),
          ),
        });
        if (result.effectiveness === 0) {
          if (hit === 0) pushText(state, `It doesn't affect ${hitTarget.name}...`);
          break;
        }
        let damage = runModifyDamage(
          makeContext(state, side, { source: attacker, target: hitTarget, move: activeMove }),
          activeMove,
          result.damage,
          result.effectiveness,
          result.crit,
        );
        if ((hitTarget.volatiles.endure || state.roomField.endure) && damage >= hitTarget.hp) {
          damage = Math.max(0, hitTarget.hp - 1);
          pushText(state, `${hitTarget.name} endured the hit!`);
        }
        const bypassSubstitute = runTrySubstitute(
          makeContext(state, side, { source: attacker, target: hitTarget, move: activeMove }),
          activeMove,
        );
        if (!bypassSubstitute && hasSubstitute(hitTarget)) {
          absorbWithSubstitute(hitTarget, damage);
          pushText(state, `It hit ${hitTarget.name}'s substitute!`);
          if (hitTarget.volatiles.substitute === 0) {
            pushText(state, `${hitTarget.name}'s substitute faded!`);
          }
          continue;
        }
        const dealt = applyDamage(hitTarget, damage);
        hitTarget.volatiles.lastDamageTaken = dealt;
        totalDamage += dealt;
        if (activeMove.category === 'Physical') hitTarget.volatiles.physicalDamageTaken += dealt;
        else if (activeMove.category === 'Special') hitTarget.volatiles.specialDamageTaken += dealt;
        pushEvent(state, {
          kind: 'damage',
          side: aim.side,
          amount: dealt,
          hp: hitTarget.hp,
          maxHp: hitTarget.maxHp,
          effectiveness: result.effectiveness,
          crit: result.crit,
        });
        pushText(state, damageMessage(activeMove.name, result, hitTarget));
        if (hitTarget.hp <= 0) {
          const bonded = hitTarget.volatiles.destinyBond;
          const grudged = hitTarget.volatiles.grudge;
          faint(state, aim.side, aim.slot);
          if (bonded && attacker.hp > 0) {
            pushText(state, `${hitTarget.name} took its attacker down with it!`);
            applyDamage(attacker, attacker.hp);
            faint(state, side, attackerSlot);
          }
          if (grudged && moveSlot) {
            moveSlot.pp = 0;
            pushText(state, `${attacker.name}'s ${activeMove.name} lost all its PP due to the grudge!`);
          }
          break;
        }
      }
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
    pushText(state, 'But it failed!');
    return;
  }
  if (last.id === 'instruct' || CALLER_MOVES.has(last.id) || last.flags.failinstruct) {
    pushText(state, 'But it failed!');
    return;
  }
  pushText(state, `${target.name} followed the instruction!`);
  resolveMove(state, opponentOf(side), target, last, null);
}

function faint(state: BattleState, side: SideId, slot: Slot = 0): void {
  const fighter = activeFighter(state, side, slot);
  pushEvent(state, { kind: 'faint', side, fighterId: fighter.id });
  pushText(state, `${fighter.name} fainted!`);
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
      pushText(state, `${fighter.name} is buffeted by the ${weatherLabel(weather)}!`);
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
        pushText(state, `${fighter.name} is restored by the grassy terrain!`);
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
      if (fighter.hp <= 0 || fighter.volatiles.yawn <= 0) continue;
      fighter.volatiles.yawn -= 1;
      if (fighter.volatiles.yawn === 0) {
        applyStatusEffect(state, side, fighter, 'slp', `${fighter.name} fell asleep!`);
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
      pushText(state, `${fighter.name}'s wish came true!`);
    }
  }

  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
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
      if (fighter.hp <= 0) faint(state, side, slot);
    }
  }

  for (const side of SIDE_IDS) {
    for (const slot of liveSlots(state, side)) {
      const fighter = activeFighter(state, side, slot);
      if (fighter.hp <= 0) continue;
      if (tickPerish(fighter)) {
        applyDamage(fighter, fighter.hp);
        pushText(state, `${fighter.name} fainted from the perish count!`);
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
            message: `${fighter.name} is trapped by Octolock and its Defense and Sp. Def fell!`,
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
          pushText(state, `${fighter.name} is locked in a nightmare!`);
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
    useMove(state, entry.side, aimed);
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
