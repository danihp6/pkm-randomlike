import type { CSSProperties, JSX } from 'preact';
import { t } from '../../../../i18n';
import { typeBadgeTone } from '../../kit';
import type { TradeIntent } from './mount';
import type { Rect, TradePanelView, TradePartyTile, TradePcTile } from './view';
import './trade.css';

export type TradePanelProps = Readonly<{
  view: TradePanelView;
  onIntent?: ((intent: TradeIntent) => void) | undefined;
}>;

type ResultView = NonNullable<TradePanelView['result']>;
type Line = Readonly<{ text: string; box: Rect }>;

/** An absolutely positioned box from a panel-relative rect. */
function box(rect: Rect, origin?: Rect): CSSProperties {
  const x = origin === undefined ? rect.x : rect.x - origin.x;
  const y = origin === undefined ? rect.y : rect.y - origin.y;
  return { left: `${x}px`, top: `${y}px`, width: `${rect.w}px`, height: `${rect.h}px` };
}

/**
 * The placeholder-cell treatment the party panel paints: the dex frame rides on the
 * cell as `data-frame`, so a packed atlas can colour it without this panel reading
 * the dex or its art.
 */
function portrait(rect: Rect, frame: number | null, extra?: string): JSX.Element {
  return (
    <span
      class={extra === undefined ? 'trade__portrait' : `trade__portrait ${extra}`}
      data-hud-trade-portrait
      data-frame={frame === null ? undefined : String(frame)}
      aria-hidden="true"
      style={box(rect)}
    />
  );
}

/** The portrait cell inside a tile: the frame's own icon square, centred by CSS. */
function cellPortrait(frame: number | null, extra: string): JSX.Element {
  return (
    <span
      class={`trade__portrait ${extra}`}
      data-hud-trade-portrait
      data-frame={frame === null ? undefined : String(frame)}
      aria-hidden="true"
    />
  );
}

function PartyTile(
  props: Readonly<{ tile: TradePartyTile; index: number; send: (intent: TradeIntent) => void }>,
): JSX.Element {
  const { tile, index, send } = props;
  return (
    <button
      type="button"
      class="trade__tile"
      data-hud-trade-tile={tile.memberId}
      data-selected={tile.selected ? 'true' : undefined}
      aria-pressed={tile.selected}
      aria-label={t('party.rowLabel', { name: tile.name, level: tile.level, status: '' })}
      style={box(tile.box)}
      onClick={() => send({ type: 'pick', index })}
    >
      {cellPortrait(tile.frame, 'trade__portrait--tile')}
      <span class="trade__tile-name">{tile.name}</span>
      <span class="trade__tile-level">{t('common.level', { level: tile.level })}</span>
    </button>
  );
}

function PcTile(props: Readonly<{ cell: TradePcTile }>): JSX.Element {
  const { cell } = props;
  return (
    <div class="trade__cell" data-hud-trade-pc={cell.memberId} title={cell.name} style={box(cell.box)}>
      {cellPortrait(cell.frame, 'trade__portrait--cell')}
      <span class="trade__cell-name">{cell.name}</span>
    </div>
  );
}

function PickCard(
  props: Readonly<{ view: TradePanelView; send: (intent: TradeIntent) => void }>,
): JSX.Element {
  const { view, send } = props;
  const give = view.give;
  return (
    <>
      <span class="trade__highlight" style={box(view.highlight)} aria-hidden="true" />
      <span class="trade__title" data-hud-trade="title" style={box(view.title.box)}>
        {view.title.text}
      </span>
      <span class="trade__meta" data-hud-trade="meta" style={box(view.meta.box)}>
        {view.meta.text}
      </span>
      <span class="trade__message" data-hud-trade="message" style={box(view.message.box)}>
        {view.message.text}
      </span>
      <span class="trade__label" data-hud-trade="party-label" style={box(view.partyLabel.box)}>
        {view.partyLabel.text}
      </span>
      <span class="trade__label" data-hud-trade="pc-label" style={box(view.pcLabel.box)}>
        {view.pcLabel.text}
      </span>
      {view.party.map((tile, index) => (
        <PartyTile key={tile.memberId} tile={tile} index={index} send={send} />
      ))}
      {view.pc.map((cell) => (
        <PcTile key={cell.memberId} cell={cell} />
      ))}
      {give === null ? null : (
        <button
          type="button"
          class="trade__give"
          data-hud-trade="give"
          disabled={!give.enabled}
          aria-disabled={give.enabled ? undefined : 'true'}
          style={box(give.box)}
          onClick={() => send({ type: 'give' })}
        >
          {give.label}
        </button>
      )}
    </>
  );
}

function TypeChip(props: Readonly<{ chip: Readonly<{ id: string; box: Rect }> }>): JSX.Element {
  const { chip } = props;
  return (
    <span
      class="trade__type"
      data-hud-trade-type={chip.id}
      title={chip.id}
      aria-label={chip.id}
      style={{ ...box(chip.box), background: typeBadgeTone(chip.id).fill }}
    />
  );
}

function ResultCard(
  props: Readonly<{
    result: ResultView;
    meta: Line;
    send: (intent: TradeIntent) => void;
  }>,
): JSX.Element {
  const { result, meta } = props;
  return (
    <section class="trade__result" data-hud-trade="result" style={box(result.card)}>
      <span class="trade__highlight" style={box(result.highlight)} aria-hidden="true" />
      <span class="trade__title" data-hud-trade="title" style={box(result.titleBox)}>
        {result.title}
      </span>
      <span class="trade__meta" data-hud-trade="meta" style={box(meta.box, result.card)}>
        {meta.text}
      </span>
      <span class="trade__kicker" data-hud-trade="kicker" style={box(result.kickerBox)}>
        {result.kicker}
      </span>
      {portrait(result.portrait, result.frame, 'trade__portrait--result')}
      {result.type === null ? null : <TypeChip chip={result.type} />}
      <span class="trade__name" data-hud-trade="name" style={box(result.nameBox)}>
        {result.name}
      </span>
      <span class="trade__added" data-hud-trade="added" style={box(result.addedBox)}>
        {result.added}
      </span>
      <button
        type="button"
        class="trade__give"
        data-hud-trade="close"
        style={box(result.button.box)}
        onClick={() => props.send({ type: 'close' })}
      >
        {result.button.label}
      </button>
    </section>
  );
}

/**
 * The trade card (`D49`): the board's `03i` pick sheet and `03j` result card as one
 * panel with two states. It paints the view and answers in `TradeIntent`s; the scene
 * module owns the run and the rule, so a press can only ever ask.
 */
export function TradePanel(props: TradePanelProps): JSX.Element {
  const { view } = props;
  const send = (intent: TradeIntent): void => props.onIntent?.(intent);
  const result = view.kind === 'result' ? view.result : null;
  return (
    <div
      class="trade"
      data-hud-panel="trade"
      data-kind={result === null ? 'pick' : 'result'}
      data-open={view.open ? 'true' : 'false'}
      hidden={!view.open}
      style={box(view.box)}
    >
      <span class="trade__scrim" aria-hidden="true" />
      <div class="trade__face">
        {result === null ? <PickCard view={view} send={send} /> : null}
        {result === null ? (
          <button
            type="button"
            class="trade__close"
            data-hud-trade="dismiss"
            aria-label={view.close.label}
            style={box(view.close.box)}
            onClick={() => send({ type: 'close' })}
          >
            {view.close.label}
          </button>
        ) : (
          <ResultCard result={result} meta={view.meta} send={send} />
        )}
      </div>
    </div>
  );
}
