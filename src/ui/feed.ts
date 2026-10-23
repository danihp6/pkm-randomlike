import { getItem } from '../data/items';
import type { BattleEvent, BattleText } from '../engine/battle/state';
import { t } from '../i18n';
import { abilityNameFromEnglish, moveName } from '../i18n/content';

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
 * One log line as the player reads it. The engine keys the line and the feed
 * resolves it in the current locale, so the same battle draws in Spanish or in
 * English without the log ever holding a sentence (`D43`): only three params are
 * ids a table owns (`move`, `ability`, `item`); every other one is inserted as is.
 */
export function battleMessage(text: BattleText): string {
  if (text.params === undefined) return t(text.key);
  const params: Record<string, string> = {};
  for (const [name, value] of Object.entries(text.params)) {
    params[name] = resolveParam(name, value);
  }
  return t(text.key, params);
}

function resolveParam(name: string, value: string | number): string {
  if (name === 'move') return moveName(String(value));
  if (name === 'ability') return abilityNameFromEnglish(String(value));
  if (name === 'item') return getItem(String(value))?.name ?? String(value);
  return String(value);
}

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
      frames.push({ message: battleMessage(event), events: current });
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
