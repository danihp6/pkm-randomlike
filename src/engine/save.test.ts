import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYBINDS } from '../data/keybinds';
import { defaultHudLayout } from '../data/hudLayout';
import { levelCapForMap } from '../data/maps';
import { floorForRoute } from './run/floors';
import { POKEVIAL_MAX_CHARGES } from './run/heal';
import { arrivalEdgeFor, planMap } from './maps/plan';
import {
  addItem,
  addMoney,
  addPokemon,
  createRun,
  createRunPokemon,
  markTrainerDefeated,
  useCapture,
  MAX_LEVEL,
  type RunState,
} from './run';
import {
  DEFAULT_AI_LEVEL,
  DEFAULT_ALWAYS_RUN,
  DEFAULT_HUD_TRANSPARENT,
  DEFAULT_LANGUAGE,
  DEFAULT_REDUCED_FLASH,
  DEFAULT_TEXT_SPEED,
  DEFAULT_VOLUME,
  SAVE_KEY,
  SAVE_MIGRATIONS,
  SAVE_VERSION,
  clearRun,
  decodeSave,
  defaultSettings,
  emptySave,
  encodeSave,
  loadSave,
  migrateDocument,
  storeRun,
  storeSave,
  storeSettings,
  storedSettingsLanguage,
  type Migrations,
  type Settings,
  type StorageLike,
} from './save';
import type { RunHistoryRecord } from './run/history';

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/**
 * A full run: six party members, one boxed, two item stacks, a spent capture and
 * a couple of stats to prove the summary counters survive the round trip.
 */
function sampleRun(): RunState {
  let run = createRun({
    seed: 'seed-a',
    starter: createRunPokemon({
      id: 'p0',
      speciesId: 'charmander',
      level: 5,
      moves: ['scratch', 'ember'],
    }),
  });
  for (let i = 1; i < 6; i++) {
    run = addPokemon(run, createRunPokemon({ id: `p${i}`, speciesId: 'sentret', level: 3 }));
  }
  run = addPokemon(run, createRunPokemon({ id: 'boxed', speciesId: 'greedent', level: 4 }));
  run = addItem(run, 'potion', 2);
  run = addItem(run, 'pokeball', 1);
  run = addMoney(run, 1500);
  run = useCapture(run);
  run = markTrainerDefeated(run, 'trainer-1-0');
  return { ...run, stats: { catches: 2, casualties: 1 } };
}

function document(raw: string): ReturnType<typeof decodeSave> {
  return decodeSave(raw);
}

describe('defaults', () => {
  it('starts at normal speed, mostly loud and the standard keys', () => {
    expect(defaultSettings()).toEqual({
      textSpeed: DEFAULT_TEXT_SPEED,
      volume: DEFAULT_VOLUME,
      alwaysRun: DEFAULT_ALWAYS_RUN,
      hudTransparent: DEFAULT_HUD_TRANSPARENT,
      hudLayout: defaultHudLayout(),
      keybinds: DEFAULT_KEYBINDS,
      reducedFlash: DEFAULT_REDUCED_FLASH,
      aiLevel: DEFAULT_AI_LEVEL,
      language: DEFAULT_LANGUAGE,
    });
  });

  it('an empty save holds the defaults, no run and no finished runs', () => {
    expect(emptySave()).toEqual({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: null,
      history: [],
    });
  });
});

describe('encodeSave', () => {
  it('stamps the current version and round-trips through decode', () => {
    const run = sampleRun();
    const encoded = encodeSave({
      version: 99,
      settings: {
        textSpeed: 'fast',
        volume: 0.4,
        alwaysRun: DEFAULT_ALWAYS_RUN,
        hudTransparent: DEFAULT_HUD_TRANSPARENT,
        hudLayout: defaultHudLayout(),
        keybinds: DEFAULT_KEYBINDS,
        reducedFlash: DEFAULT_REDUCED_FLASH,
        aiLevel: DEFAULT_AI_LEVEL,
        language: DEFAULT_LANGUAGE,
      },
      run,
      history: [],
    });
    expect(JSON.parse(encoded).version).toBe(SAVE_VERSION);

    const decoded = decodeSave(encoded);
    expect(decoded.settings).toEqual({
      textSpeed: 'fast',
      volume: 0.4,
      alwaysRun: DEFAULT_ALWAYS_RUN,
      hudTransparent: DEFAULT_HUD_TRANSPARENT,
      hudLayout: defaultHudLayout(),
      keybinds: DEFAULT_KEYBINDS,
      reducedFlash: DEFAULT_REDUCED_FLASH,
      aiLevel: DEFAULT_AI_LEVEL,
      language: DEFAULT_LANGUAGE,
    });
    expect(decoded.run).toEqual(run);
  });
});

describe('decodeSave', () => {
  it('survives missing, malformed and non-record payloads', () => {
    expect(decodeSave(null)).toEqual(emptySave());
    expect(decodeSave('')).toEqual(emptySave());
    expect(decodeSave('not json')).toEqual(emptySave());
    expect(decodeSave('[1, 2, 3]')).toEqual(emptySave());
    expect(decodeSave('"a string"')).toEqual(emptySave());
    expect(decodeSave(JSON.stringify({ version: 'one' }))).toEqual(emptySave());
  });

  it('keeps the settings but drops a run from a newer build', () => {
    const raw = JSON.stringify({
      version: SAVE_VERSION + 1,
      settings: { textSpeed: 'slow', volume: 0.1 },
      run: sampleRun(),
    });
    const decoded = document(raw);
    expect(decoded.run).toBeNull();
    expect(decoded.settings).toEqual({
      textSpeed: 'slow',
      volume: 0.1,
      alwaysRun: DEFAULT_ALWAYS_RUN,
      hudTransparent: DEFAULT_HUD_TRANSPARENT,
      hudLayout: defaultHudLayout(),
      keybinds: DEFAULT_KEYBINDS,
      reducedFlash: DEFAULT_REDUCED_FLASH,
      aiLevel: DEFAULT_AI_LEVEL,
      language: DEFAULT_LANGUAGE,
    });
  });

  it('drops an unmigratable older document', () => {
    const raw = JSON.stringify({ version: 0, textSpeed: 'fast' });
    expect(decodeSave(raw).run).toBeNull();
  });

  it('migrates a v1 run onto the current schema, adding the summary counters', () => {
    const v1run: Record<string, unknown> = { ...sampleRun() };
    delete v1run.stats;
    const raw = JSON.stringify({
      version: 1,
      settings: { textSpeed: 'fast', volume: 0.25 },
      run: v1run,
    });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.settings).toEqual({
      textSpeed: 'fast',
      volume: 0.25,
      alwaysRun: DEFAULT_ALWAYS_RUN,
      hudTransparent: DEFAULT_HUD_TRANSPARENT,
      hudLayout: defaultHudLayout(),
      keybinds: DEFAULT_KEYBINDS,
      reducedFlash: DEFAULT_REDUCED_FLASH,
      aiLevel: DEFAULT_AI_LEVEL,
      language: DEFAULT_LANGUAGE,
    });
    expect(decoded.run?.party).toHaveLength(6);
    expect(decoded.run?.stats).toEqual({ catches: 0, casualties: 0 });
  });

  it('migrates a v2 settings onto the current schema', () => {
    const raw = JSON.stringify({
      version: 2,
      settings: { textSpeed: 'slow', volume: 0.5 },
      run: sampleRun(),
    });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.settings).toEqual({
      textSpeed: 'slow',
      volume: 0.5,
      alwaysRun: DEFAULT_ALWAYS_RUN,
      hudTransparent: DEFAULT_HUD_TRANSPARENT,
      hudLayout: defaultHudLayout(),
      keybinds: DEFAULT_KEYBINDS,
      reducedFlash: DEFAULT_REDUCED_FLASH,
      aiLevel: DEFAULT_AI_LEVEL,
      language: DEFAULT_LANGUAGE,
    });
    expect(decoded.run?.party).toHaveLength(6);
  });

  it('migrates a v3 settings onto the current schema, adding the keybinds', () => {
    const raw = JSON.stringify({
      version: 3,
      settings: { textSpeed: 'fast', volume: 0.5 },
      run: sampleRun(),
    });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.settings).toEqual({
      textSpeed: 'fast',
      volume: 0.5,
      alwaysRun: DEFAULT_ALWAYS_RUN,
      hudTransparent: DEFAULT_HUD_TRANSPARENT,
      hudLayout: defaultHudLayout(),
      keybinds: DEFAULT_KEYBINDS,
      reducedFlash: DEFAULT_REDUCED_FLASH,
      aiLevel: DEFAULT_AI_LEVEL,
      language: DEFAULT_LANGUAGE,
    });
    expect(decoded.run?.party).toHaveLength(6);
  });

  it('migrates a v4 settings onto the current schema, resetting the accept/cancel keys', () => {
    const raw = JSON.stringify({
      version: 4,
      settings: {
        textSpeed: 'fast',
        volume: 0.5,
        keybinds: { ...DEFAULT_KEYBINDS, confirm: 'Z', cancel: 'X' },
      },
      run: sampleRun(),
    });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.settings.keybinds).toEqual(DEFAULT_KEYBINDS);
    expect(decoded.run?.party).toHaveLength(6);
  });

  it('migrates a v9 run onto the current schema, adding the Pokevial charges', () => {
    const v9run: Record<string, unknown> = { ...sampleRun() };
    delete v9run.pokevialCharges;
    const raw = JSON.stringify({ version: 9, run: v9run });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.run?.pokevialCharges).toBe(POKEVIAL_MAX_CHARGES);
  });
});

