import { getItem, type ItemDef } from '../../data/items';
import { restoreFighter } from '../battle/fighter';
import type { RunPokemon } from './progression';
import { consumeItem, memberById, updatePokemon, type RunState } from './state';

function curesStatus(item: ItemDef, status: RunPokemon['fighter']['status']): boolean {
  if (!item.cures || status === null) return false;
  return item.cures === 'all' || item.cures.includes(status);
}

/** Whether `item` would change `member` if spent now. A fainted member never applies. */
export function itemAppliesTo(member: RunPokemon, item: ItemDef): boolean {
  if (member.fighter.hp <= 0) return false;
  if (item.kind === 'heal') {
    return (
      member.fighter.hp < restoreFighter(member.fighter).maxHp ||
      curesStatus(item, member.fighter.status)
    );
  }
  if (item.kind === 'status') return curesStatus(item, member.fighter.status);
  return false;
}

/**
 * Spends one `itemId` on `memberId`: consumes the stack and writes the HP and/or
 * status back. Returns the SAME `run` object (no new state, no consumption) when
 * the member, the item or the stock is missing, or when `itemAppliesTo` is false.
 */
export function useItemOn(run: RunState, memberId: string, itemId: string): RunState {
  const member = memberById(run, memberId);
  if (!member) return run;
  const item = getItem(itemId);
  if (!item) return run;
  const stock = run.bag.find((slot) => slot.itemId === itemId);
  if (!stock || stock.count <= 0) return run;
  if (!itemAppliesTo(member, item)) return run;

  const maxHp = restoreFighter(member.fighter).maxHp;
  let hp = member.fighter.hp;
  let status = member.fighter.status;
  let statusCounter = member.fighter.statusCounter;

  if (item.kind === 'heal') {
    const gain = item.healFraction
      ? Math.floor((maxHp * item.healFraction[0]) / item.healFraction[1])
      : (item.healAmount ?? 0);
    hp = Math.min(maxHp, hp + Math.max(0, gain));
    if (curesStatus(item, status)) {
      status = null;
      statusCounter = 0;
    }
  } else if (item.kind === 'status') {
    status = null;
    statusCounter = 0;
  }

  const healed: RunPokemon = { ...member, fighter: { ...member.fighter, hp, status, statusCounter } };
  return updatePokemon(consumeItem(run, itemId), healed);
}
