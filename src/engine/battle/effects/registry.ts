import type { Move, MoveEffect } from '../../../data/dex';
import { warnUnportedEffect } from '../../../dev/warnings';
import type { Rng } from '../../rng';
import { moveContacts, type BattleFighter, type BoostId } from '../fighter';
import type { BattleState, SideId } from '../state';

export type EffectKind = 'ability' | 'item' | 'move' | 'weather' | 'terrain' | 'status' | 'volatile';

export type EffectContext = Readonly<{
  state: BattleState;
  side: SideId;
  source: BattleFighter;
  target: BattleFighter | null;
  move: Move | null;
  rng: Rng;
  /** The fighter the running effect is attached to (ability or held item). */
  owner: BattleFighter;
}>;

export type MovePayload = Readonly<{ move: Move; hit: boolean; contact: boolean }>;
export type DamagePayload = Readonly<{
  move: Move;
  damage: number;
  effectiveness: number;
  crit: boolean;
  contact: boolean;
}>;
export type StatusPayload = Readonly<{ status: string }>;
export type BoostPayload = Readonly<{ stat: BoostId; stages: number; self: boolean }>;
export type VolatilePayload = Readonly<{ volatile: string }>;
export type SecondaryPayload = Readonly<{ effect: MoveEffect }>;

/**
 * Handler bodies are direct ports of Showdown's, on the same hook names, but
 * against our smaller battle-state object. A handler mutates state directly and
 * returns a value only when the hook can veto or amend the pending action.
 */
export type EffectHandlers = Readonly<{
  onSwitchIn?: (ctx: EffectContext) => void;
  onSwitchOut?: (ctx: EffectContext) => void;
  onStart?: (ctx: EffectContext) => void;
  onResidual?: (ctx: EffectContext) => void;
  onModifyDamage?: (ctx: EffectContext, payload: DamagePayload) => number | void;
  onModifySpe?: (ctx: EffectContext, speed: number) => number | void;
  onModifyAccuracy?: (ctx: EffectContext, chance: number) => number | void;
  onModifyPriority?: (ctx: EffectContext, priority: number) => number | void;
  /**
   * A tie-break inside the holder's priority bracket: positive acts before the
   * same-bracket moves regardless of Speed, negative acts last (Quick Draw,
   * Stall). Not the priority itself.
   */
  onFractionalPriority?: (ctx: EffectContext) => number | void;
  onModifyCrit?: (ctx: EffectContext, willCrit: boolean) => boolean | void;
  onModifyCritRatio?: (ctx: EffectContext, ratio: number) => number | void;
  onModifyMultihit?: (ctx: EffectContext, hits: number) => number | void;
  onModifyBoost?: (ctx: EffectContext, payload: BoostPayload) => number | void;
  onModifyRecoil?: (ctx: EffectContext, recoil: number) => number | void;
  /** Secondary-effect proc chance in percent (Serene Grace doubles it). */
  onModifySecondaryChance?: (ctx: EffectContext, chance: number) => number | void;
  /** The move's type effectiveness (Scrappy and Mind's Eye pierce Ghost immunity). */
  onModifyEffectiveness?: (ctx: EffectContext, move: Move, effectiveness: number) => number | void;
  /** The move's type as used (Galvanize, Pixilate, Liquid Voice). */
  onModifyMoveType?: (ctx: EffectContext, move: Move) => string | void;
  /** Runs on the survivors when any active Pokémon faints (Soul-Heart). */
  onFaint?: (ctx: EffectContext) => void;
  onTryHit?: (ctx: EffectContext, payload: MovePayload) => boolean | void;
  /** True bypasses the target's substitute (Infiltrator). */
  onTrySubstitute?: (ctx: EffectContext) => boolean | void;
  onTryVolatile?: (ctx: EffectContext, payload: VolatilePayload) => boolean | void;
  onTrySecondary?: (ctx: EffectContext, payload: SecondaryPayload) => boolean | void;
  /** True guarantees a wild escape (Run Away). */
  onTryEscape?: (ctx: EffectContext) => boolean | void;
  onAfterMove?: (ctx: EffectContext, payload: MovePayload) => void;
  onStatus?: (ctx: EffectContext, payload: StatusPayload) => boolean | void;
  onAfterStatus?: (ctx: EffectContext, status: string) => void;
  onBoost?: (ctx: EffectContext, payload: BoostPayload) => boolean | void;
}>;

