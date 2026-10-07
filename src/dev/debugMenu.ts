import {
  allAbilities,
  allMoves,
  allNatures,
  getMove,
  getNature,
  playableSpecies,
  type Ability,
  type Move,
  type Nature,
  type Species,
} from '../data/dex';
import { ITEMS, type ItemDef } from '../data/items';
import { RUN_CHAIN } from '../data/run';
import { SHAPES, isRouteShape, type RouteShape } from '../engine/routes/layout';
import { ROUTE_HEIGHT, ROUTE_WIDTH } from '../engine/routes/sketch';
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

/** Route size the panel's "Randomize" draws; mirrors the generator's own default. */
export const DEBUG_ROUTE_WIDTH = ROUTE_WIDTH;
export const DEBUG_ROUTE_HEIGHT = ROUTE_HEIGHT;

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
  shape: RouteShape;
  width: number;
  height: number;
  /** Dev noclip: walk through walls, water and ledges. */
  passThrough: boolean;
  /** Dev inspect: color the hovered cell and show its tile coordinates. */
  hoverInspect: boolean;
}>;

/** The resolved inputs the panel sends back; a blank field already fell back. */
export type DebugRouteInput = Readonly<{
  seed: string;
  routeIndex: number;
  attempt: number;
  shape: RouteShape;
  width: number;
  height: number;
}>;

/** The generator phase the scene is rendering, for the step controls. */
export type DebugGeneratorStep = Readonly<{
  index: number;
  total: number;
  label: string;
}>;

/** A party member the dev editor can target, with its live run shape. */
export type DebugPartyMember = Readonly<{
  id: string;
  speciesId: string;
  name: string;
  level: number;
  nature: string;
  ability: string;
  moves: readonly string[];
}>;

/** A partial override the dev editor sends back; a missing field is kept. */
export type DebugPartyEdit = Readonly<{
  level?: number;
  nature?: string;
  ability?: string;
  moves?: readonly string[];
}>;

export type DebugMenuHandlers = Readonly<{
  onWildBattle: (speciesId: string, level: number) => void;
  /** Dev only: drops a species into the run; returns where it landed. */
  onAddPokemon: (speciesId: string, level: number) => 'party' | 'box' | null;
  /** Dev only: adds `count` of an item to the run's bag. */
  onAddItem: (itemId: string, count: number) => void;
  /** Dev only: the party members the editor can target, with their live shape. */
  readParty: () => readonly DebugPartyMember[];
  /** Dev only: overrides a party member's level, moves, ability or nature. */
  onEditPartyMember: (memberId: string, edit: DebugPartyEdit) => boolean;
  readRouteContext: () => DebugRouteContext | null;
  onRegenerateRoute: (input: DebugRouteInput) => void;
  onTogglePassThrough: (enabled: boolean) => void;
  onToggleHoverInspect: (enabled: boolean) => void;
  generatorStepInfo: () => DebugGeneratorStep | null;
  stepGenerator: (delta: number) => void;
  resetGeneratorStep: () => void;
  /** The current route described cell by cell, as JSON; null when no route. */
  exportFrameMap: () => string | null;
  /** Loads an exported frame map back into the scene; reports why it failed. */
  importFrameMap: (text: string) => Readonly<{ ok: boolean; error?: string }>;
}>;

/**
 * Resolves a typed query to a catalog entry with an `id` and a `name`: an exact
 * id, then an exact name, then a name prefix and finally a substring on either.
 * Case and punctuation are ignored, so `Mr. Mime`, `mrmime` and `mr` all land.
 */
function matchCatalog<T extends { id: string; name: string }>(
  query: string,
  entries: readonly T[],
): T | null {
  const text = query.trim().toLowerCase();
  if (!text) return null;
  const id = text.replace(/[^a-z0-9]/g, '');
  const exactId = entries.find((entry) => entry.id === id);
  if (exactId) return exactId;
  const exactName = entries.find((entry) => entry.name.toLowerCase() === text);
  if (exactName) return exactName;
  const prefix = entries.find((entry) => entry.name.toLowerCase().startsWith(text));
  if (prefix) return prefix;
  return entries.find((entry) => entry.name.toLowerCase().includes(text) || entry.id.includes(id)) ?? null;
}

/** Resolves a typed species to one of the catalog (see `matchCatalog`). */
export function matchSpecies(query: string, species: readonly Species[]): Species | null {
  return matchCatalog(query, species);
}

