import { t } from '../i18n';

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
    text: t('notice.catchToPc', { name }),
    holdMs: NOTICE_HOLD_MS,
  };
}

/**
 * The pickup notice: an item landed in the run's bag. `name` is the item's own
 * display name, resolved by the caller, so this never reads the data tables.
 */
export function itemPickupNotice(name: string): Notice {
  return {
    text: t('notice.itemObtained', { name }),
    holdMs: NOTICE_HOLD_MS,
  };
}

/**
 * The level-up notice: `<name>` reached `level`. `name` is the member's nickname
 * when it has one, else its species name, resolved by the caller; every level-up
 * beat raises it, whether or not a move was crossed.
 */
export function levelUpNotice(name: string, level: number): Notice {
  return {
    text: t('notice.levelUp', { name, level }),
    holdMs: NOTICE_HOLD_MS,
  };
}

/** The Egg's hatch notice: `<name>` is the hatched member's display name. */
export function eggHatchNotice(name: string): Notice {
  return {
    text: t('notice.eggHatch', { name }),
    holdMs: NOTICE_HOLD_MS,
  };
}
