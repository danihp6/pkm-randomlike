import { getMove, type Move } from '../../data/dex';
import type { ItemDef } from '../../data/items';
import { BARRED_HEALING_MOVES } from '../../data/noHeal';
import { attemptCapture } from './capture';
import { canGigantamax } from './gmax';
import { canMegaEvolve } from './mega';
import { applyHeal, type BattleFighter, type MoveSlot } from './fighter';
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
  type Slot,
  type TargetRef,
} from './state';
import { cureStatus } from './status';
import { canRun } from './runAway';
import { isTaunted } from './volatile';

export type FightCommand = Readonly<{
  type: 'fight';
  moveIndex: number;
  /** Which active acts. Default 0. */
  slot?: Slot;
  /** The chosen foe slot (single-target moves). Default: the foe's slot 0. */
  target?: TargetRef;
  mega?: boolean;
  gmax?: boolean;
}>;
export type BagCommand = Readonly<{ type: 'bag'; itemId: string }>;
export type SwitchCommand = Readonly<{
  type: 'switch';
  partyIndex: number;
  /** Which slot receives the switch. Default 0. */
  slot?: Slot;
}>;
export type RunCommand = Readonly<{ type: 'run' }>;
export type Command = FightCommand | BagCommand | SwitchCommand | RunCommand;

export function findMoveIndex(fighter: BattleFighter, moveId: string): number {
  return fighter.moves.findIndex((slot) => slot.moveId === moveId);
}

export type SelectedMove = Readonly<{ move: Move; slot: MoveSlot | null }>;

const BARRED_HEALING: ReadonlySet<string> = new Set(BARRED_HEALING_MOVES);
const NOTHING_BARRED: ReadonlySet<string> = new Set();

/**
 * The moves the room bars for `side`: the no-heal room's list for the **player**
 * only, empty for the enemy (its AI, its own healing moves and everything else
 * stay untouched).
 */
export function barredMovesFor(state: BattleState, side: SideId): ReadonlySet<string> {
  if (side !== 'player' || !state.noHeal) return NOTHING_BARRED;
  return BARRED_HEALING;
}

