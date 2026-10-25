import { getDexItem } from '../../../data/dex';
import { ITEMS, type ItemDef } from '../../../data/items';
import {
  applyBoosts,
  applyDamage,
  applyHeal,
  hasAbility,
  type BattleFighter,
  type BoostId,
  type StatusId,
} from '../fighter';
import { opponent, pushEvent, pushText, type BattleTextKey } from '../state';
import { applyStatus, cureStatus } from '../status';
import {
  registerEffects,
  type EffectContext,
  type EffectDefinition,
  type EffectHandlers,
} from './registry';

const ITEM_RAISED: Readonly<Record<BoostId, BattleTextKey>> = {
  atk: 'battle.log.item.raised.atk',
  def: 'battle.log.item.raised.def',
  spa: 'battle.log.item.raised.spa',
  spd: 'battle.log.item.raised.spd',
  spe: 'battle.log.item.raised.spe',
  accuracy: 'battle.log.item.raised.accuracy',
  evasion: 'battle.log.item.raised.evasion',
};

const ITEM_INFLICTED: Readonly<Record<StatusId, BattleTextKey>> = {
  brn: 'battle.log.itemInflicted.brn',
  psn: 'battle.log.itemInflicted.psn',
  tox: 'battle.log.itemInflicted.tox',
  par: 'battle.log.itemInflicted.par',
  slp: 'battle.log.itemInflicted.slp',
  frz: 'battle.log.itemInflicted.frz',
};

/**
 * Held items a run can meet that nothing models yet (`D16` `no-op`): the coverage
 * table reads this list, and `itemEffects()` leaves them unregistered so a develop
 * build warns the first time a battle meets one. Adding a handler means removing
 * the id here.
 */ export const UNMODELLED_ITEMS: readonly string[] = [
  'custapberry',
  'enigmaberry',
  'jabocaberry',
  'keeberry',
  'lansatberry',
  'leppaberry',
  'marangaberry',
  'persimberry',
  'rowapberry',
  'starfberry',
  'tamatoberry',
  'abilityshield',
  'absorbbulb',
  'adamantcrystal',
  'adamantorb',
  'airballoon',
  'assaultvest',
  'bigroot',
  'blacksludge',
  'blunderpolicy',
  'boosterenergy',
  'brightpowder',
  'cellbattery',
  'clearamulet',
  'covertcloak',
  'damprock',
  'ejectbutton',
  'ejectpack',
  'electricseed',
  'eviolite',
  'floatstone',
  'grassyseed',
  'gripclaw',
  'griseouscore',
  'griseousorb',
  'heatrock',
  'heavydutyboots',
  'icyrock',
  'kingsrock',
  'lightball',
  'lightclay',
  'loadeddice',
  'luminousmoss',
  'lustrousglobe',
  'lustrousorb',
  'mentalherb',
  'metronome',
  'mirrorherb',
  'mistyseed',
  'powerherb',
  'protectivepads',
  'psychicseed',
  'punchingglove',
  'quickclaw',
  'razorfang',
  'redcard',
  'ringtarget',
  'rockyhelmet',
  'roomservice',
  'safetygoggles',
  'shedshell',
  'shellbell',
  'snowball',
  'souldew',
  'stickybarb',
  'terrainextender',
  'throatspray',
  'utilityumbrella',
  'weaknesspolicy',
  'whiteherb',
];

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
  let [numerator, denominator] = item.below;
  // Gluttony eats a berry at half HP even when it would normally wait longer.
  if (hasAbility(fighter, 'Gluttony') && numerator / denominator < 1 / 2) {
    numerator = 1;
    denominator = 2;
  }
  return fighter.hp * denominator <= fighter.maxHp * numerator;
}

/** Unnerve stops the foe from eating its own berry. */
function unnerved(ctx: EffectContext): boolean {
  return hasAbility(opponent(ctx.state, ctx.side), 'Unnerve');
}