/** Resolves a typed item to one of the catalog (see `matchCatalog`). */
export function matchItem(query: string, items: readonly ItemDef[]): ItemDef | null {
  return matchCatalog(query, items);
}

/** Resolves a typed move to one of the dex (see `matchCatalog`). */
export function matchMove(query: string, moves: readonly Move[] = allMoves()): Move | null {
  return matchCatalog(query, moves);
}

/** Resolves a typed ability to one of the dex (see `matchCatalog`). */
export function matchAbility(query: string, abilities: readonly Ability[] = allAbilities()): Ability | null {
  return matchCatalog(query, abilities);
}

/** Resolves a typed nature to one of the dex (see `matchCatalog`). */
export function matchNature(query: string, natures: readonly Nature[] = allNatures()): Nature | null {
  return matchCatalog(query, natures);
}

/** The display string a party member's autocomplete option shows and stores. */
export function partyMemberLabel(member: DebugPartyMember): string {
  return `${member.name} Lv${member.level}`;
}

/**
 * Resolves a typed party-member label to one of `members`: an exact label
 * (`Pikachu Lv12`), then an exact name, then a name prefix and finally a
 * substring on the name or species id.
 */
export function matchPartyMember(
  query: string,
  members: readonly DebugPartyMember[],
): DebugPartyMember | null {
  const text = query.trim().toLowerCase();
  if (!text) return null;
  const exactLabel = members.find((member) => partyMemberLabel(member).toLowerCase() === text);
  if (exactLabel) return exactLabel;
  const exactName = members.find((member) => member.name.toLowerCase() === text);
  if (exactName) return exactName;
  const prefix = members.find((member) => member.name.toLowerCase().startsWith(text));
  if (prefix) return prefix;
  const id = text.replace(/[^a-z0-9]/g, '');
  return (
    members.find(
      (member) => member.name.toLowerCase().includes(text) || member.speciesId.includes(id),
    ) ?? null
  );
}

/** A level the wild can legally hold; a blank or broken field falls back to 5. */
export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return DEBUG_DEFAULT_LEVEL;
  return Math.max(DEBUG_MIN_LEVEL, Math.min(DEBUG_MAX_LEVEL, Math.floor(value)));
}

/** The most of one item the debug bag adder will grant in a single press. */
export const DEBUG_MAX_ITEM_COUNT = 999;

