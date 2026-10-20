/**
 * The run's four outliving NPC facts (`docs/maps-spec.md` §7): the exorcist's
 * hex, the weather man's forced sky and the magician's narrowed wild type. One
 * record saved with the run, written by the special-NPC cards and read by the
 * route's battles and encounter rolls. Pure: no Phaser, no DOM, no RNG, no clock
 * and no mutation, and it imports nothing from `./state` (no cycle).
 */
export type RunModifiers = Readonly<{
  /** The exorcist's hex: the next enemy battle starts with the lead one stage down. */
  curse: boolean;
  /** The weather man's sky: a `ROOM_BATTLEFIELDS` id and the floors it still covers. */
  forcedField: Readonly<{ id: string; floorsLeft: number }> | null;
  /** The magician's type: the next wild roll is narrowed to it, then it is consumed. */
  nextWildType: string | null;
}>;

/** How many floors a forced sky covers when the weather man sets it. */
export const FORCED_FIELD_FLOORS = 3;

export function emptyModifiers(): RunModifiers {
  return { curse: false, forcedField: null, nextWildType: null };
}

export function withCurse(mods: RunModifiers): RunModifiers {
  return { ...mods, curse: true };
}

export function withoutCurse(mods: RunModifiers): RunModifiers {
  return mods.curse ? { ...mods, curse: false } : mods;
}

export function withForcedField(mods: RunModifiers, id: string): RunModifiers {
  return { ...mods, forcedField: { id, floorsLeft: FORCED_FIELD_FLOORS } };
}

export function withNextWildType(mods: RunModifiers, typeId: string): RunModifiers {
  return { ...mods, nextWildType: typeId };
}

export function withoutNextWildType(mods: RunModifiers): RunModifiers {
  return mods.nextWildType === null ? mods : { ...mods, nextWildType: null };
}

/** `floorsLeft - 1`, and `null` at zero. Every other field is untouched. */
export function decayModifiers(mods: RunModifiers): RunModifiers {
  const field = mods.forcedField;
  if (field === null) return mods;
  const floorsLeft = field.floorsLeft - 1;
  return { ...mods, forcedField: floorsLeft > 0 ? { id: field.id, floorsLeft } : null };
}

/** `mods.forcedField`'s id while it still has floors, else null. */
export function forcedFieldId(mods: RunModifiers): string | null {
  const field = mods.forcedField;
  return field !== null && field.floorsLeft > 0 ? field.id : null;
}
