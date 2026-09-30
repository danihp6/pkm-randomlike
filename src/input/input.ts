import Phaser from 'phaser';
import {
  actionForKey,
  type KeybindAction,
  type Keybinds,
  type KeyName,
} from '../data/keybinds';
import { loadSettings } from '../settings';

/**
 * The Phaser half of the shared input layer (Phase 7). It turns the pure keybind
 * map in `src/data/keybinds.ts` into keyboard events, so every scene reads its
 * confirm / cancel / move / party / settings keys from one place and a rebind
 * reaches all of them.
 *
 * It listens to the keyboard plugin's generic `keydown` (Phaser's
 * `ANY_KEY_DOWN`) rather than one event per key: the map is re-read on every
 * press, so a rebind applies at once, and Phaser stops dispatching to a paused
 * scene, so the screen paused underneath (route HUD, battle) never double-
 * handles the key that drove the screen on top.
 */

export type KeybindInput = Readonly<{
  action: KeybindAction;
  /** The Phaser key name of the press, e.g. `'Z'` or `'UP'`. */
  key: KeyName;
  event: KeyboardEvent;
}>;

/** Phaser names a key by its numeric code; this is the inverse lookup. */
const NAME_BY_CODE: Record<number, KeyName> = {};
for (const [name, code] of Object.entries(
  Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>,
)) {
  NAME_BY_CODE[code] = name;
}

/** The player's current bindings, read from the save. */
export function currentKeybinds(): Keybinds {
  return loadSettings().keybinds;
}

/** The Phaser key name of a native keyboard event, or `''` when it has none. */
export function keyNameOf(event: KeyboardEvent): KeyName {
  return NAME_BY_CODE[event.keyCode] ?? '';
}

/**
 * Routes a scene's keydowns through the keybind map. Auto-repeat is ignored, so
 * a held key never fires twice; a caller that wants held state polls
 * `actionKeys` instead. `keybinds` is a getter so a live rebind is picked up.
 */
export function subscribeKeybinds(
  scene: Phaser.Scene,
  handler: (input: KeybindInput) => void,
  keybinds: () => Keybinds = currentKeybinds,
): void {
  scene.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
    if (event.repeat) return;
    const key = keyNameOf(event);
    if (!key) return;
    const action = actionForKey(keybinds(), key);
    if (!action) return;
    handler({ action, key, event });
  });
}

/**
 * The Phaser Key objects behind an action, for polling held state (the route's
 * per-tile walk, the battle's hold-to-skip). It reads the map at call time, so
 * call it when the scene starts or resumes, not every frame.
 */
export function actionKeys(
  scene: Phaser.Scene,
  action: KeybindAction,
  keybinds: Keybinds = currentKeybinds(),
): Phaser.Input.Keyboard.Key[] {
  const code = (Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number | undefined>)[
    keybinds[action]
  ];
  if (typeof code !== 'number') return [];
  return [scene.input.keyboard!.addKey(code)];
}