describe('settings validation', () => {
  it('repairs an unknown speed and clamps the volume', () => {
    const decoded = document(
      JSON.stringify({ version: SAVE_VERSION, settings: { textSpeed: 'hyper', volume: 5 } }),
    );
    expect(decoded.settings).toEqual({
      textSpeed: DEFAULT_TEXT_SPEED,
      volume: 1,
      alwaysRun: DEFAULT_ALWAYS_RUN,
      hudTransparent: DEFAULT_HUD_TRANSPARENT,
      hudLayout: defaultHudLayout(),
      keybinds: DEFAULT_KEYBINDS,
      reducedFlash: DEFAULT_REDUCED_FLASH,
      aiLevel: DEFAULT_AI_LEVEL,
      language: DEFAULT_LANGUAGE,
    });
  });

  it('floors a negative volume and fills a missing one', () => {
    expect(
      document(JSON.stringify({ version: SAVE_VERSION, settings: { volume: -3 } })).settings,
    ).toEqual({
      textSpeed: DEFAULT_TEXT_SPEED,
      volume: 0,
      alwaysRun: DEFAULT_ALWAYS_RUN,
      hudTransparent: DEFAULT_HUD_TRANSPARENT,
      hudLayout: defaultHudLayout(),
      keybinds: DEFAULT_KEYBINDS,
      reducedFlash: DEFAULT_REDUCED_FLASH,
      aiLevel: DEFAULT_AI_LEVEL,
      language: DEFAULT_LANGUAGE,
    });
    expect(document(JSON.stringify({ version: SAVE_VERSION, settings: {} })).settings).toEqual(
      defaultSettings(),
    );
  });

  it('keeps the keybinds it can read and fills the rest', () => {
    const decoded = document(
      JSON.stringify({ version: SAVE_VERSION, settings: { keybinds: { confirm: 'Q' } } }),
    );
    expect(decoded.settings.keybinds.confirm).toBe('Q');
    expect(decoded.settings.keybinds.cancel).toBe(DEFAULT_KEYBINDS.cancel);
  });

  it('keeps the reduce-flashing preference through a round trip', () => {
    const settings: Settings = { ...defaultSettings(), reducedFlash: true };
    const decoded = document(encodeSave({ version: SAVE_VERSION, settings, run: null, history: [] }));
    expect(decoded.settings.reducedFlash).toBe(true);
  });

  it('reads a document with no reduce-flashing field as off', () => {
    const raw = JSON.stringify({ version: 16, settings: { textSpeed: 'fast', volume: 0.4 } });
    const decoded = document(raw);
    expect(SAVE_VERSION).toBe(24);
    expect(decoded.settings.reducedFlash).toBe(false);
  });

  it('starts the enemies at the normal difficulty', () => {
    expect(defaultSettings().aiLevel).toBe('normal');
    expect(DEFAULT_AI_LEVEL).toBe('normal');
  });

  it('keeps the hard difficulty through a round trip', () => {
    const settings: Settings = { ...defaultSettings(), aiLevel: 'hard' };
    const decoded = document(encodeSave({ version: SAVE_VERSION, settings, run: null, history: [] }));
    expect(decoded.settings.aiLevel).toBe('hard');
  });

  it('reads an absent or unknown difficulty as normal, with no version step', () => {
    expect(
      document(JSON.stringify({ version: 16, settings: { textSpeed: 'fast' } })).settings.aiLevel,
    ).toBe('normal');
    expect(
      document(JSON.stringify({ version: 16, settings: { aiLevel: 'nightmare' } })).settings.aiLevel,
    ).toBe('normal');
    expect(SAVE_VERSION).toBe(24);
  });

  it('starts on the source table', () => {
    expect(defaultSettings().language).toBe('en');
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('reads a document written before the language as English, run intact', () => {
    const raw = JSON.stringify({ version: 16, settings: { textSpeed: 'fast' }, run: sampleRun() });
    const decoded = decodeSave(raw);
    expect(decoded.settings.language).toBe('en');
    expect(decoded.run?.party).toHaveLength(6);
  });

  it('keeps the Spanish language through a round trip with the run', () => {
    const settings: Settings = { ...defaultSettings(), language: 'es' };
    const decoded = document(encodeSave({ version: SAVE_VERSION, settings, run: sampleRun(), history: [] }));
    expect(decoded.settings.language).toBe('es');
    expect(decoded.run?.party).toHaveLength(6);
  });

  it('reads a junk or absent language as English, with no version step', () => {
    expect(
      document(JSON.stringify({ version: 16, settings: { textSpeed: 'fast' } })).settings.language,
    ).toBe('en');
    expect(
      document(JSON.stringify({ version: 16, settings: { language: 'fr' } })).settings.language,
    ).toBe('en');
    expect(document(JSON.stringify({ version: 16, settings: { language: 42 } })).settings.language).toBe(
      'en',
    );
    expect(SAVE_VERSION).toBe(24);
    expect(Object.keys(SAVE_MIGRATIONS)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
      '21',
      '22',
      '23',
    ]);
  });

  it('keeps a saved HUD layout and repairs a junk offset', () => {
    const decoded = document(
      JSON.stringify({
        version: SAVE_VERSION,
        settings: {
          hudLayout: {
            party: { dx: 40, dy: -20, collapsed: true },
            bag: { dx: 99999, dy: 0, collapsed: 'no' },
          },
        },
      }),
    );
    expect(decoded.settings.hudLayout.party).toEqual({ dx: 40, dy: -20, collapsed: true });
    expect(decoded.settings.hudLayout.bag).toEqual(defaultHudLayout().bag);
    expect(decoded.settings.hudLayout.box).toEqual(defaultHudLayout().box);
  });
});

describe('run validation', () => {
  it('recomputes the level cap from the map instead of trusting the save', () => {
    const run = { ...sampleRun(), routeIndex: 12, mapIndex: 3, levelCap: 999 };
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run }));
    expect(decoded.run?.levelCap).toBe(levelCapForMap(3));
  });

  it('derives the map position and the discovery set when the save lacks them', () => {
    const run: Record<string, unknown> = { ...sampleRun(), routeIndex: 9 };
    delete run.mapIndex;
    delete run.routeInMap;
    delete run.discoveredRooms;
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run }));
    const position = floorForRoute(run.seed as string, 9);
    expect(decoded.run?.mapIndex).toBe(position.mapIndex);
    expect(decoded.run?.routeInMap).toBe(position.roomInMap);
    expect(decoded.run?.discoveredRooms).toContain(position.roomInMap);
  });

  it('clamps a room outside the plan to the floor', () => {
    const run = { ...sampleRun(), mapIndex: 1, routeInMap: 9999 };
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run }));
    const plan = planMap(run.seed, 1);
    expect(decoded.run?.routeInMap).toBe(plan.rooms.length - 1);
  });

  it('keeps the members that parse and drops the ones that do not', () => {
    const run = sampleRun();
    const broken = { ...run, party: [run.party[0], { fighter: null }, 7] };
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run: broken }));
    expect(decoded.run?.party).toHaveLength(1);
  });

  it('drops a run with no surviving party member', () => {
    const run = sampleRun();
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run: { ...run, party: [] } }));
    expect(decoded.run).toBeNull();
  });

  it('drops a run with a malformed bag', () => {
    const run = sampleRun();
    const decoded = document(
      JSON.stringify({ version: SAVE_VERSION, run: { ...run, bag: [{ itemId: 'potion' }] } }),
    );
    expect(decoded.run).toBeNull();
  });

  it('defaults the flags and filters the trainer and item marks', () => {
    const run = sampleRun();
    const decoded = document(
      JSON.stringify({
        version: SAVE_VERSION,
        run: {
          ...run,
          capturedRooms: [1, 'x', 1, -2],
          defeatedTrainers: ['a', 4, null],
          pickedItems: ['item-1-0', 7, null],
        },
      }),
    );
    expect(decoded.run?.capturedRooms).toEqual([1]);
    expect(decoded.run?.defeatedTrainers).toEqual(['a']);
    expect(decoded.run?.pickedItems).toEqual(['item-1-0']);
  });

  it('keeps a valid run whole, box and all', () => {
    const run = sampleRun();
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run }));
    expect(decoded.run?.party).toHaveLength(6);
    expect(decoded.run?.box).toHaveLength(1);
    expect(decoded.run?.bag).toEqual(run.bag);
    expect(decoded.run?.stats).toEqual({ catches: 2, casualties: 1 });
  });

  it('defaults counters that do not parse', () => {
    const run = sampleRun();
    const decoded = document(
      JSON.stringify({
        version: SAVE_VERSION,
        run: { ...run, stats: { catches: -2, casualties: 'x' } },
      }),
    );
    expect(decoded.run?.stats).toEqual({ catches: 0, casualties: 0 });
  });

  it('defaults a missing Pokevial count and clamps a junk one', () => {
    const run = sampleRun();
    const missing: Record<string, unknown> = { ...run };
    delete missing.pokevialCharges;
    const withoutField = document(JSON.stringify({ version: SAVE_VERSION, run: missing }));
    expect(withoutField.run?.pokevialCharges).toBe(POKEVIAL_MAX_CHARGES);

    const over = document(
      JSON.stringify({ version: SAVE_VERSION, run: { ...run, pokevialCharges: 5 } }),
    );
    expect(over.run?.pokevialCharges).toBe(POKEVIAL_MAX_CHARGES);
  });

  it('defaults the PC-lock fields and reads them back', () => {
    const run = sampleRun();
    // The sample stands in the entry room, so a missing flag reads not-departed
    // and the route catch window starts closed.
    const missing: Record<string, unknown> = { ...run };
    delete missing.entryDeparted;
    delete missing.pcCatch;
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run: missing }));
    expect(decoded.run?.entryDeparted).toBe(false);
    expect(decoded.run?.pcCatch).toBeNull();

    const caught = document(
      JSON.stringify({
        version: SAVE_VERSION,
        run: { ...run, entryDeparted: false, pcCatch: { roomInMap: 2, memberId: 'p0' } },
      }),
    );
    expect(caught.run?.entryDeparted).toBe(false);
    expect(caught.run?.pcCatch).toEqual({ roomInMap: 2, memberId: 'p0' });
  });

  it('round-trips a current-schema route catch', () => {
    const run: RunState = { ...sampleRun(), pcCatch: { roomInMap: 3, memberId: 'boxed' } };
    const decoded = document(encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run, history: [] }));
    expect(decoded.run?.pcCatch).toEqual({ roomInMap: 3, memberId: 'boxed' });
  });

  it('defaults a malformed route catch to none rather than stranding the run', () => {
    const run = sampleRun();
    const raw = (pcCatch: unknown): string =>
      JSON.stringify({ version: SAVE_VERSION, run: { ...run, pcCatch } });
    expect(document(raw({ roomInMap: -1, memberId: 'p0' })).run?.pcCatch).toBeNull();
    expect(document(raw({ roomInMap: 1.5, memberId: 'p0' })).run?.pcCatch).toBeNull();
    expect(document(raw({ roomInMap: 2, memberId: '' })).run?.pcCatch).toBeNull();
    expect(document(raw({ roomInMap: 2, memberId: 7 })).run?.pcCatch).toBeNull();
    expect(document(raw('catch-1')).run?.pcCatch).toBeNull();
    expect(document(raw(null)).run?.pcCatch).toBeNull();
  });

  it('re-keys a saved run whose members share an id', () => {
    const party = [0, 1].map(() => createRunPokemon({ id: 'wild', speciesId: 'sentret', level: 3 }));
    const run: RunState = {
      ...sampleRun(),
      party,
      pcCatch: { roomInMap: 2, memberId: 'wild' },
      stats: { catches: 2, casualties: 0 },
    };
    const decoded = document(encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run, history: [] }));
    expect(decoded.run?.party.map((member) => member.fighter.id)).toEqual(['wild', 'catch-1']);
    expect(decoded.run?.pcCatch).toEqual({ roomInMap: 2, memberId: 'catch-1' });
    expect(decoded.run?.stats).toEqual({ catches: 2, casualties: 0 });
  });

  it('round-trips a run whose ids are already unique', () => {
    const run = sampleRun();
    const decoded = document(encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run, history: [] }));
    expect(decoded.run?.party.map((member) => member.fighter.id)).toEqual(
      run.party.map((member) => member.fighter.id),
    );
    expect(decoded.run?.box.map((member) => member.fighter.id)).toEqual(['boxed']);
    expect(decoded.run).toEqual(run);
  });

  it('drops a member whose species the dex no longer knows', () => {
    const run = sampleRun();
    const stale = { ...run.party[0], fighter: { ...run.party[0].fighter, speciesId: 'missingno' } };
    const decoded = document(
      JSON.stringify({ version: SAVE_VERSION, run: { ...run, party: [run.party[0], stale], box: [] } }),
    );
    expect(decoded.run?.party).toHaveLength(1);
  });

  it('clamps a level past the ceiling', () => {
    const run = sampleRun();
    const deep = { ...run.party[0], fighter: { ...run.party[0].fighter, level: MAX_LEVEL + 50 } };
    const decoded = document(
      JSON.stringify({ version: SAVE_VERSION, run: { ...run, party: [deep], box: [] } }),
    );
    expect(decoded.run?.party[0].fighter.level).toBe(MAX_LEVEL);
  });
});

