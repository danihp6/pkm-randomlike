import { afterEach, describe, expect, it } from 'vitest';
import { createRun, createRunPokemon } from './engine/run';
import { defaultSettings, SAVE_KEY, type StorageLike } from './engine/save';
import { getLocale, setLocale } from './i18n';
import { applyVolume, browserLanguageTag, loadSettings, saveSettings } from './settings';

afterEach(() => {
  setLocale('en');
});

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

describe('loadSettings', () => {
  it('reads the defaults from an empty or absent slot', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(defaultSettings());
    expect(loadSettings(null)).toEqual(defaultSettings());
  });

  it('reads back what was saved', () => {
    const storage = new MemoryStorage();
    const settings = { ...defaultSettings(), textSpeed: 'fast' as const, volume: 0.3 };
    saveSettings(settings, storage);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it('writes the save slot the rest of the game reads', () => {
    const storage = new MemoryStorage();
    saveSettings(defaultSettings(), storage);
    expect(storage.data.has(SAVE_KEY)).toBe(true);
  });

  it('survives a blocked store', () => {
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    };
    expect(loadSettings(blocked)).toEqual(defaultSettings());
    expect(() => saveSettings(defaultSettings(), blocked)).not.toThrow();
  });
});

describe('browserLanguageTag', () => {
  it('reads no tag without a browser', () => {
    expect(browserLanguageTag()).toBe('');
  });
});

describe('the language', () => {
  it('defaults from the browser tag and stores what it detected', () => {
    const storage = new MemoryStorage();
    const loaded = loadSettings(storage, 'es-ES');
    expect(loaded.language).toBe('es');
    // The store keeps it, so the next boot cannot fall back to the source table.
    const second = loadSettings(storage);
    expect(second.language).toBe('es');
    expect(getLocale()).toBe('es');
  });

  it('reads the tag as English for anything but Spanish', () => {
    expect(loadSettings(new MemoryStorage(), 'fr-FR').language).toBe('en');
    expect(loadSettings(new MemoryStorage(), 'en-GB').language).toBe('en');
  });

  it('lets a stored choice win over the browser', () => {
    const storage = new MemoryStorage();
    saveSettings({ ...defaultSettings(), language: 'es' }, storage);
    expect(loadSettings(storage, 'fr-FR').language).toBe('es');
  });

  it('applies the locale on load and on save, with no restart', () => {
    const storage = new MemoryStorage();
    loadSettings(storage, 'es-ES');
    expect(getLocale()).toBe('es');
    saveSettings({ ...defaultSettings(), language: 'en' }, storage);
    expect(getLocale()).toBe('en');
    expect(loadSettings(storage).language).toBe('en');
    expect(getLocale()).toBe('en');
  });

  it('keeps the run in progress through the language write', () => {
    const storage = new MemoryStorage();
    const starter = createRunPokemon({
      id: 'starter',
      speciesId: 'charmander',
      level: 5,
      moves: ['scratch'],
    });
    const run = createRun({ seed: 'kept', starter });
    // A v16 document written before the language existed: no `language` key at all.
    const legacy = JSON.stringify({ version: 16, settings: { textSpeed: 'normal', volume: 0.8 }, run });
    storage.setItem(SAVE_KEY, legacy);
    expect(loadSettings(storage, 'es-ES').language).toBe('es');
    const raw = storage.getItem(SAVE_KEY);
    expect(raw).toContain('"seed":"kept"');
    expect(raw === null ? null : JSON.parse(raw).settings.language).toBe('es');
  });
});

describe('applyVolume', () => {
  it('pushes the stored volume into the sound manager', () => {
    const calls: number[] = [];
    const target = { setVolume: (volume: number) => calls.push(volume) };
    applyVolume(target, { ...defaultSettings(), volume: 0.4 });
    expect(calls).toEqual([0.4]);
  });
});
