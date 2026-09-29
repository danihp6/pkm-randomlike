import type { Move, MoveEffect } from '../../../data/dex';
import { warnUnportedEffect } from '../../../dev/warnings';
import type { Rng } from '../../rng';
import type { BattleFighter, BoostId } from '../fighter';
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

export type MovePayload = Readonly<{ move: Move }>;
export type DamagePayload = Readonly<{ move: Move; damage: number; effectiveness: number }>;
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
  onModifyCrit?: (ctx: EffectContext, willCrit: boolean) => boolean | void;
  onModifyMultihit?: (ctx: EffectContext, hits: number) => number | void;
  onModifyBoost?: (ctx: EffectContext, payload: BoostPayload) => number | void;
  onModifyRecoil?: (ctx: EffectContext, recoil: number) => number | void;
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

function ownedEffects(fighter: BattleFighter | null): readonly EffectRef[] {
  if (!fighter) return [];
  const refs: EffectRef[] = [];
  const ability = getEffect(fighter.ability);
  if (ability) refs.push({ effect: ability, owner: fighter });
  else if (fighter.ability) warnUnportedEffect('ability', fighter.ability);
  if (fighter.heldItem) {
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
  return [
    ...ownedEffects(ctx.source),
    ...(includeTarget ? ownedEffects(ctx.target) : []),
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

export function runAfterMove(ctx: EffectContext, move: Move): void {
  const payload: MovePayload = { move };
  for (const ref of contextEffects(ctx, true, move)) {
    ref.effect.handlers.onAfterMove?.(contextFor(ctx, ref), payload);
  }
}

export function runTryHit(ctx: EffectContext, move: Move): boolean {
  const payload: MovePayload = { move };
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
): number {
  let value = damage;
  for (const ref of contextEffects(ctx, true, move)) {
    const next = ref.effect.handlers.onModifyDamage?.(contextFor(ctx, ref), {
      move,
      damage: value,
      effectiveness,
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
