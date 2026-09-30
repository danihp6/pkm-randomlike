import type { TextSpeed } from '../engine/save';

/**
 * The battle message box's typewriter (Phase 7). A message is revealed one
 * character at a time at the player's text speed; pure state so the timing is
 * unit-tested and the scene only pushes elapsed milliseconds through it.
 */

/**
 * Milliseconds per revealed character. `normal` lands a typical battle line in
 * about half a second, `fast` is near-instant and `slow` reads deliberately.
 */
export const TEXT_SPEED_MS: Readonly<Record<TextSpeed, number>> = {
  slow: 44,
  normal: 20,
  fast: 6,
};

/** A message and how much of it is on screen. */
export type Typewriter = Readonly<{ text: string; shown: number }>;

export function beginTypewriter(text: string): Typewriter {
  return { text, shown: 0 };
}

export function typewriterDone(typewriter: Typewriter): boolean {
  return typewriter.shown >= typewriter.text.length;
}

/** Reveals one more character; already-complete text is returned unchanged. */
export function revealNext(typewriter: Typewriter): Typewriter {
  return typewriterDone(typewriter)
    ? typewriter
    : { text: typewriter.text, shown: typewriter.shown + 1 };
}

/** Skips to the end of the message. */
export function revealAll(typewriter: Typewriter): Typewriter {
  return typewriterDone(typewriter)
    ? typewriter
    : { text: typewriter.text, shown: typewriter.text.length };
}

export function visibleText(typewriter: Typewriter): string {
  return typewriter.text.slice(0, typewriter.shown);
}

/**
 * Reveals as many characters as `elapsedMs` buys and hands back the leftover
 * time, so a slow frame does not lose characters. A non-positive `msPerChar`
 * ("instant") reveals everything at once.
 */
export function advanceTypewriter(
  typewriter: Typewriter,
  elapsedMs: number,
  msPerChar: number,
): Readonly<{ typewriter: Typewriter; elapsed: number }> {
  if (msPerChar <= 0) return { typewriter: revealAll(typewriter), elapsed: 0 };
  let shown = typewriter.shown;
  let elapsed = elapsedMs;
  while (elapsed >= msPerChar && shown < typewriter.text.length) {
    shown += 1;
    elapsed -= msPerChar;
  }
  return { typewriter: { text: typewriter.text, shown }, elapsed };
}
