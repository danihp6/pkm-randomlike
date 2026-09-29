import { ITEMS, type ItemDef } from '../../../data/items';
import { applyHeal, type BattleFighter } from '../fighter';
import { opponent, pushEvent, pushText } from '../state';
import { cureStatus } from '../status';
import {
  registerEffects,
  type EffectContext,
  type EffectDefinition,
  type EffectHandlers,
} from './registry';

function healAmountOf(item: ItemDef, maxHp: number): number {
  if (item.healFraction && item.healFraction.length === 2) {
    return Math.floor((maxHp * item.healFraction[0]) / item.healFraction[1]);
  }
  return item.healAmount ?? 0;
}

function hasCurableStatus(item: ItemDef, fighter: BattleFighter): boolean {
  if (!item.cures || !fighter.status) return false;
  return item.cures === 'all' || item.cures.includes(fighter.status);
}

/** `below` is an HP at-or-below fraction, as `[numerator, denominator]`. */
function belowThreshold(item: ItemDef, fighter: BattleFighter): boolean {
  if (!item.below) return true;
  return fighter.hp * item.below[1] <= fighter.maxHp * item.below[0];
}

/** Unnerve stops the foe from eating its own berry. */
function unnerved(ctx: EffectContext): boolean {
  return opponent(ctx.state, ctx.side).ability === 'Unnerve';
}

function consume(ctx: EffectContext, item: ItemDef): void {
  ctx.owner.heldItem = null;
  ctx.owner.lastItemId = item.id;
  pushText(ctx.state, `${ctx.owner.name} used up its ${item.name}!`);
  if (item.consumed && ctx.owner.ability === 'Cheek Pouch' && ctx.owner.hp > 0) {
    const healed = applyHeal(ctx.owner, Math.max(1, Math.floor(ctx.owner.maxHp / 3)));
    if (healed > 0) {
      pushEvent(ctx.state, {
        kind: 'heal',
        side: ctx.side,
        amount: healed,
        hp: ctx.owner.hp,
        maxHp: ctx.owner.maxHp,
      });
      pushText(ctx.state, `${ctx.owner.name} restored HP with Cheek Pouch!`);
    }
  }
}

/** Leftovers and the healing berries: a residual heal, optionally consumed. */
function residualHandler(item: ItemDef): NonNullable<EffectHandlers['onResidual']> {
  return (ctx) => {
    const holder = ctx.owner;
    if (holder.hp <= 0) return;
    if (item.consumed && unnerved(ctx)) {
      pushText(ctx.state, `${holder.name} can't eat its ${item.name} because of Unnerve!`);
      return;
    }

    if (item.cures) {
      if (!hasCurableStatus(item, holder)) return;
      const cured = cureStatus(holder);
      if (!cured) return;
      pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status: cured });
      pushText(ctx.state, `${holder.name}'s ${item.name} cured its status!`);
      if (item.consumed) consume(ctx, item);
      return;
    }

    const baseAmount = healAmountOf(item, holder.maxHp);
    const amount = holder.ability === 'Ripen' ? baseAmount * 2 : baseAmount;
    if (amount <= 0 || !belowThreshold(item, holder)) return;
    const healed = applyHeal(holder, amount);
    if (healed <= 0) return;

    pushEvent(ctx.state, {
      kind: 'heal',
      side: ctx.side,
      amount: healed,
      hp: holder.hp,
      maxHp: holder.maxHp,
    });
    pushText(ctx.state, `${holder.name} restored HP with its ${item.name}!`);
    if (item.consumed) consume(ctx, item);
  };
}

/** The 1.2x type items, applied only when the holder is the move's user. */
function typeBoostHandler(item: ItemDef): NonNullable<EffectHandlers['onModifyDamage']> {
  const boost = item.typeBoost!;
  return (ctx, payload) => {
    if (ctx.owner !== ctx.source) return;
    if (payload.move.type !== boost.type) return;
    return Math.max(1, Math.floor(payload.damage * boost.multiplier));
  };
}

function handlersFor(item: ItemDef): EffectHandlers {
  const hasResidual = Boolean(item.cures || item.healAmount || item.healFraction);
  if (item.typeBoost && hasResidual) {
    return { onModifyDamage: typeBoostHandler(item), onResidual: residualHandler(item) };
  }
  if (item.typeBoost) return { onModifyDamage: typeBoostHandler(item) };
  if (hasResidual) return { onResidual: residualHandler(item) };
  return {};
}

/** Every held item in the catalogue, as a registrable effect definition. */
export function itemEffects(): readonly EffectDefinition[] {
  const defs: EffectDefinition[] = [];
  for (const item of ITEMS) {
    if (item.kind !== 'held') continue;
    defs.push({ id: item.id, kind: 'item', handlers: handlersFor(item) });
  }
  return defs;
}

export function registerItemEffects(): void {
  registerEffects(itemEffects());
}

registerItemEffects();