/** An item stack size: at least 1, at most `DEBUG_MAX_ITEM_COUNT`. */
export function clampItemCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(DEBUG_MAX_ITEM_COUNT, Math.floor(value)));
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
  const shapes = Object.keys(SHAPES) as RouteShape[];
  return {
    seed: `debug-${Math.floor(unit() * 0xffffffff).toString(36)}`,
    routeIndex: roll(1, RUN_CHAIN.finiteLength),
    attempt: 0,
    shape: shapes[Math.floor(unit() * shapes.length)] ?? 'straight',
    width: DEBUG_ROUTE_WIDTH,
    height: DEBUG_ROUTE_HEIGHT,
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

  const shapeSelect = document.createElement('select');
  shapeSelect.style.cssText = compact;
  const autoShape = document.createElement('option');
  autoShape.value = '';
  autoShape.textContent = 'auto';
  shapeSelect.append(autoShape);
  for (const shape of Object.keys(SHAPES)) {
    const option = document.createElement('option');
    option.value = shape;
    option.textContent = shape;
    shapeSelect.append(option);
  }

  const widthInput = numberField('width', 'auto');
  const heightInput = numberField('height', 'auto');

  field('Seed', seedInput);
  field('Index', routeIndexInput);
  field('Attempt', attemptInput);
  field('Shape', shapeSelect);
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
    shapeSelect.value = input.shape;
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
      shape: isRouteShape(shapeSelect.value) ? shapeSelect.value : ctx.shape,
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

  // Generator stepper: walk the build phases (walls → access → spine → branches →
  // clean → terrain → final) one at a time to debug the carver.
  const stepStatus = document.createElement('span');
  stepStatus.style.cssText = 'flex:1;min-width:0;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

  const refreshGeneratorStep = (): void => {
    const info = handlers.generatorStepInfo();
    stepStatus.textContent = info ? `${info.label} ${info.index + 1}/${info.total}` : 'no route';
  };

  const advanceGeneratorStep = (delta: number): void => {
    handlers.stepGenerator(delta);
    refreshGeneratorStep();
  };

  const stepRow = document.createElement('div');
  stepRow.style.cssText = 'display:flex;gap:6px;align-items:center;';
  stepRow.append(
    button('◂', () => advanceGeneratorStep(-1)),
    button('Step ▸', () => advanceGeneratorStep(1)),
    button('Live', () => {
      handlers.resetGeneratorStep();
      refreshGeneratorStep();
    }),
    stepStatus,
  );

  // General section: cross-cutting dev toggles that are not tied to a route
  // rebuild (noclip, cell inspection).
  const generalSection = document.createElement('div');
  generalSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  const toggleRow = (input: HTMLInputElement, labelText: string): HTMLLabelElement => {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;';
    row.append(input, document.createTextNode(labelText));
    return row;
  };

  const passThroughInput = document.createElement('input');
  passThroughInput.type = 'checkbox';
  passThroughInput.title = 'walk through walls, water and ledges';
  passThroughInput.addEventListener('change', () => {
    handlers.onTogglePassThrough(passThroughInput.checked);
  });
  const passThroughRow = toggleRow(passThroughInput, 'Pass through obstacles');

  const hoverInspectInput = document.createElement('input');
  hoverInspectInput.type = 'checkbox';
  hoverInspectInput.title = 'color the cell under the mouse and show its x,y';
  hoverInspectInput.addEventListener('change', () => {
    handlers.onToggleHoverInspect(hoverInspectInput.checked);
  });
  const hoverInspectRow = toggleRow(hoverInspectInput, 'Inspect hovered cell');

  generalSection.append(passThroughRow, hoverInspectRow);

  // Live values refresh while the panel is idle; a field the user is editing
  // (or has randomized) is left alone until the next "Regenerate".
  const refreshRouteFields = (): void => {
    dirty = false;
    const ctx = handlers.readRouteContext();
    if (!ctx) {
      routeInfo.textContent = 'no active route';
      routeStatus.textContent = '';
      refreshGeneratorStep();
      return;
    }
    seedInput.value = ctx.seed;
    routeIndexInput.value = String(ctx.routeIndex);
    // `attempt` is the panel's own reroll counter: never reset by the refresh.
    shapeSelect.value = ctx.shape;
    widthInput.value = String(ctx.width);
    heightInput.value = String(ctx.height);
    passThroughInput.checked = ctx.passThrough;
    hoverInspectInput.checked = ctx.hoverInspect;
    routeInfo.textContent = `${ctx.mode} · ${ctx.biomeName} · band ${ctx.bandName}`;
    routeStatus.textContent = '';
    refreshGeneratorStep();
  };

  for (const control of [seedInput, routeIndexInput, attemptInput, shapeSelect, widthInput, heightInput]) {
    control.addEventListener('input', () => {
      dirty = true;
    });
  }

  const refreshTimer = window.setInterval(() => {
    if (!dirty && root.style.display !== 'none') refreshRouteFields();
  }, 500);

  routeSection.append(routeGrid, stepRow, routeButtons, routeStatus, routeInfo);

  const battlePanel = document.createElement('div');
  battlePanel.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  battlePanel.append(speciesRow, levelRow, battleButton, status);

  // Party section: drop a species straight into the run. It joins the party
  // while there is room and the PC box after that, the capture rule.
  const partySection = document.createElement('div');
  partySection.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  const partySpeciesInput = document.createElement('input');
  partySpeciesInput.type = 'text';
  partySpeciesInput.placeholder = 'species';
  partySpeciesInput.autocomplete = 'off';
  partySpeciesInput.setAttribute('list', 'debug-species-list');
  partySpeciesInput.style.cssText = compact;

  const partyLevelInput = document.createElement('input');
  partyLevelInput.type = 'number';
  partyLevelInput.min = String(DEBUG_MIN_LEVEL);
  partyLevelInput.max = String(DEBUG_MAX_LEVEL);
  partyLevelInput.value = String(DEBUG_DEFAULT_LEVEL);
  partyLevelInput.title = 'level';
  partyLevelInput.style.cssText = compact;

  const partySpeciesRow = document.createElement('label');
  partySpeciesRow.textContent = 'Species';
  partySpeciesRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
  partySpeciesRow.append(partySpeciesInput);

  const partyLevelRow = document.createElement('label');
  partyLevelRow.textContent = 'Level';
  partyLevelRow.style.cssText = partySpeciesRow.style.cssText;
  partyLevelRow.append(partyLevelInput);

  const partyStatus = document.createElement('div');
  partyStatus.style.cssText = 'min-height:16px;color:#94a3b8;';

  const addPokemon = (): void => {
    const species = matchSpecies(partySpeciesInput.value, SPECIES);
    if (!species) {
      partyStatus.textContent = partySpeciesInput.value.trim() ? 'unknown species' : 'type a species';
      return;
    }
    const level = clampLevel(Number(partyLevelInput.value));
    partyLevelInput.value = String(level);
    const where = handlers.onAddPokemon(species.id, level);
    partyStatus.textContent = where
      ? `added ${species.name} Lv${level} to ${where === 'party' ? 'party' : 'PC box'}`
      : 'no active run';
    if (where) refreshPartyOptions();
  };

  const addPokemonButton = button('Add', addPokemon);
  addPokemonButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';
  partySection.append(partySpeciesRow, partyLevelRow, addPokemonButton, partyStatus);

  // Party editor: pick a party member and override its level, moves, ability
  // and nature. The member list is rebuilt from the live run on every open.
  const partyEditor = document.createElement('div');
  partyEditor.style.cssText =
    'display:flex;flex-direction:column;gap:6px;border-top:1px solid #334155;padding-top:6px;';

  const partyList = document.createElement('datalist');
  partyList.id = 'debug-party-list';

  const partyMemberInput = document.createElement('input');
  partyMemberInput.type = 'text';
  partyMemberInput.placeholder = 'party member';
  partyMemberInput.autocomplete = 'off';
  partyMemberInput.setAttribute('list', 'debug-party-list');
  partyMemberInput.style.cssText = compact;

  const partyMemberRow = document.createElement('label');
  partyMemberRow.textContent = 'Member';
  partyMemberRow.style.cssText = partySpeciesRow.style.cssText;
  partyMemberRow.append(partyMemberInput);

  const editLevelInput = document.createElement('input');
  editLevelInput.type = 'number';
  editLevelInput.min = String(DEBUG_MIN_LEVEL);
  editLevelInput.max = String(DEBUG_MAX_LEVEL);
  editLevelInput.title = 'level';
  editLevelInput.placeholder = 'level';
  editLevelInput.style.cssText = compact;

  const editLevelRow = document.createElement('label');
  editLevelRow.textContent = 'Level';
  editLevelRow.style.cssText = partySpeciesRow.style.cssText;

  const moveInputs = [0, 1, 2, 3].map((index) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `move ${index + 1}`;
    input.autocomplete = 'off';
    input.setAttribute('list', 'debug-move-list');
    input.style.cssText = compact;
    return input;
  });

  const moveRows = moveInputs.map((input, index) => {
    const row = document.createElement('label');
    row.textContent = `Move ${index + 1}`;
    row.style.cssText = partySpeciesRow.style.cssText;
    row.append(input);
    return row;
  });

  const abilityInput = document.createElement('input');
  abilityInput.type = 'text';
  abilityInput.placeholder = 'ability';
  abilityInput.autocomplete = 'off';
  abilityInput.setAttribute('list', 'debug-ability-list');
  abilityInput.style.cssText = compact;

  const abilityRow = document.createElement('label');
  abilityRow.textContent = 'Ability';
  abilityRow.style.cssText = partySpeciesRow.style.cssText;
  abilityRow.append(abilityInput);

  const natureInput = document.createElement('input');
  natureInput.type = 'text';
  natureInput.placeholder = 'nature';
  natureInput.autocomplete = 'off';
  natureInput.setAttribute('list', 'debug-nature-list');
  natureInput.style.cssText = compact;

  const natureRow = document.createElement('label');
  natureRow.textContent = 'Nature';
  natureRow.style.cssText = partySpeciesRow.style.cssText;
  natureRow.append(natureInput);

  const editStatus = document.createElement('div');
  editStatus.style.cssText = 'min-height:16px;color:#94a3b8;';

  /** The member the fields currently describe; kept by id across a refresh. */
  let selectedMemberId: string | null = null;

  const fillMemberFields = (member: DebugPartyMember): void => {
    partyMemberInput.value = partyMemberLabel(member);
    editLevelInput.value = String(member.level);
    moveInputs.forEach((input, index) => {
      const moveId = member.moves[index];
      input.value = moveId ? (getMove(moveId)?.name ?? moveId) : '';
    });
    abilityInput.value = member.ability;
    natureInput.value = getNature(member.nature)?.name ?? member.nature;
  };

  const refreshPartyOptions = (): void => {
    const members = handlers.readParty();
    partyList.replaceChildren();
    for (const member of members) {
      const option = document.createElement('option');
      option.value = partyMemberLabel(member);
      option.label = `#${member.speciesId}`;
      partyList.append(option);
    }
    const selected = members.find((member) => member.id === selectedMemberId);
    if (selected) fillMemberFields(selected);
    else selectedMemberId = null;
  };

  const currentMember = (): DebugPartyMember | null => {
    const members = handlers.readParty();
    return (
      (selectedMemberId ? members.find((member) => member.id === selectedMemberId) : null) ??
      matchPartyMember(partyMemberInput.value, members)
    );
  };

  partyMemberInput.addEventListener('input', () => {
    const text = partyMemberInput.value.trim().toLowerCase();
    const member = handlers
      .readParty()
      .find((candidate) => partyMemberLabel(candidate).toLowerCase() === text);
    if (!member) return;
    selectedMemberId = member.id;
    fillMemberFields(member);
  });

  partyMemberInput.addEventListener('change', () => {
    const member = matchPartyMember(partyMemberInput.value, handlers.readParty());
    if (!member) return;
    selectedMemberId = member.id;
    fillMemberFields(member);
  });

  const applyEdit = (): void => {
    const member = currentMember();
    if (!member) {
      editStatus.textContent = partyMemberInput.value.trim() ? 'unknown member' : 'pick a member';
      return;
    }
    const edit: { level?: number; nature?: string; ability?: string; moves?: readonly string[] } = {};
    const level = parseOptionalInt(editLevelInput.value);
    if (level !== undefined) edit.level = clampLevel(level);
    if (abilityInput.value.trim()) {
      const ability = matchAbility(abilityInput.value);
      if (!ability) {
        editStatus.textContent = `unknown ability "${abilityInput.value.trim()}"`;
        return;
      }
      edit.ability = ability.name;
    }
    if (natureInput.value.trim()) {
      const nature = matchNature(natureInput.value);
      if (!nature) {
        editStatus.textContent = `unknown nature "${natureInput.value.trim()}"`;
        return;
      }
      edit.nature = nature.id;
    }
    const moveIds: string[] = [];
    for (const input of moveInputs) {
      const text = input.value.trim();
      if (!text) continue;
      const move = matchMove(text);
      if (!move) {
        editStatus.textContent = `unknown move "${text}"`;
        return;
      }
      moveIds.push(move.id);
    }
    if (moveIds.length > 0) edit.moves = moveIds;
    if (!handlers.onEditPartyMember(member.id, edit)) {
      editStatus.textContent = 'no active run';
      return;
    }
    selectedMemberId = member.id;
    refreshPartyOptions();
    editStatus.textContent = `edited ${member.name}`;
  };

  const plusOneLevel = (): void => {
    const member = currentMember();
    if (!member) {
      editStatus.textContent = 'pick a member';
      return;
    }
    const level = clampLevel(member.level + 1);
    if (!handlers.onEditPartyMember(member.id, { level })) {
      editStatus.textContent = 'no active run';
      return;
    }
    selectedMemberId = member.id;
    refreshPartyOptions();
    editStatus.textContent = `${member.name} → Lv${level}`;
  };

  const plusLevelButton = button('+1 lvl', plusOneLevel);
  plusLevelButton.style.cssText += 'white-space:nowrap;';
  editLevelRow.append(editLevelInput, plusLevelButton);

  const applyButton = button('Apply', applyEdit);
  applyButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';

  partyEditor.append(
    partyMemberRow,
    editLevelRow,
    ...moveRows,
    abilityRow,
    natureRow,
    applyButton,
    editStatus,
  );
  partySection.append(partyEditor);

  // Bag section: add any run item to the bag in bulk, resolved by the same
  // name/id autocomplete as species.
  const bagSection = document.createElement('div');
  bagSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  const bagItemInput = document.createElement('input');
  bagItemInput.type = 'text';
  bagItemInput.placeholder = 'item';
  bagItemInput.autocomplete = 'off';
  bagItemInput.setAttribute('list', 'debug-item-list');
  bagItemInput.style.cssText = compact;

  const bagCountInput = document.createElement('input');
  bagCountInput.type = 'number';
  bagCountInput.min = '1';
  bagCountInput.max = String(DEBUG_MAX_ITEM_COUNT);
  bagCountInput.value = '1';
  bagCountInput.title = 'count';
  bagCountInput.style.cssText = compact;

  const bagItemRow = document.createElement('label');
  bagItemRow.textContent = 'Item';
  bagItemRow.style.cssText = partySpeciesRow.style.cssText;
  bagItemRow.append(bagItemInput);

  const bagCountRow = document.createElement('label');
  bagCountRow.textContent = 'Count';
  bagCountRow.style.cssText = partySpeciesRow.style.cssText;
  bagCountRow.append(bagCountInput);

  const bagStatus = document.createElement('div');
  bagStatus.style.cssText = 'min-height:16px;color:#94a3b8;';

  const addBagItem = (): void => {
    const item = matchItem(bagItemInput.value, ITEMS);
    if (!item) {
      bagStatus.textContent = bagItemInput.value.trim() ? 'unknown item' : 'type an item';
      return;
    }
    const count = clampItemCount(Number(bagCountInput.value));
    bagCountInput.value = String(count);
    handlers.onAddItem(item.id, count);
    bagStatus.textContent = `added ${item.name} x${count}`;
  };

  const addBagButton = button('Add', addBagItem);
  addBagButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';
  bagSection.append(bagItemRow, bagCountRow, addBagButton, bagStatus);

  const itemList = document.createElement('datalist');
  itemList.id = 'debug-item-list';
  for (const item of ITEMS) {
    const option = document.createElement('option');
    option.value = item.name;
    option.label = `# ${item.id}`;
    itemList.append(option);
  }

  const moveList = document.createElement('datalist');
  moveList.id = 'debug-move-list';
  for (const move of allMoves()) {
    const option = document.createElement('option');
    option.value = move.name;
    option.label = `#${move.id} · ${move.type} ${move.category}`;
    moveList.append(option);
  }

  const abilityList = document.createElement('datalist');
  abilityList.id = 'debug-ability-list';
  for (const ability of allAbilities()) {
    const option = document.createElement('option');
    option.value = ability.name;
    option.label = `#${ability.id}`;
    abilityList.append(option);
  }

  const natureList = document.createElement('datalist');
  natureList.id = 'debug-nature-list';
  for (const nature of allNatures()) {
    const option = document.createElement('option');
    option.value = nature.name;
    option.label = nature.plus && nature.minus ? `+${nature.plus} / -${nature.minus}` : 'neutral';
    natureList.append(option);
  }

  for (const input of [partyMemberInput, editLevelInput]) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') applyEdit();
    });
  }

  for (const input of [partySpeciesInput, partyLevelInput]) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') addPokemon();
    });
  }
  for (const input of [bagItemInput, bagCountInput]) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') addBagItem();
    });
  }

  // Map section: describe the route cell by cell (tile, resolved frame, wall
  // pattern membership) so a cut tree can be spotted, and round-trip it as JSON.
  const mapSection = document.createElement('div');
  mapSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  const mapArea = document.createElement('textarea');
  mapArea.spellcheck = false;
  mapArea.placeholder = 'route + frame map JSON';
  mapArea.style.cssText =
    'width:296px;height:150px;resize:vertical;padding:6px;border:1px solid #334155;border-radius:5px;' +
    'background:#0f172a;color:#e2e8f0;font:11px/1.35 monospace;';

  const mapStatus = document.createElement('div');
  mapStatus.style.cssText = 'min-height:16px;color:#94a3b8;';

  const mapSummary = document.createElement('div');
  mapSummary.style.cssText = 'color:#94a3b8;white-space:pre-wrap;max-height:120px;overflow:auto;';

  const summarize = (text: string): void => {
    const parsed = JSON.parse(text) as {
      frameMap?: {
        width: number;
        height: number;
        trees: { id: string; band: number; top: number; bottom: number; solid: boolean; whole: boolean; cells: unknown[] }[];
      };
    };
    const frameMap = parsed.frameMap;
    if (!frameMap) {
      mapSummary.textContent = '';
      return;
    }
    const bitten = frameMap.trees.filter((tree) => !tree.solid);
    const lines = [
      `${frameMap.width}x${frameMap.height} · ${frameMap.trees.length} trees · ${bitten.length} bitten`,
    ];
    for (const tree of bitten) {
      lines.push(`tree ${tree.id} · band ${tree.band} · rows ${tree.top}-${tree.bottom} · ${tree.cells.length} cells`);
    }
    mapSummary.textContent = lines.join('\n');
  };

  const mapExportButton = button('Export', () => {
    const text = handlers.exportFrameMap();
    if (!text) {
      mapStatus.textContent = 'no active route';
      return;
    }
    mapArea.value = text;
    mapStatus.textContent = `exported ${text.length} chars`;
    summarize(text);
  });
  const mapCopyButton = button('Copy', () => {
    if (!mapArea.value) {
      mapStatus.textContent = 'nothing to copy';
      return;
    }
    void navigator.clipboard?.writeText(mapArea.value).then(
      () => {
        mapStatus.textContent = 'copied';
      },
      () => {
        mapStatus.textContent = 'copy failed';
      },
    );
  });
  const mapImportButton = button('Import', () => {
    const result = handlers.importFrameMap(mapArea.value);
    mapStatus.textContent = result.ok ? 'imported' : `import failed: ${result.error}`;
    if (result.ok) {
      try {
        summarize(mapArea.value);
      } catch {
        mapSummary.textContent = '';
      }
    }
  });
  const mapButtons = document.createElement('div');
  mapButtons.style.cssText = 'display:flex;gap:6px;';
  mapButtons.append(mapExportButton, mapCopyButton, mapImportButton);
  mapSection.append(mapButtons, mapArea, mapStatus, mapSummary);

  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  const generalTab = button('General', () => selectTab('general'));
  const battleTab = button('Battle', () => selectTab('battle'));
  const partyTab = button('Party', () => selectTab('party'));
  const bagTab = button('Bag', () => selectTab('bag'));
  const routeTab = button('Route', () => selectTab('route'));
  const mapTab = button('Map', () => selectTab('map'));
  tabs.append(generalTab, battleTab, partyTab, bagTab, routeTab, mapTab);

  const setTabStyle = (element: HTMLButtonElement, active: boolean): void => {
    element.style.background = active ? '#0e7490' : '#1e293b';
    element.style.color = active ? '#f8fafc' : '#e2e8f0';
  };

  const selectTab = (tab: 'general' | 'battle' | 'party' | 'bag' | 'route' | 'map'): void => {
    generalSection.style.display = tab === 'general' ? 'flex' : 'none';
    battlePanel.style.display = tab === 'battle' ? 'flex' : 'none';
    partySection.style.display = tab === 'party' ? 'flex' : 'none';
    bagSection.style.display = tab === 'bag' ? 'flex' : 'none';
    routeSection.style.display = tab === 'route' ? 'flex' : 'none';
    mapSection.style.display = tab === 'map' ? 'flex' : 'none';
    setTabStyle(generalTab, tab === 'general');
    setTabStyle(battleTab, tab === 'battle');
    setTabStyle(partyTab, tab === 'party');
    setTabStyle(bagTab, tab === 'bag');
    setTabStyle(routeTab, tab === 'route');
    setTabStyle(mapTab, tab === 'map');
    if (tab === 'route' || tab === 'general') refreshRouteFields();
    if (tab === 'party') refreshPartyOptions();
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

  body.append(tabs, generalSection, battlePanel, partySection, bagSection, routeSection, mapSection);
  root.append(title, body, list, itemList, partyList, moveList, abilityList, natureList);
  document.body.append(root);
  selectTab('general');
  refreshRouteFields();
  refreshPartyOptions();

  // Keep the panel's typing out of the game's window-level key handlers, but
  // only while it is open: a hidden panel can still hold focus, and then the
  // game would go deaf to the keyboard.
  const swallow = (event: Event): void => {
    if (root.style.display !== 'none') event.stopPropagation();
  };
  for (const type of ['keydown', 'keyup', 'keypress']) root.addEventListener(type, swallow);

  const setOpen = (open: boolean): void => {
    root.style.display = open ? 'flex' : 'none';
    if (open) {
      refreshRouteFields();
      if (partySection.style.display !== 'none') refreshPartyOptions();
    } else (document.activeElement as HTMLElement | null)?.blur();
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
