import type { ComponentChildren, JSX } from 'preact';
import { panelClass } from './classes';

export type PanelProps = Readonly<{
  title?: string;
  aside?: string;
  children?: ComponentChildren;
  class?: string;
}>;

/** The board's dialog card: radius 11, one hairline and a 1 px highlight drawn by `kit.css`. */
export function Panel(props: PanelProps): JSX.Element {
  const hasHeader = props.title !== undefined || props.aside !== undefined;
  return (
    <section class={panelClass(props)}>
      {hasHeader ? (
        <header class="kit-panel__header">
          {props.title !== undefined ? <h2 class="kit-panel__title">{props.title}</h2> : null}
          {props.aside !== undefined ? <span class="kit-panel__aside">{props.aside}</span> : null}
        </header>
      ) : null}
      {props.children}
    </section>
  );
}
