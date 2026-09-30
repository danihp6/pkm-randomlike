import { playableSpecies, type Species } from '../data/dex';
import { DEBUG_MENU_TOGGLE_KEY, IS_DEVELOP } from './env';

/**
 * The dev-only debug menu (Phase 0). It is a small DOM overlay because a species
 * picker wants real text input and the browser's own autocomplete (`datalist`),
 * which the canvas cannot offer cheaply. It never runs in a production build:
 * `installDebugMenu` bails out unless `IS_DEVELOP`, and `main.ts` only imports
 * this module behind that same gate. Every key event inside the panel is stopped
 * so typing does not also drive the game.
 */
export { DEBUG_MENU_TOGGLE_KEY };
export const DEBUG_DEFAULT_LEVEL = 5;
export const DEBUG_MIN_LEVEL = 1;
export const DEBUG_MAX_LEVEL = 100;

export type DebugMenuHandlers = Readonly<{
  onWildBattle: (speciesId: string, level: number) => void;
}>;

/**
 * Resolves a typed species to one of the catalog: an exact id, then an exact
 * name, then a name prefix and finally a substring on either. Case and
 * punctuation are ignored, so `Mr. Mime`, `mrmime` and `mr` all land.
 */
export function matchSpecies(
  query: string,
  species: readonly Species[],
): Species | null {
  const text = query.trim().toLowerCase();
  if (!text) return null;
  const id = text.replace(/[^a-z0-9]/g, '');
  const exactId = species.find((entry) => entry.id === id);
  if (exactId) return exactId;
  const exactName = species.find((entry) => entry.name.toLowerCase() === text);
  if (exactName) return exactName;
  const prefix = species.find((entry) => entry.name.toLowerCase().startsWith(text));
  if (prefix) return prefix;
  return species.find((entry) => entry.name.toLowerCase().includes(text) || entry.id.includes(id)) ?? null;
}

/** A level the wild can legally hold; a blank or broken field falls back to 5. */
export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return DEBUG_DEFAULT_LEVEL;
  return Math.max(DEBUG_MIN_LEVEL, Math.min(DEBUG_MAX_LEVEL, Math.floor(value)));
}

const SPECIES = playableSpecies();

function button(label: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.style.cssText =
    'padding:5px 8px;border:1px solid #7dd3fc;border-radius:5px;background:#1e293b;color:#e2e8f0;font:inherit;cursor:pointer;';
  element.addEventListener('click', onClick);
  return element;
}

/**
 * Mounts the panel once and returns a disposer. `handlers` is read live, so a
 * caller can keep the same panel while the scene under it changes.
 */
export function installDebugMenu(handlers: DebugMenuHandlers): () => void {
  if (!IS_DEVELOP) return () => {};

  const existing = document.getElementById('debug-menu');
  if (existing) existing.remove();

  const root = document.createElement('div');
  root.id = 'debug-menu';
  root.style.cssText =
    'position:fixed;right:8px;bottom:8px;z-index:9999;display:flex;flex-direction:column;gap:6px;padding:10px;' +
    'min-width:238px;background:#10161fe6;border:2px solid #7dd3fc;border-radius:8px;' +
    'color:#e2e8f0;font:12px/1.4 monospace;';

  const title = document.createElement('div');
  title.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:700;color:#7dd3fc;';
  const titleText = document.createElement('span');
  titleText.textContent = 'DEBUG · wild battle';

  const status = document.createElement('div');
  status.style.cssText = 'min-height:16px;color:#94a3b8;';

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  const speciesInput = document.createElement('input');
  speciesInput.type = 'text';
  speciesInput.placeholder = 'species';
  speciesInput.autocomplete = 'off';
  speciesInput.setAttribute('list', 'debug-species-list');
  speciesInput.style.cssText =
    'padding:5px 7px;border:1px solid #334155;border-radius:5px;background:#0f172a;color:#e2e8f0;font:inherit;';

  const list = document.createElement('datalist');
  list.id = 'debug-species-list';
  for (const species of SPECIES) {
    const option = document.createElement('option');
    option.value = species.name;
    option.label = `#${species.num} ${species.id}`;
    list.append(option);
  }

  const levelInput = document.createElement('input');
  levelInput.type = 'number';
  levelInput.min = String(DEBUG_MIN_LEVEL);
  levelInput.max = String(DEBUG_MAX_LEVEL);
  levelInput.value = String(DEBUG_DEFAULT_LEVEL);
  levelInput.title = 'level';
  levelInput.style.cssText = speciesInput.style.cssText;

  const speciesRow = document.createElement('label');
  speciesRow.textContent = 'Species';
  speciesRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
  speciesRow.append(speciesInput);

  const levelRow = document.createElement('label');
  levelRow.textContent = 'Level';
  levelRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
  levelRow.append(levelInput);

  const launch = (): void => {
    const species = matchSpecies(speciesInput.value, SPECIES);
    if (!species) {
      status.textContent = speciesInput.value.trim() ? 'unknown species' : 'type a species';
      return;
    }
    const level = clampLevel(Number(levelInput.value));
    levelInput.value = String(level);
    status.textContent = `Lv${level} ${species.name}`;
    (document.activeElement as HTMLElement | null)?.blur();
    handlers.onWildBattle(species.id, level);
  };

  const battleButton = button('Wild battle', launch);
  battleButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';

  const close = button('×', () => {
    (document.activeElement as HTMLElement | null)?.blur();
    root.style.display = 'none';
  });
  close.style.cssText += 'padding:2px 8px;';
  title.append(titleText, close);

  for (const input of [speciesInput, levelInput]) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') launch();
    });
  }

  body.append(speciesRow, levelRow, battleButton, status);
  root.append(title, body, list);
  document.body.append(root);

  // Keep the panel's typing out of the game's window-level key handlers, but
  // only while it is open: a hidden panel can still hold focus, and then the
  // game would go deaf to the keyboard.
  const swallow = (event: Event): void => {
    if (root.style.display !== 'none') event.stopPropagation();
  };
  for (const type of ['keydown', 'keyup', 'keypress']) root.addEventListener(type, swallow);

  const setOpen = (open: boolean): void => {
    root.style.display = open ? 'flex' : 'none';
    if (!open) (document.activeElement as HTMLElement | null)?.blur();
  };

  const onToggle = (event: KeyboardEvent): void => {
    if (event.key !== DEBUG_MENU_TOGGLE_KEY) return;
    event.preventDefault();
    setOpen(root.style.display === 'none');
  };
  window.addEventListener('keydown', onToggle);

  return () => {
    window.removeEventListener('keydown', onToggle);
    root.remove();
  };
}
