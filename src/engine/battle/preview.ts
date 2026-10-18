import { getMove } from '../../data/dex';
import { accuracyChance } from './accuracy';
import { clampBoost, type BattleFighter } from './fighter';
import { activeFighter, opponent, type BattleState, type SideId } from './state';
import {
  makeContext,
  runModifyAccuracy,
  runModifyDamage,
  runModifyMove,
  runModifyMoveType,
} from './effects/registry';

/**
 * What the moves menu shows about one move slot: its effective power (base
 * power folded with STAB and the attacker's ability/item boosts) and its final
 * hit chance (the move's accuracy under the net accuracy/evasion stage and any
 * ability modifiers). Pure and headless, so the grid and its tests share one
 * reading of the rules; the scene only formats it.
 */
export type MovePreview = Readonly<{
  /** The move's type as used, after -ate abilities (Pixilate, Galvanize...). */
  type: string;
  /** Base power straight from the dex (0 for a status move). */
  basePower: number;
  /** Effective power: base × ability/item boosts × STAB. */
  power: number;
  /** True when the move matches one of the user's types (STAB). */
  stab: boolean;
  /** Combined attacker ability/item damage multiplier (1 = unmodified). */
  powerMultiplier: number;
  /** The move's printed accuracy in percent, or null when it never misses. */
  baseAccuracy: number | null;
  /** Final hit chance in percent after stages and abilities, or null. */
  accuracy: number | null;
  /** Net accuracy stage (accuracy − evasion), clamped to ±6. */
  accuracyStage: number;
}>;

/** The move slot's preview, or null when the slot or its move is unknown. */
export function movePreview(state: BattleState, side: SideId, moveIndex: number): MovePreview | null {
  const fighter = activeFighter(state, side);
  const slot = fighter.moves[moveIndex];
  if (!slot) return null;
  const move = getMove(slot.moveId);
  if (!move) return null;

  const target = opponent(state, side);
  const ctx = makeContext(state, side, { source: fighter, target, move });
  const modified = runModifyMove(ctx, move);
  const type = runModifyMoveType(ctx, modified);
  const activeMove = type === modified.type ? modified : { ...modified, type };
  const damaging = activeMove.category !== 'Status' && activeMove.basePower > 0;

  // A probe of 100 turns the attacker's damage hooks into a plain multiplier:
  // each is a straight scale of the pending damage, so the result reads as the
  // move's effective power including abilities and items (but not STAB, which
  // the damage formula applies on its own).
  const powerMultiplier = damaging ? runModifyDamage(ctx, activeMove, 100, 1, false, false) / 100 : 1;
  const stab = damaging && fighter.types.includes(activeMove.type);
  const power = damaging ? Math.round(activeMove.basePower * powerMultiplier * (stab ? 1.5 : 1)) : 0;

  return {
    type: activeMove.type,
    basePower: activeMove.basePower,
    power,
    stab,
    powerMultiplier,
    ...accuracyPreview(fighter, target, activeMove.accuracy, ctx),
  };
}

function accuracyPreview(
  attacker: BattleFighter,
  defender: BattleFighter,
  moveAccuracy: number | true,
  ctx: ReturnType<typeof makeContext>,
): Pick<MovePreview, 'baseAccuracy' | 'accuracy' | 'accuracyStage'> {
  const evasion = attacker.ability === "Mind's Eye" ? 0 : defender.boosts.evasion;
  const accuracyStage = clampBoost(attacker.boosts.accuracy - evasion);
  if (moveAccuracy === true) {
    return { baseAccuracy: null, accuracy: null, accuracyStage };
  }
  const chance = runModifyAccuracy(
    ctx,
    accuracyChance(moveAccuracy, attacker, defender, ctx.state.field.gravity > 0),
  );
  return {
    baseAccuracy: moveAccuracy,
    accuracy: Math.round(Math.min(1, chance) * 100),
    accuracyStage,
  };
}