export type EffectDefinition = Readonly<{
  id: string;
  kind: EffectKind;
  handlers: EffectHandlers;
}>;

export type ContextOptions = Readonly<{
  source: BattleFighter;
  target?: BattleFighter | null;
  move?: Move | null;
}>;

const REGISTRY = new Map<string, EffectDefinition>();

export function normalizeEffectId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function registerEffect(def: EffectDefinition): void {
  const id = normalizeEffectId(def.id);
  if (REGISTRY.has(id)) throw new Error(`Effect "${id}" is already registered`);
  REGISTRY.set(id, { id, kind: def.kind, handlers: def.handlers });
}

export function registerEffects(defs: readonly EffectDefinition[]): void {
  for (const def of defs) registerEffect(def);
}

export function getEffect(id: string): EffectDefinition | undefined {
  return REGISTRY.get(normalizeEffectId(id));
}

export function registeredEffects(): readonly EffectDefinition[] {
  return [...REGISTRY.values()];
}

/** Test-only: drops every registration so suites do not leak into each other. */
export function clearEffects(): void {
  REGISTRY.clear();
}

export function makeContext(state: BattleState, side: SideId, options: ContextOptions): EffectContext {
  return {
    state,
    side,
    source: options.source,
    target: options.target ?? null,
    move: options.move ?? null,
    rng: state.rng,
    owner: options.source,
  };
}

type EffectRef = Readonly<{ effect: EffectDefinition; owner: BattleFighter }>;

function activeAbility(state: BattleState, side: SideId): string {
  return state.sides[side].party[state.sides[side].activeIndex].ability;
}

/** Neutralizing Gas suppresses the opposing active Pokémon's ability. */
function gasSuppresses(state: BattleState, side: SideId): boolean {
  const foeSide: SideId = side === 'player' ? 'enemy' : 'player';
  return activeAbility(state, foeSide) === 'Neutralizing Gas';
}

function abilityActive(state: BattleState, fighter: BattleFighter, side: SideId): boolean {
  if (fighter.ability === 'Neutralizing Gas') return true;
  return !gasSuppresses(state, side);
}

function ownedEffects(
  fighter: BattleFighter | null,
  state: BattleState,
  side: SideId,
): readonly EffectRef[] {
  if (!fighter) return [];
  const refs: EffectRef[] = [];
  const active = abilityActive(state, fighter, side);
  // Mold Breaker ignores every ability except the piercer's own.
  const pierced = state.abilityPierce !== null && state.abilityPierce !== fighter;
  const ability = getEffect(fighter.ability);
  if (active && !pierced) {
    if (ability) refs.push({ effect: ability, owner: fighter });
    else if (fighter.ability) warnUnportedEffect('ability', fighter.ability);
  }
  // Klutz suppresses the holder's held item entirely.
  if (fighter.heldItem && fighter.ability !== 'Klutz') {
    const item = getEffect(fighter.heldItem);
    if (item) refs.push({ effect: item, owner: fighter });
    else warnUnportedEffect('item', fighter.heldItem);
  }
  return refs;
}

function moveEffect(move: Move | null, owner: BattleFighter): readonly EffectRef[] {
  if (!move) return [];
  const effect = getEffect(move.id);
  return effect ? [{ effect, owner }] : [];
}

/** Source first, then the defender's ability, then the move's own handlers. */
function contextEffects(
  ctx: EffectContext,
  includeTarget: boolean,
  move: Move | null,
): readonly EffectRef[] {
  const foeSide: SideId = ctx.side === 'player' ? 'enemy' : 'player';
  return [
    ...ownedEffects(ctx.source, ctx.state, ctx.side),
    ...(includeTarget ? ownedEffects(ctx.target, ctx.state, foeSide) : []),
    ...moveEffect(move, ctx.source),
  ];
}

function contextFor(ctx: EffectContext, ref: EffectRef): EffectContext {
  return ref.owner === ctx.owner ? ctx : { ...ctx, owner: ref.owner };
}

export function runSwitchIn(ctx: EffectContext): void {
  for (const ref of contextEffects(ctx, false, null)) {
    ref.effect.handlers.onSwitchIn?.(contextFor(ctx, ref));
  }
}

export function runSwitchOut(ctx: EffectContext): void {
  for (const ref of contextEffects(ctx, false, null)) {
    ref.effect.handlers.onSwitchOut?.(contextFor(ctx, ref));
  }
}