describe('migrateDocument', () => {
  const steps: Migrations = {
    0: (doc) => ({ ...doc, tapped: true }),
    1: (doc) => ({ ...doc, tappedAgain: true }),
  };

  it('runs every step between two versions, in order', () => {
    expect(migrateDocument({ value: 1 }, 0, 2, steps)).toEqual({
      value: 1,
      tapped: true,
      tappedAgain: true,
    });
  });

  it('stops at a missing step', () => {
    expect(migrateDocument({}, 0, 2, { 0: steps[0] })).toBeNull();
  });

  it('returns the document untouched when no step is needed', () => {
    const doc = { value: 1 };
    expect(migrateDocument(doc, 1, 1, steps)).toBe(doc);
  });

  it('upgrades a pre-envelope document end to end, once a step exists', () => {
    const run = sampleRun();
    const legacy = JSON.stringify({ textSpeed: 'fast', volume: 0.25, run });
    // One step per version boundary, because the test starts at v0 and the
    // current schema is v24.
    const migrations: Migrations = {
      0: (doc) => ({ ...doc, version: 1, settings: { textSpeed: doc.textSpeed, volume: doc.volume } }),
      1: (doc) => ({ ...doc, version: 2 }),
      2: (doc) => ({ ...doc, version: 3 }),
      3: (doc) => ({
        ...doc,
        version: 4,
        settings: { ...(doc.settings as object), keybinds: DEFAULT_KEYBINDS },
      }),
      4: (doc) => ({ ...doc, version: 5 }),
      5: (doc) => ({ ...doc, version: 6 }),
      6: (doc) => ({ ...doc, version: 7 }),
      7: (doc) => ({ ...doc, version: 8 }),
      8: (doc) => ({ ...doc, version: 9 }),
      9: (doc) => ({ ...doc, version: 10 }),
      10: (doc) => ({ ...doc, version: 11 }),
      11: (doc) => ({ ...doc, version: 12 }),
      12: (doc) => ({ ...doc, version: 13 }),
      13: (doc) => ({ ...doc, version: 14 }),
      14: (doc) => ({ ...doc, version: 15 }),
      15: (doc) => ({ ...doc, version: 16 }),
      16: (doc) => ({ ...doc, version: 17 }),
      17: (doc) => ({ ...doc, version: 18 }),
      18: (doc) => ({ ...doc, version: 19 }),
      19: (doc) => ({ ...doc, version: 20 }),
      20: (doc) => ({ ...doc, version: 21 }),
      21: (doc) => ({ ...doc, version: 22 }),
      22: (doc) => ({ ...doc, version: 23 }),
      23: (doc) => ({ ...doc, version: SAVE_VERSION }),
    };
    const decoded = decodeSave(legacy, migrations);
    expect(decoded.settings).toEqual({
      textSpeed: 'fast',
      volume: 0.25,
      alwaysRun: DEFAULT_ALWAYS_RUN,
      hudTransparent: DEFAULT_HUD_TRANSPARENT,
      hudLayout: defaultHudLayout(),
      keybinds: DEFAULT_KEYBINDS,
      reducedFlash: DEFAULT_REDUCED_FLASH,
      aiLevel: DEFAULT_AI_LEVEL,
      language: DEFAULT_LANGUAGE,
    });
    expect(decoded.run).toEqual(run);
  });
});

