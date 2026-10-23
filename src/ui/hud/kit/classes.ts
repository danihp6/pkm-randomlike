import type { BarTone } from './bar';

/** Joins the truthy class names with a single space; never leaves a double space. */
export function joinClasses(...parts: readonly (string | false | null | undefined)[]): string {
  const kept: string[] = [];
  for (const part of parts) {
    if (typeof part !== 'string') continue;
    const trimmed = part.trim();
    if (trimmed.length > 0) kept.push(trimmed);
  }
  return kept.join(' ');
}

/** The panel's class list; a panel adds its own class without cloning the stylesheet. */
export function panelClass(opts?: Readonly<{ class?: string | undefined }>): string {
  return joinClasses('kit-panel', opts?.class);
}

/** The row's class list. `interactive` is the row that carries a press handler. */
export function rowClass(
  opts?: Readonly<{
    interactive?: boolean | undefined;
    selected?: boolean | undefined;
    disabled?: boolean | undefined;
    class?: string | undefined;
  }>,
): string {
  return joinClasses(
    'kit-row',
    opts?.interactive === true && 'kit-row--interactive',
    opts?.selected === true && 'kit-row--selected',
    opts?.disabled === true && 'kit-row--disabled',
    opts?.class,
  );
}

/** The chip's class list. The chip is the one primitive that also carries the base `kit` class, so the kit-scoped chip radius resolves wherever it is used. */
export function chipClass(opts?: Readonly<{ active?: boolean | undefined }>): string {
  return joinClasses('kit', 'kit-chip', opts?.active === true && 'kit-chip--active');
}

/** The bar's class list; the tone defaults to `hp`, the board's only filled bar. */
export function barClass(opts?: Readonly<{ tone?: BarTone | undefined }>): string {
  return joinClasses('kit-bar', `kit-bar--${opts?.tone ?? 'hp'}`);
}

/** The type badge's class list. */
export function typeBadgeClass(): string {
  return 'kit-type';
}
