import type { CSSProperties, JSX } from 'preact';
import type { HudCommand } from '../../commands';
import {
  MAP_BOSS_FILL,
  MAP_CAPTURE_FILL,
  MAP_CURRENT_FILL,
  MAP_CURRENT_STROKE,
  MAP_ENTRY_STROKE,
  MAP_LINK_STROKE,
  MAP_OPENING_STROKE,
  MAP_PORTAL_STROKE,
  MAP_ROOM_STROKE,
  type MapMarkerView,
  type MapPanelView,
  type Rect,
} from './view';
import './map.css';

export type MapPanelProps = Readonly<{
  view: MapPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
}>;

/** The capture ball's band, and the portal ring's 2 px stroke. */
const CAPTURE_BAND = 1.5;
const PORTAL_RING = 2;

function boxStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/** The tick colour of one opening: the portal, the map's entry, or a plain link. */
function openingStroke(kind: 'entry' | 'link' | 'portal'): string {
  if (kind === 'portal') return MAP_PORTAL_STROKE;
  return kind === 'entry' ? MAP_ENTRY_STROKE : 'var(--map-link)';
}

/**
 * One room's icon inside the grid's SVG. The boss is the frame's two-ink dot, a
 * spent capture the two-tone ball with its band, the open portal the ring, and a
 * special room the kind's documented tone dot — the canvas glyphs stay the
 * canvas's (`src/scenes/rooms/*` draws them with Phaser `Graphics`).
 */
function Marker(props: Readonly<{ marker: MapMarkerView; dx: number; dy: number }>): JSX.Element {
  const { marker, dx, dy } = props;
  const cx = marker.cx - dx;
  const cy = marker.cy - dy;
  if (marker.kind === 'boss') {
    return (
      <g data-hud-map-marker="boss">
        <circle cx={cx} cy={cy} r={marker.r} fill={MAP_BOSS_FILL} />
        <circle cx={cx} cy={cy} r={marker.r * 0.36} fill="var(--map-ink)" />
      </g>
    );
  }
  if (marker.kind === 'capture') {
    return (
      <g data-hud-map-marker="capture">
        <circle
          cx={cx}
          cy={cy}
          r={marker.r}
          fill={MAP_CAPTURE_FILL}
          stroke="var(--map-ink)"
          stroke-width={CAPTURE_BAND}
        />
        <line
          x1={cx - marker.r}
          y1={cy}
          x2={cx + marker.r}
          y2={cy}
          stroke="var(--map-ink)"
          stroke-width={CAPTURE_BAND}
        />
        <circle cx={cx} cy={cy} r={marker.r * 0.32} fill="var(--map-ink)" />
      </g>
    );
  }
  if (marker.kind === 'portal') {
    return (
      <g data-hud-map-marker="portal">
        <circle
          cx={cx}
          cy={cy}
          r={marker.r}
          fill="none"
          stroke={MAP_PORTAL_STROKE}
          stroke-width={PORTAL_RING}
        />
      </g>
    );
  }
  return (
    <g data-hud-map-marker={marker.special}>
      <circle cx={cx} cy={cy} r={marker.r} fill={marker.fill} />
    </g>
  );
}

/**
 * The route header card: the `Map N · Biome` title over the floor's minimap. It
 * paints a `MapPanelView` and answers no press — the shipped header has nothing
 * interactive and the card carries no chip of its own — so `onCommand` stays the
 * seam for the strip that will own one (`[Task-139]`).
 */
export function MapPanel(props: MapPanelProps): JSX.Element {
  const { view } = props;
  const grid = view.grid;
  return (
    <div
      class="map"
      data-hud-panel="header"
      data-open={view.open ? 'true' : 'false'}
      hidden={!view.open}
      style={boxStyle(view.box)}
    >
      <div class="map__face">
        <span class="map__highlight" style={boxStyle(view.highlight)} />
        <span class="map__title" data-hud-map="title" style={boxStyle(view.title.box)}>
          {view.title.text}
        </span>
        <div class="map__grid" data-hud-map="grid" style={boxStyle(grid.box)}>
          <svg
            viewBox={`0 0 ${grid.width} ${grid.height}`}
            width={grid.width}
            height={grid.height}
            style={{
              left: `${grid.dx - grid.box.x}px`,
              top: `${grid.dy - grid.box.y}px`,
            }}
          >
            {view.links.map((link) => (
              <line
                key={`link-${link.from}-${link.to}`}
                data-hud-map-link={`${link.from}-${link.to}`}
                x1={link.x1 - grid.dx}
                y1={link.y1 - grid.dy}
                x2={link.x2 - grid.dx}
                y2={link.y2 - grid.dy}
                stroke="var(--map-link)"
                stroke-width={MAP_LINK_STROKE}
              />
            ))}
            {view.rooms.map((room) => (
              <rect
                key={`room-${room.id}`}
                data-hud-map-room={String(room.id)}
                data-current={room.current ? 'true' : undefined}
                x={room.box.x - grid.dx}
                y={room.box.y - grid.dy}
                width={room.box.w}
                height={room.box.h}
                fill={room.current ? MAP_CURRENT_FILL : 'var(--map-room-fill)'}
                stroke={room.current ? MAP_CURRENT_STROKE : 'var(--map-room-stroke)'}
                stroke-width={MAP_ROOM_STROKE}
              />
            ))}
            {view.rooms.map((room) =>
              room.openings.map((opening, index) => (
                <path
                  key={`opening-${room.id}-${index}`}
                  data-hud-map-opening={opening.kind}
                  d={opening.d}
                  stroke={openingStroke(opening.kind)}
                  stroke-width={MAP_OPENING_STROKE}
                />
              )),
            )}
            {view.rooms.map((room) =>
              room.markers.map((marker, index) => (
                <Marker key={`marker-${room.id}-${index}`} marker={marker} dx={grid.dx} dy={grid.dy} />
              )),
            )}
          </svg>
        </div>
        {view.empty === null ? null : (
          <span class="map__empty" data-hud-map="empty" style={boxStyle(view.empty.box)}>
            {view.empty.label}
          </span>
        )}
      </div>
    </div>
  );
}
