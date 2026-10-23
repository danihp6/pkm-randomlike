import type { ComponentChildren, JSX } from 'preact';

export type SheetProps = Readonly<{
  open?: boolean;
  title?: string;
  onClose?: () => void;
  children?: ComponentChildren;
}>;

/** The board's bottom sheet, radius 16: nothing at all until it is open. */
export function Sheet(props: SheetProps): JSX.Element | null {
  if (props.open !== true) return null;
  return (
    <section class="kit kit-sheet" aria-label={props.title}>
      <div class="kit-sheet__handle" aria-hidden="true" />
      <header class="kit-sheet__header">
        {props.title !== undefined ? <h2 class="kit-sheet__title">{props.title}</h2> : null}
        {props.onClose !== undefined ? (
          <button type="button" class="kit-sheet__close" aria-label="Close" onClick={props.onClose}>
            ×
          </button>
        ) : null}
      </header>
      {props.children}
    </section>
  );
}
