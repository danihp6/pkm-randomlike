import type { ComponentChildren, JSX } from 'preact';

export type KitTone = 'primary' | 'secondary' | 'muted' | 'faint' | 'ink' | 'warning' | 'accent';

export type MetaProps = Readonly<{ children?: ComponentChildren; tone?: Exclude<KitTone, 'ink'> }>;

function metaClass(tone: Exclude<KitTone, 'ink'>): string {
  return `kit-meta kit-meta--${tone}`;
}

/** A meta line: the 9 px muted text the board uses under a row's label. */
export function Meta(props: MetaProps): JSX.Element {
  return <span class={metaClass(props.tone ?? 'muted')}>{props.children}</span>;
}
