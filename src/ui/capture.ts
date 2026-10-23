/**
 * The presentation pieces of a capture (Phase 5). The engine's `capture` event
 * carries `shakes` (the interrupted shake check) and `success`; `captureTimeline`
 * turns that roll into the one clock the ball's tweens and the message box share,
 * so the wobble count on screen is exactly the count the engine measured. Pure and
 * deterministic, so `BattleScene` can drive it from the engine's log without extra
 * RNG.
 */
import { t } from '../i18n';

export const CAPTURE_SHAKES = 3;
export const CAPTURE_HELD_SHAKES = 4;

/** Shake pixels per second — the classic 2-3 shakes a second. */
export const CAPTURE_SHAKE_SPEED = 2.4;

/** The throw's flight and the ball's drop, in ms. The shipped values. */
export const CAPTURE_THROW_MS = 260;
export const CAPTURE_DROP_MS = 150;

export type CaptureBeat = Readonly<{ shakes: number; held: boolean }>;

export type CaptureTickKind = 'shake' | 'break' | 'settle';

/** One scheduled moment of the beat: `at` is ms from the frame's start. */
export type CaptureTick = Readonly<{ at: number; kind: CaptureTickKind; index: number }>;

export type CaptureTimeline = Readonly<{
  throwMs: number;
  dropMs: number;
  /** One third of a wobble; the scene's per-tween duration. */
  stepMs: number;
  /** Ordered by `at`; `settle` is always last. */
  beats: readonly CaptureTick[];
  /** Sum of the phases: `throwMs + dropMs + shakes * 3 * stepMs (+ break)`. */
  totalMs: number;
}>;

/** The engine's roll, unclamped: a failure keeps 0-3, a success keeps 4. */
export function captureBeat(shakes: number, success: boolean): CaptureBeat {
  if (success) return { shakes: CAPTURE_HELD_SHAKES, held: true };
  const rolled = Number.isFinite(shakes) ? Math.floor(shakes) : 0;
  return { shakes: Math.max(0, Math.min(CAPTURE_SHAKES, rolled)), held: false };
}

export function captureTimeline(shakes: number, success: boolean): CaptureTimeline {
  const beat = captureBeat(shakes, success);
  const stepMs = Math.round(1000 / CAPTURE_SHAKE_SPEED / 3);
  const wobbleMs = 3 * stepMs;
  const dropAt = CAPTURE_THROW_MS + CAPTURE_DROP_MS;
  const wobbleEnd = dropAt + beat.shakes * wobbleMs;
  const breakMs = beat.held ? 0 : stepMs;

  const beats: CaptureTick[] = [];
  for (let index = 1; index <= beat.shakes; index++) {
    beats.push({ at: dropAt + index * wobbleMs, kind: 'shake', index });
  }
  if (!beat.held) beats.push({ at: wobbleEnd, kind: 'break', index: 0 });
  const totalMs = wobbleEnd + breakMs;
  beats.push({ at: totalMs, kind: 'settle', index: 0 });

  return {
    throwMs: CAPTURE_THROW_MS,
    dropMs: CAPTURE_DROP_MS,
    stepMs,
    beats,
    totalMs,
  };
}

/** The in-progress line: `{name}` plus one dot per completed wobble, capped at three. */
export function captureWaitLine(name: string, completed: number): string {
  const done = Number.isFinite(completed) ? Math.floor(completed) : 0;
  const dots = Math.min(Math.max(done, 0) + 1, 3);
  return t('battle.log.captureWait', { name }) + '.'.repeat(dots - 1);
}
