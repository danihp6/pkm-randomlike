/**
 * The keybind vocabulary (Phase 7): the actions every scene reads its keys from,
 * their defaults and the pure rules for rebinding them. It carries no Phaser
 * import, so the save can validate a binding without the browser; the Phaser half
 * that turns these names into key events lives in `src/input/`.
 */

/** The player-facing actions. A scene never hardcodes a key of its own. */
export const KEYBIND_ACTIONS = [
  'confirm',
  'cancel',
  'up',
  'down',
  'left',
  'right',
  'run',
  'interact',
  'reset',
  'settings',
] as const;

export type KeybindAction = (typeof KEYBIND_ACTIONS)[number];

/**
 * A key named the way Phaser names it (`Phaser.Input.Keyboard.KeyCodes`), e.g.
 * `'Z'`, `'UP'`, `'ENTER'`, `'SPACE'`, `'ESC'`. The Phaser half maps a native
 * event back onto one of these names.
 */
export type KeyName = string;

/**
 * One key per action, so a rebind is always a single, unambiguous press and the
 * settings screen has one row to show. The one deliberate overlap is `confirm`
 * and `interact`: `E` is the accept key everywhere, so in the overworld it both
 * advances the release text and picks up the item the player faces. `MOVE_ACTIONS`
 * lists the four the route polls for walking; the rest are the menu keys.
 */
export type Keybinds = Readonly<Record<KeybindAction, KeyName>>;

export const DEFAULT_KEYBINDS: Keybinds = {
  confirm: 'E',
  cancel: 'Q',
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  run: 'SHIFT',
  interact: 'E',
  reset: 'R',
  settings: 'O',
};

/**
 * Keys that always answer confirm and cancel, whatever the map says, so a rebind
 * can never lock a player out of the two keys every menu needs. An explicit
 * binding still wins, so a player can take one over deliberately.
 */
export const KEY_ALIASES: Readonly<Partial<Record<KeyName, KeybindAction>>> = {
  ENTER: 'confirm',
  SPACE: 'confirm',
  ESC: 'cancel',
};

export const KEYBIND_LABELS: Readonly<Record<KeybindAction, string>> = {
  confirm: 'Confirm',
  cancel: 'Cancel',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  run: 'Run',
  interact: 'Interact',
  reset: 'Reset run',
  settings: 'Settings',
};

/** The four directions, in the order the settings screen lists them. */
export const MOVE_ACTIONS: readonly KeybindAction[] = ['up', 'down', 'left', 'right'];

/**
 * Extra keys that always drive an action, beside its single binding. Only the
 * four directions have them: WASD walks as well as the arrows, so a player never
 * has to rebind just to move. The bound key still counts; an alias is polled for
 * its own direction only, so it cannot shadow a menu key.
 */
export const MOVE_ALIASES: Readonly<Partial<Record<KeybindAction, readonly KeyName[]>>> = {
  up: ['W'],
  down: ['S'],
  left: ['A'],
  right: ['D'],
};

/** Every key that drives an action: its binding, then any movement aliases. */
export function keysForAction(bindings: Keybinds, action: KeybindAction): KeyName[] {
  const keys = [bindings[action]];
  for (const alias of MOVE_ALIASES[action] ?? []) {
    if (!keys.includes(alias)) keys.push(alias);
  }
  return keys;
}

const KEY_DISPLAY: Readonly<Record<KeyName, string>> = {
  UP: '\u2191',
  DOWN: '\u2193',
  LEFT: '\u2190',
  RIGHT: '\u2192',
  ESC: 'Esc',
  ENTER: 'Enter',
  SPACE: 'Space',
  TAB: 'Tab',
  BACKSPACE: 'Backspace',
  SHIFT: 'Shift',
  CTRL: 'Ctrl',
  ALT: 'Alt',
  DELETE: 'Del',
  CAPS_LOCK: 'Caps',
};

/** Keeps a hand-edited save from carrying a key name with junk in it. */
const KEY_NAME_PATTERN = /^[A-Z0-9_]{1,24}$/;

export function isKeybindAction(value: unknown): value is KeybindAction {
  return KEYBIND_ACTIONS.includes(value as KeybindAction);
}

export function isKeyName(value: unknown): value is KeyName {
  return typeof value === 'string' && KEY_NAME_PATTERN.test(value);
}

/** The printable name of a key (`UP` prints as an arrow). */
export function keyLabel(name: KeyName): string {
  return KEY_DISPLAY[name] ?? name;
}

/** The action a key triggers: an explicit binding first, then the aliases. */
export function actionForKey(bindings: Keybinds, name: KeyName): KeybindAction | null {
  for (const action of KEYBIND_ACTIONS) {
    if (bindings[action] === name) return action;
  }
  return KEY_ALIASES[name] ?? null;
}

/**
 * Rebinds one action to `name`, swapping with whichever action held that key, so
 * two actions can never answer the same press. The old key moves to the action
 * that was displaced (or is simply freed, if nothing held it).
 */
export function withBinding(bindings: Keybinds, action: KeybindAction, name: KeyName): Keybinds {
  if (bindings[action] === name) return bindings;
  const previous = bindings[action];
  const owner = KEYBIND_ACTIONS.find((other) => bindings[other] === name);
  const next: Record<KeybindAction, KeyName> = { ...bindings, [action]: name };
  if (owner && owner !== action) next[owner] = previous;
  return next;
}

/**
 * Reads bindings from an untrusted value (a save): anything missing or malformed
 * falls back to its default and every action keeps its own key. Total, so a
 * hand-edited document can never leave the game with no way to press confirm.
 */
export function sanitizeKeybinds(value: unknown): Keybinds {
  const source = isRecord(value) ? value : {};
  const used = new Set<KeyName>();
  const result = {} as Record<KeybindAction, KeyName>;
  for (const action of KEYBIND_ACTIONS) {
    const fallback = DEFAULT_KEYBINDS[action];
    const candidates: unknown[] = [source[action], fallback];
    let chosen = fallback;
    for (const candidate of candidates) {
      if (isKeyName(candidate) && !used.has(candidate)) {
        chosen = candidate;
        break;
      }
    }
    used.add(chosen);
    result[action] = chosen;
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
