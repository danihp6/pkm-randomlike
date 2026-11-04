import type Phaser from 'phaser';
import type { HudLayout, HudPanelId } from '../../data/hudLayout';
import { HUD_PANEL_IDS } from '../../data/hudLayout';
import type { MapPlan } from '../../engine/maps';
import type { RouteMap, RouteTrainer } from '../../engine/routes/routeMap';
import type { RunState } from '../../engine/run/state';
import type { Settings } from '../../engine/save';
import { saveSettings } from '../../settings';
import type { Notice } from '../../ui/notice';
import { initialPartyUi, type PartyUiState } from '../../ui/partyScreen';
// The folder path is spelled in full: this module is the one importer of the panel
// registry, and a scene that reaches it is the drift this layer exists to remove.
import { collectPanels, type PanelRegistry } from '../panels/registry';
import type { RoomRegistry } from '../rooms/registry';
import type { RoomPanel } from '../rooms/types';
import { hudMetrics } from './hud';
import type { RoutePanelDescriptor, RoutePanelHost, RoutePanelId } from './types';

/**
 * The panel layer of **every** node scene: the route's overlay cards, mounted over
 * whatever screen the run is standing on (`D47`'s descriptor shape, `D49`'s DOM
 * HUD). A city, a gym, a laboratory, a Centre and the League draw the party, bag,
 * missions, rewards, trade, detail and pause cards from the run they already carry;
 * the route keeps all twelve, because it is the only screen with a minimap, a floor
 * hud, a box and a notice strip.
 *
 * The layer owns the HUD's transient state (`ui()`, the open/collapsed set and the
 * saved layout) exactly as `RouteScene` used to, so a card never keeps a second copy
 * of it. `Phaser` is a **type-only** import here and nothing in this module mounts by
 * itself, so the port is built and tested headless.
 */

/** One wild battle a card starts through the scene's own wild path. */
export type PanelEncounter = Readonly<{ speciesId: string; level: number; key: string }>;

/** The scene's room-panel slot; absent means the scene has none. */
export type PanelRoomSlot = Readonly<{
  open(panel: RoomPanel): void;
  close(): void;
  isOpen(): boolean;
}>;

/** The writes a card asks its scene for. Every member is optional on a source. */
export type PanelActions = Readonly<{
  showNotice(notice: Notice): void;
  startWildBattle(encounter: PanelEncounter): void;
  startTrainerBattle(trainer: RouteTrainer): void;
  openSettings(): void;
  restartRun(): void;
  flyToNode(key: string): void;
  commitRun(run: RunState): void;
  persistRun(): void;
}>;

/** Everything a scene hands the host. Only `scene`, `run` and `settings` are required. */
export type PanelSceneSource = Readonly<{
  scene: Phaser.Scene;
  run(): RunState;
  settings(): Settings;
  route?(): RouteMap | null;
  plan?(): MapPlan | null;
  rooms?(): RoomRegistry;
  slot?: PanelRoomSlot;
  actions?: Partial<PanelActions>;
  /** The panel ids this scene mounts; omitted means all twelve, in registry order. */
  panels?: readonly RoutePanelId[];
}>;

export type ScenePanels = Readonly<{
  host: RoutePanelHost;
  registry: PanelRegistry;
  panels: readonly RoutePanelDescriptor[];
  /** Mounts every selected card into `#hud`, in `order`; registers the scene's shutdown. */
  build(): void;
  /** Repaints every selected card once, in `order`. */
  refresh(): void;
  /** Unmounts every card, in reverse `order`. */
  close(): void;
}>;

/**
 * The node scenes' seven cards, in registry order: the ones a settlement produces.
 * The route's minimap, floor HUD, PC box, notice strip and Mart counter belong to the
 * route and the Mart room, so no node screen mounts them.
 */
export const NODE_PANEL_IDS: readonly RoutePanelId[] = [
  'party',
  'bag',
  'missions',
  'rewards',
  'trade',
  'detail',
  'pause',
];

/** `Phaser.Scenes.Events.SHUTDOWN`, spelled out so this module never imports Phaser as a value. */
const SCENE_SHUTDOWN = 'shutdown';

/** The empty registry a scene without special rooms answers with. */
const EMPTY_ROOMS: RoomRegistry = { byKind: new Map(), byMarker: new Map() };

/** The slot of a scene that has none: every call is total and answers closed. */
const NO_SLOT: PanelRoomSlot = {
  open: () => undefined,
  close: () => undefined,
  isOpen: () => false,
};

