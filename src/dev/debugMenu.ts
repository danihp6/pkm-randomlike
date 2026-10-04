import { playableSpecies, type Species } from '../data/dex';
import { RUN_CHAIN } from '../data/run';
import { LAYOUTS, isLayoutStyle, type LayoutStyle } from '../engine/routes/layout';
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

/** Ranges the route panel's "Randomize" draws from. */
export const DEBUG_ROUTE_WIDTH_MIN = 32;
export const DEBUG_ROUTE_WIDTH_MAX = 64;
export const DEBUG_ROUTE_HEIGHT_MIN = 24;
export const DEBUG_ROUTE_HEIGHT_MAX = 40;

/**
 * The live values the route panel pre-fills: the current route's base inputs plus
 * the derived biome/band and the read-only run mode.
 */
export type DebugRouteContext = Readonly<{
  seed: string;
  routeIndex: number;
  mode: string;
  biomeName: string;
  bandName: string;
  layout: LayoutStyle;
  width: number;
  height: number;
  /** Dev noclip: walk through walls, water and ledges. */
  passThrough: boolean;
}>;

/** The resolved inputs the panel sends back; a blank field already fell back. */
export type DebugRouteInput = Readonly<{
  seed: string;
  routeIndex: number;
  attempt: number;
  layout: LayoutStyle;
  width: number;
  height: number;
}>;

export type DebugMenuHandlers = Readonly<{
  onWildBattle: (speciesId: string, level: number) => void;
  readRouteContext: () => DebugRouteContext | null;
  onRegenerateRoute: (input: DebugRouteInput) => void;
  onTogglePassThrough: (enabled: boolean) => void;
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

/** A blank or non-numeric field means `auto` (`undefined`), never zero. */
export function parseOptionalInt(value: string): number | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const number = Number(text);
  if (!Number.isFinite(number)) return undefined;
  return Math.trunc(number);
}

/** A blank field means `auto` (`undefined`), never an empty string. */
export function parseOptionalText(value: string): string | undefined {
  const text = value.trim();
  return text ? text : undefined;
}

/**
 * A full set of explicit overrides for the route panel's "Randomize". The
 * `random` source is injectable so the ranges can be tested without a flaky
 * suite; it is clamped to `[0, 1)` so a 1 never walks off an array.
 */
