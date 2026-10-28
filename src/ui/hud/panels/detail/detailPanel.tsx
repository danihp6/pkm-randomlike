import type { CSSProperties, JSX } from 'preact';
import { MoveCategoryIcon, MoveTypeBadge, TypeBadge } from '../../kit';
import type { DetailIntent } from './mount';
import {
  DETAIL_CONTENT_LEFT,
  DETAIL_EVO_TITLE_TOP,
  DETAIL_GRID_TOP,
  DETAIL_HEADER_TOP,
  DETAIL_INFO_ROW,
  DETAIL_INFO_TOP,
  DETAIL_PAD_X,
  DETAIL_PAD_X_NARROW,
  DETAIL_PANEL_W,
  DETAIL_POOL_TOP,
  DETAIL_SEARCH_TOP,
  DETAIL_TYPE_TOP,
  type DetailEvolutionView,
  type DetailMoveSlotView,
  type DetailPanelView,
  type DetailPoolRowView,
  type DetailStatView,
  type Rect,
} from './view';
import { EVO_PAD_X, EVO_PORTRAIT, EVO_ROW_H, levelColumnWidth } from './evolution';
import './detail.css';

export type DetailPanelProps = Readonly<{
  view: DetailPanelView;
  onIntent?: ((intent: DetailIntent) => void) | undefined;
}>;

/** The board's 26 px badge at the card's top-left corner, and the level column's inset. */
const CHIP = 26;
const LEVEL_W = 72;
/** The card's own left inset for its texts: past the chip. */
const HINT_TOP = DETAIL_TYPE_TOP + 24;

/** An absolutely positioned box from a panel-relative rect. */
function box(rect: Rect, origin?: Rect): CSSProperties {
  const x = origin === undefined ? rect.x : rect.x - origin.x;
  const y = origin === undefined ? rect.y : rect.y - origin.y;
  return { left: `${x}px`, top: `${y}px`, width: `${rect.w}px`, height: `${rect.h}px` };
}

/** The card itself: fixed at the view's viewport box, with its lateral padding as a token. */
function cardStyle(view: DetailPanelView): CSSProperties {
  const style: Record<string, string> = {
    left: `${view.box.x}px`,
    top: `${view.box.y}px`,
    width: `${view.box.w}px`,
    height: `${view.box.h}px`,
    '--detail-pad-x': `${padOf(view)}px`,
  };
  return style as CSSProperties;
}

/** The card's lateral padding: the narrow card drops it, exactly as `hudMetrics` does. */
function padOf(view: DetailPanelView): number {
  return view.box.w < DETAIL_PANEL_W ? DETAIL_PAD_X_NARROW : DETAIL_PAD_X;
}

/** Captures the keyboard for a text field, so the route's quick keys never fire while typing. */
function holdKeys(event: { stopPropagation(): void }): void {
  event.stopPropagation();
}

function StatRow(props: Readonly<{ stat: DetailStatView }>): JSX.Element {
  const { stat } = props;
  return (
    <div
      class="detail__stat"
      data-hud-detail-stat={stat.stat}
      data-effect={stat.effect}
      style={box(stat.box)}
    >
      <span class="detail__stat-label" style={box(stat.labelBox, stat.box)}>
        {stat.label}
      </span>
      <span class="detail__stat-value" style={box(stat.valueBox, stat.box)}>
        {stat.value}
      </span>
    </div>
  );
}

