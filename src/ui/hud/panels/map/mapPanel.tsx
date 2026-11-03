import type { CSSProperties, JSX } from 'preact';
import type { HudCommand } from '../../commands';
import {
  MAP_CURRENT_FILL,
  MAP_CURRENT_STROKE,
  MAP_LINK_STROKE,
  MAP_UNVISITED_FILL,
  MAP_VISITED_FILL,
  type MapPanelView,
  type Rect,
  type RegionMarkerView,
} from './view';
import './map.css';

export type MapPanelProps = Readonly<{
  view: MapPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
}>;

function boxStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/** A node dot's fill: the node the run stands on, one it has entered, or one it has not. */
function nodeFill(node: RegionMarkerView): string {
  if (node.current) return MAP_CURRENT_FILL;
  return node.visited ? MAP_VISITED_FILL : MAP_UNVISITED_FILL;
}

/**
 * The region header card: the current settlement's name over the plan's node graph
 * (`docs/region-spec.md` §5). It paints a `MapPanelView` — every settlement from the
 * first frame, the visited ones marked, the current one ringed — and answers no press:
 * the map is not a menu yet, so `onCommand` stays the seam the travel task will use.
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
        {view.badges === null ? null : (
          <span class="map__badges" data-hud-badge-count style={boxStyle(view.badges.box)}>
            {view.badges.text}
          </span>
        )}
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
            {view.edges.map((edge) => (
              <line
                key={`edge-${edge.from}-${edge.to}`}
                data-hud-region-edge={`${edge.from}-${edge.to}`}
                x1={edge.x1 - grid.dx}
                y1={edge.y1 - grid.dy}
                x2={edge.x2 - grid.dx}
                y2={edge.y2 - grid.dy}
                stroke="var(--map-link)"
                stroke-width={MAP_LINK_STROKE}
              />
            ))}
            {view.nodes.map((node) => (
              <g
                key={`node-${node.key}`}
                data-hud-region-node={node.key}
                data-kind={node.kind}
                data-visited={node.visited ? 'true' : 'false'}
                data-current={node.current ? 'true' : 'false'}
              >
                <circle
                  cx={node.cx - grid.dx}
                  cy={node.cy - grid.dy}
                  r={node.r}
                  fill={nodeFill(node)}
                  stroke={node.current ? MAP_CURRENT_STROKE : 'none'}
                />
              </g>
            ))}
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