export function randomRouteInput(random: () => number = Math.random): DebugRouteInput {
  const unit = (): number => Math.max(0, Math.min(0.999999, random()));
  const roll = (min: number, max: number): number => min + Math.floor(unit() * (max - min + 1));
  const layouts = Object.keys(LAYOUTS) as LayoutStyle[];
  return {
    seed: `debug-${Math.floor(unit() * 0xffffffff).toString(36)}`,
    routeIndex: roll(1, RUN_CHAIN.finiteLength),
    attempt: 0,
    layout: layouts[Math.floor(unit() * layouts.length)] ?? 'forest',
    width: roll(DEBUG_ROUTE_WIDTH_MIN, DEBUG_ROUTE_WIDTH_MAX),
    height: roll(DEBUG_ROUTE_HEIGHT_MIN, DEBUG_ROUTE_HEIGHT_MAX),
  };
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
    'position:fixed;right:8px;bottom:8px;z-index:9999;display:none;flex-direction:column;gap:6px;padding:10px;' +
    'min-width:238px;background:#10161fe6;border:2px solid #7dd3fc;border-radius:8px;' +
    'color:#e2e8f0;font:12px/1.4 monospace;';

  const title = document.createElement('div');
  title.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:700;color:#7dd3fc;';
  const titleText = document.createElement('span');
  titleText.textContent = 'DEBUG · tools';

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

  // Route section: regenerate the current route with selectable inputs. A blank
  // field is `auto` (the live value), never random; "Randomize" fills them.
  const routeSection = document.createElement('div');
  routeSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  const routeGrid = document.createElement('div');
  routeGrid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;';

  const compact = `${speciesInput.style.cssText}min-width:0;width:100%;`;
  const field = (labelText: string, control: HTMLElement): void => {
    const label = document.createElement('span');
    label.textContent = labelText;
    routeGrid.append(label, control);
  };
  const numberField = (title: string, placeholder: string): HTMLInputElement => {
    const control = document.createElement('input');
    control.type = 'number';
    control.title = title;
    control.placeholder = placeholder;
    control.style.cssText = compact;
    return control;
  };

  const seedInput = document.createElement('input');
  seedInput.type = 'text';
  seedInput.placeholder = 'auto';
  seedInput.autocomplete = 'off';
  seedInput.style.cssText = compact;

  const routeIndexInput = numberField('route index', 'auto');
  routeIndexInput.min = '1';

  const attemptInput = numberField('attempt (nonce; auto-increments per press)', '0');
  attemptInput.min = '0';
  attemptInput.value = '0';

  const layoutSelect = document.createElement('select');
  layoutSelect.style.cssText = compact;
  const autoLayout = document.createElement('option');
  autoLayout.value = '';
  autoLayout.textContent = 'auto';
  layoutSelect.append(autoLayout);
  for (const style of Object.keys(LAYOUTS)) {
    const option = document.createElement('option');
    option.value = style;
    option.textContent = style;
    layoutSelect.append(option);
  }

  const widthInput = numberField('width', 'auto');
  const heightInput = numberField('height', 'auto');

  field('Seed', seedInput);
  field('Index', routeIndexInput);
  field('Attempt', attemptInput);
  field('Layout', layoutSelect);
  field('W', widthInput);
  field('H', heightInput);

  const routeInfo = document.createElement('div');
  routeInfo.style.cssText = 'color:#94a3b8;';

  const routeStatus = document.createElement('div');
  routeStatus.style.cssText = 'min-height:16px;color:#94a3b8;';

  /** True while the fields hold the user's edits; pauses the live refresh. */
  let dirty = false;

  const randomizeButton = button('Randomize', () => {
    const input = randomRouteInput();
    seedInput.value = input.seed;
    routeIndexInput.value = String(input.routeIndex);
    attemptInput.value = '0';
    layoutSelect.value = input.layout;
    widthInput.value = String(input.width);
    heightInput.value = String(input.height);
    routeStatus.textContent = 'randomized';
    dirty = true;
  });

  const regenButton = button('Regenerate route', () => {
    const ctx = handlers.readRouteContext();
    if (!ctx) {
      routeStatus.textContent = 'no active route';
      return;
    }
    const attempt = (parseOptionalInt(attemptInput.value) ?? 0) + 1;
    attemptInput.value = String(attempt);
    (document.activeElement as HTMLElement | null)?.blur();
    handlers.onRegenerateRoute({
      seed: parseOptionalText(seedInput.value) ?? ctx.seed,
      routeIndex: parseOptionalInt(routeIndexInput.value) ?? ctx.routeIndex,
      attempt,
      layout: isLayoutStyle(layoutSelect.value) ? layoutSelect.value : ctx.layout,
      width: parseOptionalInt(widthInput.value) ?? ctx.width,
      height: parseOptionalInt(heightInput.value) ?? ctx.height,
    });
    routeStatus.textContent = `regenerated (attempt ${attempt})`;
    dirty = false;
  });
  regenButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';

  const routeButtons = document.createElement('div');
  routeButtons.style.cssText = 'display:flex;gap:6px;';
  routeButtons.append(randomizeButton, regenButton);

  const passThroughInput = document.createElement('input');
  passThroughInput.type = 'checkbox';
  passThroughInput.title = 'walk through walls, water and ledges';

  const passThroughRow = document.createElement('label');
  passThroughRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;';
  passThroughRow.append(passThroughInput, document.createTextNode('Pass through obstacles'));
  passThroughInput.addEventListener('change', () => {
    handlers.onTogglePassThrough(passThroughInput.checked);
  });

  // Live values refresh while the panel is idle; a field the user is editing
  // (or has randomized) is left alone until the next "Regenerate".
  const refreshRouteFields = (): void => {
    dirty = false;
    const ctx = handlers.readRouteContext();
    if (!ctx) {
      routeInfo.textContent = 'no active route';
      routeStatus.textContent = '';
      return;
    }
    seedInput.value = ctx.seed;
    routeIndexInput.value = String(ctx.routeIndex);
    // `attempt` is the panel's own reroll counter: never reset by the refresh.
    layoutSelect.value = ctx.layout;
    widthInput.value = String(ctx.width);
    heightInput.value = String(ctx.height);
    passThroughInput.checked = ctx.passThrough;
    routeInfo.textContent = `${ctx.mode} · ${ctx.biomeName} · band ${ctx.bandName}`;
    routeStatus.textContent = '';
  };

  for (const control of [seedInput, routeIndexInput, attemptInput, layoutSelect, widthInput, heightInput]) {
    control.addEventListener('input', () => {
      dirty = true;
    });
  }

  const refreshTimer = window.setInterval(() => {
    if (!dirty && root.style.display !== 'none') refreshRouteFields();
  }, 500);

  routeSection.append(routeGrid, routeButtons, passThroughRow, routeStatus, routeInfo);

  const battlePanel = document.createElement('div');
  battlePanel.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  battlePanel.append(speciesRow, levelRow, battleButton, status);

  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:6px;';
  const battleTab = button('Battle', () => selectTab('battle'));
  const routeTab = button('Route', () => selectTab('route'));
  tabs.append(battleTab, routeTab);

  const selectTab = (tab: 'battle' | 'route'): void => {
    const isBattle = tab === 'battle';
    battlePanel.style.display = isBattle ? 'flex' : 'none';
    routeSection.style.display = isBattle ? 'none' : 'flex';
    battleTab.style.background = isBattle ? '#0e7490' : '#1e293b';
    routeTab.style.background = isBattle ? '#1e293b' : '#0e7490';
    battleTab.style.color = isBattle ? '#f8fafc' : '#e2e8f0';
    routeTab.style.color = isBattle ? '#e2e8f0' : '#f8fafc';
    if (!isBattle) refreshRouteFields();
  };

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

  body.append(tabs, battlePanel, routeSection);
  root.append(title, body, list);
  document.body.append(root);
  selectTab('battle');
  refreshRouteFields();

  // Keep the panel's typing out of the game's window-level key handlers, but
  // only while it is open: a hidden panel can still hold focus, and then the
  // game would go deaf to the keyboard.
  const swallow = (event: Event): void => {
    if (root.style.display !== 'none') event.stopPropagation();
  };
  for (const type of ['keydown', 'keyup', 'keypress']) root.addEventListener(type, swallow);

  const setOpen = (open: boolean): void => {
    root.style.display = open ? 'flex' : 'none';
    if (open) refreshRouteFields();
    else (document.activeElement as HTMLElement | null)?.blur();
  };

  const onToggle = (event: KeyboardEvent): void => {
    if (event.key.toUpperCase() !== DEBUG_MENU_TOGGLE_KEY) return;
    event.preventDefault();
    setOpen(root.style.display === 'none');
  };
  window.addEventListener('keydown', onToggle);

  return () => {
    window.clearInterval(refreshTimer);
    window.removeEventListener('keydown', onToggle);
    root.remove();
  };
}
