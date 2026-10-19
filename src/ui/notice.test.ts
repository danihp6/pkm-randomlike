import { describe, expect, it } from 'vitest';
import {
  NOTICE_HOLD_MS,
  catchToPcNotice,
  eggHatchNotice,
  itemPickupNotice,
  levelUpNotice,
} from './notice';

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

describe('levelUpNotice', () => {
  it('writes the fixed sentence with the member name, its new level and the shared hold', () => {
    expect(levelUpNotice('Growlithe', 21)).toEqual({
      text: 'Growlithe grew to Lv 21!',
      holdMs: NOTICE_HOLD_MS,
    });
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(levelUpNotice('Charmander', 6).holdMs).toBe(2600);
  });

  it('passes the name and the level through untouched', () => {
    expect(levelUpNotice("Farfetch'd 2", 5).text).toBe("Farfetch'd 2 grew to Lv 5!");
    expect(levelUpNotice('Mr. Mime', 100).text).toBe('Mr. Mime grew to Lv 100!');
  });
});

describe('eggHatchNotice', () => {
  it('writes the fixed sentence with the hatched name and the shared hold', () => {
    expect(eggHatchNotice('Sentret')).toEqual({
      text: 'The Egg hatched into Sentret!',
      holdMs: NOTICE_HOLD_MS,
    });
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(eggHatchNotice('Sentret').holdMs).toBe(2600);
  });

  it('passes the name through untouched', () => {
    expect(eggHatchNotice("Farfetch'd 2").text).toBe("The Egg hatched into Farfetch'd 2!");
    expect(eggHatchNotice('Mr. Mime').text).toBe('The Egg hatched into Mr. Mime!');
  });
});
