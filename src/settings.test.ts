import { describe, expect, it } from 'vitest';
import { defaultSettings, SAVE_KEY, type StorageLike } from './engine/save';
import { applyVolume, loadSettings, saveSettings } from './settings';

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

describe('applyVolume', () => {
  it('pushes the stored volume into the sound manager', () => {
    const calls: number[] = [];
    const target = { setVolume: (volume: number) => calls.push(volume) };
    applyVolume(target, { ...defaultSettings(), volume: 0.4 });
    expect(calls).toEqual([0.4]);
  });
});
