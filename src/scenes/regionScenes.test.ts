import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Scene {}
  return {
    default: {
      Scene,
      Scenes: { Events: { SHUTDOWN: 'shutdown', PAUSE: 'pause', RESUME: 'resume' } },
      Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
      Input: { Keyboard: { KeyCodes: {} } },
      Scale: { RESIZE: 5, NO_CENTER: 6 },
      AUTO: 0,
    },
  };
});

import { collectRegionScenes, REGION_SCENES } from './regionScenes';

const scene = (): unknown => class Scene {};

describe('collectRegionScenes', () => {
  it('collects a module that exports both markers', () => {
    const entry = { regionSceneKey: 'City', regionSceneClass: scene() };
    expect(collectRegionScenes({ './CityScene.ts': entry })).toStrictEqual([
      { key: 'City', Scene: entry.regionSceneClass },
    ]);
  });

  it('skips a module exporting one marker or none', () => {
    expect(
      collectRegionScenes({
        './keyOnly.ts': { regionSceneKey: 'Gym' },
        './classOnly.ts': { regionSceneClass: scene() },
        './helper.ts': { something: true },
        './WorldScene.ts': {},
        './not-a-module.ts': null,
        './a-number.ts': 7,
        './CityScene.ts': { regionSceneKey: 'City', regionSceneClass: scene() },
      }),
    ).toHaveLength(1);
  });

  it('throws on two modules claiming one key, naming both paths', () => {
    const modules = {
      './CityScene.ts': { regionSceneKey: 'City', regionSceneClass: scene() },
      './GymScene.ts': { regionSceneKey: 'City', regionSceneClass: scene() },
    };
    expect(() => collectRegionScenes(modules)).toThrow(
      /two region scenes claim the key City: \.\/CityScene\.ts, \.\/GymScene\.ts/,
    );
  });

  it('collects the folder itself, which holds no region node scene yet', () => {
    expect(Array.isArray(REGION_SCENES)).toBe(true);
    expect(REGION_SCENES).toStrictEqual([]);
  });
});