function MoveSlot(
  props: Readonly<{
    slot: DetailMoveSlotView;
    send: (intent: DetailIntent) => void;
  }>,
): JSX.Element {
  const { slot, send } = props;
  const info: Rect = {
    x: slot.box.x + slot.info.x,
    y: slot.box.y + slot.info.y,
    w: slot.info.w,
    h: slot.info.h,
  };
  return (
    <>
      <button
        type="button"
        class="detail__slot kit-row--interactive"
        data-hud-detail-slot={String(slot.index)}
        data-empty={slot.moveId === null ? 'true' : undefined}
        data-selected={slot.selected ? 'true' : undefined}
        aria-pressed={slot.selected}
        aria-label={slot.moveId === null ? undefined : `${slot.name} ${slot.pp}`}
        disabled={!slot.enabled}
        style={box(slot.box)}
        onClick={(event) => {
          if (event.detail > 1) {
            send(
              slot.moveId === null
                ? { type: 'drop', slot: slot.index }
                : { type: 'grab', index: slot.index },
            );
            return;
          }
          send({ type: 'cursor', index: slot.index });
        }}
      >
        {slot.moveId === null ? null : (
          <>
            <span class="detail__slot-type" style={box(slot.typeBox, slot.box)}>
              <MoveTypeBadge type={slot.type} />
            </span>
            <span class="detail__slot-category" style={box(slot.categoryBox, slot.box)}>
              <MoveCategoryIcon category={slot.category} />
            </span>
            <span class="detail__slot-name" style={box(slot.nameBox, slot.box)}>
              {slot.name}
            </span>
            <span class="detail__slot-pp" style={box(slot.ppBox, slot.box)}>
              {slot.pp}
            </span>
            <span class="detail__slot-pwr" style={box(slot.statsBox, slot.box)}>
              {slot.power}
            </span>
            <span class="detail__slot-acc" style={box(slot.statsBox, slot.box)}>
              {slot.accuracy}
            </span>
          </>
        )}
      </button>
      {slot.moveId === null ? null : (
        <button
          type="button"
          class="detail__slot-info kit-row--interactive"
          data-hud-detail-info={String(slot.index)}
          aria-label={slot.name}
          style={box(info)}
          onClick={() => send({ type: 'info', index: slot.index })}
        >
          i
        </button>
      )}
    </>
  );
}

function PoolRow(
  props: Readonly<{ row: DetailPoolRowView; send: (intent: DetailIntent) => void }>,
): JSX.Element {
  const { row, send } = props;
  return (
    <button
      type="button"
      class="detail__pool-row kit-row--interactive"
      data-hud-detail-pool={String(row.index)}
      data-hud-detail-pool-move={row.moveId}
      data-selected={row.selected ? 'true' : undefined}
      aria-pressed={row.selected}
      disabled={!row.enabled}
      style={box(row.box)}
      onPointerEnter={() => send({ type: 'poolCursor', index: row.index })}
      onFocus={() => send({ type: 'poolCursor', index: row.index })}
      onClick={(event) => {
        event.stopPropagation();
        send({ type: 'equip', moveId: row.moveId });
      }}
    >
      <span class="detail__pool-name">{row.name}</span>
      <span class="detail__pool-type">
        <MoveTypeBadge type={row.type} />
      </span>
      <span class="detail__pool-source">{row.source}</span>
    </button>
  );
}

/**
 * The evolution graph as SVG: one `<path>` per edge and one `<text>` per known level,
 * with the names as HTML over the graph so a press anywhere on a ready row lands on
 * its `<g role="button">`. The rows' paint (accent current, positive ready) is CSS.
 */
