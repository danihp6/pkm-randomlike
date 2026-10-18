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
import { t } from '../i18n';
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
  /** 1-based floor of the live run. */
  mapIndex: number;
  /** 0-based room id inside that floor (`RunState.routeInMap`). */
  roomInMap: number;
  /** Rooms in the floor's plan; 0 on a dev-built route (the generator/import tools have no plan). */
  roomCount: number;
  /** The player's tile. The scene always fills it; nullable only so the helper's clause-drop is defined. */
  tile: { x: number; y: number } | null;
  /** Dev only: while true the tall grass rolls no wild encounter. */
  ignoreEncounters: boolean;
  /** Dev only: while true no line of sight opens a trainer battle. */
  ignoreTrainers: boolean;
}>;

/** Where a dev teleport landed, or why it refused. `where` is reserved and stays unset here. */
export type DebugTeleportResult = Readonly<{ ok: boolean; where?: string; error?: string }>;

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

/**
 * A partial override the dev editor sends back; a missing field is kept. The
 * level is **not** here: the squad shares one level, so it is set from its own
 * control (`onSetSquadLevel`) that moves the party and the box together.
 */
export type DebugPartyEdit = Readonly<{
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
  /** Dev only: moves the whole squad (party and PC) onto one level. */
  onSetSquadLevel: (level: number) => boolean;
  /** Dev only: overrides a party member's moves, ability or nature. */
  onEditPartyMember: (memberId: string, edit: DebugPartyEdit) => boolean;
  /** Dev only: fully restores a party member (HP, PP, status and revival). */
  onHealPartyMember: (memberId: string) => boolean;
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
  /** Dev only: moves the run to a floor, clamped to the run's map range. */
  onTeleportFloor: (mapIndex: number) => DebugTeleportResult;
  /** Dev only: moves the run to a room of the current floor, clamped to the plan. */
  onTeleportRoom: (roomInMap: number) => DebugTeleportResult;
  /** Dev only: moves the player onto a tile of the current room. */
  onTeleportTile: (x: number, y: number) => DebugTeleportResult;
  /** Dev only: while true the tall grass rolls no wild encounter. */
  onToggleIgnoreEncounters: (enabled: boolean) => void;
  /** Dev only: while true no line of sight opens a trainer battle. */
  onToggleIgnoreTrainers: (enabled: boolean) => void;
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
  return t('dev.partyMemberLabel', { name: member.name, level: member.level });
}

/**
 * The labels for a whole party, in order: each member's `Name Lv##`, with a
 * ` (n)` suffix only on the ones that would otherwise share a label (two
 * identical species at the same level). The panel lists and matches these, so
 * both can be picked apart; the order is stable within one open.
 */
