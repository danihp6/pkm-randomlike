import type { JSX } from 'preact';
import { typeColor } from '../../typeColors';
import { typeBadgeClass } from './classes';

const DARK_INK = '#0b1017';
const LIGHT_INK = '#f8fafc';

function hex(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(colour: string): number {
  const value = Number.parseInt(colour.slice(1), 16);
  return (
    0.2126 * channel((value >> 16) & 0xff) +
    0.7152 * channel((value >> 8) & 0xff) +
    0.0722 * channel(value & 0xff)
  );
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** The type badge's two colours, as CSS hex: the canon fill and the readable ink (the higher WCAG contrast of the two fixed inks). */
export function typeBadgeTone(type: string): Readonly<{ fill: string; ink: string }> {
  const fill = hex(typeColor(type));
  return { fill, ink: contrast(fill, DARK_INK) >= contrast(fill, LIGHT_INK) ? DARK_INK : LIGHT_INK };
}

export type TypeBadgeProps = Readonly<{ type: string; label?: string }>;

/** The canon type chip: its colour is content, so it comes from the type palette and never from the chrome tokens. */
export function TypeBadge(props: TypeBadgeProps): JSX.Element {
  const tone = typeBadgeTone(props.type);
  return (
    <span class={typeBadgeClass()} style={{ color: tone.ink, background: tone.fill }}>
      {props.label ?? props.type}
    </span>
  );
}
