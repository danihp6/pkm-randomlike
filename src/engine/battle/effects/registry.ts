import type { Move } from '../../../data/dex';
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
}>;

export type MovePayload = Readonly<{ move: Move }>;
export type DamagePayload = Readonly<{ move: Move; damage: number }>;
export type StatusPayload = Readonly<{ status: string }>;
export type BoostPayload = Readonly<{ stat: BoostId; stages: number }>;

/**
 * Handler bodies are direct ports of Showdown's, on the same hook names, but
 * against our smaller battle-state object. A handler mutates state directly and
 * returns a value only when the hook can veto or amend the pending action.
 */
export type EffectHandlers = Readonly<{
  onSwitchIn?: (ctx: EffectContext) => void;
  onStart?: (ctx: EffectContext) => void;
  onResidual?: (ctx: EffectContext) => void;
  onModifyDamage?: (ctx: EffectContext, payload: DamagePayload) => number | void;
  onTryHit?: (ctx: EffectContext, payload: MovePayload) => boolean | void;
  onAfterMove?: (ctx: EffectContext, payload: MovePayload) => void;
  onStatus?: (ctx: EffectContext, payload: StatusPayload) => boolean | void;
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
  };
}

function ownedEffects(fighter: BattleFighter | null): readonly EffectDefinition[] {
  if (!fighter) return [];
  const ability = getEffect(fighter.ability);
  return ability ? [ability] : [];
}

function moveEffect(move: Move | null): readonly EffectDefinition[] {
  if (!move) return [];
  const effect = getEffect(move.id);
  return effect ? [effect] : [];
}

/** Source first, then the defender's ability, then the move's own handlers. */
function contextEffects(
  ctx: EffectContext,
  includeTarget: boolean,
  move: Move | null,
): readonly EffectDefinition[] {
  return [
    ...ownedEffects(ctx.source),
    ...(includeTarget ? ownedEffects(ctx.target) : []),
    ...moveEffect(move),
  ];
}

export function runSwitchIn(ctx: EffectContext): void {
  for (const effect of contextEffects(ctx, false, null)) effect.handlers.onSwitchIn?.(ctx);
}

export function runStart(ctx: EffectContext): void {
  for (const effect of contextEffects(ctx, false, null)) effect.handlers.onStart?.(ctx);
}

export function runResidual(ctx: EffectContext): void {
  for (const effect of contextEffects(ctx, false, null)) effect.handlers.onResidual?.(ctx);
}

export function runAfterMove(ctx: EffectContext, move: Move): void {
  const payload: MovePayload = { move };
  for (const effect of contextEffects(ctx, false, move)) {
    effect.handlers.onAfterMove?.(ctx, payload);
  }
}

export function runTryHit(ctx: EffectContext, move: Move): boolean {
  const payload: MovePayload = { move };
  for (const effect of contextEffects(ctx, true, move)) {
    if (effect.handlers.onTryHit?.(ctx, payload) === false) return false;
  }
  return true;
}

export function runStatus(ctx: EffectContext, status: string): boolean {
  const payload: StatusPayload = { status };
  for (const effect of contextEffects(ctx, true, null)) {
    if (effect.handlers.onStatus?.(ctx, payload) === false) return false;
  }
  return true;
}

export function runBoost(ctx: EffectContext, stat: BoostId, stages: number): boolean {
  const payload: BoostPayload = { stat, stages };
  for (const effect of contextEffects(ctx, true, null)) {
    if (effect.handlers.onBoost?.(ctx, payload) === false) return false;
  }
  return true;
}

export function runModifyDamage(ctx: EffectContext, move: Move, damage: number): number {
  let value = damage;
  for (const effect of contextEffects(ctx, true, move)) {
    const next = effect.handlers.onModifyDamage?.(ctx, { move, damage: value });
    if (typeof next === 'number') value = next;
  }
  return value;
}
