import { IS_DEVELOP } from './env';

const warned = new Set<string>();

/**
 * Dev-only nudge so a coverage gap cannot hide during playtests (D16): a
 * battle met an ability or held item with no registered effect. Fires once per
 * effect for the life of the page.
 */
export function warnUnportedEffect(kind: 'ability' | 'item', id: string): void {
  if (!IS_DEVELOP) return;
  const key = `${kind}:${id}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[coverage] ${kind} "${id}" has no ported effect (D16).`);
}

/** Test helper: lets a suite assert the once-per-effect behaviour. */
export function resetCoverageWarnings(): void {
  warned.clear();
}
