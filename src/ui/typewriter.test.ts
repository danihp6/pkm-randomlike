import { describe, expect, it } from 'vitest';
import {
  advanceTypewriter,
  beginTypewriter,
  revealAll,
  revealNext,
  TEXT_SPEED_MS,
  typewriterDone,
  visibleText,
} from './typewriter';

describe('typewriter', () => {
  it('reveals nothing until it is advanced', () => {
    const writing = beginTypewriter('critical hit!');
    expect(visibleText(writing)).toBe('');
    expect(typewriterDone(writing)).toBe(false);
  });

  it('reveals one character per call', () => {
    let writing = beginTypewriter('abc');
    writing = revealNext(writing);
    expect(visibleText(writing)).toBe('a');
    writing = revealNext(revealNext(writing));
    expect(visibleText(writing)).toBe('abc');
    expect(typewriterDone(writing)).toBe(true);
    expect(revealNext(writing)).toBe(writing);
  });

  it('reveals everything at once when skipped', () => {
    const done = revealAll(beginTypewriter('a long message'));
    expect(visibleText(done)).toBe('a long message');
    expect(typewriterDone(done)).toBe(true);
  });

  it('treats an empty message as already done', () => {
    expect(typewriterDone(beginTypewriter(''))).toBe(true);
    expect(visibleText(revealAll(beginTypewriter('')))).toBe('');
  });

  it('reveals as many characters as the elapsed time buys, keeping the rest', () => {
    const { typewriter, elapsed } = advanceTypewriter(beginTypewriter('abcdef'), 50, TEXT_SPEED_MS.normal);
    expect(visibleText(typewriter)).toBe('ab');
    expect(elapsed).toBe(10);
  });

  it('never over-reveals and never loses time', () => {
    const { typewriter, elapsed } = advanceTypewriter(beginTypewriter('ab'), 1000, 20);
    expect(visibleText(typewriter)).toBe('ab');
    expect(typewriterDone(typewriter)).toBe(true);
    expect(elapsed).toBe(960);
  });

  it('reveals instantly at a zero cost per character', () => {
    const { typewriter, elapsed } = advanceTypewriter(beginTypewriter('abc'), 40, 0);
    expect(visibleText(typewriter)).toBe('abc');
    expect(elapsed).toBe(0);
  });

  it('keeps slow slower than normal, and normal slower than fast', () => {
    expect(TEXT_SPEED_MS.slow).toBeGreaterThan(TEXT_SPEED_MS.normal);
    expect(TEXT_SPEED_MS.normal).toBeGreaterThan(TEXT_SPEED_MS.fast);
    expect(TEXT_SPEED_MS.fast).toBeGreaterThan(0);
  });
});
