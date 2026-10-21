import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import {
  NOTICE_HOLD_MS,
  catchToPcNotice,
  eggHatchNotice,
  gateLockedNotice,
  gateOpenedNotice,
  itemPickupNotice,
  itemUsedNotice,
  levelUpNotice,
  missionCompleteNotice,
  noHealRoomNotice,
  bannedRoomNotice,
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
      levelUpNotice('Growlithe', 21),
      eggHatchNotice('Sentret'),
      gateLockedNotice('bush'),
      gateOpenedNotice(),
      noHealRoomNotice(),
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
      levelUpNotice('Growlithe', 21),
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
      levelUpNotice('Growlithe', 21),
      eggHatchNotice('Sentret'),
      gateLockedNotice('bush'),
      gateOpenedNotice(),
      noHealRoomNotice(),
    ].map((notice) => notice.text);
    expect(others).not.toContain(bannedRoomNotice('Pidgeot').text);
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
      levelUpNotice('Growlithe', 21),
      eggHatchNotice('Sentret'),
      gateLockedNotice('bush'),
      gateOpenedNotice(),
      noHealRoomNotice(),
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