function consume(ctx: EffectContext, item: ItemDef): void {
  ctx.owner.heldItem = null;
  ctx.owner.lastItemId = item.id;
  pushText(ctx.state, 'battle.log.item.usedUp', { name: ctx.owner.name, item: item.id });
  // Cud Chew owes the holder one more bite at the end of the turn.
  if (hasAbility(ctx.owner, 'Cud Chew') && ctx.owner.volatiles.cudChew === null) {
    ctx.owner.volatiles.cudChew = item.id;
  }
  if (item.consumed && hasAbility(ctx.owner, 'Cheek Pouch') && ctx.owner.hp > 0) {
    const healed = applyHeal(ctx.owner, Math.max(1, Math.floor(ctx.owner.maxHp / 3)));
    if (healed > 0) {
      pushEvent(ctx.state, {
        kind: 'heal',
        side: ctx.side,
        amount: healed,
        hp: ctx.owner.hp,
        maxHp: ctx.owner.maxHp,
      });
      pushText(ctx.state, 'battle.log.item.cheekPouch', { name: ctx.owner.name });
    }
  }
}

/**
 * Spends a held item that fires mid-move (a gem, a resist berry, a Focus Sash):
 * the holder drops it and remembers it, with the same "used up" text `consume`
 * writes. Leftovers-style bookkeeping (Cud Chew, Cheek Pouch) is for the berries
 * the residual branch eats, not for these.
 */
function spend(ctx: EffectContext, item: ItemDef): void {
  ctx.owner.heldItem = null;
  ctx.owner.lastItemId = item.id;
  pushText(ctx.state, 'battle.log.item.usedUp', { name: ctx.owner.name, item: item.id });
}

/**
 * Applies a held item's effect once. `forced` skips the HP threshold, for Cud
 * Chew's second bite. Returns whether anything happened.
 */
export function applyHeldItemEffect(ctx: EffectContext, item: ItemDef, forced = false): boolean {
  const holder = ctx.owner;
  if (item.cures) {
    if (!hasCurableStatus(item, holder)) return false;
    const cured = cureStatus(holder);
    if (!cured) return false;
    pushEvent(ctx.state, { kind: 'cure', side: ctx.side, status: cured });
    pushText(ctx.state, 'battle.log.item.curedStatus', { name: holder.name, item: item.id });
    return true;
  }

  // The pinch berries raise a stat instead of healing (Liechi, Salac...).
  if (item.boosts && (forced || belowThreshold(item, holder))) {
    const changes = applyBoosts(holder, item.boosts);
    if (changes.length === 0) return false;
    for (const change of changes) {
      pushEvent(ctx.state, { kind: 'boost', side: ctx.side, stat: change.stat, stages: change.stages });
    }
    pushText(ctx.state, ITEM_RAISED[changes[0].stat], { name: holder.name, item: item.id });
    return true;
  }

  const baseAmount = healAmountOf(item, holder.maxHp);
  const amount = hasAbility(holder, 'Ripen') ? baseAmount * 2 : baseAmount;
  if (amount <= 0 || (!forced && !belowThreshold(item, holder))) return false;
  const healed = applyHeal(holder, amount);
  if (healed <= 0) return false;

  pushEvent(ctx.state, {
    kind: 'heal',
    side: ctx.side,
    amount: healed,
    hp: holder.hp,
    maxHp: holder.maxHp,
  });
  pushText(ctx.state, 'battle.log.item.restoredHp', { name: holder.name, item: item.id });
  return true;
}

