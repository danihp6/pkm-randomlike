import type { CSSProperties, JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getBiome } from '../../../../data/biomes';
import { COMMON_ATLAS_URL, TILESETS } from '../../../../data/tilesets';
import {
  previewWalkers,
  stepPreviewWalkers,
  type PreviewRoom,
  type PreviewWalker,
} from '../../../../engine/routes/preview';
import { Panel, Row } from '../../kit';
import { portraitBackground, portraitCrop, type PortraitCrop } from '../../portrait';
import type { MainMenuIntent } from './mount';
import {
  ROUTE_PREVIEW_STEP_MS,
  previewRoomFor,
  previewTileBox,
  previewWalkerBox,
  tileBackground,
  type PreviewTileset,
  type TileBackground,
} from './routeWindow';
import {
  MAIN_MENU_BOARD,
  MAIN_MENU_BOARD_NARROW,
  MAIN_MENU_NARROW_QUERY,
  forLayout,
  glowBackground,
  type MainMenuRowId,
  type MainMenuView,
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

function walkerStyle(
  window: Readonly<{ x: number; y: number; w: number; h: number }>,
  room: PreviewRoom,
  walker: PreviewWalker,
): CSSProperties {
  const box = previewWalkerBox(window, room, walker);
  const crop = portraitCrop(walker.speciesId);
  return {
    ...boxPaint(box),
    ...(crop === null ? {} : portraitBackground(crop, box.w)),
  };
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
  const [walkers, setWalkers] = useState<readonly PreviewWalker[]>(() => previewWalkers(room));
  const step = useRef(0);

  useEffect(() => {
    step.current = 0;
    setWalkers(previewWalkers(room));
    const timer = setInterval(() => {
      step.current += 1;
      setWalkers((current) => stepPreviewWalkers(room, current, step.current));
    }, ROUTE_PREVIEW_STEP_MS);
    return () => clearInterval(timer);
  }, [room]);

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
          {walkers.map((walker) => (
            <span
              key={walker.id}
              class="main-menu__walker"
              data-hud-main-menu-walker={String(walker.id)}
              style={walkerStyle(routeWindow, room, walker)}
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
                  {row.value === '' ? null : <span class="main-menu__value">{row.value}</span>}
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
