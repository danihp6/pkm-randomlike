import type { ComponentChildren, JSX } from 'preact';
import { rowClass } from './classes';

export type RowProps = Readonly<{
  children?: ComponentChildren;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  class?: string;
}>;

/** One board row. Only a row that carries a press handler is a real button, so only real actions are focusable. */
export function Row(props: RowProps): JSX.Element {
  const interactive = props.onPress !== undefined;
  const selected = props.selected === true;
  const disabled = props.disabled === true;
  const cls = rowClass({ interactive, selected, disabled, class: props.class });
  const current = selected ? 'true' : undefined;

  if (!interactive) {
    return (
      <div class={cls} aria-current={current}>
        {props.children}
      </div>
    );
  }

  return (
    <button
      type="button"
      class={cls}
      disabled={disabled}
      aria-disabled={disabled ? 'true' : undefined}
      aria-current={current}
      onClick={disabled ? undefined : props.onPress}
    >
      {props.children}
    </button>
  );
}
