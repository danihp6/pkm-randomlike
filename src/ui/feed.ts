import type { BattleEvent } from '../engine/battle/state';

/**
 * A presentation beat: the message to show (when there is one) and the events
 * whose state changes are applied as it appears. The scene walks these frames
 * one at a time, so a "Critical hit!" line lands with the HP drop it describes.
 */
export type FeedFrame = Readonly<{
  message: string | null;
  events: readonly BattleEvent[];
}>;

/**
 * Splits the engine's event log into frames that each end at one text message.
 * Non-text events (damage, heal, boost, switch, faint...) ride along with the
 * message printed next to them; any that trail the last message form a final
 * silent frame.
 */
export function battleFrames(events: readonly BattleEvent[]): FeedFrame[] {
  const frames: FeedFrame[] = [];
  let current: BattleEvent[] = [];
  for (const event of events) {
    current.push(event);
    if (event.kind === 'text') {
      frames.push({ message: event.text, events: current });
      current = [];
    }
  }
  if (current.length > 0) frames.push({ message: null, events: current });
  return frames;
}

/** The message of a frame, or null for a silent beat. */
export function frameMessage(frame: FeedFrame): string | null {
  return frame.message;
}
