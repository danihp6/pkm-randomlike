import { describe, expect, it } from 'vitest';
import { NOTICE_HOLD_MS, catchToPcNotice } from './notice';

describe('catchToPcNotice', () => {
  it('writes the fixed sentence with the caught name and the shared hold', () => {
    expect(catchToPcNotice('Sentret')).toEqual({
      text: 'Your party is full — Sentret went to the PC. You can swap it in before you leave this route.',
      holdMs: NOTICE_HOLD_MS,
    });
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(NOTICE_HOLD_MS).toBe(2600);
    expect(catchToPcNotice('Sentret').holdMs).toBe(2600);
  });

  it('passes the name through untouched', () => {
    expect(catchToPcNotice("Farfetch'd 2").text).toContain(
      "Your party is full — Farfetch'd 2 went to the PC.",
    );
    expect(catchToPcNotice('Mr. Mime').holdMs).toBe(NOTICE_HOLD_MS);
  });
});
