import type { StatId } from '../../data/dex';
import {
  CANDY_COLOURS,
  CANDY_POSITIVE_CHANCE,
  CANDY_STATS,
  getItem,
  type ItemDef,
  type RouteEffect,
} from '../../data/items';
import { restoreFighter, type FighterSnapshot } from '../battle/fighter';
import { hashSeed, Rng } from '../rng';
import { healParty } from './heal';
import { withCurse, withForcedField } from './modifiers';
import type { RunPokemon } from './progression';
import {
  consumeItem,
  discoverCandy,
  memberById,
  updatePokemon,
  type RunState,
} from './state';

/** The permanent treat one candy colour gives in one run (`Task-103`). */
export type CandyTreat = Readonly<{ stat: Exclude<StatId, 'hp'>; delta: 1 | -1 }>;

/**
 * The treat `colour` gives **this run**: one `rng.int` over `CANDY_STATS` then one
 * `rng.next()` against `CANDY_POSITIVE_CHANCE`, on
 * `Rng(hashSeed(`${seed}:candy:${colour}`))`, in that order. Pure and stable, so a
 * colour always moves the same stat in the same run. An unknown colour throws.
 */
export function candyTreat(seed: string, colour: string): CandyTreat {
  if (!CANDY_COLOURS.includes(colour)) throw new Error(`Unknown candy colour "${colour}"`);
  const rng = new Rng(hashSeed(`${seed}:candy:${colour}`));
  const stat = CANDY_STATS[rng.int(0, CANDY_STATS.length - 1)];
  const delta = rng.next() < CANDY_POSITIVE_CHANCE ? 1 : -1;
  return { stat, delta };
}

function curesStatus(item: ItemDef, status: RunPokemon['fighter']['status']): boolean {
  if (!item.cures || status === null) return false;
  return item.cures === 'all' || item.cures.includes(status);
}

/**
 * Whether `item` would change `member` if spent now. A route consumable always
 * applies, because its effect is party-wide and the member it is dropped on is
 * only the gesture's carrier; a candy applies while the member is alive; and a
 * fainted member never takes a heal or a cure.
 */
export function itemAppliesTo(member: RunPokemon, item: ItemDef): boolean {
  if (item.routeEffect) return true;
  if (member.fighter.hp <= 0) return false;
  if (item.candy !== undefined) return true;
  if (item.kind === 'heal') {
    return (
      member.fighter.hp < restoreFighter(member.fighter).maxHp ||
      curesStatus(item, member.fighter.status)
    );
  }
  if (item.kind === 'status') return curesStatus(item, member.fighter.status);
  return false;
}

/** The snapshot's treats with one candy's `delta` written on its stat, zeroes dropped. */
function withTreat(fighter: FighterSnapshot, treat: CandyTreat): FighterSnapshot {
  const treats: Partial<Record<StatId, number>> = { ...(fighter.statTreats ?? {}) };
  const next = (treats[treat.stat] ?? 0) + treat.delta;
  if (next === 0) delete treats[treat.stat];
  else treats[treat.stat] = next;
  // A record that reaches empty leaves no key at all, so the save stays byte-stable.
  const { statTreats, ...rest } = fighter;
  return Object.keys(treats).length === 0 ? rest : { ...rest, statTreats: treats };
}

/** A route consumable's effect, written by the shipped NPC writers. */
function applyRouteEffect(run: RunState, effect: RouteEffect): RunState {
  switch (effect.kind) {
    case 'heal':
      return healParty(run);
    case 'curse':
      return { ...run, modifiers: withCurse(run.modifiers) };
    case 'sky':
      return { ...run, modifiers: withForcedField(run.modifiers, effect.field) };
  }
}

/**
 * Spends one `itemId` on the route: a candy writes its treat on `memberId` and
 * records the colour; a route consumable applies its own effect to the whole run
 * (`heal` → `healParty`, `curse` → `withCurse`, `sky` → `withForcedField`), with
 * `memberId` ignored. Returns the SAME `run` object (no consumption) when the
 * member, the item or the stock is missing, and for a candy on a fainted member.
 */
export function useItemOn(run: RunState, memberId: string, itemId: string): RunState {
  const member = memberById(run, memberId);
  if (!member) return run;
  const item = getItem(itemId);
  if (!item) return run;
  const stock = run.bag.find((slot) => slot.itemId === itemId);
  if (!stock || stock.count <= 0) return run;
  if (!itemAppliesTo(member, item)) return run;

  if (item.routeEffect) return consumeItem(applyRouteEffect(run, item.routeEffect), itemId);

  if (item.candy !== undefined) {
    const treats = candyTreat(run.seed, item.candy);
    const treated: RunPokemon = { ...member, fighter: withTreat(member.fighter, treats) };
    return updatePokemon(consumeItem(discoverCandy(run, item.candy), itemId), treated);
  }

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
