import type { JSX } from 'preact';
import { barClass } from './classes';

export type BarTone = 'hp' | 'xp' | 'charge';

export type BarProps = Readonly<{ fraction: number; tone?: BarTone; label?: string }>;

function clampFraction(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(1, Math.max(0, fraction));
}

/** Bar geometry: the fill's width as a CSS percentage, clamped to 0…100, two decimals. */
export function fillPercent(fraction: number): string {
  return `${Number((clampFraction(fraction) * 100).toFixed(2))}%`;
}

/** A single board bar: the track is the row fill, the fill is its inner element. */
export function Bar(props: BarProps): JSX.Element {
  const now = Math.trunc(Number((clampFraction(props.fraction) * 100).toFixed(6)));
  return (
    <div
      class={barClass({ tone: props.tone })}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={now}
      aria-label={props.label}
    >
      <div class="kit-bar__fill" style={{ width: fillPercent(props.fraction) }} />
    </div>
  );
}