/** The default of an action a scene does not override. */
const NOOP = (): void => undefined;

/** The folder's modules, exactly the map the registry collects its descriptors from. */
const PANEL_MODULES = import.meta.glob(['./*.ts', '!./*.test.ts'], { eager: true });

/** Collects the folder's descriptors (`import.meta.glob('./*.ts', '!./*.test.ts')` lives here, not in a scene). */
export function createPanels(): PanelRegistry {
  return collectPanels(PANEL_MODULES);
}

/** The cards a scene asked for, in `order`; an unknown id is a programming error. */
function selectPanels(
  registry: PanelRegistry,
  ids: readonly RoutePanelId[] | undefined,
): readonly RoutePanelDescriptor[] {
  if (ids === undefined) return registry.all;
  const wanted = new Set(ids);
  for (const id of wanted) {
    if (!registry.byId.has(id)) throw new Error(`unknown panel id: ${id}`);
  }
  return registry.all.filter((panel) => wanted.has(panel.id));
}

/** The cards a saved layout holds open: every one whose record is not collapsed. */
function openStateOf(layout: HudLayout): Set<HudPanelId> {
  return new Set(HUD_PANEL_IDS.filter((id) => !layout[id].collapsed));
}

/** Builds a `RoutePanelHost` over any scene. Never mounts by itself. */
export function createScenePanels(source: PanelSceneSource): ScenePanels {
  const registry = createPanels();
  const panels = selectPanels(registry, source.panels);
  let layout: HudLayout = source.settings().hudLayout;
  let open = openStateOf(layout);
  let ui: PartyUiState = initialPartyUi();
  let closed = false;

  const repaint = (): void => {
    for (let index = 0; index < panels.length; index++) panels[index].refresh?.(host);
  };

  const setHudLayout = (next: HudLayout): void => {
    layout = next;
    open = openStateOf(next);
    saveSettings({ ...source.settings(), hudLayout: next });
    repaint();
  };

  const actions: PanelActions = {
    showNotice: source.actions?.showNotice ?? NOOP,
    startWildBattle: source.actions?.startWildBattle ?? NOOP,
    startTrainerBattle: source.actions?.startTrainerBattle ?? NOOP,
    openSettings: source.actions?.openSettings ?? NOOP,
    restartRun: source.actions?.restartRun ?? NOOP,
    flyToNode: source.actions?.flyToNode ?? NOOP,
    commitRun: source.actions?.commitRun ?? NOOP,
    persistRun: source.actions?.persistRun ?? NOOP,
  };

  const slot = source.slot ?? NO_SLOT;

  const host: RoutePanelHost = {
    scene: source.scene,
    run: () => source.run(),
    settings: () => source.settings(),
    hudLayout: () => layout,
    setHudLayout,
    hud: () => hudMetrics(source.scene.scale.width),
    hudCardOpen: (id) => open.has(id),
    setHudCardOpen: (id, next) => {
      if (open.has(id) === next) return;
      if (next) open.add(id);
      else open.delete(id);
      setHudLayout({ ...layout, [id]: { ...layout[id], collapsed: !next } });
    },
    ui: () => ui,
    setUi: (state) => {
      ui = state;
    },
    commitRun: (run) => actions.commitRun(run),
    persistRun: () => actions.persistRun(),
    refreshHud: repaint,
    openPanel: (panel) => slot.open(panel),
    closePanel: () => slot.close(),
    panelOpen: () => slot.isOpen(),
    showNotice: (notice) => actions.showNotice(notice),
    startWildBattle: (encounter) => actions.startWildBattle(encounter),
    startTrainerBattle: (trainer) => actions.startTrainerBattle(trainer),
    route: source.route ?? (() => null),
    plan: source.plan ?? (() => null),
    rooms: source.rooms ?? (() => EMPTY_ROOMS),
    openSettings: () => actions.openSettings(),
    restartRun: () => actions.restartRun(),
    flyToNode: (key) => actions.flyToNode(key),
  };

  const refresh = (): void => repaint();

  const close = (): void => {
    if (closed) return;
    closed = true;
    for (let index = panels.length - 1; index >= 0; index--) panels[index].close?.(host);
  };

  const build = (): void => {
    closed = false;
    for (let index = 0; index < panels.length; index++) panels[index].build(host);
    source.scene.events.once(SCENE_SHUTDOWN, () => close());
  };

  return { host, registry, panels, build, refresh, close };
}
