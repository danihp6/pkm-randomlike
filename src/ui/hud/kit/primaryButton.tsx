import type { ComponentChildren, JSX } from 'preact';

export type PrimaryButtonProps = Readonly<{
  children?: ComponentChildren;
  onPress: () => void;
  disabled?: boolean;
}>;

/** The board's one filled action: Bold at the body size, radius 10. */
export function PrimaryButton(props: PrimaryButtonProps): JSX.Element {
  const disabled = props.disabled === true;
  return (
    <button
      type="button"
      class="kit kit-button"
      disabled={disabled}
      onClick={disabled ? undefined : props.onPress}
    >
      {props.children}
    </button>
  );
}
