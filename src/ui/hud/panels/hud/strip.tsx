import type { CSSProperties, JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import type { HudPanelId, HudPanelLayout } from '../../../../data/hudLayout';
import type { HudCommand } from '../../commands';
import { badgeDrag, badgeLayout, type BadgeDragResult, type BadgeDragStart } from './drag';
import { STRIP_CHIP_SIZE, type StripChip, type StripView, type Viewport } from './view';
import './strip.css';

/** What the strip sends back: its panel intents and the layout a badge drag commits. */
export type HudStripCallbacks = Readonly<{
  onCommand?: ((command: HudCommand) => void) | undefined;
  /** The same writer a card's own chip uses: one panel's `{ dx, dy, collapsed }`. */
  onLayout?: ((id: HudPanelId, next: HudPanelLayout) => void) | undefined;
}>;

export type HudStripProps = Readonly<{ view: StripView }> & HudStripCallbacks;

/** The badge's box plus the live translate a gesture is painting over it. */
function boxStyle(chip: StripChip, live: BadgeDragResult | null): CSSProperties {
  const dx = live === null ? chip.dx : live.dx;
  const dy = live === null ? chip.dy : live.dy;
  return {
    left: `${chip.box.x}px`,
    top: `${chip.box.y}px`,
    width: `${chip.box.w}px`,
    height: `${chip.box.h}px`,
    transform: `translate(${dx - chip.dx}px, ${dy - chip.dy}px)`,
  };
}

type BadgeGesture = {
  pointerId: number;
  start: BadgeDragStart;
  /** What this gesture has painted so far: the commit reads it, never a render. */
  live: BadgeDragResult | null;
};

/**
 * One edge chip: the panel's initial, its live quick key in the accessible label,
 * and the card's own gesture — a press under the slop toggles the panel exactly as
 * its quick key does, a press that travels drags the badge and commits the same
 * `hudLayout` offset the open card writes. The 44 px hit overlay is the `::after` in
 * `strip.css`, so a thumb finds a 26 px badge.
 */
function StripChipButton(
  props: Readonly<{ chip: StripChip; viewport: Viewport }> & HudStripCallbacks,
): JSX.Element {
  const { chip, viewport, onCommand, onLayout } = props;
  const button = useRef<HTMLButtonElement>(null);
  const gesture = useRef<BadgeGesture | null>(null);
  const suppressed = useRef(false);
  const [live, setLive] = useState<BadgeDragResult | null>(null);

  const onPointerDown = (event: PointerEvent): void => {
    gesture.current = {
      pointerId: event.pointerId,
      start: {
        pointerX: event.clientX,
        pointerY: event.clientY,
        dx: chip.dx,
        dy: chip.dy,
        originX: chip.box.x - chip.dx,
        originY: chip.box.y - chip.dy,
      },
      live: null,
    };
    try {
      button.current?.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer id has no capture: the drag still paints, it just stops
      // at the pointer instead of following it off the badge.
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    const active = gesture.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    const next = badgeDrag(
      active.start,
      { x: event.clientX, y: event.clientY },
      viewport,
      STRIP_CHIP_SIZE,
    );
    if (!next.moved) return;
    active.live = next;
    setLive(next);
  };

  const onPointerUp = (event: PointerEvent): void => {
    const active = gesture.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    gesture.current = null;
    try {
      button.current?.releasePointerCapture(event.pointerId);
    } catch {
      // Nothing was captured, so releasing is the no-op it already is.
    }
    const done = active.live;
    setLive(null);
    // The gesture owns the click that follows it: a press toggles here, a drag does not.
    suppressed.current = true;
    if (done === null) {
      onCommand?.({ type: 'panel', panel: chip.id });
      return;
    }
    onLayout?.(chip.id, badgeLayout(chip.collapsed, done));
  };

  const onPointerCancel = (): void => {
    gesture.current = null;
    setLive(null);
    suppressed.current = true;
  };

  const onClick = (event: MouseEvent): void => {
    const swallowed = suppressed.current;
    suppressed.current = false;
    // Only the click a real gesture produces is the gesture's own: a keyboard press
    // and a programmatic press report `detail === 0` and always toggle.
    if (swallowed && event.detail > 0) return;
    onCommand?.({ type: 'panel', panel: chip.id });
  };

  return (
    <button
      type="button"
      ref={button}
      class="hud-strip__chip"
      data-hud-strip-chip={chip.id}
      aria-label={chip.label}
      style={boxStyle(chip, live)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
    >
      <span class="hud-strip__letter" data-hud-strip-letter>
        {chip.letter}
      </span>
    </button>
  );
}

/**
 * The route strip: the collapsed panels' edge chips, laid out by `stripView` and
 * painted over the `#hud` layer. It draws no purse, no level and no meter — those
 * are the bag's and the party's own cards — and its badges are the same drag handle
 * the open cards' chips are.
 */
export function HudStrip(props: HudStripProps): JSX.Element {
  const { view, onCommand, onLayout } = props;
  return (
    <div class="hud-strip" data-hud-strip hidden={!view.open}>
      {view.chips.map((chip) => (
        <StripChipButton
          key={chip.id}
          chip={chip}
          viewport={view.viewport}
          onCommand={onCommand}
          onLayout={onLayout}
        />
      ))}
    </div>
  );
}
