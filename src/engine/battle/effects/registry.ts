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
  /** The fighter the running effect is attached to (ability or held item). */
  owner: BattleFighter;
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
    owner: options.source,
  };
}

type EffectRef = Readonly<{ effect: EffectDefinition; owner: BattleFighter }>;

function ownedEffects(fighter: BattleFighter | null): readonly EffectRef[] {
  if (!fighter) return [];
  const refs: EffectRef[] = [];
  const ability = getEffect(fighter.ability);
  if (ability) refs.push({ effect: ability, owner: fighter });
  if (fighter.heldItem) {
    const item = getEffect(fighter.heldItem);
    if (item) refs.push({ effect: item, owner: fighter });
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
  for (const ref of contextEffects(ctx, false, move)) {
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

export function runBoost(ctx: EffectContext, stat: BoostId, stages: number): boolean {
  const payload: BoostPayload = { stat, stages };
  for (const ref of contextEffects(ctx, true, null)) {
    if (ref.effect.handlers.onBoost?.(contextFor(ctx, ref), payload) === false) return false;
  }
  return true;
}

export function runModifyDamage(ctx: EffectContext, move: Move, damage: number): number {
  let value = damage;
  for (const ref of contextEffects(ctx, true, move)) {
    const next = ref.effect.handlers.onModifyDamage?.(contextFor(ctx, ref), { move, damage: value });
    if (typeof next === 'number') value = next;
  }
  return value;
}
