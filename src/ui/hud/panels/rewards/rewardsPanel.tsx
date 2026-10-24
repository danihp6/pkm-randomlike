import type { CSSProperties, JSX } from 'preact';
import type { RewardsIntent } from './mount';
import {
  REWARDS_SHEET_HANDLE,
  rewardsNarrow,
  rewardsRowBand,
  type Rect,
  type RewardRowView,
  type RewardsPanelView,
} from './view';
import './rewards.css';

export type RewardsPanelProps = Readonly<{
  view: RewardsPanelView;
  onIntent?: ((intent: RewardsIntent) => void) | undefined;
}>;

function box(rect: Rect, origin?: Rect): CSSProperties {
  const x = origin === undefined ? rect.x : rect.x - origin.x;
  const y = origin === undefined ? rect.y : rect.y - origin.y;
  return { left: `${x}px`, top: `${y}px`, width: `${rect.w}px`, height: `${rect.h}px` };
}

function sprite(icon: Readonly<{ url: string; size: number; x: number; y: number }>): CSSProperties {
  return {
    width: `${icon.size}px`,
    height: `${icon.size}px`,
    backgroundImage: `url("${icon.url}")`,
    backgroundPosition: `-${icon.x}px -${icon.y}px`,
  };
}

/**
 * One offer. An item row draws its icon, its name and its description; a Pokémon
 * row draws its `STAT · Nature` label and nothing else, so an unidentified option
 * cannot leak a name, an icon or a description.
 */
function RewardRow(
  props: Readonly<{
    row: RewardRowView;
    band: Rect;
    send: (intent: RewardsIntent) => void;
  }>,
): JSX.Element {
  const { row, band, send } = props;
  return (
    <button
      type="button"
      class="rewards__row"
      data-hud-reward-row={String(row.index)}
      data-kind={row.kind}
      data-armed={row.armed ? 'true' : undefined}
      aria-pressed={row.armed}
      style={box(row.box, band)}
      onClick={() => send({ type: 'arm', index: row.index })}
    >
      {row.icon === null ? null : (
        <span class="rewards__icon" data-hud-reward-icon style={sprite(row.icon)} />
      )}
      {row.kind === 'item' ? (
        <span class="rewards__name" data-hud-rewards-name>
          {row.label}
        </span>
      ) : (
        <span class="rewards__label">{row.label}</span>
      )}
      {row.kind === 'item' ? <span class="rewards__desc">{row.description}</span> : null}
    </button>
  );
}

/**
 * The mini-boss reward card: the title, the "choose one" line, the drawn ✕ and one
 * pressable row per offer — the board's desktop card above `REWARDS_NARROW`, its
 * phone sheet below it. It paints the view and answers in `arm` / `commit` /
 * `close` intents; the scene module owns the rows, the arm and the commit.
 */
export function RewardsPanel(props: RewardsPanelProps): JSX.Element {
  const { view } = props;
  const send = (intent: RewardsIntent): void => props.onIntent?.(intent);
  const sheet = rewardsNarrow(view.box);
  const band = rewardsRowBand(view);
  const last = view.rows[view.rows.length - 1];
  const contentH = last === undefined ? 0 : last.box.y + last.box.h - band.y;
  const handle: Rect = {
    x: Math.round((view.box.w - REWARDS_SHEET_HANDLE.w) / 2),
    y: REWARDS_SHEET_HANDLE.y,
    w: REWARDS_SHEET_HANDLE.w,
    h: REWARDS_SHEET_HANDLE.h,
  };

  return (
    <div
      class="rewards"
      data-hud-panel="rewards"
      data-layout={sheet ? 'sheet' : 'card'}
      data-open={view.open ? 'true' : 'false'}
      hidden={!view.open}
      style={box(view.box)}
    >
      <div class="rewards__body">
        {sheet ? <span class="rewards__handle" style={box(handle)} /> : null}
        <span class="rewards__highlight" style={box(view.highlight)} />
        <span class="rewards__title" data-hud-rewards="title" style={box(view.title.box)}>
          {view.title.text}
        </span>
        <span class="rewards__choose" data-hud-rewards="choose" style={box(view.choose.box)}>
          {view.choose.text}
        </span>
        <button
          type="button"
          class="rewards__close"
          data-hud-rewards="close"
          aria-label={view.close.label}
          style={box(view.close.box)}
          onClick={() => send({ type: 'close' })}
        >
          {view.close.label}
        </button>
        <div class="rewards__list" data-hud-rewards="list" style={box(band)}>
          <span class="rewards__spacer" style={{ height: `${contentH}px` }} />
          {view.rows.map((row) => (
            <RewardRow key={row.index} row={row} band={band} send={send} />
          ))}
        </div>
      </div>
    </div>
  );
}
