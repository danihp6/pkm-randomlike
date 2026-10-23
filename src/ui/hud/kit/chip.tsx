import type { JSX } from 'preact';
import { chipClass } from './classes';

export type ChipProps = Readonly<{
  letter: string;
  label: string;
  active?: boolean;
  onPress?: () => void;
}>;

/** The board's 26×26 badge: the initial only, its full name in the accessible label. */
export function Chip(props: ChipProps): JSX.Element {
  return (
    <button
      type="button"
      class={chipClass({ active: props.active === true })}
      aria-label={props.label}
      onClick={props.onPress}
    >
      {props.letter}
    </button>
  );
}