describe('map-position migration', () => {
  it('adds the floor, the room and the discovery set to a v5 run', () => {
    const run: Record<string, unknown> = { ...sampleRun(), routeIndex: 9 };
    delete run.mapIndex;
    delete run.routeInMap;
    delete run.discoveredRooms;
    const raw = JSON.stringify({ version: 5, settings: { textSpeed: 'fast', volume: 0.5 }, run });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    const position = floorForRoute(run.seed as string, 9);
    expect(decoded.run?.mapIndex).toBe(position.mapIndex);
    expect(decoded.run?.routeInMap).toBe(position.roomInMap);
    expect(decoded.run?.discoveredRooms).toEqual(
      Array.from({ length: position.roomInMap + 1 }, (_, id) => id),
    );
  });

  it('adds the bossDefeated flag to a v6 run', () => {
    const run: Record<string, unknown> = { ...sampleRun(), bossDefeated: true };
    delete run.bossDefeated;
    const raw = JSON.stringify({ version: 6, run });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.run?.bossDefeated).toBe(false);
  });

  it('adds the arrival edge to a v7 run', () => {
    const run: Record<string, unknown> = { ...sampleRun() };
    delete run.arrivalEdge;
    delete run.capturedRooms;
    const raw = JSON.stringify({ version: 7, run });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    const decodedRun = decoded.run!;
    const plan = planMap(decodedRun.seed, decodedRun.mapIndex);
    expect(decodedRun.arrivalEdge).toBe(arrivalEdgeFor(plan, decodedRun.routeInMap));
  });

  it('turns a v8 captureUsed boolean into the v9 capturedRooms list', () => {
    const run: Record<string, unknown> = { ...sampleRun(), routeInMap: 2, captureUsed: true };
    delete run.capturedRooms;
    const raw = JSON.stringify({ version: 8, run });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.run?.capturedRooms).toEqual([2]);
  });

  it('maps a v8 run with no capture to an empty capturedRooms list', () => {
    const run: Record<string, unknown> = { ...sampleRun(), captureUsed: false };
    delete run.capturedRooms;
    const raw = JSON.stringify({ version: 8, run });
    const decoded = decodeSave(raw);
    expect(decoded.run?.capturedRooms).toEqual([]);
  });

  it('adds the money counter to a v13 run', () => {
    const run: Record<string, unknown> = { ...sampleRun() };
    delete run.money;
    const raw = JSON.stringify({ version: 13, run });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.run?.money).toBe(0);
  });

  it('turns a v15 floor catch list into an empty route catch', () => {
    const run: Record<string, unknown> = { ...sampleRun(), pcUnlocked: ['catch-1'] };
    delete run.pcCatch;
    const raw = JSON.stringify({ version: 15, run });
    const decoded = decodeSave(raw);
    expect(emptySave().version).toBe(24);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.run?.pcCatch).toBeNull();
    expect('pcUnlocked' in (decoded.run ?? {})).toBe(false);
    expect(decoded.run?.party).toHaveLength(6);
  });
});