/** The indices the active Pokémon may actually pick, `barred` moves excluded. */
export function legalMoveIndices(
  fighter: BattleFighter,
  barred?: ReadonlySet<string>,
): readonly number[] {
  const usable = fighter.moves
    .map((slot, index) => ({ slot, index }))
    .filter(
      (entry) =>
        entry.slot.pp > 0 &&
        entry.slot.moveId !== fighter.volatiles.disabledMove &&
        !(barred?.has(entry.slot.moveId) ?? false),
    );

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

/** The chosen move, or Struggle when no move is usable (spent PP or a barred move). */
export function selectedMove(
  fighter: BattleFighter,
  command: FightCommand,
  barred?: ReadonlySet<string>,
): SelectedMove | null {
  const slot = fighter.moves[command.moveIndex];
  if (
    slot &&
    slot.pp > 0 &&
    slot.moveId !== fighter.volatiles.disabledMove &&
    !(barred?.has(slot.moveId) ?? false)
  ) {
    const move = getMove(slot.moveId);
    if (move) return { move, slot };
  }
  const anyUsable = fighter.moves.some(
    (entry) =>
      entry.pp > 0 &&
      entry.moveId !== fighter.volatiles.disabledMove &&
      !(barred?.has(entry.moveId) ?? false),
  );
  if (!anyUsable) {
    const struggle = getMove('struggle');
    if (struggle) return { move: struggle, slot: null };
  }
  return null;
}

const SPREAD_TARGETS: ReadonlySet<string> = new Set(['allAdjacentFoes', 'allAdjacent', 'all']);
const SELF_TARGETS: ReadonlySet<string> = new Set(['self']);

function commandSlot(command: Command): Slot {
  if (command.type === 'fight' || command.type === 'switch') return command.slot ?? 0;
  return 0;
}

/** The slot a command acts through; a slot 1 command needs a double battle that fields it. */
function validateSlot(state: BattleState, side: SideId, slot: Slot): string | null {
  if (slot === 0) return null;
  if (!state.double || state.sides[side].secondActiveIndex < 0) {
    return 'There is no second active Pokémon.';
  }
  return null;
}

/** A single-target command must name one of the foe's live slots; a spread move ignores it. */
function validateTarget(
  state: BattleState,
  side: SideId,
  fighter: BattleFighter,
  command: FightCommand,
): string | null {
  const target = command.target;
  if (!target) return null;
  const move = getMove(fighter.moves[command.moveIndex]?.moveId ?? '');
  if (!move) return null;
  if (SPREAD_TARGETS.has(move.target)) return null;
  if (SELF_TARGETS.has(move.target) || move.target === 'ally') return null;
  if (target.side !== opponentOf(side)) return 'That is not an opposing Pokémon.';
  if (target.slot !== 0 && (!state.double || state.sides[opponentOf(side)].secondActiveIndex < 0)) {
    return 'There is no such Pokémon on the field.';
  }
  return null;
}

/**
 * Runs `read` with `side`'s slot lead-relative, so a shipped per-side helper
 * (`canMegaEvolve`, `canGigantamax` and the two that apply them) reads the slot
 * the command names instead of slot 0.
 */
export function withLeadSlot<T>(state: BattleState, side: SideId, slot: Slot, read: () => T): T {
  if (slot === 0) return read();
  const battleSide = state.sides[side];
  const lead = battleSide.activeIndex;
  battleSide.activeIndex = battleSide.secondActiveIndex;
  try {
    return read();
  } finally {
    battleSide.activeIndex = lead;
  }
}

function validateSwitch(state: BattleState, side: SideId, command: SwitchCommand): string | null {
  const battleSide = state.sides[side];
  const target = battleSide.party[command.partyIndex];
  if (!target) return 'That Pokémon is not in the party.';
  if (
    command.partyIndex === battleSide.activeIndex ||
    command.partyIndex === battleSide.secondActiveIndex
  ) {
    return 'That Pokémon is already out.';
  }
  if (target.hp <= 0) return 'That Pokémon has no energy left.';
  if (!battleSide.awaitingReplacement && isTrapped(state, side)) {
    return 'The Pokémon cannot be switched out.';
  }
  return null;
}

function validateBag(state: BattleState, side: SideId, command: BagCommand): string | null {
  if (side !== 'player') return 'Only the player has a Bag.';
  if (side === 'player' && state.noHeal) return 'No items can be used in this room.';
  const slot = state.bag.find((entry) => entry.item.id === command.itemId);
  if (!slot || slot.count <= 0) return 'That item is not in the Bag.';
  if (slot.item.kind === 'ball' && !state.isWild) return 'Ball: cannot be used in a trainer battle.';
  if (slot.item.kind === 'held') return 'Held items can only be used while held.';
  return null;
}

export function validateCommand(state: BattleState, side: SideId, command: Command): string | null {
  if (state.winner !== null) return 'The battle is over.';

  const slot = commandSlot(command);
  const slotError = validateSlot(state, side, slot);
  if (slotError) return slotError;

  if (state.sides[side].awaitingReplacement && command.type !== 'switch') {
    return 'A replacement must be sent out first.';
  }

  switch (command.type) {
    case 'fight': {
      const fighter = activeFighter(state, side, slot);
      if (command.moveIndex < 0 || command.moveIndex >= fighter.moves.length) {
        return 'There is no such move.';
      }
      const barred = barredMovesFor(state, side);
      const legal = legalMoveIndices(fighter, barred);
      if (fighter.moves[command.moveIndex]?.moveId === fighter.volatiles.disabledMove) {
        return 'That move is disabled!';
      }
      if (legal.length > 0 && !legal.includes(command.moveIndex)) {
        // The room's rule only refuses a barred move while another one is left:
        // a fighter whose whole moveset is barred falls through to Struggle.
        if (barred.has(fighter.moves[command.moveIndex].moveId)) {
          return 'That move cannot be used in this room.';
        }
        if (
          isTaunted(fighter) &&
          getMove(fighter.moves[command.moveIndex]?.moveId ?? '')?.category === 'Status'
        ) {
          return 'The Pokémon is taunted and cannot use status moves.';
        }
        return 'That move has no PP left.';
      }
      if (command.mega && !withLeadSlot(state, side, slot, () => canMegaEvolve(state, side))) {
        return 'That Pokémon cannot Mega Evolve.';
      }
      if (command.gmax && !withLeadSlot(state, side, slot, () => canGigantamax(state, side))) {
        return 'That Pokémon cannot Gigantamax.';
      }
      return validateTarget(state, side, fighter, command);
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