/** Leftovers and the healing berries: a residual effect, optionally consumed. */
function residualHandler(item: ItemDef): NonNullable<EffectHandlers['onResidual']> {
  return (ctx) => {
    const holder = ctx.owner;
    if (holder.hp <= 0) return;
    if (item.consumed && unnerved(ctx)) {
      pushText(ctx.state, 'battle.log.item.unnerve', { name: holder.name, item: item.id });
      return;
    }
    if (!applyHeldItemEffect(ctx, item)) return;
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

/**
 * The damage boosters (Choice Band/Specs, Muscle Band, Wise Glasses, Expert Belt,
 * Life Orb, the Normal Gem), gated by move category and/or super-effectiveness.
 * A `consumed` one (the gem) is spent the moment it fires.
 */
function damageBoostHandler(item: ItemDef): NonNullable<EffectHandlers['onModifyDamage']> {
  const boost = item.damageBoost!;
  return (ctx, payload) => {
    if (ctx.owner !== ctx.source) return;
    if (boost.category && payload.move.category !== boost.category) return;
    if (boost.superEffective && payload.effectiveness <= 1) return;
    const damage = Math.max(1, Math.floor(payload.damage * boost.multiplier));
    if (item.consumed) spend(ctx, item);
    return damage;
  };
}

/**
 * The resist berries: the holder is the defender, and the hit is of the berry's
 * type. `'Normal'` (the Chilan Berry) halves any Normal-type hit; every other
 * berry only fires on a super-effective one. Spent either way.
 */
function resistBerryHandler(item: ItemDef): NonNullable<EffectHandlers['onModifyDamage']> {
  const type = item.resistBerry!;
  return (ctx, payload) => {
    if (ctx.owner !== ctx.target) return;
    if (payload.move.type !== type) return;
    if (type !== 'Normal' && payload.effectiveness <= 1) return;
    const damage = Math.max(1, Math.floor(payload.damage / 2));
    spend(ctx, item);
    return damage;
  };
}

/** Focus Sash / Focus Band: the holder hangs on at 1 HP, and a sash is spent. */
function surviveHandler(item: ItemDef): NonNullable<EffectHandlers['onModifyDamage']> {
  const survive = item.survive!;
  return (ctx, payload) => {
    if (ctx.owner !== ctx.target) return;
    const holder = ctx.owner;
    if (survive.fullHpOnly && holder.hp !== holder.maxHp) return;
    if (payload.damage < holder.hp) return;
    const [numerator, denominator] = survive.chance;
    if (ctx.rng.int(1, denominator) > numerator) return;
    if (item.consumed) spend(ctx, item);
    pushText(ctx.state, 'battle.log.item.hungOn', { name: holder.name, item: item.id });
    return Math.max(0, holder.hp - 1);
  };
}

/** The Speed items: Choice Scarf and Iron Ball multiply the holder's Speed. */
function speedBoostHandler(item: ItemDef): NonNullable<EffectHandlers['onModifySpe']> {
  const multiplier = item.speedBoost!;
  return (_ctx, speed) => Math.max(1, Math.floor(speed * multiplier));
}

/** Wide Lens: only the holder's own hit chance is multiplied. */
function accuracyBoostHandler(item: ItemDef): NonNullable<EffectHandlers['onModifyAccuracy']> {
  const multiplier = item.accuracyBoost!;
  return (ctx, chance) => {
    if (ctx.owner !== ctx.source) return;
    // An accuracy chance is a 0..1 fraction, not a stat: the item multiplies it,
    // the way `accuracyModifier` in `abilities.ts` does. Flooring it (`Math.max(1,
    // Math.floor(...))`) would turn every sub-1 chance into a guaranteed hit.
    return Math.min(1, chance * multiplier);
  };
}

/** Scope Lens and Razor Claw add crit stages, only while the holder attacks. */
function critStagesHandler(item: ItemDef): NonNullable<EffectHandlers['onModifyCritRatio']> {
  const stages = item.critStages!;
  return (ctx, ratio) => {
    if (ctx.owner !== ctx.source) return;
    return ratio + stages;
  };
}

/** Life Orb: the holder's own damaging move costs it a fraction of its max HP. */
function recoilHandler(item: ItemDef): NonNullable<EffectHandlers['onAfterMove']> {
  const [numerator, denominator] = item.recoil!;
  return (ctx, payload) => {
    if (ctx.owner !== ctx.source) return;
    if (!payload.hit) return;
    if (payload.move.category === 'Status') return;
    const holder = ctx.owner;
    const dealt = applyDamage(holder, Math.floor((holder.maxHp * numerator) / denominator));
    if (dealt <= 0) return;
    pushEvent(ctx.state, {
      kind: 'damage',
      side: ctx.side,
      amount: dealt,
      hp: holder.hp,
      maxHp: holder.maxHp,
      effectiveness: 1,
      crit: false,
    });
    pushText(ctx.state, 'battle.log.item.lostHp', { name: holder.name, item: item.id });
  };
}

/** Flame Orb / Toxic Orb: one status on the holder, at the end of a turn, never spent. */
function selfStatusHandler(item: ItemDef): NonNullable<EffectHandlers['onResidual']> {
  const status = item.selfStatus!;
  return (ctx) => {
    const holder = ctx.owner;
    if (holder.hp <= 0) return;
    if (!applyStatus(holder, status, ctx.rng)) return;
    pushEvent(ctx.state, { kind: 'status', side: ctx.side, status });
    pushText(ctx.state, ITEM_INFLICTED[status], { name: holder.name, item: item.id });
  };
}

/** A Plate retypes the holder's Judgment (D37). */
function plateHandler(item: ItemDef): NonNullable<EffectHandlers['onModifyMoveType']> {
  const type = item.plate!;
  return (ctx, move) => {
    if (ctx.owner !== ctx.source) return;
    if (move.id !== 'judgment') return;
    return type;
  };
}

/** A Memory retypes the holder's Multi-Attack (D37). */
function memoryHandler(type: string): NonNullable<EffectHandlers['onModifyMoveType']> {
  return (ctx, move) => {
    if (ctx.owner !== ctx.source) return;
    if (move.id !== 'multiattack') return;
    return type;
  };
}

/** A Drive retypes the holder's Techno Blast (D37). */
function driveHandler(type: string): NonNullable<EffectHandlers['onModifyMoveType']> {
  return (ctx, move) => {
    if (ctx.owner !== ctx.source) return;
    if (move.id !== 'technoblast') return;
    return type;
  };
}

/**
 * The berry a Natural Gift reads (D37): the move is used as the berry's type and
 * base power, and the berry is spent once the move has resolved. `null` for an
 * item the dex gives no `naturalGift` pair.
 */
function naturalGiftHandlers(item: ItemDef): EffectHandlers | null {
  const gift = getDexItem(item.id)?.naturalGift;
  if (!gift) return null;
  return {
    onModifyMove: (ctx, move) => {
      if (ctx.owner !== ctx.source) return;
      if (move.id !== 'naturalgift') return;
      return { ...move, type: gift.type, basePower: gift.basePower };
    },
    // The spend lives here, not in the retype: `onModifyMove` runs in the FIGHT
    // menu's preview too, and `onAfterMove` fires once per resolved move, after
    // the move the berry powered has already produced the turn's damage.
    onAfterMove: (ctx, payload) => {
      if (ctx.owner !== ctx.source) return;
      if (payload.move.id !== 'naturalgift') return;
      spend(ctx, item);
    },
  };
}

/** A `flee` held item: the holder always escapes a wild battle (Smoke Ball). */
function fleeHandler(): NonNullable<EffectHandlers['onTryEscape']> {
  return (ctx) => {
    if (ctx.owner !== ctx.source) return;
    return true;
  };
}

/**
 * A Tera Crystal (`Task-103`): from the moment the holder takes the field, it
 * fights as the crystal's single type. `onStart` runs for every live active at
 * battle start and on each switch-in, and a Mega (or a G-Max) re-runs it after the
 * forme change, so the crystal's type stands over the forme's own. Draws no RNG
 * and writes no log line.
 */
function teraCrystalHandler(item: ItemDef): NonNullable<EffectHandlers['onStart']> {
  const type = item.teraType!;
  return (ctx) => {
    if (ctx.owner !== ctx.source || ctx.owner.hp <= 0) return;
    if (ctx.owner.types.length === 1 && ctx.owner.types[0] === type) return;
    ctx.owner.types = [type];
  };
}

function handlersFor(item: ItemDef): EffectHandlers {
  const hasResidual = Boolean(
    item.cures || item.healAmount || item.healFraction || (item.boosts && item.below),
  );
  let handlers: EffectHandlers = {};
  if (item.typeBoost) handlers = { ...handlers, onModifyDamage: typeBoostHandler(item) };
  if (item.damageBoost) handlers = { ...handlers, onModifyDamage: damageBoostHandler(item) };
  if (item.resistBerry) handlers = { ...handlers, onModifyDamage: resistBerryHandler(item) };
  if (item.survive) handlers = { ...handlers, onModifyDamage: surviveHandler(item) };
  if (hasResidual) handlers = { ...handlers, onResidual: residualHandler(item) };
  if (item.selfStatus) handlers = { ...handlers, onResidual: selfStatusHandler(item) };
  if (item.plate) handlers = { ...handlers, onModifyMoveType: plateHandler(item) };
  if (item.memory) handlers = { ...handlers, onModifyMoveType: memoryHandler(item.memory) };
  if (item.drive) handlers = { ...handlers, onModifyMoveType: driveHandler(item.drive) };
  // The berries whose own effect is still unported stay an honest `no-op` row
  // (D16): they must register nothing at all, or `items.test.ts` would demand a
  // `port` row for an item whose real effect does nothing.
  if (!UNMODELLED_ITEMS.includes(item.id)) {
    const gift = naturalGiftHandlers(item);
    if (gift) handlers = { ...handlers, ...gift };
  }
  if (item.speedBoost) handlers = { ...handlers, onModifySpe: speedBoostHandler(item) };
  if (item.accuracyBoost) handlers = { ...handlers, onModifyAccuracy: accuracyBoostHandler(item) };
  if (item.critStages) handlers = { ...handlers, onModifyCritRatio: critStagesHandler(item) };
  if (item.alwaysLast) handlers = { ...handlers, onFractionalPriority: () => -1 };
  if (item.flee) handlers = { ...handlers, onTryEscape: fleeHandler() };
  if (item.teraType) handlers = { ...handlers, onStart: teraCrystalHandler(item) };
  if (item.recoil) handlers = { ...handlers, onAfterMove: recoilHandler(item) };
  if (item.id === 'bindingband') {
    handlers = {
      ...handlers,
      onModifyTrapDamage: (ctx) => Math.max(1, Math.floor(ctx.owner.maxHp / 6)),
    };
  }
  return handlers;
}

/** Every held item the engine models, as a registrable effect definition. */
export function itemEffects(): readonly EffectDefinition[] {
  const defs: EffectDefinition[] = [];
  for (const item of ITEMS) {
    if (item.kind !== 'held') continue;
    const handlers = handlersFor(item);
    // An unregistered id is what `ownedEffects` (registry.ts) warns about, so an
    // item nothing models must stay out of the registry rather than register an
    // empty handler set (D16). A **Mega Stone** or a **G-Max Stone** is the
    // exception: its effect is the Mega or the Gigantamax command (`mega.ts` /
    // `gmax.ts` via `commands.ts`), not a registry hook, so it is registered with
    // no handlers rather than paged as an unported item.
    if (Object.keys(handlers).length === 0 && !item.mega && !item.gmax) continue;
    defs.push({ id: item.id, kind: 'item', handlers });
  }
  return defs;
}

export function registerItemEffects(): void {
  registerEffects(itemEffects());
}

registerItemEffects();