describe('the RIP list', () => {
  it('adds an empty RIP list to a v16 run', () => {
    const run: Record<string, unknown> = { ...sampleRun() };
    delete run.rip;
    const raw = JSON.stringify({ version: 16, run });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.run?.rip).toEqual([]);
    expect(decoded.run?.party).toHaveLength(6);
  });

  it("round-trips a current-schema RIP list with its member's 0 HP", () => {
    const base = createRunPokemon({ id: 'fallen', speciesId: 'sentret', level: 3 });
    const dead = { ...base, fighter: { ...base.fighter, hp: 0 } };
    const withFallen: RunState = {
      ...sampleRun(),
      rip: [dead],
      stats: { catches: 2, casualties: 1 },
    };
    const decoded = document(
      encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run: withFallen, history: [] }),
    );
    expect(decoded.run?.rip.map((member) => member.fighter.id)).toEqual(['fallen']);
    expect(decoded.run?.rip[0].fighter.hp).toBe(0);
    expect(decoded.run?.party).toHaveLength(6);
  });
});

describe('the caught-species record', () => {
  it('adds an empty record to a v17 run, party intact', () => {
    const run: Record<string, unknown> = { ...sampleRun() };
    delete run.caughtSpecies;
    const raw = JSON.stringify({ version: 17, run });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.run?.caughtSpecies).toEqual([]);
    expect(decoded.run?.party).toHaveLength(6);
  });

  it('round-trips the record unchanged on the current schema', () => {
    const run: RunState = { ...sampleRun(), caughtSpecies: ['sentret', 'raichualola'] };
    const decoded = document(encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run, history: [] }));
    expect(decoded.run?.caughtSpecies).toEqual(['sentret', 'raichualola']);
    expect(decoded.run?.party).toHaveLength(6);
  });

  it('drops duplicate and empty ids while keeping catch order', () => {
    const run = { ...sampleRun(), caughtSpecies: ['sentret', '', 'raichualola', 'sentret', 42] };
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run }));
    expect(decoded.run?.caughtSpecies).toEqual(['sentret', 'raichualola']);
  });
});

describe('the floor mission', () => {
  it('round-trips the mission and its three counters', () => {
    const run: RunState = {
      ...sampleRun(),
      mission: { id: 'flawless', progress: 2, completed: true },
      missionsCompleted: 3,
      hpLost: 4,
      floorCasualties: 1,
    };
    const decoded = document(encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run, history: [] }));
    expect(decoded.run?.mission).toEqual({ id: 'flawless', progress: 2, completed: true });
    expect(decoded.run?.missionsCompleted).toBe(3);
    expect(decoded.run?.hpLost).toBe(4);
    expect(decoded.run?.floorCasualties).toBe(1);
  });

  it('adds a mission-less, clean floor to a v18 run', () => {
    const run: Record<string, unknown> = { ...sampleRun() };
    delete run.mission;
    delete run.missionsCompleted;
    delete run.hpLost;
    delete run.floorCasualties;
    const decoded = decodeSave(JSON.stringify({ version: 18, run }));
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.run?.mission).toBeNull();
    expect(decoded.run?.missionsCompleted).toBe(0);
    expect(decoded.run?.hpLost).toBe(0);
    expect(decoded.run?.floorCasualties).toBe(0);
    expect(decoded.run?.party).toHaveLength(6);
  });

  it('clamps a floor casualty baseline the run never reached', () => {
    // The sample run carries one casualty, so a floor cannot claim a clean one.
    const run = sampleRun();
    const raw = (floorCasualties: unknown): string =>
      JSON.stringify({ version: SAVE_VERSION, run: { ...run, floorCasualties } });
    expect(document(raw(4)).run?.floorCasualties).toBe(1);
    expect(document(raw(1)).run?.floorCasualties).toBe(1);
    expect(document(raw(-2)).run?.floorCasualties).toBe(0);
    expect(document(raw('x')).run?.floorCasualties).toBe(0);
  });

  it('defaults a junk counter and drops a mission the table does not carry', () => {
    const run = sampleRun();
    const raw = (patch: Record<string, unknown>): string =>
      JSON.stringify({ version: SAVE_VERSION, run: { ...run, ...patch } });
    expect(document(raw({ missionsCompleted: -1 })).run?.missionsCompleted).toBe(0);
    expect(document(raw({ missionsCompleted: 2.5 })).run?.missionsCompleted).toBe(0);
    expect(document(raw({ hpLost: 1.5 })).run?.hpLost).toBe(0);
    expect(document(raw({ hpLost: -3 })).run?.hpLost).toBe(0);
    expect(
      document(raw({ mission: { id: 'no-such-mission', progress: 0, completed: false } })).run?.mission,
    ).toBeNull();
    expect(
      document(raw({ mission: { id: 'flawless', progress: -1, completed: false } })).run?.mission,
    ).toBeNull();
    expect(
      document(raw({ mission: { id: 'flawless', progress: 0, completed: 'yes' } })).run?.mission,
    ).toBeNull();
    expect(document(raw({ mission: 'flawless' })).run?.mission).toBeNull();
  });
});

describe('nickname migration', () => {
  it('reads a v14 run as a current-schema run with its members intact and unnamed', () => {
    const raw = JSON.stringify({ version: 14, settings: defaultSettings(), run: sampleRun() });
    const decoded = decodeSave(raw);
    expect(SAVE_VERSION).toBe(24);
    expect(decoded.version).toBe(24);
    expect(decoded.run?.party).toHaveLength(6);
    expect(decoded.run?.party[0].fighter.speciesId).toBe('charmander');
    expect(decoded.run?.box[0].fighter.speciesId).toBe('greedent');
    expect('nickname' in (decoded.run?.party[0].fighter ?? {})).toBe(false);
  });

  it('round-trips a nickname on the current schema', () => {
    const run = sampleRun();
    const named: RunState = {
      ...run,
      party: run.party.map((member, index) =>
        index === 0 ? { ...member, fighter: { ...member.fighter, nickname: 'Sparky' } } : member,
      ),
    };
    const decoded = document(
      encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run: named, history: [] }),
    );
    expect(decoded.run?.party[0].fighter.nickname).toBe('Sparky');
    expect(decoded.run?.party[1].fighter.nickname).toBeUndefined();
    expect('nickname' in (decoded.run?.party[1].fighter ?? {})).toBe(false);
  });

  it('sanitises a stored nickname, and drops a malformed one rather than the member', () => {
    const raw = (nickname: unknown): string => {
      const run: Record<string, unknown> = { ...sampleRun() };
      const party = run.party as Record<string, unknown>[];
      const [first, ...rest] = party;
      const fighter = first.fighter as Record<string, unknown>;
      const member: Record<string, unknown> = { ...first, fighter: { ...fighter, nickname } };
      return JSON.stringify({ version: SAVE_VERSION, run: { ...run, party: [member, ...rest] } });
    };

    expect(document(raw('  Sparky  ')).run?.party[0].fighter.nickname).toBe('Sparky');
    expect(document(raw('ABCDEFGHIJKLMNOP')).run?.party[0].fighter.nickname).toBe('ABCDEFGHIJKL');
    expect(document(raw(7)).run?.party).toHaveLength(6);
    expect('nickname' in (document(raw(7)).run?.party[0].fighter ?? {})).toBe(false);
    expect(document(raw('   ')).run?.party).toHaveLength(6);
    expect(document(raw('   ')).run?.party[0].fighter.nickname).toBeUndefined();
  });
});