export function partyMemberLabels(members: readonly DebugPartyMember[]): readonly string[] {
  const total = new Map<string, number>();
  for (const member of members) {
    const base = partyMemberLabel(member);
    total.set(base, (total.get(base) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return members.map((member) => {
    const base = partyMemberLabel(member);
    if ((total.get(base) ?? 0) <= 1) return base;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return t('dev.partyMemberTwin', { label: base, n });
  });
}

/**
 * Resolves a typed party-member label to one of `members`: an exact label
 * (`Pikachu Lv12`, disambiguated `Pikachu Lv12 (2)`), then a plain label (the
 * first of a duplicate pair), then an exact name, a name prefix and finally a
 * substring on the name or species id.
 */
export function matchPartyMember(
  query: string,
  members: readonly DebugPartyMember[],
): DebugPartyMember | null {
  const text = query.trim().toLowerCase();
  if (!text) return null;
  const labels = partyMemberLabels(members);
  const exactLabel = labels.findIndex((label) => label.toLowerCase() === text);
  if (exactLabel >= 0) return members[exactLabel]!;
  const plainLabel = members.find((member) => partyMemberLabel(member).toLowerCase() === text);
  if (plainLabel) return plainLabel;
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

/**
 * One line naming the run's position: `map 3 · room 2/7 · (14,9)`. Clauses join
 * with `space · space` and are **dropped** rather than printed empty: the room
 * clause only when the floor has a plan (`roomCount > 0`), the tile clause only
 * when there is a tile. The `map` clause is always printed.
 */
export function debugLocationLabel(
  context: Pick<DebugRouteContext, 'mapIndex' | 'roomInMap' | 'roomCount' | 'tile'>,
): string {
  const clauses = [t('dev.location.map', { map: context.mapIndex })];
  if (context.roomCount > 0) {
    clauses.push(t('dev.location.room', { room: context.roomInMap, count: context.roomCount }));
  }
  if (context.tile) {
    clauses.push(t('dev.location.tile', { x: context.tile.x, y: context.tile.y }));
  }
  return clauses.join(' · ');
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
  titleText.textContent = t('dev.title');

  const status = document.createElement('div');
  status.style.cssText = 'min-height:16px;color:#94a3b8;';

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  const speciesInput = document.createElement('input');
  speciesInput.type = 'text';
  speciesInput.placeholder = t('dev.speciesPlaceholder');
  speciesInput.autocomplete = 'off';
  speciesInput.setAttribute('list', 'debug-species-list');
  speciesInput.style.cssText =
    'padding:5px 7px;border:1px solid #334155;border-radius:5px;background:#0f172a;color:#e2e8f0;font:inherit;';

  const list = document.createElement('datalist');
  list.id = 'debug-species-list';
  for (const species of SPECIES) {
    const option = document.createElement('option');
    option.value = species.name;
    option.label = t('dev.option.species', { num: species.num, id: species.id });
    list.append(option);
  }

  const levelInput = document.createElement('input');
  levelInput.type = 'number';
  levelInput.min = String(DEBUG_MIN_LEVEL);
  levelInput.max = String(DEBUG_MAX_LEVEL);
  levelInput.value = String(DEBUG_DEFAULT_LEVEL);
  levelInput.title = t('dev.levelTitle');
  levelInput.style.cssText = speciesInput.style.cssText;

  const speciesRow = document.createElement('label');
  speciesRow.textContent = t('dev.species');
  speciesRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
  speciesRow.append(speciesInput);

  const levelRow = document.createElement('label');
  levelRow.textContent = t('dev.level');
  levelRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
  levelRow.append(levelInput);

  const launch = (): void => {
    const species = matchSpecies(speciesInput.value, SPECIES);
    if (!species) {
      status.textContent = speciesInput.value.trim()
        ? t('dev.status.unknownSpecies')
        : t('dev.status.typeSpecies');
      return;
    }
    const level = clampLevel(Number(levelInput.value));
    levelInput.value = String(level);
    status.textContent = t('dev.status.launch', { level, name: species.name });
    (document.activeElement as HTMLElement | null)?.blur();
    handlers.onWildBattle(species.id, level);
  };

  const battleButton = button(t('dev.wildBattle'), launch);
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
  seedInput.placeholder = t('dev.auto');
  seedInput.autocomplete = 'off';
  seedInput.style.cssText = compact;

  const routeIndexInput = numberField(t('dev.routeIndexTitle'), t('dev.auto'));
  routeIndexInput.min = '1';

  const attemptInput = numberField(t('dev.attemptTitle'), '0');
  attemptInput.min = '0';
  attemptInput.value = '0';

  const shapeSelect = document.createElement('select');
  shapeSelect.style.cssText = compact;
  const autoShape = document.createElement('option');
  autoShape.value = '';
  autoShape.textContent = t('dev.auto');
  shapeSelect.append(autoShape);
  for (const shape of Object.keys(SHAPES)) {
    const option = document.createElement('option');
    option.value = shape;
    option.textContent = shape;
    shapeSelect.append(option);
  }

  const widthInput = numberField(t('dev.widthTitle'), t('dev.auto'));
  const heightInput = numberField(t('dev.heightTitle'), t('dev.auto'));

  field(t('dev.seed'), seedInput);
  field(t('dev.index'), routeIndexInput);
  field(t('dev.attempt'), attemptInput);
  field(t('dev.shape'), shapeSelect);
  field(t('dev.w'), widthInput);
  field(t('dev.h'), heightInput);

  const routeInfo = document.createElement('div');
  routeInfo.style.cssText = 'color:#94a3b8;';

  const routeStatus = document.createElement('div');
  routeStatus.style.cssText = 'min-height:16px;color:#94a3b8;';

  const locationInfo = document.createElement('div');
  locationInfo.id = 'debug-location';
  locationInfo.style.cssText = 'color:#94a3b8;';

  // Teleport block: jump the run to a floor, to a room of the current floor or
  // to a tile of the current room. A blank field means "wherever the run is now",
  // so it reads back the live position rather than guessing one.
  const teleportSection = document.createElement('div');
  teleportSection.style.cssText =
    'display:flex;flex-direction:column;gap:6px;border-top:1px solid #334155;padding-top:6px;';

  const teleportGrid = document.createElement('div');
  teleportGrid.style.cssText = routeGrid.style.cssText;

  const teleportField = (labelText: string, control: HTMLElement): void => {
    const label = document.createElement('span');
    label.textContent = labelText;
    teleportGrid.append(label, control);
  };

  const floorInput = numberField(t('dev.floorTitle'), t('dev.auto'));
  const roomInput = numberField(t('dev.roomTitle'), t('dev.auto'));
  const tileXInput = numberField(t('dev.tileXTitle'), t('dev.auto'));
  const tileYInput = numberField(t('dev.tileYTitle'), t('dev.auto'));

  teleportField(t('dev.floor'), floorInput);
  teleportField(t('dev.room'), roomInput);
  teleportField(t('dev.x'), tileXInput);
  teleportField(t('dev.y'), tileYInput);

  const teleportStatus = document.createElement('div');
  teleportStatus.id = 'debug-teleport-status';
  teleportStatus.style.cssText = 'min-height:16px;color:#94a3b8;';

  /** Rewrites the position readout; called on the tick and after every teleport. */
  const refreshLocation = (): void => {
    const ctx = handlers.readRouteContext();
    locationInfo.textContent = ctx ? debugLocationLabel(ctx) : t('dev.error.noRoute');
  };

  const teleport = (run: (ctx: DebugRouteContext) => DebugTeleportResult): void => {
    const ctx = handlers.readRouteContext();
    if (!ctx) {
      teleportStatus.textContent = t('dev.error.noRoute');
      return;
    }
    const result = run(ctx);
    teleportStatus.textContent = result.ok
      ? t('dev.status.teleported')
      : t('dev.status.teleportFailed', { error: result.error ?? t('dev.status.unknown') });
    refreshLocation();
  };

  const floorGo = button(t('dev.go'), () => {
    teleport((ctx) => handlers.onTeleportFloor(parseOptionalInt(floorInput.value) ?? ctx.mapIndex));
  });
  floorGo.title = t('dev.teleportFloor');
  const roomGo = button(t('dev.go'), () => {
    teleport((ctx) => handlers.onTeleportRoom(parseOptionalInt(roomInput.value) ?? ctx.roomInMap));
  });
  roomGo.title = t('dev.teleportRoom');
  const tileGo = button(t('dev.go'), () => {
    teleport((ctx) =>
      handlers.onTeleportTile(
        parseOptionalInt(tileXInput.value) ?? ctx.tile?.x ?? 0,
        parseOptionalInt(tileYInput.value) ?? ctx.tile?.y ?? 0,
      ),
    );
  });
  tileGo.title = t('dev.teleportTile');

  const teleportButtons = document.createElement('div');
  teleportButtons.style.cssText = 'display:flex;gap:6px;';
  teleportButtons.append(floorGo, roomGo, tileGo);

  teleportSection.append(teleportGrid, teleportButtons, teleportStatus);

  /** True while the fields hold the user's edits; pauses the live refresh. */
  let dirty = false;

  const randomizeButton = button(t('dev.randomize'), () => {
    const input = randomRouteInput();
    seedInput.value = input.seed;
    routeIndexInput.value = String(input.routeIndex);
    attemptInput.value = '0';
    shapeSelect.value = input.shape;
    widthInput.value = String(input.width);
    heightInput.value = String(input.height);
    routeStatus.textContent = t('dev.status.randomized');
    dirty = true;
  });

  const regenButton = button(t('dev.regenerate'), () => {
    const ctx = handlers.readRouteContext();
    if (!ctx) {
      routeStatus.textContent = t('dev.error.noRoute');
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
    routeStatus.textContent = t('dev.status.regenerated', { attempt });
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
    stepStatus.textContent = info
      ? t('dev.stepInfo', { label: info.label, index: info.index + 1, total: info.total })
      : t('dev.status.noRoute');
  };

  const advanceGeneratorStep = (delta: number): void => {
    handlers.stepGenerator(delta);
    refreshGeneratorStep();
  };

  const stepRow = document.createElement('div');
  stepRow.style.cssText = 'display:flex;gap:6px;align-items:center;';
  stepRow.append(
    button('◂', () => advanceGeneratorStep(-1)),
    button(t('dev.step'), () => advanceGeneratorStep(1)),
    button(t('dev.live'), () => {
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
  passThroughInput.title = t('dev.passThroughTitle');
  passThroughInput.addEventListener('change', () => {
    handlers.onTogglePassThrough(passThroughInput.checked);
  });
  const passThroughRow = toggleRow(passThroughInput, t('dev.passThrough'));

  const hoverInspectInput = document.createElement('input');
  hoverInspectInput.type = 'checkbox';
  hoverInspectInput.title = t('dev.hoverInspectTitle');
  hoverInspectInput.addEventListener('change', () => {
    handlers.onToggleHoverInspect(hoverInspectInput.checked);
  });
  const hoverInspectRow = toggleRow(hoverInspectInput, t('dev.hoverInspect'));

  const ignoreEncountersInput = document.createElement('input');
  ignoreEncountersInput.type = 'checkbox';
  ignoreEncountersInput.title = t('dev.ignoreEncountersTitle');
  ignoreEncountersInput.addEventListener('change', () => {
    handlers.onToggleIgnoreEncounters(ignoreEncountersInput.checked);
  });
  const ignoreEncountersRow = toggleRow(ignoreEncountersInput, t('dev.ignoreEncounters'));

  const ignoreTrainersInput = document.createElement('input');
  ignoreTrainersInput.type = 'checkbox';
  ignoreTrainersInput.title = t('dev.ignoreTrainersTitle');
  ignoreTrainersInput.addEventListener('change', () => {
    handlers.onToggleIgnoreTrainers(ignoreTrainersInput.checked);
  });
  const ignoreTrainersRow = toggleRow(ignoreTrainersInput, t('dev.ignoreTrainers'));

  generalSection.append(passThroughRow, hoverInspectRow, ignoreEncountersRow, ignoreTrainersRow);

  // Live values refresh while the panel is idle; a field the user is editing
  // (or has randomized) is left alone until the next "Regenerate".
  const refreshRouteFields = (): void => {
    dirty = false;
    const ctx = handlers.readRouteContext();
    if (!ctx) {
      routeInfo.textContent = t('dev.error.noRoute');
      routeStatus.textContent = '';
      refreshLocation();
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
    ignoreEncountersInput.checked = ctx.ignoreEncounters;
    ignoreTrainersInput.checked = ctx.ignoreTrainers;
    routeInfo.textContent = t('dev.routeInfo', {
      mode: ctx.mode,
      biome: ctx.biomeName,
      band: ctx.bandName,
    });
    routeStatus.textContent = '';
    refreshLocation();
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

  routeSection.append(routeGrid, stepRow, routeButtons, routeStatus, routeInfo, locationInfo, teleportSection);

  const battlePanel = document.createElement('div');
  battlePanel.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  battlePanel.append(speciesRow, levelRow, battleButton, status);

  // Party section: drop a species straight into the run. It joins the party
  // while there is room and the PC box after that, the capture rule.
  const partySection = document.createElement('div');
  partySection.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  const partySpeciesInput = document.createElement('input');
  partySpeciesInput.type = 'text';
  partySpeciesInput.placeholder = t('dev.speciesPlaceholder');
  partySpeciesInput.autocomplete = 'off';
  partySpeciesInput.setAttribute('list', 'debug-species-list');
  partySpeciesInput.style.cssText = compact;

  const partySpeciesRow = document.createElement('label');
  partySpeciesRow.textContent = t('dev.species');
  partySpeciesRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
  partySpeciesRow.append(partySpeciesInput);

  const partyStatus = document.createElement('div');
  partyStatus.style.cssText = 'min-height:16px;color:#94a3b8;';

  // Squad level: the party and the PC share one level (D35), so it has its own
  // control at the top instead of living on the per-member editor.
  const squadLevelInput = document.createElement('input');
  squadLevelInput.type = 'number';
  squadLevelInput.min = String(DEBUG_MIN_LEVEL);
  squadLevelInput.max = String(DEBUG_MAX_LEVEL);
  squadLevelInput.title = t('dev.squadLevelTitle');
  squadLevelInput.placeholder = t('dev.levelPlaceholder');
  squadLevelInput.style.cssText = compact;

  const setSquadLevel = (): void => {
    const level = clampLevel(parseOptionalInt(squadLevelInput.value) ?? DEBUG_DEFAULT_LEVEL);
    squadLevelInput.value = String(level);
    if (!handlers.onSetSquadLevel(level)) {
      partyStatus.textContent = t('dev.status.noRun');
      return;
    }
    refreshPartyOptions();
    partyStatus.textContent = t('dev.status.squadLevel', { level });
  };

  const squadLevelButton = button(t('dev.setLevel'), setSquadLevel);
  squadLevelButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';

  const squadLevelRow = document.createElement('label');
  squadLevelRow.textContent = t('dev.squadLevel');
  squadLevelRow.style.cssText = 'display:flex;align-items:center;gap:8px;';
  squadLevelRow.append(squadLevelInput, squadLevelButton);

  const addPokemon = (): void => {
    const species = matchSpecies(partySpeciesInput.value, SPECIES);
    if (!species) {
      partyStatus.textContent = partySpeciesInput.value.trim()
        ? t('dev.status.unknownSpecies')
        : t('dev.status.typeSpecies');
      return;
    }
    const level = DEBUG_DEFAULT_LEVEL;
    const where = handlers.onAddPokemon(species.id, level);
    partyStatus.textContent = where
      ? t('dev.status.added', {
          name: species.name,
          level,
          where: where === 'party' ? t('dev.where.party') : t('dev.where.box'),
        })
      : t('dev.status.noRun');
    if (where) refreshPartyOptions();
  };

  const addPokemonButton = button(t('dev.add'), addPokemon);
  addPokemonButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';
  partySection.append(squadLevelRow, partySpeciesRow, addPokemonButton, partyStatus);

  // Party editor: pick a party member and override its moves, ability and
  // nature (the level is the squad's, set above). The member list is rebuilt
  // from the live run on every open.
  const partyEditor = document.createElement('div');
  partyEditor.style.cssText =
    'display:flex;flex-direction:column;gap:6px;border-top:1px solid #334155;padding-top:6px;';

  const partyList = document.createElement('datalist');
  partyList.id = 'debug-party-list';

  const partyMemberInput = document.createElement('input');
  partyMemberInput.type = 'text';
  partyMemberInput.placeholder = t('dev.memberPlaceholder');
  partyMemberInput.autocomplete = 'off';
  partyMemberInput.setAttribute('list', 'debug-party-list');
  partyMemberInput.style.cssText = compact;

  const partyMemberRow = document.createElement('label');
  partyMemberRow.textContent = t('dev.member');
  partyMemberRow.style.cssText = partySpeciesRow.style.cssText;
  partyMemberRow.append(partyMemberInput);

  const moveInputs = [0, 1, 2, 3].map((index) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = t('dev.movePlaceholder', { n: index + 1 });
    input.autocomplete = 'off';
    input.setAttribute('list', 'debug-move-list');
    input.style.cssText = compact;
    return input;
  });

  const moveRows = moveInputs.map((input, index) => {
    const row = document.createElement('label');
    row.textContent = t('dev.move', { n: index + 1 });
    row.style.cssText = partySpeciesRow.style.cssText;
    row.append(input);
    return row;
  });

  const abilityInput = document.createElement('input');
  abilityInput.type = 'text';
  abilityInput.placeholder = t('dev.abilityPlaceholder');
  abilityInput.autocomplete = 'off';
  abilityInput.setAttribute('list', 'debug-ability-list');
  abilityInput.style.cssText = compact;

  const abilityRow = document.createElement('label');
  abilityRow.textContent = t('dev.ability');
  abilityRow.style.cssText = partySpeciesRow.style.cssText;
  abilityRow.append(abilityInput);

  const natureInput = document.createElement('input');
  natureInput.type = 'text';
  natureInput.placeholder = t('dev.naturePlaceholder');
  natureInput.autocomplete = 'off';
  natureInput.setAttribute('list', 'debug-nature-list');
  natureInput.style.cssText = compact;

  const natureRow = document.createElement('label');
  natureRow.textContent = t('dev.nature');
  natureRow.style.cssText = partySpeciesRow.style.cssText;
  natureRow.append(natureInput);

  const editStatus = document.createElement('div');
  editStatus.style.cssText = 'min-height:16px;color:#94a3b8;';

  /** The member the fields currently describe; kept by id across a refresh. */
  let selectedMemberId: string | null = null;

  const fillMemberFields = (member: DebugPartyMember): void => {
    const members = handlers.readParty();
    const index = members.findIndex((entry) => entry.id === member.id);
    partyMemberInput.value =
      index >= 0 ? (partyMemberLabels(members)[index] ?? partyMemberLabel(member)) : partyMemberLabel(member);
    moveInputs.forEach((input, index) => {
      const moveId = member.moves[index];
      input.value = moveId ? (getMove(moveId)?.name ?? moveId) : '';
    });
    abilityInput.value = member.ability;
    natureInput.value = getNature(member.nature)?.name ?? member.nature;
  };

  const refreshPartyOptions = (): void => {
    const members = handlers.readParty();
    const labels = partyMemberLabels(members);
    // The squad shares one level, so the first member carries the level control.
    const squadLevel = members[0]?.level;
    if (squadLevel !== undefined) squadLevelInput.value = String(squadLevel);
    partyList.replaceChildren();
    members.forEach((member, index) => {
      const option = document.createElement('option');
      option.value = labels[index] ?? partyMemberLabel(member);
      option.label = t('dev.option.member', { id: member.speciesId });
      partyList.append(option);
    });
    const selected = members.find((member) => member.id === selectedMemberId);
    if (selected) {
      fillMemberFields(selected);
      setEditorEnabled(true);
    } else {
      selectedMemberId = null;
      setEditorEnabled(false);
    }
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
    const members = handlers.readParty();
    const labels = partyMemberLabels(members);
    let index = labels.findIndex((label) => label.toLowerCase() === text);
    if (index < 0) {
      index = members.findIndex((candidate) => partyMemberLabel(candidate).toLowerCase() === text);
    }
    if (index < 0) return;
    const member = members[index]!;
    selectedMemberId = member.id;
    fillMemberFields(member);
    setEditorEnabled(true);
  });

  partyMemberInput.addEventListener('change', () => {
    const member = matchPartyMember(partyMemberInput.value, handlers.readParty());
    if (!member) return;
    selectedMemberId = member.id;
    fillMemberFields(member);
    setEditorEnabled(true);
  });

  const applyEdit = (): void => {
    const member = currentMember();
    if (!member) {
      editStatus.textContent = partyMemberInput.value.trim()
        ? t('dev.status.unknownMember')
        : t('dev.status.pickMember');
      return;
    }
    const edit: { nature?: string; ability?: string; moves?: readonly string[] } = {};
    if (abilityInput.value.trim()) {
      const ability = matchAbility(abilityInput.value);
      if (!ability) {
        editStatus.textContent = t('dev.status.unknownAbility', {
          name: abilityInput.value.trim(),
        });
        return;
      }
      edit.ability = ability.name;
    }
    if (natureInput.value.trim()) {
      const nature = matchNature(natureInput.value);
      if (!nature) {
        editStatus.textContent = t('dev.status.unknownNature', {
          name: natureInput.value.trim(),
        });
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
        editStatus.textContent = t('dev.status.unknownMove', { name: text });
        return;
      }
      moveIds.push(move.id);
    }
    if (moveIds.length > 0) edit.moves = moveIds;
    if (!handlers.onEditPartyMember(member.id, edit)) {
      editStatus.textContent = t('dev.status.noRun');
      return;
    }
    selectedMemberId = member.id;
    refreshPartyOptions();
    editStatus.textContent = t('dev.status.edited', { name: member.name });
  };

  const healSelected = (): void => {
    const member = currentMember();
    if (!member) {
      editStatus.textContent = t('dev.status.pickMember');
      return;
    }
    if (!handlers.onHealPartyMember(member.id)) {
      editStatus.textContent = t('dev.status.noRun');
      return;
    }
    selectedMemberId = member.id;
    refreshPartyOptions();
    editStatus.textContent = t('dev.status.healed', { name: member.name });
  };

  const applyButton = button(t('dev.apply'), applyEdit);
  applyButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';

  const healButton = button(t('dev.heal'), healSelected);
  healButton.style.cssText += 'background:#166534;color:#f8fafc;font-weight:700;';

  const editButtons = document.createElement('div');
  editButtons.style.cssText = 'display:flex;gap:6px;';
  editButtons.append(applyButton, healButton);

  /** The editor only works on a chosen member; with none, every field locks. */
  const setEditorEnabled = (enabled: boolean): void => {
    abilityInput.disabled = !enabled;
    natureInput.disabled = !enabled;
    for (const input of moveInputs) input.disabled = !enabled;
    applyButton.disabled = !enabled;
    healButton.disabled = !enabled;
  };
  setEditorEnabled(false);

  partyEditor.append(
    partyMemberRow,
    ...moveRows,
    abilityRow,
    natureRow,
    editButtons,
    editStatus,
  );
  partySection.append(partyEditor);

  // Bag section: add any run item to the bag in bulk, resolved by the same
  // name/id autocomplete as species.
  const bagSection = document.createElement('div');
  bagSection.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  const bagItemInput = document.createElement('input');
  bagItemInput.type = 'text';
  bagItemInput.placeholder = t('dev.itemPlaceholder');
  bagItemInput.autocomplete = 'off';
  bagItemInput.setAttribute('list', 'debug-item-list');
  bagItemInput.style.cssText = compact;

  const bagCountInput = document.createElement('input');
  bagCountInput.type = 'number';
  bagCountInput.min = '1';
  bagCountInput.max = String(DEBUG_MAX_ITEM_COUNT);
  bagCountInput.value = '1';
  bagCountInput.title = t('dev.countTitle');
  bagCountInput.style.cssText = compact;

  const bagItemRow = document.createElement('label');
  bagItemRow.textContent = t('dev.item');
  bagItemRow.style.cssText = partySpeciesRow.style.cssText;
  bagItemRow.append(bagItemInput);

  const bagCountRow = document.createElement('label');
  bagCountRow.textContent = t('dev.count');
  bagCountRow.style.cssText = partySpeciesRow.style.cssText;
  bagCountRow.append(bagCountInput);

  const bagStatus = document.createElement('div');
  bagStatus.style.cssText = 'min-height:16px;color:#94a3b8;';

  const addBagItem = (): void => {
    const item = matchItem(bagItemInput.value, ITEMS);
    if (!item) {
      bagStatus.textContent = bagItemInput.value.trim()
        ? t('dev.status.unknownItem')
        : t('dev.status.typeItem');
      return;
    }
    const count = clampItemCount(Number(bagCountInput.value));
    bagCountInput.value = String(count);
    handlers.onAddItem(item.id, count);
    bagStatus.textContent = t('dev.status.addedItem', { name: item.name, count });
  };

  const addBagButton = button(t('dev.add'), addBagItem);
  addBagButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';
  bagSection.append(bagItemRow, bagCountRow, addBagButton, bagStatus);

  const itemList = document.createElement('datalist');
  itemList.id = 'debug-item-list';
  for (const item of ITEMS) {
    const option = document.createElement('option');
    option.value = item.name;
    option.label = t('dev.option.item', { id: item.id });
    itemList.append(option);
  }

  const moveList = document.createElement('datalist');
  moveList.id = 'debug-move-list';
  for (const move of allMoves()) {
    const option = document.createElement('option');
    option.value = move.name;
    option.label = t('dev.option.move', { id: move.id, type: move.type, category: move.category });
    moveList.append(option);
  }

  const abilityList = document.createElement('datalist');
  abilityList.id = 'debug-ability-list';
  for (const ability of allAbilities()) {
    const option = document.createElement('option');
    option.value = ability.name;
    option.label = t('dev.option.ability', { id: ability.id });
    abilityList.append(option);
  }

  const natureList = document.createElement('datalist');
  natureList.id = 'debug-nature-list';
  for (const nature of allNatures()) {
    const option = document.createElement('option');
    option.value = nature.name;
    option.label = nature.plus && nature.minus
      ? t('dev.option.nature', { plus: nature.plus, minus: nature.minus })
      : t('dev.option.natureNeutral');
    natureList.append(option);
  }

  for (const input of [partyMemberInput, squadLevelInput]) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') (input === squadLevelInput ? setSquadLevel() : applyEdit());
    });
  }

  for (const input of [partySpeciesInput]) {
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
  mapArea.placeholder = t('dev.mapPlaceholder');
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
      t('dev.summary.map', {
        width: frameMap.width,
        height: frameMap.height,
        trees: frameMap.trees.length,
        bitten: bitten.length,
      }),
    ];
    for (const tree of bitten) {
      lines.push(t('dev.summary.tree', {
        id: tree.id,
        band: tree.band,
        from: tree.top,
        to: tree.bottom,
        cells: tree.cells.length,
      }));
    }
    mapSummary.textContent = lines.join('\n');
  };

  const mapExportButton = button(t('dev.export'), () => {
    const text = handlers.exportFrameMap();
    if (!text) {
      mapStatus.textContent = t('dev.error.noRoute');
      return;
    }
    mapArea.value = text;
    mapStatus.textContent = t('dev.status.exported', { chars: text.length });
    summarize(text);
  });
  const mapCopyButton = button(t('dev.copy'), () => {
    if (!mapArea.value) {
      mapStatus.textContent = t('dev.status.nothingToCopy');
      return;
    }
    void navigator.clipboard?.writeText(mapArea.value).then(
      () => {
        mapStatus.textContent = t('dev.status.copied');
      },
      () => {
        mapStatus.textContent = t('dev.status.copyFailed');
      },
    );
  });
  const mapImportButton = button(t('dev.import'), () => {
    const result = handlers.importFrameMap(mapArea.value);
    mapStatus.textContent = result.ok
      ? t('dev.status.imported')
      : t('dev.status.importFailed', { error: result.error ?? t('dev.status.unknown') });
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
  const generalTab = button(t('dev.tab.general'), () => selectTab('general'));
  const battleTab = button(t('dev.tab.battle'), () => selectTab('battle'));
  const partyTab = button(t('dev.tab.party'), () => selectTab('party'));
  const bagTab = button(t('dev.tab.bag'), () => selectTab('bag'));
  const routeTab = button(t('dev.tab.route'), () => selectTab('route'));
  const mapTab = button(t('dev.tab.map'), () => selectTab('map'));
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