function Evolution(
  props: Readonly<{
    evolution: DetailEvolutionView;
    hint: string;
    send: (intent: DetailIntent) => void;
  }>,
): JSX.Element {
  const { evolution, hint, send } = props;
  const width = evolution.box.w;
  const height = evolution.box.h;
  const ready = evolution.rows.some((row) => row.ready);
  return (
    <div class="detail__evolution" data-hud-detail="evolution">
      <span
        class="detail__section"
        style={box({ x: evolution.box.x, y: DETAIL_EVO_TITLE_TOP, w: width, h: 20 })}
      >
        {evolution.title}
      </span>
      {ready ? (
        <span
          class="detail__hint detail__hint--evolve"
          style={box({ x: evolution.box.x, y: DETAIL_EVO_TITLE_TOP, w: width, h: 20 })}
        >
          {hint}
        </span>
      ) : null}
      <svg
        class="detail__evo"
        data-hud-detail-evo
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={box(evolution.box)}
      >
        {evolution.edges.map((edge) => (
          <path key={`${edge.fromRow}-${edge.toRow}`} class="detail__evo-edge" d={edge.d} />
        ))}
        {evolution.rows.map((row) => (
          <g
            key={row.id}
            data-hud-detail-evo-row={String(row.row)}
            data-current={row.current ? 'true' : undefined}
            data-hud-detail-evo-ready={row.ready ? 'true' : undefined}
            role={row.ready ? 'button' : undefined}
            tabindex={row.ready ? 0 : undefined}
            aria-label={row.ready ? row.name : undefined}
            onClick={row.ready ? () => send({ type: 'evolve', into: row.id }) : undefined}
            onKeyDown={
              row.ready
                ? (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    send({ type: 'evolve', into: row.id });
                  }
                : undefined
            }
          >
            <rect
              class="detail__evo-portrait"
              x={row.x}
              y={row.y + (EVO_ROW_H - EVO_PORTRAIT) / 2}
              width={EVO_PORTRAIT}
              height={EVO_PORTRAIT}
              rx={4}
            />
            <rect class="detail__evo-hit" x={0} y={row.y} width={width} height={EVO_ROW_H} />
            {row.level === null ? null : (
              <text class="detail__evo-level" x={width - EVO_PAD_X} y={row.y + EVO_ROW_H / 2}>
                {row.level}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div class="detail__evo-names" style={box(evolution.box)} aria-hidden="true">
        {evolution.rows.map((row) => (
          <span
            key={row.id}
            class="detail__evo-name"
            data-evo-current={row.current ? 'true' : undefined}
            data-evo-ready={row.ready ? 'true' : undefined}
            style={{
              left: `${row.x + EVO_PORTRAIT + 6}px`,
              top: `${row.y + 4}px`,
              right: `${levelColumnWidth(row.level)}px`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {row.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The member detail card: the header over the STATS / MOVES tabs, the six stats, the
 * evolution graph, the 2x2 move grid, the search field with its learnset pool and the
 * rename field. It paints a `DetailPanelView` and answers in `DetailIntent`s; the
 * scene module owns the run, the panel record and every write.
 */
export function DetailPanel(props: DetailPanelProps): JSX.Element {
  const { view } = props;
  const send = (intent: DetailIntent): void => props.onIntent?.(intent);
  const padX = padOf(view);
  const innerW = view.box.w - padX * 2;
  const active = view.tabs.find((tab) => tab.active)?.tab ?? 'stats';
  const stats = active === 'stats';
  const moves = active === 'moves';

  return (
    <div
      class="detail"
      data-hud-panel="detail"
      data-open={view.open ? 'true' : 'false'}
      hidden={!view.open}
      style={cardStyle(view)}
    >
      <div class="detail__body">
        <span class="detail__highlight" data-hud-detail="highlight" style={box(view.highlight)} />
        <span
          class="detail__chip"
          data-hud-detail="chip"
          aria-hidden="true"
          style={box({ x: 0, y: 0, w: CHIP, h: CHIP })}
        />

        <div
          class="detail__header"
          style={box({
            x: DETAIL_CONTENT_LEFT,
            y: DETAIL_HEADER_TOP,
            w: view.box.w - padX - LEVEL_W - DETAIL_CONTENT_LEFT,
            h: 20,
          })}
        >
          <span class="detail__name" data-hud-detail-name>
            {view.name}
          </span>
          {view.statusLabel === null ? null : <span class="detail__status">{view.statusLabel}</span>}
        </div>
        <span class="detail__level" style={{ right: `${padX}px`, top: `${DETAIL_HEADER_TOP}px` }}>
          {view.level}
        </span>

        {view.types.map((type) => (
          <span key={type.type} class="detail__type" style={box(type.box)}>
            <TypeBadge type={type.type} />
          </span>
        ))}

        {stats ? (
          <label class="detail__nickname-field" style={box(view.nickname.box)} title={view.hints.name}>
            <span class="detail__visually-hidden">{view.nickname.placeholder}</span>
            <input
              type="text"
              class="detail__nickname"
              data-hud-detail="nickname"
              value={view.nickname.editing ? undefined : view.nickname.value}
              placeholder={view.nickname.placeholder}
              aria-label={view.nickname.placeholder}
              spellcheck={false}
              autocomplete="off"
              onFocus={() => {
                if (!view.nickname.editing) send({ type: 'nickname', begin: true });
              }}
              onBlur={() => {
                if (view.nickname.editing) send({ type: 'nickname', cancel: true });
              }}
              onKeyDown={(event) => {
                holdKeys(event);
                if (event.key === 'Enter') {
                  event.preventDefault();
                  send({ type: 'nickname', commit: event.currentTarget.value });
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  send({ type: 'nickname', cancel: true });
                }
              }}
            />
          </label>
        ) : null}

        <span
          class="detail__hints"
          style={box({
            x: DETAIL_CONTENT_LEFT,
            y: HINT_TOP,
            w: view.box.w - padX - DETAIL_CONTENT_LEFT,
            h: 12,
          })}
        >
          {view.hints.name}
        </span>

        <div class="detail__tabs" data-hud-detail="tabs">
          {view.tabs.map((tab) => (
            <button
              key={tab.tab}
              type="button"
              class="detail__tab kit-row--interactive"
              data-hud-detail-tab={tab.tab}
              data-active={tab.active ? 'true' : undefined}
              aria-pressed={tab.active}
              style={box(tab.box)}
              onClick={() => send({ type: 'tab', tab: tab.tab })}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div class="detail__stats" data-hud-detail="stats" hidden={!stats}>
          {view.stats.map((stat) => (
            <StatRow key={stat.stat} stat={stat} />
          ))}
        </div>

        {stats ? (
          <div
            class="detail__info"
            style={box({ x: padX, y: DETAIL_INFO_TOP, w: innerW, h: DETAIL_INFO_ROW * 2 })}
          >
            <span class="detail__info-cell detail__info-nature">{view.nature}</span>
            <span class="detail__info-cell detail__info-held">{view.held}</span>
            <span class="detail__info-cell detail__info-ability">{view.ability}</span>
            {view.abilityInfo === null ? null : (
              <button
                type="button"
                class="detail__info-button kit-row--interactive"
                data-hud-detail="ability-info"
                data-pinned={view.abilityInfo.pinned ? 'true' : undefined}
                aria-pressed={view.abilityInfo.pinned}
                aria-label={view.abilityDesc ?? view.ability}
                style={box(view.abilityInfo.box, {
                  x: padX,
                  y: DETAIL_INFO_TOP,
                  w: innerW,
                  h: DETAIL_INFO_ROW * 2,
                })}
                onClick={() => send({ type: 'abilityInfo', open: !(view.abilityInfo?.pinned === true) })}
              >
                i
              </button>
            )}
            <span class="detail__info-cell detail__info-caught">{view.caught}</span>
          </div>
        ) : null}

        {view.evolution === null ? null : (
          <Evolution evolution={view.evolution} hint={view.hints.evolve} send={send} />
        )}

        {view.emptyMoves === null ? null : (
          <p class="detail__empty" style={box({ x: padX, y: DETAIL_GRID_TOP + 60, w: innerW, h: 13 })}>
            {view.emptyMoves}
          </p>
        )}

        <div class="detail__moves" data-hud-detail="moves" hidden={!moves}>
          {view.moves.map((slot) => (
            <MoveSlot key={slot.index} slot={slot} send={send} />
          ))}
        </div>

        {moves ? (
          <input
            type="text"
            class="detail__search"
            data-hud-detail="search"
            value={view.search.value}
            placeholder={view.search.placeholder}
            aria-label={view.search.placeholder}
            spellcheck={false}
            autocomplete="off"
            style={box(view.search.box)}
            onInput={(event) => send({ type: 'search', query: event.currentTarget.value })}
            onKeyDown={holdKeys}
          />
        ) : null}

        {moves ? (
          <>
            <button
              type="button"
              class="detail__nav kit-row--interactive"
              data-hud-detail-nav="prev"
              aria-label={view.search.placeholder}
              style={box({
                x: view.search.box.x + view.search.box.w + 26,
                y: DETAIL_SEARCH_TOP,
                w: 20,
                h: 24,
              })}
              onClick={() => send({ type: 'page', delta: -1 })}
            >
              {'<'}
            </button>
            <button
              type="button"
              class="detail__nav kit-row--interactive"
              data-hud-detail-nav="next"
              aria-label={view.search.placeholder}
              style={box({
                x: view.search.box.x + view.search.box.w + 50,
                y: DETAIL_SEARCH_TOP,
                w: 20,
                h: 24,
              })}
              onClick={() => send({ type: 'page', delta: 1 })}
            >
              {'>'}
            </button>
            <div
              class="detail__pool"
              data-hud-detail="pool"
              style={box({ x: 0, y: DETAIL_POOL_TOP, w: view.box.w, h: view.box.h - DETAIL_POOL_TOP })}
              onClick={(event) => {
                if (event.detail > 1) send({ type: 'unequip', slot: -1 });
              }}
            >
              {view.pool.map((row) => (
                <PoolRow key={row.moveId} row={row} send={send} />
              ))}
              {view.emptyPool === null ? null : (
                <span class="detail__empty" style={box({ x: padX, y: 40, w: innerW, h: 13 })}>
                  {view.emptyPool}
                </span>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