describe('the NPC member words', () => {
  /** A run whose party, box and rip each carry one crash-test member. */
  function editedRun(): RunState {
    const run = sampleRun();
    const party = run.party.map((member, index) =>
      index === 0
        ? { ...member, taughtMoves: ['earthquake', 'roost'], secondAbility: 'Pickup' }
        : member,
    );
    const box = run.box.map((member) => ({ ...member, taughtMoves: ['icebeam'] }));
    const rip = run.box.map((member) => ({
      ...member,
      secondAbility: 'Honey Gather',
    }));
    return { ...run, party, box, rip };
  }

  it('round-trips both words on a party, a box and a rip member, byte-stable', () => {
    const run = editedRun();
    const encoded = encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run, history: [] });
    const decoded = decodeSave(encoded);
    expect(decoded.run?.party[0].taughtMoves).toEqual(['earthquake', 'roost']);
    expect(decoded.run?.party[0].secondAbility).toBe('Pickup');
    expect(decoded.run?.party[0].fighter.ability).not.toBe('Pickup');
    expect(decoded.run?.box[0].taughtMoves).toEqual(['icebeam']);
    expect(decoded.run?.box[0].secondAbility).toBeUndefined();
    expect(decoded.run?.rip[0].secondAbility).toBe('Honey Gather');
    expect(decoded.run?.rip[0].taughtMoves).toBeUndefined();
    // Neither word appears on a member that never carried one, and the canonical
    // re-encode of the decoded run is stable.
    expect('taughtMoves' in (decoded.run?.party[1] ?? {})).toBe(false);
    expect('secondAbility' in (decoded.run?.party[1] ?? {})).toBe(false);
    const canonical = encodeSave({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: decoded.run!,
      history: [],
    });
    const again = encodeSave({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: decodeSave(canonical).run!,
      history: [],
    });
    expect(again).toBe(canonical);
    const stored = JSON.parse(canonical);
    expect(Object.keys(stored.run.party[0])).toEqual(['fighter', 'taughtMoves', 'secondAbility']);
    expect(Object.keys(stored.run.party[1])).toEqual(['fighter']);
  });

  it('migrates a v19 run to v24 with no taught moves and no second ability', () => {
    const run: Record<string, unknown> = { ...sampleRun() };
    const legacy = JSON.stringify({ version: 19, settings: defaultSettings(), run });
    const decoded = decodeSave(legacy);
    expect(decoded.version).toBe(24);
    expect(decoded.run?.party).toHaveLength(6);
    for (const member of decoded.run?.party ?? []) {
      expect('taughtMoves' in member).toBe(false);
      expect('secondAbility' in member).toBe(false);
    }
  });

  it('drops a malformed taughtMoves or secondAbility to none, never the member', () => {
    const raw = (extra: Record<string, unknown>): string => {
      const run: Record<string, unknown> = { ...sampleRun() };
      const party = run.party as Record<string, unknown>[];
      const [first, ...rest] = party;
      return JSON.stringify({
        version: SAVE_VERSION,
        run: { ...run, party: [{ ...first, ...extra }, ...rest] },
      });
    };
    const kept = document(raw({ taughtMoves: ['earthquake', 7, '', 'no-such-move', 'EARTHQUAKE'] }));
    expect(kept.run?.party).toHaveLength(6);
    expect(kept.run?.party[0].taughtMoves).toEqual(['earthquake']);
    expect(document(raw({ taughtMoves: 'earthquake' })).run?.party[0].taughtMoves).toBeUndefined();
    expect(document(raw({ taughtMoves: [] })).run?.party[0].taughtMoves).toBeUndefined();
    expect(document(raw({ secondAbility: '' })).run?.party[0].secondAbility).toBeUndefined();
    expect(document(raw({ secondAbility: 3 })).run?.party[0].secondAbility).toBeUndefined();
    expect(document(raw({ secondAbility: null })).run?.party[0].secondAbility).toBeUndefined();
  });
});

describe('storage', () => {
  it('reads a missing slot as an empty save', () => {
    expect(loadSave(new MemoryStorage())).toEqual(emptySave());
    expect(loadSave(null)).toEqual(emptySave());
  });

  it('round-trips a run through the slot', () => {
    const storage = new MemoryStorage();
    const run = sampleRun();
    storeRun(storage, run);
    expect(loadSave(storage).run).toEqual(run);
    expect(storage.data.has(SAVE_KEY)).toBe(true);
  });

  it('keeps the settings when the run is stored or cleared', () => {
    const storage = new MemoryStorage();
    const settings = { ...defaultSettings(), textSpeed: 'fast' as const, volume: 0.3 };
    storeSettings(storage, settings);
    storeRun(storage, sampleRun());
    expect(loadSave(storage).settings).toEqual(settings);

    clearRun(storage);
    expect(loadSave(storage)).toEqual({
      version: SAVE_VERSION,
      settings,
      run: null,
      history: [],
    });
  });

  it('keeps the run when the settings are stored', () => {
    const storage = new MemoryStorage();
    const run = sampleRun();
    storeRun(storage, run);
    storeSettings(storage, { ...defaultSettings(), textSpeed: 'slow', volume: 0.2 });
    const decoded = loadSave(storage);
    expect(decoded.run).toEqual(run);
    expect(decoded.settings.textSpeed).toBe('slow');
    expect(decoded.settings.volume).toBeCloseTo(0.2);
  });

  it('never throws when the slot is blocked', () => {
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    };
    expect(loadSave(blocked)).toEqual(emptySave());
    expect(() => storeSave(blocked, emptySave())).not.toThrow();
    expect(() => storeSave(null, emptySave())).not.toThrow();
  });
});

describe('storedSettingsLanguage', () => {
  it('reads no language without a slot, storage or a settings object', () => {
    expect(storedSettingsLanguage(null)).toBeNull();
    expect(storedSettingsLanguage(new MemoryStorage())).toBeNull();

    const truncated = new MemoryStorage();
    truncated.setItem(SAVE_KEY, '{"version":16,"settings":');
    expect(storedSettingsLanguage(truncated)).toBeNull();

    const noSettings = new MemoryStorage();
    noSettings.setItem(SAVE_KEY, JSON.stringify({ version: 16, run: null }));
    expect(storedSettingsLanguage(noSettings)).toBeNull();

    const junk = new MemoryStorage();
    junk.setItem(SAVE_KEY, JSON.stringify({ version: 16, settings: { language: 'fr' } }));
    expect(storedSettingsLanguage(junk)).toBeNull();

    const blocked: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(storedSettingsLanguage(blocked)).toBeNull();
  });

  it('reads the language a stored document carries', () => {
    const storage = new MemoryStorage();
    storeSettings(storage, { ...defaultSettings(), language: 'es' });
    expect(storedSettingsLanguage(storage)).toBe('es');
    storeSettings(storage, defaultSettings());
    expect(storedSettingsLanguage(storage)).toBe('en');
  });
});