/** A true result means the attacker's move ignores the target's substitute. */
export function runTrySubstitute(ctx: EffectContext, move: Move): boolean {
  for (const ref of contextEffects(ctx, false, move)) {
    if (ref.effect.handlers.onTrySubstitute?.(contextFor(ctx, ref)) === true) return true;
  }
  return false;
}

export function runStart(ctx: EffectContext): void {
  for (const ref of contextEffects(ctx, false, null)) {
    ref.effect.handlers.onStart?.(contextFor(ctx, ref));
  }
}

export function runResidual(ctx: EffectContext): void {
  for (const ref of contextEffects(ctx, false, null)) {
    ref.effect.handlers.onResidual?.(contextFor(ctx, ref));
  }
}

export function runAfterMove(ctx: EffectContext, move: Move, hit = true): void {
  const payload: MovePayload = { move, hit, contact: moveContacts(ctx.source, move) };
  for (const ref of contextEffects(ctx, true, move)) {
    ref.effect.handlers.onAfterMove?.(contextFor(ctx, ref), payload);
  }
}

export function runFaint(ctx: EffectContext): void {
  for (const ref of contextEffects(ctx, false, null)) {
    ref.effect.handlers.onFaint?.(contextFor(ctx, ref));
  }
}

export function runTryHit(ctx: EffectContext, move: Move): boolean {
  const payload: MovePayload = { move, hit: true, contact: moveContacts(ctx.source, move) };
  for (const ref of contextEffects(ctx, true, move)) {
    if (ref.effect.handlers.onTryHit?.(contextFor(ctx, ref), payload) === false) return false;
  }
  return true;
}

export function runStatus(ctx: EffectContext, status: string): boolean {
  const payload: StatusPayload = { status };
  for (const ref of contextEffects(ctx, true, null)) {
    if (ref.effect.handlers.onStatus?.(contextFor(ctx, ref), payload) === false) return false;
  }
  return true;
}

export function runTryVolatile(ctx: EffectContext, volatile: string): boolean {
  const payload: VolatilePayload = { volatile };
  for (const ref of contextEffects(ctx, true, null)) {
    if (ref.effect.handlers.onTryVolatile?.(contextFor(ctx, ref), payload) === false) return false;
  }
  return true;
}

export function runTrySecondary(ctx: EffectContext, effect: MoveEffect): boolean {
  const payload: SecondaryPayload = { effect };
  for (const ref of contextEffects(ctx, true, null)) {
    if (ref.effect.handlers.onTrySecondary?.(contextFor(ctx, ref), payload) === false) return false;
  }
  return true;
}

/** Secondary proc chance in percent, read from the attacker's ability (Serene Grace). */
export function runModifySecondaryChance(ctx: EffectContext, chance: number): number {
  let value = chance;
  for (const ref of contextEffects(ctx, false, null)) {
    const next = ref.effect.handlers.onModifySecondaryChance?.(contextFor(ctx, ref), value);
    if (typeof next === 'number') value = next;
  }
  return value;
}

export function runAfterStatus(ctx: EffectContext, status: string): void {
  for (const ref of contextEffects(ctx, true, null)) {
    ref.effect.handlers.onAfterStatus?.(contextFor(ctx, ref), status);
  }
}

export function runTryEscape(ctx: EffectContext): boolean {
  for (const ref of contextEffects(ctx, false, null)) {
    if (ref.effect.handlers.onTryEscape?.(contextFor(ctx, ref)) === true) return true;
  }
  return false;
}

export function runBoost(
  ctx: EffectContext,
  stat: BoostId,
  stages: number,
  self = false,
): boolean {
  const payload: BoostPayload = { stat, stages, self };
  for (const ref of contextEffects(ctx, true, null)) {
    if (ref.effect.handlers.onBoost?.(contextFor(ctx, ref), payload) === false) return false;
  }
  return true;
}

export function runModifyDamage(
  ctx: EffectContext,
  move: Move,
  damage: number,
  effectiveness = 1,
  crit = false,
): number {
  let value = damage;
  const contact = moveContacts(ctx.source, move);
  for (const ref of contextEffects(ctx, true, move)) {
    const next = ref.effect.handlers.onModifyDamage?.(contextFor(ctx, ref), {
      move,
      damage: value,
      effectiveness,
      crit,
      contact,
    });
    if (typeof next === 'number') value = next;
  }
  return value;
}

