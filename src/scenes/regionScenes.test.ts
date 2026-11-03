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

import { createRunPokemon } from '../engine/run/progression';
import { createRun } from '../engine/run/state';
import type { NodeWorld } from '../engine/region/preload';
import { RouteScene } from './RouteScene';
import { WORLD_ARRIVED } from './WorldScene';
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

  it('collects the folder itself: the city screen is its first region scene', () => {
    expect(Array.isArray(REGION_SCENES)).toBe(true);
    expect(REGION_SCENES.map((entry) => entry.key)).toStrictEqual(['City']);
  });
});

/**
 * The travel seam needs a live Phaser scene, so this file gives `travelToNode` the
 * surface it reads (the run, the preload, the event bus and the transition) and starts
 * it twice inside the preload window the way two presses on a marker do.
 */
function fakeTravelScene(preload: () => Promise<NodeWorld | null>) {
  const listeners: (() => void)[] = [];
  const run = createRun({
    seed: 'task-283',
    starter: createRunPokemon({
      id: 'starter',
      speciesId: 'charmander',
      level: 5,
      moves: ['scratch'],
    }),
  });
  const fake = {
    travelling: false,
    run,
    pendingBattle: null,
    releaseRoot: null,
    gameOver: false,
    travelFades: 0,
    travelCommits: 0,
    scene: { isActive: () => true },
    events: {
      once: (event: string, listener: () => void) => {
        if (event === WORLD_ARRIVED) listeners.push(listener);
      },
    },
    cachedWorld: () => null,
    preload,
    persistRun: () => undefined,
    transitionToNode: () => {
      for (const listener of listeners.splice(0)) listener();
    },
  };
  return fake;
}

describe('RouteScene.travelToNode, one flight at a time', () => {
  it('commits one travel for two presses started inside the preload window', async () => {
    let settle: (world: NodeWorld | null) => void = () => undefined;
    const fake = fakeTravelScene(
      () =>
        new Promise<NodeWorld | null>((resolve) => {
          settle = resolve;
        }),
    );
    const travelToNode = RouteScene.prototype.travelToNode;
    const first = travelToNode.call(fake as unknown as RouteScene, 'route:1', 'walk');
    // The guard is taken before `preload`'s await, so the second press is refused.
    expect(fake.travelling).toBe(true);
    const second = travelToNode.call(fake as unknown as RouteScene, 'city:1', 'walk');
    await expect(second).resolves.toBe(false);
    expect(fake.run.nodeKey).toBe('town:1');
    expect(fake.travelCommits).toBe(0);
    expect(fake.travelFades).toBe(0);

    settle({ key: 'route:1' } as unknown as NodeWorld);
    await expect(first).resolves.toBe(true);
    expect(fake.run.nodeKey).toBe('route:1');
    expect(fake.travelCommits).toBe(1);
    expect(fake.travelFades).toBe(1);
    expect(fake.travelling).toBe(false);
  });

  it('clears the guard when the node has no world, so a later press may travel', async () => {
    const fake = fakeTravelScene(() => Promise.resolve(null));
    const travelToNode = RouteScene.prototype.travelToNode;
    await expect(travelToNode.call(fake as unknown as RouteScene, 'route:1', 'walk')).resolves.toBe(
      false,
    );
    expect(fake.travelling).toBe(false);
    expect(fake.run.nodeKey).toBe('town:1');
    expect(fake.travelCommits).toBe(0);
    expect(fake.travelFades).toBe(0);
  });
});
