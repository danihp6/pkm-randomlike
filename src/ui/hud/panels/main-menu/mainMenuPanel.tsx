import { Fragment } from 'preact';
import type { CSSProperties, JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getBiome } from '../../../../data/biomes';
import { pokemonOverworldSheet, type PokemonOverworldSheet } from '../../../../data/pokemonOverworld';
import { COMMON_ATLAS_URL, TILESETS } from '../../../../data/tilesets';
import {
  previewWalkers,
  stepPreviewWalkers,
  type PreviewRoom,
  type PreviewWalker,
} from '../../../../engine/routes/preview';
import { Panel, Row } from '../../kit';
import { portraitBackground, type PortraitCrop } from '../../portrait';
import type { MainMenuIntent } from './mount';
import {
  ROUTE_PREVIEW_STEP_MS,
  TRAIL_MS,
  WALK_FRAME_MS,
  WALK_STEP_MS,
  previewRoomFor,
  previewTileBox,
  tileBackground,
  walkerPaint,
  type PreviewTileset,
  type TileBackground,
  type WalkerPaint,
  type WalkerPlate,
} from './routeWindow';
import {
  MAIN_MENU_BOARD,
  MAIN_MENU_BOARD_NARROW,
  MAIN_MENU_NARROW_QUERY,
  forLayout,
  glowBackground,
  type MainMenuRowId,
  type MainMenuView,
  type Rect,
} from './view';
import './main-menu.css';

export type MainMenuPanelProps = Readonly<{
  view: MainMenuView;
  onIntent?: ((intent: MainMenuIntent) => void) | undefined;
}>;

/** The intent a row's press asks the scene for. */
const ROW_INTENTS: Readonly<Record<MainMenuRowId, MainMenuIntent['type']>> = {
  continue: 'continue',
  new: 'new-run',
  options: 'options',
  stats: 'stats',
  ranking: 'ranking',
};

function rowClass(selected: boolean): string {
  return selected ? 'main-menu__row-button main-menu__row-button--selected' : 'main-menu__row-button';
}

/** The board's phone column draws the same rows on the 390 × 844 frame. */
function compactViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(MAIN_MENU_NARROW_QUERY).matches;
}

/** Repaints when the panel crosses the breakpoint, so the inline portrait scale follows the box. */
function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(compactViewport);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(MAIN_MENU_NARROW_QUERY);
    const sync = (): void => setCompact(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return compact;
}

/** The portrait cell's inline scale, or no background at all when the atlas names no cell. */
function portraitStyle(portrait: PortraitCrop | null, box: number): CSSProperties | undefined {
  if (portrait === null) return undefined;
  const background = portraitBackground(portrait, box);
  return { ...background };
}

const TILESET_CACHE = new Map<string, PreviewTileset>();

/** The biome's tileset, built once per biome: a repaint never remakes it. */
function previewTilesetFor(biomeId: string): PreviewTileset {
  const biome = getBiome(biomeId);
  const cached = TILESET_CACHE.get(biome.id);
  if (cached !== undefined) return cached;
  const tileset = TILESETS[biome.tilesetId];
  const built: PreviewTileset = {
    config: tileset.config,
    atlasUrl: tileset.atlasUrl,
    commonUrl: COMMON_ATLAS_URL,
  };
  TILESET_CACHE.set(biome.id, built);
  return built;
}

function backgroundPaint(background: TileBackground): CSSProperties {
  return {
    backgroundImage: background.images.map((url) => `url("${url}")`).join(', '),
    backgroundPosition: background.positions.join(', '),
    backgroundSize: background.images.map(() => background.size).join(', '),
  };
}

