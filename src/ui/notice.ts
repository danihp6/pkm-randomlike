/**
 * The run's transient notices (Phase 10): the one-line messages the route HUD
 * floats at the top of the screen and dismisses by itself. The copy and the hold
 * time live here, not in the scene, so every later notice is a string in this
 * module rather than a second transient window (`docs/routes-spec.md` §6).
 * Pure: it draws nothing and reads no dex.
 */

/** One transient notice: the line the HUD floats and how long it stays. */
export type Notice = Readonly<{ text: string; holdMs: number }>;

/** How long a transient notice stays on the screen. */
export const NOTICE_HOLD_MS = 2600;

/**
 * The catch notice: a full party sent `<name>` to the PC, and the boxed catch is
 * swappable only while the run stays on this route. `name` is resolved by the
 * caller, so this never reads the dex.
 */
export function catchToPcNotice(name: string): Notice {
  return {
    text: `Your party is full — ${name} went to the PC. You can swap it in before you leave this route.`,
    holdMs: NOTICE_HOLD_MS,
  };
}
