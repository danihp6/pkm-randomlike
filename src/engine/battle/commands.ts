import { getMove, type Move } from '../../data/dex';
import type { ItemDef } from '../../data/items';
import { attemptCapture } from './capture';
import { canGigantamax } from './gmax';
import { canMegaEvolve } from './mega';
import { applyBoosts, applyHeal, type BattleFighter, type MoveSlot } from './fighter';
import {
  activeFighter,
  finishBattle,
  isTrapped,
  opponent,
  opponentOf,
  pushEvent,
  pushText,
  type BattleState,
  type SideId,
} from './state';
import { cureStatus } from './status';
import { canRun } from './runAway';
import { isTaunted } from './volatile';

export type FightCommand = Readonly<{
  type: 'fight';
  moveIndex: number;
  mega?: boolean;
  gmax?: boolean;
}>;
export type BagCommand = Readonly<{ type: 'bag'; itemId: string }>;
export type SwitchCommand = Readonly<{ type: 'switch'; partyIndex: number }>;
export type RunCommand = Readonly<{ type: 'run' }>;
export type Command = FightCommand | BagCommand | SwitchCommand | RunCommand;

export function findMoveIndex(fighter: BattleFighter, moveId: string): number {
  return fighter.moves.findIndex((slot) => slot.moveId === moveId);
}

/** Indices the active Pokémon may actually pick, honouring PP, Encore and disable. */
export function legalMoveIndices(fighter: BattleFighter): readonly number[] {
  const usable = fighter.moves
    .map((slot, index) => ({ slot, index }))
    .filter((entry) => entry.slot.pp > 0 && entry.slot.moveId !== fighter.volatiles.disabledMove);

  if (fighter.volatiles.encoreMove !== null) {
    const locked = usable.filter((entry) => entry.slot.moveId === fighter.volatiles.encoreMove);
    if (locked.length > 0) return locked.map((entry) => entry.index);
  }
  // Gorilla Tactics locks the holder into the first move it used.
  if (fighter.volatiles.gorillaTactics !== null) {
    const locked = usable.filter((entry) => entry.slot.moveId === fighter.volatiles.gorillaTactics);
    if (locked.length > 0) return locked.map((entry) => entry.index);
  }
  return usable.map((entry) => entry.index);
}

export type SelectedMove = Readonly<{ move: Move; slot: MoveSlot | null }>;

/** The chosen move, or Struggle when no move is usable. */
export function selectedMove(fighter: BattleFighter, command: FightCommand): SelectedMove | null {
  const slot = fighter.moves[command.moveIndex];
  if (slot && slot.pp > 0 && slot.moveId !== fighter.volatiles.disabledMove) {
    const move = getMove(slot.moveId);
    if (move) return { move, slot };
  }
  const anyUsable = fighter.moves.some(
    (entry) => entry.pp > 0 && entry.moveId !== fighter.volatiles.disabledMove,
  );
  if (!anyUsable) {
    const struggle = getMove('struggle');
    if (struggle) return { move: struggle, slot: null };
  }
  return null;
}

function validateSwitch(state: BattleState, side: SideId, command: SwitchCommand): string | null {
  const battleSide = state.sides[side];
  const target = battleSide.party[command.partyIndex];
  if (!target) return 'That Pokémon is not in the party.';
  if (command.partyIndex === battleSide.activeIndex) return 'That Pokémon is already out.';
  if (target.hp <= 0) return 'That Pokémon has no energy left.';
  if (!battleSide.awaitingReplacement && isTrapped(state, side)) {
    return 'The Pokémon cannot be switched out.';
  }
  return null;
}

function validateBag(state: BattleState, side: SideId, command: BagCommand): string | null {
  if (side !== 'player') return 'Only the player has a Bag.';
  const slot = state.bag.find((entry) => entry.item.id === command.itemId);
  if (!slot || slot.count <= 0) return 'That item is not in the Bag.';
  if (slot.item.kind === 'ball' && !state.isWild) return 'Ball: cannot be used in a trainer battle.';
  if (slot.item.kind === 'held') return 'Held items can only be used while held.';
  return null;
}

