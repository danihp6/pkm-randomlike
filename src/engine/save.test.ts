import { describe, expect, it } from 'vitest';
import { levelCapForRoute } from '../data/run';
import {
  addItem,
  addPokemon,
  createRun,
  createRunPokemon,
  markTrainerDefeated,
  useCapture,
  MAX_LEVEL,
  type RunState,
} from './run';
import {
  DEFAULT_TEXT_SPEED,
  DEFAULT_VOLUME,
  SAVE_KEY,
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
  type Migrations,
  type StorageLike,
} from './save';

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
    starter: createRunPokemon({ id: 'p0', speciesId: 'charmander', level: 5, moves: ['scratch', 'ember'] }),
  });
  for (let i = 1; i < 6; i++) {
    run = addPokemon(run, createRunPokemon({ id: `p${i}`, speciesId: 'sentret', level: 3 }));
  }
  run = addPokemon(run, createRunPokemon({ id: 'boxed', speciesId: 'greedent', level: 4 }));
  run = addItem(run, 'potion', 2);
  run = addItem(run, 'pokeball', 1);
  run = useCapture(run);
  run = markTrainerDefeated(run, 'trainer-1-0');
  return { ...run, stats: { catches: 2, casualties: 1 } };
}

function document(raw: string): ReturnType<typeof decodeSave> {
  return decodeSave(raw);
}

describe('defaults', () => {
  it('starts at normal speed and mostly loud', () => {
    expect(defaultSettings()).toEqual({ textSpeed: DEFAULT_TEXT_SPEED, volume: DEFAULT_VOLUME });
  });

  it('an empty save holds the defaults and no run', () => {
    expect(emptySave()).toEqual({ version: SAVE_VERSION, settings: defaultSettings(), run: null });
  });
});

describe('encodeSave', () => {
  it('stamps the current version and round-trips through decode', () => {
    const run = sampleRun();
    const encoded = encodeSave({
      version: 99,
      settings: { textSpeed: 'fast', volume: 0.4 },
      run,
    });
    expect(JSON.parse(encoded).version).toBe(SAVE_VERSION);

    const decoded = decodeSave(encoded);
    expect(decoded.settings).toEqual({ textSpeed: 'fast', volume: 0.4 });
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
    expect(decoded.settings).toEqual({ textSpeed: 'slow', volume: 0.1 });
  });

  it('drops an unmigratable older document', () => {
    const raw = JSON.stringify({ version: 0, textSpeed: 'fast' });
    expect(decodeSave(raw).run).toBeNull();
  });

  it('migrates a v1 run onto the current schema, adding the summary counters', () => {
    const v1run: Record<string, unknown> = { ...sampleRun() };
    delete v1run.stats;
    const raw = JSON.stringify({ version: 1, settings: { textSpeed: 'fast', volume: 0.25 }, run: v1run });
    const decoded = decodeSave(raw);
    expect(decoded.version).toBe(SAVE_VERSION);
    expect(decoded.settings).toEqual({ textSpeed: 'fast', volume: 0.25 });
    expect(decoded.run?.party).toHaveLength(6);
    expect(decoded.run?.stats).toEqual({ catches: 0, casualties: 0 });
  });
});

describe('settings validation', () => {
  it('repairs an unknown speed and clamps the volume', () => {
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, settings: { textSpeed: 'hyper', volume: 5 } }));
    expect(decoded.settings).toEqual({ textSpeed: DEFAULT_TEXT_SPEED, volume: 1 });
  });

  it('floors a negative volume and fills a missing one', () => {
    expect(document(JSON.stringify({ version: SAVE_VERSION, settings: { volume: -3 } })).settings).toEqual({
      textSpeed: DEFAULT_TEXT_SPEED,
      volume: 0,
    });
    expect(document(JSON.stringify({ version: SAVE_VERSION, settings: {} })).settings).toEqual(defaultSettings());
  });
});

describe('run validation', () => {
  it('recomputes the level cap from the route instead of trusting the save', () => {
    const run = { ...sampleRun(), routeIndex: 5, levelCap: 999 };
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run }));
    expect(decoded.run?.levelCap).toBe(levelCapForRoute(5));
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
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run: { ...run, bag: [{ itemId: 'potion' }] } }));
    expect(decoded.run).toBeNull();
  });

  it('defaults the flags and filters the trainer marks', () => {
    const run = sampleRun();
    const decoded = document(
      JSON.stringify({ version: SAVE_VERSION, run: { ...run, captureUsed: 'yes', defeatedTrainers: ['a', 4, null] } }),
    );
    expect(decoded.run?.captureUsed).toBe(false);
    expect(decoded.run?.defeatedTrainers).toEqual(['a']);
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
      JSON.stringify({ version: SAVE_VERSION, run: { ...run, stats: { catches: -2, casualties: 'x' } } }),
    );
    expect(decoded.run?.stats).toEqual({ catches: 0, casualties: 0 });
  });

  it('drops a member whose species the dex no longer knows', () => {
    const run = sampleRun();
    const stale = { ...run.party[0], fighter: { ...run.party[0].fighter, speciesId: 'missingno' } };
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run: { ...run, party: [run.party[0], stale], box: [] } }));
    expect(decoded.run?.party).toHaveLength(1);
  });

  it('clamps a level past the ceiling', () => {
    const run = sampleRun();
    const deep = { ...run.party[0], fighter: { ...run.party[0].fighter, level: MAX_LEVEL + 50 } };
    const decoded = document(JSON.stringify({ version: SAVE_VERSION, run: { ...run, party: [deep], box: [] } }));
    expect(decoded.run?.party[0].fighter.level).toBe(MAX_LEVEL);
  });
});

describe('migrateDocument', () => {
  const steps: Migrations = {
    0: (doc) => ({ ...doc, tapped: true }),
    1: (doc) => ({ ...doc, tappedAgain: true }),
  };

  it('runs every step between two versions, in order', () => {
    expect(migrateDocument({ value: 1 }, 0, 2, steps)).toEqual({ value: 1, tapped: true, tappedAgain: true });
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
    // Two steps, because the test starts at v0 and the current schema is v2.
    const migrations: Migrations = {
      0: (doc) => ({ ...doc, version: 1, settings: { textSpeed: doc.textSpeed, volume: doc.volume } }),
      1: (doc) => ({ ...doc, version: SAVE_VERSION }),
    };
    const decoded = decodeSave(legacy, migrations);
    expect(decoded.settings).toEqual({ textSpeed: 'fast', volume: 0.25 });
    expect(decoded.run).toEqual(run);
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
    storeSettings(storage, { textSpeed: 'fast', volume: 0.3 });
    storeRun(storage, sampleRun());
    expect(loadSave(storage).settings).toEqual({ textSpeed: 'fast', volume: 0.3 });

    clearRun(storage);
    expect(loadSave(storage)).toEqual({ version: SAVE_VERSION, settings: { textSpeed: 'fast', volume: 0.3 }, run: null });
  });

  it('keeps the run when the settings are stored', () => {
    const storage = new MemoryStorage();
    const run = sampleRun();
    storeRun(storage, run);
    storeSettings(storage, { textSpeed: 'slow', volume: 0.2 });
    const decoded = loadSave(storage);
    expect(decoded.run).toEqual(run);
    expect(decoded.settings.textSpeed).toBe('slow');
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
