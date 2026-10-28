import type { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { HudPanelId, HudPanelLayout } from '../../../../data/hudLayout';
import { clampPanelOffset, type FrameVec } from './panelFrameView';
import { STRIP_CHIP_LETTERS, STRIP_CHIP_SIZE, type Rect, type Viewport } from './view';
import './panelFrame.css';

/**
 * The frame every route card hangs in (`D49` amended): the 26 px chip at its own
 * top-left that collapses it and drags it, the offset clamped to the window, and no
 * second chip anywhere — a collapsed card is the strip's badge, so the two layers
 * never draw the same object twice.
 *
 * The root paints no position of its own: the card inside keeps its own absolute box
 * and the frame only translates the whole thing, so no panel's view math changes.
 */

export type PanelFrameProps = Readonly<{
  id: HudPanelId;
  open: boolean;
  layout: HudPanelLayout;
  label: string | null;
  letter: string;
  onToggle(): void;
  onLayout(next: HudPanelLayout): void;
  children: ComponentChildren;
}>;

/** What the frame reads from the scene: the live record and the two callbacks. */
export type PanelFrameCallbacks = Pick<
  PanelFrameProps,
  'id' | 'open' | 'layout' | 'onToggle' | 'onLayout'
>;

/**
 * What a mount hands the frame: the scene's record plus the chip's accessible name.
 * Both are read on every paint and every commit, so a collapse, a rebind and the
 * saved offset all reach the frame without the mount rebuilding it.
 */
export type PanelFrameMount = Readonly<{
  host: PanelFrameCallbacks;
  label: string | null;
}>;

/** The chip's letter: the strip's own badge letter, and none on the detail card. */
function chipLetter(id: HudPanelId): string {
  return id === 'detail' ? '' : STRIP_CHIP_LETTERS[id];
}

/** The frame's props for one card, resolved at paint time from the live record. */
export function panelFrameProps(
  frame: PanelFrameMount,
  open: boolean,
): Omit<PanelFrameProps, 'children'> {
  return {
    id: frame.host.id,
    open: open && frame.host.open,
    layout: frame.host.layout,
    label: frame.label,
    letter: chipLetter(frame.host.id),
    onToggle: frame.host.onToggle,
    onLayout: frame.host.onLayout,
  };
}

/** A press that travels less than this many pixels is a click, not a drag. */
const DRAG_SLOP = 3;

const ZERO: FrameVec = { dx: 0, dy: 0 };

/** The card's default rect: the frame's first element child, without the applied offset. */
function defaultRect(child: Element | null, layout: HudPanelLayout): Rect | null {
  if (child === null || typeof child.getBoundingClientRect !== 'function') return null;
  const rect = child.getBoundingClientRect();
  return { x: rect.left - layout.dx, y: rect.top - layout.dy, w: rect.width, h: rect.height };
}

/** The card's default corner, read from layout so the root's transform plays no part. */
function defaultOrigin(child: Element | null): FrameVec | null {
  if (!(child instanceof HTMLElement)) return null;
  return { dx: child.offsetLeft, dy: child.offsetTop };
}

/** The window's own size, or nothing headless. */
function viewportOf(): Viewport {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

type Gesture = {
  pointerId: number;
  x: number;
  y: number;
  box: Rect | null;
  /** The offset this gesture has painted so far: the commit reads it, never a render. */
  live: FrameVec | null;
  moved: boolean;
};

export function PanelFrame(props: PanelFrameProps): JSX.Element {
  const { id, open, layout, label, letter } = props;
  const root = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressed = useRef(false);
  const [drag, setDrag] = useState<FrameVec | null>(null);
  const [origin, setOrigin] = useState<FrameVec>(ZERO);

  // The chip rides on the card's own corner, which only the card's own box knows.
  useLayoutEffect(() => {
    const next = defaultOrigin(root.current?.firstElementChild ?? null);
    if (next === null) return;
    if (next.dx !== origin.dx || next.dy !== origin.dy) setOrigin(next);
  });

  const dx = drag === null ? layout.dx : drag.dx;
  const dy = drag === null ? layout.dy : drag.dy;

  const onPointerDown = (event: PointerEvent): void => {
    gesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      box: defaultRect(root.current?.firstElementChild ?? null, layout),
      live: null,
      moved: false,
    };
    try {
      chip.current?.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer id has no capture: the drag still paints, it just stops
      // at the pointer instead of following it off the chip.
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    const active = gesture.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    const mx = event.clientX - active.x;
    const my = event.clientY - active.y;
    if (!active.moved && Math.abs(mx) < DRAG_SLOP && Math.abs(my) < DRAG_SLOP) return;
    active.moved = true;
    active.live = { dx: layout.dx + mx, dy: layout.dy + my };
    setDrag(active.live);
  };

  const onPointerUp = (event: PointerEvent): void => {
    const active = gesture.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    gesture.current = null;
    try {
      chip.current?.releasePointerCapture(event.pointerId);
    } catch {
      // Nothing was captured, so releasing is the no-op it already is.
    }
    const live = active.live;
    setDrag(null);
    // The gesture owns the click that follows it: a press toggles here, a drag does not.
    suppressed.current = true;
    if (!active.moved) {
      props.onToggle();
      return;
    }
    if (live === null || active.box === null) return;
    const next = clampPanelOffset(live, active.box, viewportOf());
    props.onLayout({ ...layout, dx: next.dx, dy: next.dy });
  };

  const onPointerCancel = (): void => {
    gesture.current = null;
    setDrag(null);
    suppressed.current = true;
  };

  const onClick = (event: MouseEvent): void => {
    const swallowed = suppressed.current;
    suppressed.current = false;
    // Only the click a real gesture produces is the gesture's own: a keyboard press
    // and a programmatic press report `detail === 0` and always toggle.
    if (swallowed && event.detail > 0) return;
    props.onToggle();
  };

  return (
    <div
      ref={root}
      class="hud-frame"
      data-hud-frame={id}
      hidden={!open}
      style={{ transform: `translate(${dx}px, ${dy}px)` }}
    >
      {props.children}
      {open && label !== null ? (
        <button
          type="button"
          ref={chip}
          class="hud-frame__chip"
          data-hud-frame-chip={id}
          aria-label={label}
          style={{
            left: `${origin.dx}px`,
            top: `${origin.dy}px`,
            width: `${STRIP_CHIP_SIZE}px`,
            height: `${STRIP_CHIP_SIZE}px`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={onClick}
        >
          <span class="hud-frame__letter" data-hud-frame-letter>
            {letter}
          </span>
        </button>
      ) : null}
    </div>
  );
}