export function validateCommand(state: BattleState, side: SideId, command: Command): string | null {
  if (state.winner !== null) return 'The battle is over.';

  if (state.sides[side].awaitingReplacement && command.type !== 'switch') {
    return 'A replacement must be sent out first.';
  }

  switch (command.type) {
    case 'fight': {
      const fighter = activeFighter(state, side);
      if (command.moveIndex < 0 || command.moveIndex >= fighter.moves.length) {
        return 'There is no such move.';
      }
      const legal = legalMoveIndices(fighter);
      if (fighter.moves[command.moveIndex]?.moveId === fighter.volatiles.disabledMove) {
        return 'That move is disabled!';
      }
      if (legal.length > 0 && !legal.includes(command.moveIndex)) {
        if (
          isTaunted(fighter) &&
          getMove(fighter.moves[command.moveIndex]?.moveId ?? '')?.category === 'Status'
        ) {
          return 'The Pokémon is taunted and cannot use status moves.';
        }
        return 'That move has no PP left.';
      }
      if (command.mega && !canMegaEvolve(state, side)) {
        return 'That Pokémon cannot Mega Evolve.';
      }
      if (command.gmax && !canGigantamax(state, side)) {
        return 'That Pokémon cannot Gigantamax.';
      }
      return null;
    }
    case 'bag':
      return validateBag(state, side, command);
    case 'switch':
      return validateSwitch(state, side, command);
    case 'run':
      if (!canRun(state, side)) return 'There is no running from a trainer battle.';
      return null;
  }
}

export function useBagItem(state: BattleState, side: SideId, itemId: string): boolean {
  const slot = state.bag.find((entry) => entry.item.id === itemId);
  if (!slot || slot.count <= 0) return false;

  slot.count -= 1;
  if (slot.count <= 0) state.bag.splice(state.bag.indexOf(slot), 1);

  const item = slot.item;
  const target = activeFighter(state, side);
  pushEvent(state, { kind: 'item', side, itemId: item.id });
  pushText(state, `${state.sides[side].name} used ${item.name}.`);

  switch (item.kind) {
    case 'ball': {
      const wild = opponent(state, side);
      const result = attemptCapture(state, opponentOf(side), item.catchBonus ?? 1);
      pushEvent(state, {
        kind: 'capture',
        success: result.success,
        fighterId: wild.id,
        shakes: result.shakes,
      });
      pushText(state, captureMessage(wild.name, result.shakes, result.success));
      if (result.success) finishBattle(state, side);
      break;
    }
    case 'heal': {
      const amount = item.healFraction
        ? Math.floor((target.maxHp * item.healFraction[0]) / item.healFraction[1])
        : (item.healAmount ?? 0);
      const healed = applyHeal(target, amount);
      if (healed > 0) {
        pushEvent(state, { kind: 'heal', side, amount: healed, hp: target.hp, maxHp: target.maxHp });
        pushText(state, `${target.name} recovered ${healed} HP.`);
      }
      if (item.cures) cureWithItem(state, side, target, item);
      break;
    }
    case 'status':
      cureWithItem(state, side, target, item);
      break;
    case 'boost': {
      const changes = applyBoosts(target, item.boosts ?? {});
      for (const change of changes) {
        pushEvent(state, { kind: 'boost', side, stat: change.stat, stages: change.stages });
      }
      if (changes.length > 0) pushText(state, `${target.name}'s stats rose!`);
      break;
    }
    case 'held':
      break;
  }
  return true;
}

function cureWithItem(state: BattleState, side: SideId, target: BattleFighter, item: ItemDef): void {
  if (!item.cures || !target.status) return;
  if (item.cures !== 'all' && !item.cures.includes(target.status)) return;
  const cured = cureStatus(target);
  if (cured) {
    pushEvent(state, { kind: 'cure', side, status: cured });
    pushText(state, `${target.name} was cured of its status.`);
  }
}

function captureMessage(name: string, shakes: number, success: boolean): string {
  if (success) return `Gotcha! ${name} was caught!`;
  if (shakes === 0) return `Oh no! ${name} broke free!`;
  if (shakes === 1) return `Aww! ${name} appeared to be caught!`;
  if (shakes === 2) return `Aargh! ${name} almost had it!`;
  return `Gah! ${name} was so close, too!`;
}