/** Speed modifiers read the fighter's own ability only (Chlorophyll, Quick Feet). */
export function runModifySpe(ctx: EffectContext, speed: number): number {
  let value = speed;
  for (const ref of contextEffects(ctx, false, null)) {
    const next = ref.effect.handlers.onModifySpe?.(contextFor(ctx, ref), value);
    if (typeof next === 'number') value = next;
  }
  return value;
}

/** Accuracy modifiers read the attacker's and the defender's abilities (Compound Eyes, Sand Veil). */
export function runModifyAccuracy(ctx: EffectContext, chance: number): number {
  let value = chance;
  for (const ref of contextEffects(ctx, true, null)) {
    const next = ref.effect.handlers.onModifyAccuracy?.(contextFor(ctx, ref), value);
    if (typeof next === 'number') value = next;
  }
  return value;
}

/** Priority modifiers read the fighter's own ability (Prankster, Gale Wings). */
export function runModifyPriority(ctx: EffectContext, move: Move, priority: number): number {
  let value = priority;
  for (const ref of contextEffects(ctx, false, move)) {
    const next = ref.effect.handlers.onModifyPriority?.(contextFor(ctx, ref), value);
    if (typeof next === 'number') value = next;
  }
  return value;
}

/** The holder's tie-break inside its priority bracket (Quick Draw, Stall). */
export function runFractionalPriority(ctx: EffectContext): number {
  let value = 0;
  for (const ref of contextEffects(ctx, false, null)) {
    const next = ref.effect.handlers.onFractionalPriority?.(contextFor(ctx, ref));
    if (typeof next === 'number') value = next;
  }
  return value;
}

/** Effectiveness modifiers read the attacker's ability (Scrappy, Mind's Eye). */
export function runModifyEffectiveness(ctx: EffectContext, move: Move, effectiveness: number): number {
  let value = effectiveness;
  for (const ref of contextEffects(ctx, false, move)) {
    const next = ref.effect.handlers.onModifyEffectiveness?.(contextFor(ctx, ref), move, value);
    if (typeof next === 'number') value = next;
  }
  return value;
}

/** Type-changing abilities read the attacker's ability (Galvanize, Pixilate). */
export function runModifyMoveType(ctx: EffectContext, move: Move): string {
  let value = move.type;
  for (const ref of contextEffects(ctx, false, move)) {
    const next = ref.effect.handlers.onModifyMoveType?.(contextFor(ctx, ref), move);
    if (typeof next === 'string') value = next;
  }
  return value;
}

/** Crit-ratio modifiers read the attacker's ability (Super Luck). */
export function runModifyCritRatio(ctx: EffectContext, move: Move, ratio: number): number {
  let value = ratio;
  for (const ref of contextEffects(ctx, true, move)) {
    const next = ref.effect.handlers.onModifyCritRatio?.(contextFor(ctx, ref), value);
    if (typeof next === 'number') value = next;
  }
  return value;
}

/** Crit blockers read the defender's ability (Battle Armor, Shell Armor). */
export function runModifyCrit(ctx: EffectContext, move: Move, willCrit: boolean): boolean {
  let value = willCrit;
  for (const ref of contextEffects(ctx, true, move)) {
    const next = ref.effect.handlers.onModifyCrit?.(contextFor(ctx, ref), value);
    if (typeof next === 'boolean') value = next;
  }
  return value;
}

/** Multihit modifiers read the attacker's ability (Skill Link). */
export function runModifyMultihit(ctx: EffectContext, move: Move, hits: number): number {
  let value = hits;
  for (const ref of contextEffects(ctx, false, move)) {
    const next = ref.effect.handlers.onModifyMultihit?.(contextFor(ctx, ref), value);
    if (typeof next === 'number') value = next;
  }
  return value;
}

/** Boost modifiers read the target's ability (Simple, Contrary). */
export function runModifyBoost(
  ctx: EffectContext,
  stat: BoostId,
  stages: number,
  self: boolean,
): number {
  let value = stages;
  for (const ref of contextEffects(ctx, true, null)) {
    const next = ref.effect.handlers.onModifyBoost?.(contextFor(ctx, ref), { stat, stages: value, self });
    if (typeof next === 'number') value = next;
  }
  return value;
}

/** Recoil modifiers read the attacker's ability (Rock Head). */
export function runModifyRecoil(ctx: EffectContext, move: Move, recoil: number): number {
  let value = recoil;
  for (const ref of contextEffects(ctx, false, move)) {
    const next = ref.effect.handlers.onModifyRecoil?.(contextFor(ctx, ref), value);
    if (typeof next === 'number') value = next;
  }
  return value;
}
