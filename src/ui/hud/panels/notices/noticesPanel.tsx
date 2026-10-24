import type { CSSProperties, JSX } from 'preact';
import type { NoticesLine, NoticesPanelView } from './view';
import './notices.css';

export type NoticesPanelProps = Readonly<{
  view: NoticesPanelView;
}>;

function lineBox(line: NoticesLine | null): CSSProperties {
  const box = line === null ? { x: 0, y: 0, w: 0, h: 0 } : line.box;
  return { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` };
}

/**
 * The route's three passive cards (`03k` / `m03k`): the notice strip, the mission
 * line and the area-entry banner. Nothing here answers: the cards are
 * `pointer-events: none` and hold no handler, so the route keeps walking under them.
 * A card stays in the tree while it is down, hidden, so its rect is zero rather than
 * absent.
 */
export function NoticesPanel(props: NoticesPanelProps): JSX.Element {
  const { view } = props;
  return (
    <div class="notices" data-hud-panel="notices">
      <div
        class="notices__card notices__card--notice"
        data-hud-notice
        hidden={view.notice === null}
        style={lineBox(view.notice)}
      >
        <span class="notices__line">{view.notice?.text}</span>
      </div>
      <div
        class="notices__card notices__card--mission"
        data-hud-mission
        hidden={view.mission === null}
        style={lineBox(view.mission)}
      >
        <span class="notices__line">{view.mission?.text}</span>
      </div>
      <div
        class="notices__card notices__card--area"
        data-hud-area
        hidden={view.area === null}
        style={lineBox(view.area)}
      >
        <span class="notices__line">{view.area?.text}</span>
      </div>
    </div>
  );
}