function boxPaint(box: Readonly<{ x: number; y: number; w: number; h: number }>): CSSProperties {
  return { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` };
}

/**
 * The value's own box, row-relative: the view measures it in page coordinates and the
 * row's own left is `MAIN_MENU_BOARD.row.x`. The string is already elided to it, so the
 * bound only stops a font fallback from reaching under the portraits.
 */
function valueStyle(box: Rect): CSSProperties {
  return { left: `${box.x - MAIN_MENU_BOARD.row.x}px`, width: `${box.w}px` };
}

function tileStyle(
  window: Readonly<{ x: number; y: number; w: number; h: number }>,
  room: PreviewRoom,
  tileset: PreviewTileset,
  x: number,
  y: number,
): CSSProperties {
  return {
    ...boxPaint(previewTileBox(window, room, { x, y })),
    ...backgroundPaint(tileBackground(room, { x, y }, tileset)),
  };
}

function walkerStyle(walker: WalkerPaint): CSSProperties {
  return {
    ...boxPaint(walker.box),
    backgroundImage: walker.backgroundImage,
    backgroundPosition: walker.backgroundPosition,
    backgroundSize: walker.backgroundSize,
    transform: walker.transform,
    transitionDuration: `${walker.transitionMs}ms`,
  };
}

function plateStyle(plate: WalkerPlate): CSSProperties {
  return { ...boxPaint(plate.box), backgroundColor: plate.colour };
}

/** One repaint of the window: the walkers, who is in flight and where the walk clock stands. */
type PreviewWalk = Readonly<{
  walkers: readonly PreviewWalker[];
  /** The ids whose tile this tick moved; empty once they have landed. */
  moving: readonly number[];
  /** The paint clock's reading in ms — elapsed time only, so no draw and no fold moves. */
  clock: number;
  /** True on a first paint and on a room change: the boxes are set, never slid into. */
  instant: boolean;
  /** The slide the last tick bought, in ms: one `WALK_STEP_MS` per tile of the longest stride. */
  strideMs: number;
  /** When the trail goes, on the paint clock; `0` = no trail to clear. */
  trailUntil: number;
}>;

/** A mount or a room change: every walker is born on its own tile. */
function firstPaint(room: PreviewRoom): PreviewWalk {
  return {
    walkers: previewWalkers(room),
    moving: [],
    clock: 0,
    instant: true,
    strideMs: WALK_STEP_MS,
    trailUntil: 0,
  };
}

/** The paint clock: elapsed time, never a random draw (`D11`). */
function nowMs(): number {
  return typeof performance === 'undefined' ? 0 : performance.now();
}

/** The `walk` strip's frame the clock stands on, wrapped to that pair's own `count`. */
function walkFrameStep(sheet: PokemonOverworldSheet | null, clock: number): number {
  const count = sheet === null ? 0 : sheet.anims.walk.count;
  if (!(count > 0)) return 0;
  return Math.floor(clock / WALK_FRAME_MS) % count;
}

/** The ids the tick moved: those are the walkers it paints in flight for `WALK_STEP_MS`. */
function movedIds(before: readonly PreviewWalker[], after: readonly PreviewWalker[]): readonly number[] {
  const ids: number[] = [];
  for (const walker of after) {
    const previous = before.find((candidate) => candidate.id === walker.id);
    if (
      previous === undefined ||
      previous.tile.x !== walker.tile.x ||
      previous.tile.y !== walker.tile.y
    ) {
      ids.push(walker.id);
    }
  }
  return ids;
}

const PAIR_SHEETS = new Map<string, PokemonOverworldSheet | null>();
const PAIR_READY = new Set<string>();
const PAIR_FAILURES = new Set<string>();
const PAIR_PROBES = new Set<string>();

/** A species' committed pair, resolved once per boot; null when the manifest has none. */
function pairSheet(speciesId: string): PokemonOverworldSheet | null {
  const cached = PAIR_SHEETS.get(speciesId);
  if (cached !== undefined) return cached;
  const sheet = pokemonOverworldSheet(speciesId);
  PAIR_SHEETS.set(speciesId, sheet);
  return sheet;
}

/** The sheet a walker may draw: null for a pair whose image the browser refused. */
function drawablePair(speciesId: string): PokemonOverworldSheet | null {
  if (PAIR_FAILURES.has(speciesId)) return null;
  return pairSheet(speciesId);
}

/**
 * Probes a pair PNG once and remembers the answer, so a 404 flips the walker to its
 * portrait on the next paint instead of leaving an empty box or a thrown error.
 */
function probePairImage(speciesId: string, sheet: PokemonOverworldSheet, onFail: () => void): void {
  if (PAIR_READY.has(speciesId) || PAIR_FAILURES.has(speciesId)) return;
  if (PAIR_PROBES.has(speciesId)) return;
  PAIR_PROBES.add(speciesId);
  const image = new Image();
  image.onload = () => {
    PAIR_PROBES.delete(speciesId);
    PAIR_READY.add(speciesId);
  };
  image.onerror = () => {
    PAIR_PROBES.delete(speciesId);
    PAIR_FAILURES.add(speciesId);
    onFail();
  };
  image.src = sheet.url;
}

/** The window's floor: one span per cell of the room, painted from the tileset's frames. */
function routeTiles(
  window: Readonly<{ x: number; y: number; w: number; h: number }>,
  room: PreviewRoom,
  tileset: PreviewTileset,
): JSX.Element[] {
  const cells: JSX.Element[] = [];
  for (let y = 0; y < room.rows; y++) {
    for (let x = 0; x < room.cols; x++) {
      cells.push(
        <span
          key={`${x},${y}`}
          class="main-menu__tile"
          data-hud-main-menu-tile
          style={tileStyle(window, room, tileset, x, y)}
        />,
      );
    }
  }
  return cells;
}

export function MainMenuPanel(props: MainMenuPanelProps): JSX.Element {
  const handler = props.onIntent;
  const compact = useCompactViewport();
  const view = forLayout(props.view, compact ? 'compact' : 'wide');
  const portraitBox = compact ? MAIN_MENU_BOARD_NARROW.portrait.size : MAIN_MENU_BOARD.portrait.size;

  const routeWindow = compact ? MAIN_MENU_BOARD_NARROW.window : MAIN_MENU_BOARD.window;
  const room = previewRoomFor(view.previewSeed, routeWindow);
  const tileset = previewTilesetFor(room.biomeId);
  const tiles = useMemo(() => routeTiles(routeWindow, room, tileset), [routeWindow, room, tileset]);
  const [walk, setWalk] = useState<PreviewWalk>(() => firstPaint(room));
  const [, setPairEpoch] = useState(0);
  const step = useRef(0);

  useEffect(() => {
    step.current = 0;
    setWalk(firstPaint(room));
    const timer = setInterval(() => {
      step.current += 1;
      const tick = step.current;
      setWalk((current) => {
        const walkers = stepPreviewWalkers(room, current.walkers, tick);
        const clock = nowMs();
        return {
          walkers,
          moving: movedIds(current.walkers, walkers),
          clock,
          instant: false,
          strideMs: Math.max(1, ...walkers.map((walker) => walker.path.length)) * WALK_STEP_MS,
          trailUntil: clock + TRAIL_MS,
        };
      });
    }, ROUTE_PREVIEW_STEP_MS);
    return () => clearInterval(timer);
  }, [room]);

  // The walk's paint clock: one repaint per frame boundary while a walker is in
  // flight, and the stand that ends when its slide lands. The frame strip runs on
  // elapsed time at `FOLLOWER_FRAME_RATE`, so one 24 px tile spans one frame step.
  useEffect(() => {
    if (walk.moving.length === 0) return undefined;
    const landed = window.setTimeout(() => {
      setWalk((current) => (current.moving.length === 0 ? current : { ...current, moving: [] }));
    }, walk.strideMs);
    let frame = 0;
    const atBoundary = (): void => {
      const now = nowMs();
      const next = (Math.floor(now / WALK_FRAME_MS) + 1) * WALK_FRAME_MS;
      frame = window.setTimeout(
        () => {
          setWalk((current) => (current.moving.length === 0 ? current : { ...current, clock: next }));
          atBoundary();
        },
        Math.max(0, next - now),
      );
    };
    atBoundary();
    return () => {
      window.clearTimeout(landed);
      window.clearTimeout(frame);
    };
  }, [walk.moving, walk.strideMs]);

  // The trail is `TRAIL_MS` of paint clock behind the walker: the tick arms it and
  // this clears it, so a stride leaves a short tail and no longer.
  useEffect(() => {
    if (walk.trailUntil === 0) return undefined;
    const timer = window.setTimeout(() => {
      setWalk((current) => (current.trailUntil === 0 ? current : { ...current, trailUntil: 0 }));
    }, TRAIL_MS);
    return () => window.clearTimeout(timer);
  }, [walk.trailUntil]);

  // A pair the manifest names but the browser cannot fetch (the PNGs are local-only)
  // keeps its portrait crop: the probe runs once per species and the failure repaints.
  useEffect(() => {
    if (typeof Image === 'undefined') return undefined;
    let live = true;
    const repaint = (): void => {
      if (live) setPairEpoch((value) => value + 1);
    };
    for (const walker of walk.walkers) {
      const sheet = drawablePair(walker.speciesId);
      if (sheet !== null) probePairImage(walker.speciesId, sheet, repaint);
    }
    return () => {
      live = false;
    };
  }, [walk.walkers]);

  const paints = walk.walkers.map((walker) => {
    const sheet = drawablePair(walker.speciesId);
    const paint = walkerPaint(
      routeWindow,
      room,
      walker,
      {
        moving: walk.moving.includes(walker.id),
        resting: walker.rest > 0,
        frameStep: walkFrameStep(sheet, walk.clock),
        instant: walk.instant,
        // Only the walkers that booked this tick's stride carry a trail: a resting tick
        // re-arms `trailUntil`, and re-lighting the tail through the stand would leave
        // the half-alpha plate flickering for the whole beat.
        sinceStrideMs:
          walk.trailUntil === 0 || !walk.moving.includes(walker.id)
            ? Number.POSITIVE_INFINITY
            : nowMs() - (walk.trailUntil - TRAIL_MS),
      },
      sheet,
    );
    return { walker, paint };
  });

  const press = (id: MainMenuRowId): void => {
    if (handler === undefined) return;
    handler({ type: ROW_INTENTS[id] });
  };

  const portraits = (): JSX.Element[] =>
    view.portraits.map((portrait) => (
      <span
        key={portrait.memberId}
        class="main-menu__portrait"
        data-hud-main-menu-portrait
        role="img"
        aria-label={portrait.name}
        style={portraitStyle(portrait.portrait, portraitBox)}
      />
    ));

  const glowStyle: CSSProperties = {
    ...boxPaint(view.glow.box),
    backgroundImage: glowBackground(view.glow),
  };

  return (
    <div class="main-menu" data-hud-panel="main-menu">
      <div class="main-menu__stage">
        <div class="main-menu__glow" data-hud-main-menu-glow style={glowStyle} />
        <div
          class="main-menu__window"
          data-hud-main-menu-window
          data-hud-main-menu-preview={view.previewSeed}
        >
          <div class="main-menu__tiles" data-hud-main-menu-tiles>
            {tiles}
          </div>
          {paints.map(({ walker, paint }) => (
            <Fragment key={walker.id}>
              {paint.trail === null ? null : (
                <span
                  class="main-menu__plate main-menu__plate--trail"
                  data-hud-main-menu-trail={String(walker.id)}
                  style={plateStyle(paint.trail)}
                />
              )}
              <span
                class="main-menu__plate"
                data-hud-main-menu-plate={String(walker.id)}
                style={plateStyle(paint.plate)}
              />
            </Fragment>
          ))}
          {paints.map(({ walker, paint }) => (
            <span
              key={walker.id}
              class="main-menu__walker"
              data-hud-main-menu-walker={String(walker.id)}
              style={walkerStyle(paint)}
            />
          ))}
        </div>
        <h1 class="main-menu__title" data-hud-main-menu-title>
          {view.title}
        </h1>
        <span class="main-menu__rule" data-hud-main-menu-rule />
        <div class="main-menu__card" data-hud-main-menu-card data-rows={String(view.rows.length)}>
          <Panel class="main-menu__skin" />
          {view.rows.map((row) => {
            const selected = row.id === view.selected;
            return (
              <div
                key={row.id}
                class="main-menu__row"
                data-hud-main-menu-row={row.id}
                data-selected={selected ? 'true' : undefined}
              >
                <Row
                  class={rowClass(selected)}
                  selected={selected}
                  disabled={!row.enabled}
                  onPress={() => press(row.id)}
                >
                  {selected ? (
                    <>
                      <span class="main-menu__bar" data-hud-main-menu-bar />
                      <span class="main-menu__cursor" data-hud-main-menu-cursor>
                        {'>'}
                      </span>
                    </>
                  ) : null}
                  <span class="main-menu__label">{row.label}</span>
                  {row.valueBox === null ? null : (
                    <span class="main-menu__value" style={valueStyle(row.valueBox)}>
                      {row.value}
                    </span>
                  )}
                  {row.id === 'continue' && view.portraits.length > 0 ? (
                    <span class="main-menu__portraits">{portraits()}</span>
                  ) : null}
                </Row>
              </div>
            );
          })}
        </div>
        {view.stats.length === 0 ? null : (
          <div class="main-menu__footer" data-hud-main-menu-footer>
            <span class="main-menu__footer-rule" />
            {view.stats.map((stat) => (
              <div key={stat.id} class="main-menu__stat" data-hud-main-menu-stat={stat.id}>
                <span class="main-menu__stat-label">{stat.label}</span>
                <span class="main-menu__stat-value">{stat.value}</span>
                {stat.name === null ? null : <span class="main-menu__stat-name">{stat.name}</span>}
              </div>
            ))}
          </div>
        )}
        {view.version === null ? null : (
          <span class="main-menu__version" data-hud-main-menu-version>
            {view.version}
          </span>
        )}
      </div>
    </div>
  );
}
