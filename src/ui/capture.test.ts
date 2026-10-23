import { afterEach, describe, expect, it } from 'vitest';
import { en, es, setLocale } from '../i18n';
import {
  CAPTURE_DROP_MS,
  CAPTURE_HELD_SHAKES,
  CAPTURE_SHAKES,
  CAPTURE_SHAKE_SPEED,
  CAPTURE_THROW_MS,
  captureBeat,
  captureTimeline,
  captureWaitLine,
  type CaptureTickKind,
} from './capture';

const STEP_MS = Math.round(1000 / CAPTURE_SHAKE_SPEED / 3);
const WOBBLE_MS = 3 * STEP_MS;
const DROP_AT = CAPTURE_THROW_MS + CAPTURE_DROP_MS;

function kinds(shakes: number, success: boolean): CaptureTickKind[] {
  return captureTimeline(shakes, success).beats.map((tick) => tick.kind);
}

function dotCount(text: string): number {
  let count = 0;
  for (const char of text) if (char === '…' || char === '.') count += 1;
  return count;
}

afterEach(() => {
  setLocale('en');
});

describe('captureBeat', () => {
  it('holds through four shakes on a catch', () => {
    expect(captureBeat(4, true)).toEqual({ shakes: CAPTURE_HELD_SHAKES, held: true });
    expect(captureBeat(0, true)).toEqual({ shakes: CAPTURE_HELD_SHAKES, held: true });
  });

  it('keeps the engine roll on a failure, never clamping a zero-shake break up to one', () => {
    expect(captureBeat(0, false)).toEqual({ shakes: 0, held: false });
    expect(captureBeat(2, false)).toEqual({ shakes: 2, held: false });
    expect(captureBeat(CAPTURE_SHAKES, false)).toEqual({ shakes: CAPTURE_SHAKES, held: false });
  });

  it('floors a fractional count, floors a negative one to zero and caps above three', () => {
    expect(captureBeat(1.9, false)).toEqual({ shakes: 1, held: false });
    expect(captureBeat(-3, false)).toEqual({ shakes: 0, held: false });
    expect(captureBeat(9, false)).toEqual({ shakes: CAPTURE_SHAKES, held: false });
  });
});

describe('captureTimeline', () => {
  it('keeps the shipped phase lengths', () => {
    const timeline = captureTimeline(3, true);
    expect(timeline.throwMs).toBe(CAPTURE_THROW_MS);
    expect(timeline.dropMs).toBe(CAPTURE_DROP_MS);
    expect(timeline.stepMs).toBe(STEP_MS);
    expect(STEP_MS).toBe(139);
    expect(WOBBLE_MS).toBe(417);
  });

  it('schedules one shake tick per wobble, the break on a failure and settle last', () => {
    for (const success of [false, true]) {
      for (let shakes = 0; shakes <= 4; shakes++) {
        const timeline = captureTimeline(shakes, success);
        const beat = captureBeat(shakes, success);
        const ticks = timeline.beats;

        expect(ticks.filter((tick) => tick.kind === 'shake')).toHaveLength(beat.shakes);
        expect(ticks.filter((tick) => tick.kind === 'break')).toHaveLength(beat.held ? 0 : 1);

        const last = ticks[ticks.length - 1];
        expect(last.kind).toBe('settle');
        expect(last.at).toBe(timeline.totalMs);

        const breakTick = ticks.find((tick) => tick.kind === 'break');
        if (!beat.held) {
          expect(breakTick).toBeDefined();
          expect(breakTick!.at).toBeLessThanOrEqual(timeline.totalMs);
          expect(ticks.indexOf(breakTick!)).toBeLessThan(ticks.length - 1);
        }

        expect(ticks.map((tick) => tick.at)).toEqual(
          [...ticks.map((tick) => tick.at)].sort((a, b) => a - b),
        );
      }
    }
  });

  it('places each wobble at the end of its own three steps', () => {
    const timeline = captureTimeline(3, false);
    const shakes = timeline.beats.filter((tick) => tick.kind === 'shake');
    expect(shakes.map((tick) => tick.index)).toEqual([1, 2, 3]);
    expect(shakes.map((tick) => tick.at)).toEqual([
      DROP_AT + WOBBLE_MS,
      DROP_AT + 2 * WOBBLE_MS,
      DROP_AT + 3 * WOBBLE_MS,
    ]);
    const breakTick = timeline.beats.find((tick) => tick.kind === 'break');
    expect(breakTick?.at).toBe(DROP_AT + 3 * WOBBLE_MS);
  });

  it('sums the phases into totalMs, with one step of break only on a failure', () => {
    for (const shakes of [0, 1, 2, 3, 4]) {
      for (const success of [false, true]) {
        const timeline = captureTimeline(shakes, success);
        const beat = captureBeat(shakes, success);
        expect(timeline.totalMs).toBe(
          timeline.throwMs + timeline.dropMs + beat.shakes * WOBBLE_MS + (beat.held ? 0 : STEP_MS),
        );
      }
    }
  });

  it('leaves a zero-shake break with no wobble at all', () => {
    const timeline = captureTimeline(0, false);
    expect(kinds(0, false)).toEqual(['break', 'settle']);
    expect(timeline.totalMs).toBe(DROP_AT + STEP_MS);
  });

  it('ends a catch on its last wobble', () => {
    const timeline = captureTimeline(4, true);
    expect(kinds(4, true)).toEqual(['shake', 'shake', 'shake', 'shake', 'settle']);
    expect(timeline.totalMs).toBe(DROP_AT + 4 * WOBBLE_MS);
  });
});

describe('captureWaitLine', () => {
  it('grows one dot per completed wobble, capped at three', () => {
    const counts = [0, 1, 2, 3, 9].map((completed) => dotCount(captureWaitLine('X', completed)));
    expect(counts).toEqual([1, 2, 3, 3, 3]);
    for (const completed of [0, 1, 2, 3, 9]) {
      expect(captureWaitLine('X', completed).startsWith('X')).toBe(true);
    }
  });

  it('floors and clamps the completed count', () => {
    expect(captureWaitLine('X', -4)).toBe(captureWaitLine('X', 0));
    expect(captureWaitLine('X', 1.9)).toBe(captureWaitLine('X', 1));
  });

  it('resolves the wait key in both locales', () => {
    expect(en['battle.log.captureWait']).toBe('{name}…');
    expect(es['battle.log.captureWait']).toBe('{name}…');
    expect(captureWaitLine('Pikachu', 0)).toBe('Pikachu…');
    setLocale('es');
    expect(captureWaitLine('Pikachu', 1)).toBe('Pikachu….');
  });
});
