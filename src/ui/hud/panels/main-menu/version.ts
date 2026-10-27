import pkg from '../../../../../package.json';

/**
 * The build stamp the main menu prints bottom-right. It is metadata, not a game
 * rule and not a translated string: the `v`, the semver and the phase read the
 * same in every locale, so this module is a pure formatter over the build's own
 * two values.
 */

/** The version string `package.json` carries. */
export const APP_VERSION: string = pkg.version;

/** The roadmap phase this build ships (`TODO.md`'s current phase): 17 today. */
export const MENU_PHASE: number = 17;

/** `<v><version> · PHASE <phase>`, the board's own shape: `v0.7.0 · PHASE 7`. */
export function menuVersionLabel(version: string = APP_VERSION, phase: number = MENU_PHASE): string {
  return `v${version} · PHASE ${phase}`;
}
