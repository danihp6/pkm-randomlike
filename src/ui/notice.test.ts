import { describe, expect, it } from 'vitest';
import { NOTICE_HOLD_MS, catchToPcNotice, itemPickupNotice } from './notice';

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

describe('itemPickupNotice', () => {
  it('writes the fixed sentence with the item name and the shared hold', () => {
    expect(itemPickupNotice('Potion')).toEqual({
      text: 'Obtained Potion!',
      holdMs: NOTICE_HOLD_MS,
    });
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(NOTICE_HOLD_MS).toBe(2600);
    expect(itemPickupNotice('Potion').holdMs).toBe(2600);
  });

  it('passes the name through untouched', () => {
    expect(itemPickupNotice('Mr. Mime').text).toBe('Obtained Mr. Mime!');
    expect(itemPickupNotice("King's Rock").text).toBe("Obtained King's Rock!");
    expect(itemPickupNotice('TM 26').holdMs).toBe(NOTICE_HOLD_MS);
  });
});
