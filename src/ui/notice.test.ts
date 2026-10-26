import { describe, expect, it } from 'vitest';
import { en, es, setLocale, translationParams, type TranslationKey } from '../i18n';
import {
  AREA_PANEL_HOLD_MS,
  NOTICE_HOLD_MS,
  areaEntryNotice,
  catchToPcNotice,
  eggHatchNotice,
  gateLockedNotice,
  gateOpenedNotice,
  itemPickupNotice,
  itemUsedNotice,
  missionCompleteNotice,
  noHealRoomNotice,
  bannedRoomNotice,
  puzzleResetNotice,
  puzzleRoomNotice,
  puzzleSolvedNotice,
  staticLegendaryNotice,
  staticSealLockedNotice,
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

describe('itemUsedNotice', () => {
  it('writes the fixed sentence with the item name and the shared hold', () => {
    expect(itemUsedNotice('Potion')).toEqual({ text: 'Used Potion.', holdMs: NOTICE_HOLD_MS });
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(itemUsedNotice('Potion').holdMs).toBe(2600);
  });

  it('overlays the Spanish line on the same key', () => {
    setLocale('es');
    expect(itemUsedNotice('Potion').text).toBe('Has usado Potion.');
    setLocale('en');
    expect(itemUsedNotice('Potion').text).toBe('Used Potion.');
  });

  it('passes the name through untouched', () => {
    expect(itemUsedNotice('Mr. Mime').text).toBe('Used Mr. Mime.');
    expect(itemUsedNotice("King's Rock").text).toBe("Used King's Rock.");
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

describe('gateLockedNotice', () => {
  it('prints one line per obstacle kind, three different ones', () => {
    const notices = (['bush', 'rock', 'water'] as const).map((kind) => gateLockedNotice(kind));
    expect(notices).toEqual([
      { text: 'Thick bushes. A Bug or Grass Pokémon could clear them.', holdMs: NOTICE_HOLD_MS },
      { text: 'A boulder. A Rock or Fighting Pokémon could break it.', holdMs: NOTICE_HOLD_MS },
      { text: 'Deep water. A Water Pokémon could cross it.', holdMs: NOTICE_HOLD_MS },
    ]);
    expect(new Set(notices.map((notice) => notice.text)).size).toBe(3);
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(gateLockedNotice('bush').holdMs).toBe(2600);
  });
});

describe('gateOpenedNotice', () => {
  it('prints the opened line, the fourth of the family', () => {
    expect(gateOpenedNotice()).toEqual({ text: 'The way is open.', holdMs: NOTICE_HOLD_MS });
    const locked = (['bush', 'rock', 'water'] as const).map((kind) => gateLockedNotice(kind).text);
    expect(locked).not.toContain(gateOpenedNotice().text);
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(gateOpenedNotice().holdMs).toBe(2600);
  });
});

describe('staticSealLockedNotice', () => {
  it('keeps the shipped line for the two type obstacles and its own for the pond', () => {
    expect(staticSealLockedNotice('bush')).toEqual(gateLockedNotice('bush'));
    expect(staticSealLockedNotice('rock')).toEqual(gateLockedNotice('rock'));
    expect(staticSealLockedNotice('water')).toEqual({
      text: 'Deep water. Only the right ability could part it.',
      holdMs: NOTICE_HOLD_MS,
    });
    expect(staticSealLockedNotice('water').text).not.toBe(gateLockedNotice('water').text);
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(staticSealLockedNotice('water').holdMs).toBe(2600);
  });

  it('reads in the Spanish overlay once the locale switches back', () => {
    setLocale('es');
    try {
      expect(staticSealLockedNotice('water').text).toBe(
        'Agua profunda. Solo la habilidad adecuada podría abrirla.',
      );
    } finally {
      setLocale('en');
    }
  });
});

describe('staticLegendaryNotice', () => {
  it('hints at the legendary behind the seal with the shared hold', () => {
    expect(staticLegendaryNotice()).toEqual({
      text: 'A legendary presence waits behind the seal.',
      holdMs: NOTICE_HOLD_MS,
    });
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(staticLegendaryNotice().holdMs).toBe(2600);
  });

  it('says something no other notice says', () => {
    const others = [
      catchToPcNotice('Sentret'),
      itemPickupNotice('Potion'),
      itemUsedNotice('Potion'),
      eggHatchNotice('Sentret'),
      gateLockedNotice('bush'),
      gateOpenedNotice(),
      noHealRoomNotice(),
      bannedRoomNotice('Pidgeot'),
      missionCompleteNotice('Flawless floor'),
      staticSealLockedNotice('water'),
    ].map((notice) => notice.text);
    expect(others).not.toContain(staticLegendaryNotice().text);
  });

  it('reads in the Spanish overlay once the locale switches back', () => {
    setLocale('es');
    try {
      expect(staticLegendaryNotice().text).toBe('Una presencia legendaria aguarda tras el sello.');
    } finally {
      setLocale('en');
    }
  });
});

describe('noHealRoomNotice', () => {
  it('announces the room rule with the shared hold', () => {
    expect(noHealRoomNotice()).toEqual({
      text: 'No items or healing moves in this room!',
      holdMs: NOTICE_HOLD_MS,
    });
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(noHealRoomNotice().holdMs).toBe(2600);
  });

  it('says something no other notice says', () => {
    const others = [
      catchToPcNotice('Sentret'),
      itemPickupNotice('Potion'),
      itemUsedNotice('Potion'),
      eggHatchNotice('Sentret'),
      gateLockedNotice('bush'),
      gateOpenedNotice(),
    ].map((notice) => notice.text);
    expect(others).not.toContain(noHealRoomNotice().text);
  });
});

describe('bannedRoomNotice', () => {
  it('announces the barred species with the shared hold', () => {
    expect(bannedRoomNotice('Pidgeot')).toEqual({
      text: 'This room bars Pidgeot!',
      holdMs: NOTICE_HOLD_MS,
    });
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(bannedRoomNotice('Pidgeot').holdMs).toBe(2600);
  });

  it('passes the name through untouched, in both locales', () => {
    expect(bannedRoomNotice("Farfetch'd").text).toBe("This room bars Farfetch'd!");
    setLocale('es');
    try {
      expect(bannedRoomNotice('Mr. Mime').text).toBe('¡Esta sala bloquea a Mr. Mime!');
    } finally {
      setLocale('en');
    }
  });

  it('says something no other notice says', () => {
    const others = [
      catchToPcNotice('Pidgeot'),
      itemPickupNotice('Potion'),
      itemUsedNotice('Potion'),
      eggHatchNotice('Sentret'),
      gateLockedNotice('bush'),
      gateOpenedNotice(),
      noHealRoomNotice(),
    ].map((notice) => notice.text);
    expect(others).not.toContain(bannedRoomNotice('Pidgeot').text);
  });
});

describe('the puzzle room’s notices', () => {
  it('explains the rule on entry, with the shared hold', () => {
    expect(puzzleRoomNotice()).toEqual({
      text: 'The switches click in a set order.',
      holdMs: NOTICE_HOLD_MS,
    });
  });

  it('reports a reset sequence and a solved one', () => {
    expect(puzzleResetNotice()).toEqual({ text: 'The switches reset.', holdMs: NOTICE_HOLD_MS });
    expect(puzzleSolvedNotice()).toEqual({
      text: 'The last switch clicks — something appears!',
      holdMs: NOTICE_HOLD_MS,
    });
    expect(puzzleResetNotice().text).not.toBe(puzzleSolvedNotice().text);
  });

  it('declares no {token} in either table, so no call site supplies one', () => {
    const keys: readonly TranslationKey[] = [
      'notice.puzzleRoom',
      'notice.puzzleReset',
      'notice.puzzleSolved',
    ];
    for (const key of keys) {
      expect(translationParams(en[key]), `en ${key}`).toEqual([]);
      expect(translationParams(es[key]), `es ${key}`).toEqual([]);
      expect(en[key]).not.toContain('{');
      expect(es[key]).not.toContain('{');
    }
  });

  it('reads in the Spanish overlay once the locale switches back', () => {
    setLocale('es');
    try {
      expect(puzzleRoomNotice().text).toBe('Los interruptores suenan en un orden fijo.');
      expect(puzzleResetNotice().text).toBe('Los interruptores se reinician.');
      expect(puzzleSolvedNotice().text).toBe('¡El último interruptor encaja y algo aparece!');
      for (const notice of [puzzleRoomNotice(), puzzleResetNotice(), puzzleSolvedNotice()]) {
        expect(notice.text).not.toContain('\u2014');
      }
    } finally {
      setLocale('en');
    }
  });

  it('says something no other notice says', () => {
    const others = [
      catchToPcNotice('Sentret'),
      itemPickupNotice('Potion'),
      itemUsedNotice('Potion'),
      eggHatchNotice('Sentret'),
      gateLockedNotice('bush'),
      gateOpenedNotice(),
      noHealRoomNotice(),
      bannedRoomNotice('Pidgeot'),
    ].map((notice) => notice.text);
    for (const notice of [puzzleRoomNotice(), puzzleResetNotice(), puzzleSolvedNotice()]) {
      expect(others).not.toContain(notice.text);
    }
  });
});

describe('missionCompleteNotice', () => {
  it('announces the met mission with its display name and the shared hold', () => {
    expect(missionCompleteNotice('Flawless floor')).toEqual({
      text: 'Mission complete: Flawless floor',
      holdMs: NOTICE_HOLD_MS,
    });
  });

  it('holds a notice for 2.6 seconds', () => {
    expect(missionCompleteNotice('Flawless floor').holdMs).toBe(2600);
  });

  it('passes the name through untouched', () => {
    expect(missionCompleteNotice("Farfetch'd 2").text).toBe("Mission complete: Farfetch'd 2");
    expect(missionCompleteNotice('Mr. Mime').text).toBe('Mission complete: Mr. Mime');
  });

  it('says something no other notice says', () => {
    const others = [
      catchToPcNotice('Sentret'),
      itemPickupNotice('Potion'),
      itemUsedNotice('Potion'),
      eggHatchNotice('Sentret'),
      gateLockedNotice('bush'),
      gateOpenedNotice(),
      noHealRoomNotice(),
      bannedRoomNotice('Pidgeot'),
    ].map((notice) => notice.text);
    expect(others).not.toContain(missionCompleteNotice('Flawless floor').text);
  });

  it('reads in the Spanish overlay once the locale switches back', () => {
    setLocale('es');
    try {
      expect(missionCompleteNotice('Planta sin daño').text).toBe('Misión completada: Planta sin daño');
    } finally {
      setLocale('en');
    }
  });
});

describe('areaEntryNotice', () => {
  it('names the area in the boxed banner with its own hold', () => {
    expect(areaEntryNotice('Deep Forest')).toEqual({ text: 'Deep Forest', holdMs: 3000 });
  });

  it('holds the banner for 3 seconds, one beat longer than a notice', () => {
    expect(AREA_PANEL_HOLD_MS).toBe(3000);
    expect(AREA_PANEL_HOLD_MS).not.toBe(NOTICE_HOLD_MS);
    expect(areaEntryNotice('Deep Forest').holdMs).toBe(AREA_PANEL_HOLD_MS);
  });

  it('leaves every transient notice on its own 2.6 second hold', () => {
    expect(NOTICE_HOLD_MS).toBe(2600);
    const shipped = [
      catchToPcNotice('Sentret'),
      itemPickupNotice('Potion'),
      itemUsedNotice('Potion'),
      eggHatchNotice('Sentret'),
      gateLockedNotice('bush'),
      gateOpenedNotice(),
      noHealRoomNotice(),
      bannedRoomNotice('Pidgeot'),
      puzzleRoomNotice(),
      puzzleResetNotice(),
      puzzleSolvedNotice(),
      missionCompleteNotice('Flawless floor'),
      staticLegendaryNotice(),
      staticSealLockedNotice('water'),
    ];
    for (const notice of shipped) expect(notice.holdMs).toBe(NOTICE_HOLD_MS);
  });

  it('declares exactly one param, `area`, in both tables', () => {
    expect(translationParams(en['notice.areaEntry'])).toEqual(['area']);
    expect(translationParams(es['notice.areaEntry'])).toEqual(['area']);
    expect(en['notice.areaEntry']).toBe('{area}');
    expect(es['notice.areaEntry']).toBe('{area}');
  });

  it('keeps a biome name English in Spanish, because D43 does', () => {
    setLocale('es');
    try {
      expect(areaEntryNotice('Deep Forest')).toEqual({ text: 'Deep Forest', holdMs: 3000 });
    } finally {
      setLocale('en');
    }
    expect(areaEntryNotice('Deep Forest').text).toBe('Deep Forest');
  });

  it('passes the area through untouched', () => {
    expect(areaEntryNotice('Mt. Moon').text).toBe('Mt. Moon');
    expect(areaEntryNotice("Farfetch'd Cave").text).toBe("Farfetch'd Cave");
  });

  it('says something no other builder says', () => {
    const others = [
      catchToPcNotice('Deep Forest'),
      itemPickupNotice('Deep Forest'),
      itemUsedNotice('Deep Forest'),
      eggHatchNotice('Deep Forest'),
      gateLockedNotice('bush'),
      gateOpenedNotice(),
      noHealRoomNotice(),
      bannedRoomNotice('Deep Forest'),
      puzzleRoomNotice(),
      puzzleResetNotice(),
      puzzleSolvedNotice(),
      missionCompleteNotice('Deep Forest'),
      staticLegendaryNotice(),
      staticSealLockedNotice('water'),
    ].map((notice) => notice.text);
    expect(others).not.toContain(areaEntryNotice('Deep Forest').text);
  });
});