describe('the run modifiers', () => {
  const MODIFIERS = { curse: true, forcedField: { id: 'rain', floorsLeft: 2 }, nextWildType: 'bug' };

  /** A document at the current version whose run carries `modifiers` as given. */
  function raw(modifiers: unknown): string {
    const run: Record<string, unknown> = { ...sampleRun() };
    if (modifiers === undefined) delete run.modifiers;
    else run.modifiers = modifiers;
    return JSON.stringify({ version: SAVE_VERSION, run });
  }

  it('stamps version 24', () => {
    expect(SAVE_VERSION).toBe(24);
    expect(emptySave().version).toBe(24);
    expect(SAVE_MIGRATIONS[20]).toBeDefined();
  });

  it('round-trips a run carrying all three facts', () => {
    const run: RunState = { ...sampleRun(), modifiers: MODIFIERS };
    const decoded = document(encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run, history: [] }));
    expect(decoded.run?.modifiers).toEqual(MODIFIERS);
    // Byte-stable: the record the decoder reads re-encodes to the same document.
    const canonical = encodeSave({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: decoded.run!,
      history: [],
    });
    expect(
      encodeSave({
        version: SAVE_VERSION,
        settings: defaultSettings(),
        run: decodeSave(canonical).run!,
        history: [],
      }),
    ).toBe(canonical);
  });

  it('reads a run with no modifiers record as the empty one', () => {
    expect(document(raw(undefined)).run?.modifiers).toEqual({
      curse: false,
      forcedField: null,
      nextWildType: null,
    });
    expect(document(raw('rain')).run?.modifiers).toEqual({
      curse: false,
      forcedField: null,
      nextWildType: null,
    });
  });

  it('keeps the curse only when it is exactly true, and the type only when it is a string', () => {
    expect(document(raw({ curse: 'yes' })).run?.modifiers.curse).toBe(false);
    expect(document(raw({ curse: true })).run?.modifiers.curse).toBe(true);
    expect(document(raw({ nextWildType: 7 })).run?.modifiers.nextWildType).toBeNull();
    expect(document(raw({ nextWildType: '' })).run?.modifiers.nextWildType).toBeNull();
    expect(document(raw({ nextWildType: 'bug' })).run?.modifiers.nextWildType).toBe('bug');
  });

  it('drops a forced field with an unknown id, a zero count or a non-integer count', () => {
    const empty = { curse: false, forcedField: null, nextWildType: null };
    expect(
      document(raw({ forcedField: { id: 'no-such-field', floorsLeft: 2 } })).run?.modifiers,
    ).toEqual(empty);
    expect(document(raw({ forcedField: { id: 'rain', floorsLeft: 0 } })).run?.modifiers).toEqual(empty);
    expect(document(raw({ forcedField: { id: 'rain', floorsLeft: 1.5 } })).run?.modifiers).toEqual(
      empty,
    );
    expect(document(raw({ forcedField: { id: '', floorsLeft: 2 } })).run?.modifiers).toEqual(empty);
    expect(document(raw({ forcedField: 'rain' })).run?.modifiers).toEqual(empty);
    expect(document(raw({ forcedField: { id: 'sun', floorsLeft: 1 } })).run?.modifiers).toEqual({
      curse: false,
      forcedField: { id: 'sun', floorsLeft: 1 },
      nextWildType: null,
    });
  });

  it('migrates a v20 run to an empty record', () => {
    const run: Record<string, unknown> = { ...sampleRun() };
    delete run.modifiers;
    const legacy = JSON.stringify({ version: 20, settings: defaultSettings(), run });
    const decoded = decodeSave(legacy);
    expect(decoded.version).toBe(24);
    expect(decoded.run?.modifiers).toEqual({ curse: false, forcedField: null, nextWildType: null });
    expect(decoded.run?.party).toHaveLength(6);
  });

  it('migrates a v19 run through every step', () => {
    const run: Record<string, unknown> = { ...sampleRun() };
    delete run.modifiers;
    const legacy = JSON.stringify({ version: 19, settings: defaultSettings(), run });
    const decoded = decodeSave(legacy);
    expect(decoded.version).toBe(24);
    expect(decoded.run?.modifiers).toEqual({ curse: false, forcedField: null, nextWildType: null });
    expect(decoded.run?.party).toHaveLength(6);
    for (const member of decoded.run?.party ?? []) {
      expect('taughtMoves' in member).toBe(false);
      expect('secondAbility' in member).toBe(false);
    }
  });
});

describe('the per-member usage counter', () => {
  it('stamps version 24 and carries the 21 step', () => {
    expect(SAVE_VERSION).toBe(24);
    expect(SAVE_MIGRATIONS[21]).toBeDefined();
  });

  it('round-trips a member that has fought, byte-stably', () => {
    const run: RunState = {
      ...sampleRun(),
      party: sampleRun().party.map((member, index) =>
        index === 0 ? { ...member, battlesUsed: 3 } : member,
      ),
    };
    const encoded = encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run, history: [] });
    const decoded = document(encoded);
    expect(decoded.version).toBe(24);
    expect(decoded.run?.party[0].battlesUsed).toBe(3);
    const canonical = encodeSave({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: decoded.run!,
      history: [],
    });
    // A second round trip is byte-stable: the counter's own place survives.
    const twice = encodeSave({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: document(canonical).run!,
      history: [],
    });
    expect(twice).toBe(canonical);
    expect(canonical).toContain('"battlesUsed":3');
  });

  it('writes no field for a member that never fought', () => {
    const encoded = encodeSave({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: sampleRun(),
      history: [],
    });
    expect(encoded).not.toContain('battlesUsed');
    const decoded = document(encoded);
    for (const member of decoded.run?.party ?? []) {
      expect('battlesUsed' in member).toBe(false);
    }
  });

  it('migrates a v21 run with no counter and no field written', () => {
    const legacy = JSON.stringify({ version: 21, settings: defaultSettings(), run: sampleRun() });
    const decoded = decodeSave(legacy);
    expect(decoded.version).toBe(24);
    expect(decoded.run?.party).toHaveLength(6);
    for (const member of decoded.run?.party ?? []) {
      expect('battlesUsed' in member).toBe(false);
    }
  });
});

describe('the coloured candy and the stat treats (Task-103)', () => {
  const atkAndSpe = { atk: 1, spe: -1 };

  /** The sample run with the lead's fighter carrying `statTreats` as given. */
  function runWithTreats(statTreats: unknown): Record<string, unknown> {
    const run: Record<string, unknown> = { ...sampleRun() };
    const party = run.party as Record<string, unknown>[];
    const [first, ...rest] = party;
    const fighter = { ...(first.fighter as Record<string, unknown>), statTreats };
    return { ...run, party: [{ ...first, fighter }, ...rest] };
  }

  it('stamps version 24 and carries the 22 step', () => {
    expect(SAVE_VERSION).toBe(24);
    expect(SAVE_MIGRATIONS[22]).toBeDefined();
  });

  it('round-trips a member carrying treats byte-stably', () => {
    const run: RunState = {
      ...sampleRun(),
      party: sampleRun().party.map((member, index) =>
        index === 0 ? { ...member, fighter: { ...member.fighter, statTreats: atkAndSpe } } : member,
      ),
    };
    const encoded = encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run, history: [] });
    const decoded = document(encoded);
    expect(decoded.run?.party[0].fighter.statTreats).toEqual(atkAndSpe);
    const canonical = encodeSave({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: decoded.run!,
      history: [],
    });
    expect(
      encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run: document(canonical).run!, history: [] }),
    ).toBe(canonical);
    expect(canonical).toContain('"statTreats":{"atk":1,"spe":-1}');
  });

  it('writes no key for a member that carries none', () => {
    const encoded = encodeSave({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: sampleRun(),
      history: [],
    });
    expect(encoded).not.toContain('statTreats');
    for (const member of document(encoded).run?.party ?? []) {
      expect('statTreats' in member.fighter).toBe(false);
    }
  });

  it('drops a zero, a non-integer and an unknown stat from the treats', () => {
    const treatsOf = (statTreats: unknown) =>
      document(
        JSON.stringify({ version: SAVE_VERSION, settings: defaultSettings(), run: runWithTreats(statTreats) }),
      ).run?.party[0].fighter.statTreats;
    expect(treatsOf({ atk: 2, def: 0 })).toEqual({ atk: 2 });
    expect(treatsOf({ atk: 1.5, def: 2 })).toEqual({ def: 2 });
    expect(treatsOf({ hp: 2, accuracy: 3 })).toEqual({ hp: 2 });
    expect(treatsOf({ atk: 0 })).toBeUndefined();
    expect(treatsOf('junk')).toBeUndefined();
    expect(treatsOf({})).toBeUndefined();
  });

  it('round-trips the discovered candy set in order', () => {
    const run: RunState = { ...sampleRun(), discoveredCandy: ['red', 'blue'] };
    const decoded = document(encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run, history: [] }));
    expect(decoded.run?.discoveredCandy).toEqual(['red', 'blue']);
    const canonical = encodeSave({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: decoded.run!,
      history: [],
    });
    expect(
      encodeSave({ version: SAVE_VERSION, settings: defaultSettings(), run: document(canonical).run!, history: [] }),
    ).toBe(canonical);
  });

  it('keeps every non-empty colour once and defaults a missing or malformed set to empty', () => {
    const coloursOf = (discoveredCandy: unknown) => {
      const run: Record<string, unknown> = { ...sampleRun(), discoveredCandy };
      return document(JSON.stringify({ version: SAVE_VERSION, run })).run?.discoveredCandy;
    };
    expect(coloursOf(['red', 'red', '', 7, 'blue'])).toEqual(['red', 'blue']);
    expect(coloursOf('red')).toEqual([]);
    expect(coloursOf(undefined)).toEqual([]);
    expect(document(JSON.stringify({ version: SAVE_VERSION, run: sampleRun() })).run?.discoveredCandy).toEqual(
      [],
    );
  });

  it('migrates a v22 run to v24 with no treats and an empty discovered set', () => {
    const legacy = JSON.stringify({ version: 22, settings: defaultSettings(), run: sampleRun() });
    const decoded = decodeSave(legacy);
    expect(decoded.version).toBe(24);
    expect(decoded.run?.discoveredCandy).toEqual([]);
    expect(decoded.run?.party).toHaveLength(6);
    for (const member of [...(decoded.run?.party ?? []), ...(decoded.run?.box ?? [])]) {
      expect('statTreats' in member.fighter).toBe(false);
    }
  });
});

