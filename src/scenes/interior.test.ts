import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Scene {}
  return {
    default: {
      Scene,
      Scenes: { Events: { SHUTDOWN: 'shutdown', RESUME: 'resume' } },
      Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
      Input: { Keyboard: { KeyCodes: {}, JustDown: (): boolean => false } },
    },
  };
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RunState } from '../engine/run';
import { STARTER_LEVEL, emptyRun, takeStarter } from '../engine/run/prologue';
import { starterOffer } from '../engine/run/starters';
import { InteriorScene, labStarterOffer, regionSceneClass, regionSceneKey } from './InteriorScene';

/** The scene's own state, with the mounted panel stubbed. */
type SceneInternals = {
  run: RunState | null;
  seed: string;
  index: number;
  controller: { update(view: unknown): void; dispose(): void } | null;
  handleIntent(intent: { type: 'choose' | 'select'; index: number }): void;
};

function scene(run: RunState): SceneInternals {
  const instance = new InteriorScene() as unknown as SceneInternals;
  instance.run = run;
  instance.seed = run.seed;
  instance.index = 0;
  instance.controller = { update: vi.fn(), dispose: vi.fn() };
  return instance;
}

describe('the laboratory’s offer (Task-287)', () => {
  it('stands the seed’s three starter cards while the run is a prologue', () => {
    const offer = labStarterOffer(emptyRun('seed'), 'seed');

    expect(offer).toHaveLength(3);
    expect(offer).toEqual(starterOffer('seed'));
  });

  it('stands no card once the starter is taken', () => {
    const taken = takeStarter(emptyRun('seed'), 'charmander', STARTER_LEVEL);

    expect(taken.starterTaken).toBe(true);
    expect(labStarterOffer(taken, 'seed')).toEqual([]);
  });

  it('stands no card without a run at all', () => {
    expect(labStarterOffer(undefined, 'seed')).toEqual([]);
  });

  it('reads no clock and no storage: the same pair always gives the same offer', () => {
    const first = labStarterOffer(emptyRun('seed'), 'seed');
    const second = labStarterOffer(emptyRun('seed'), 'seed');

    expect(second).toEqual(first);
  });
});

describe('the professor’s pick', () => {
  it('takes the chosen card as the starter the run keeps', () => {
    const instance = scene(emptyRun('seed'));
    const offer = starterOffer('seed');

    instance.handleIntent({ type: 'choose', index: 1 });

    expect(instance.run?.starterTaken).toBe(true);
    expect(instance.run?.party).toHaveLength(1);
    expect(instance.run?.party[0]!.fighter.speciesId).toBe(offer[1]);
    expect(instance.run?.party[0]!.fighter.level).toBe(STARTER_LEVEL);
    expect(labStarterOffer(instance.run ?? undefined, 'seed')).toEqual([]);
  });

  it('repaints the panel after the pick, so an empty offer is drawn', () => {
    const instance = scene(emptyRun('seed'));
    const update = instance.controller!.update;

    instance.handleIntent({ type: 'choose', index: 0 });

    expect(update).toHaveBeenCalledTimes(2);
  });

  it('takes the first card on a click that arrives without a hover', () => {
    const instance = scene(emptyRun('seed'));

    instance.handleIntent({ type: 'choose', index: 0 });

    expect(instance.run?.party[0]!.fighter.speciesId).toBe(starterOffer('seed')[0]);
  });
});

describe('the scene’s region registration and its way out', () => {
  it('registers itself as the laboratory’s walkable room', () => {
    expect(regionSceneKey).toBe('Lab');
    expect(regionSceneClass).toBe(InteriorScene);
  });

  it('walks back to the town and exposes its own dev facts', () => {
    const source = readFileSync(fileURLToPath(new URL('./InteriorScene.ts', import.meta.url)), 'utf8');

    expect(source).toContain("this.scene.start('City', { run })");
    expect(source).toContain('__pkmInterior');
    expect(source).toContain('if (!IS_DEVELOP) return;');
    expect(source).toContain('mountStarter(');
    expect(source).toContain('takeStarter(');
    expect(source).not.toContain('Math.random');
    expect(source).not.toContain('Date.now');
  });
});