describe('the run history (Task-152)', () => {
  const IVS = { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 };
  const EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  const FINISHED: RunHistoryRecord = {
    seed: 'seed-a',
    mode: 'finite',
    mapReached: 3,
    catches: 5,
    casualties: 2,
    playtimeMs: 540000,
    won: false,
    endedAt: '2026-10-25T12:00:00.000Z',
    species: [{ speciesId: 'pikachu', kos: 7, damage: 412 }],
  };

  const WON: RunHistoryRecord = {
    ...FINISHED,
    seed: 'seed-b',
    mode: 'infinite',
    mapReached: 9,
    won: true,
    endedAt: '2026-10-24T08:30:00.000Z',
    species: [],
  };

  /** A v23 document written out in full: settings, a one-member run and no history. */
  const V23_DOCUMENT = JSON.stringify({
    version: 23,
    settings: {
      textSpeed: 'normal',
      volume: 0.8,
      alwaysRun: true,
      reducedFlash: false,
      aiLevel: 'normal',
      language: 'en',
    },
    run: {
      seed: 'seed-a',
      mode: 'finite',
      routeIndex: 1,
      party: [
        {
          fighter: {
            id: 'p0',
            speciesId: 'charmander',
            level: 5,
            nature: 'hardy',
            ability: 'Blaze',
            gender: 'male',
            shiny: false,
            heldItem: null,
            ivs: IVS,
            evs: EVS,
            moves: [{ moveId: 'scratch', pp: 35, maxPp: 35 }],
            hp: 20,
            status: null,
            statusCounter: 0,
          },
        },
      ],
      box: [],
      bag: [],
    },
  });

  /** A v24 document whose run is the sample one and whose history is as given. */
  function historyDocument(history: unknown): string {
    return JSON.stringify({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: sampleRun(),
      history,
    });
  }

  it('stamps version 24 and carries the 23 step', () => {
    expect(SAVE_VERSION).toBe(24);
    expect(emptySave().version).toBe(24);
    expect(SAVE_MIGRATIONS[23]).toBeDefined();
  });

  it('moves a v23 document onto version 24 with an empty history, run intact', () => {
    const decoded = decodeSave(V23_DOCUMENT);
    expect(decoded.version).toBe(24);
    expect(decoded.history).toEqual([]);
    expect(decoded.run?.seed).toBe('seed-a');
    expect(decoded.run?.routeIndex).toBe(1);
    expect(decoded.run?.party).toHaveLength(1);
    expect(decoded.run?.party[0].fighter.speciesId).toBe('charmander');
    expect(decoded.run?.stats).toEqual({ catches: 0, casualties: 0 });
  });

  it('adds the empty history in the 23 step itself', () => {
    expect(SAVE_MIGRATIONS[23]?.({ version: 23, run: null })).toEqual({
      version: 24,
      run: null,
      history: [],
    });
  });

  it('round-trips a current-schema history byte-identically', () => {
    const encoded = encodeSave({
      version: SAVE_VERSION,
      settings: defaultSettings(),
      run: sampleRun(),
      history: [FINISHED, WON],
    });
    const decoded = decodeSave(encoded);
    expect(decoded.history).toEqual([FINISHED, WON]);
    expect(decoded.run).toEqual(sampleRun());
    // The decoder's own document is canonical: re-encoding it is stable, and the
    // history travels as the last top-level key.
    const canonical = encodeSave({ ...decoded });
    expect(encodeSave({ ...decodeSave(canonical) })).toBe(canonical);
    expect(JSON.parse(canonical).history).toEqual([FINISHED, WON]);
    expect(canonical).toContain(
      '"history":[{"seed":"seed-a","mode":"finite","mapReached":3,"catches":5,"casualties":2,"playtimeMs":540000,"won":false,"endedAt":"2026-10-25T12:00:00.000Z","species":[{"speciesId":"pikachu","kos":7,"damage":412}]}',
    );
  });

  it('reads a junk, a broken row or a missing history as empty, keeping the run', () => {
    const run = sampleRun();
    const junk = document(historyDocument('nope'));
    expect(junk.history).toEqual([]);
    expect(junk.run).toEqual(run);

    const withoutSeed: Record<string, unknown> = { ...FINISHED };
    delete withoutSeed.seed;
    const broken = document(historyDocument([withoutSeed]));
    expect(broken.history).toEqual([]);
    expect(broken.run).toEqual(run);

    const mixed = document(historyDocument([FINISHED, withoutSeed, 7, null]));
    expect(mixed.history).toEqual([FINISHED]);
    expect(mixed.run).toEqual(run);

    const absent = document(
      JSON.stringify({ version: SAVE_VERSION, settings: defaultSettings(), run }),
    );
    expect(absent.history).toEqual([]);
    expect(absent.run).toEqual(run);
  });

  it('keeps the history across the run and the settings being written', () => {
    const storage = new MemoryStorage();
    storeSave(storage, { ...emptySave(), history: [FINISHED] });
    storeRun(storage, sampleRun());
    expect(loadSave(storage).history).toEqual([FINISHED]);
    storeSettings(storage, { ...defaultSettings(), volume: 0.1 });
    expect(loadSave(storage).history).toEqual([FINISHED]);
    expect(loadSave(storage).run).toEqual(sampleRun());
    clearRun(storage);
    expect(loadSave(storage).history).toEqual([FINISHED]);
  });
});

