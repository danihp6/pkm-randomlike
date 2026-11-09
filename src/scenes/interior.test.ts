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
import type { StarterIntent } from '../ui/hud/panels/starter';
import { InteriorScene, labStarterOffer, regionSceneClass, regionSceneKey } from './InteriorScene';

/** The scene's own state, with the mounted panel stubbed. */
type SceneInternals = {
  run: RunState | null;
  seed: string;
  index: number;
  controller: { update(view: unknown): void; dispose(): void } | null;
  handleIntent(intent: StarterIntent): void;
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

  it('drops the panel after the pick, instead of repainting an empty offer', () => {
    const instance = scene(emptyRun('seed'));
    const dispose = instance.controller!.dispose;
    const update = instance.controller!.update;

    instance.handleIntent({ type: 'choose', index: 0 });

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    expect(instance.controller).toBeNull();
  });

  it('drops the panel on cancel, with no gift at all', () => {
    const instance = scene(emptyRun('seed'));
    const dispose = instance.controller!.dispose;

    instance.handleIntent({ type: 'cancel' });

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(instance.controller).toBeNull();
    expect(instance.run?.starterTaken).toBe(false);
    expect(instance.run?.party).toEqual([]);
  });

  it('keeps the card the pointer hovers on, and repaints it', () => {
    const instance = scene(emptyRun('seed'));
    const update = instance.controller!.update;

    instance.handleIntent({ type: 'select', index: 2 });

    expect(instance.index).toBe(2);
    expect(update).toHaveBeenCalledTimes(1);
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

/** The room's table: the pick is opened by walking up to it, never on entry. */
describe('the laboratory’s table (Task-310)', () => {
  const SOURCE = readFileSync(fileURLToPath(new URL('./InteriorScene.ts', import.meta.url)), 'utf8');

  /** The body of the method whose signature starts at `signature`, braces balanced. */
  function bodyOf(signature: string): string {
    const at = SOURCE.indexOf(signature);
    expect(at, signature).toBeGreaterThanOrEqual(0);
    const open = SOURCE.indexOf('{', at);
    let depth = 0;
    for (let index = open; index < SOURCE.length; index++) {
      const char = SOURCE[index];
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) return SOURCE.slice(open, index + 1);
      }
    }
    return SOURCE.slice(open);
  }

  it('never mounts the pick on entry', () => {
    const create = bodyOf('override create(): void {');

    expect(create).not.toContain('createDom');
    expect(create).not.toContain('mountStarter(');
    expect(create).toContain('this.readStarterKeys()');
    expect(create).toContain('this.drawStarterBalls(interior)');
    expect(SOURCE).not.toContain('createDom');
  });

  it('opens the pick from the table, and the panel owns the room while it is up', () => {
    const update = bodyOf('override update(time: number, delta: number): void {');

    expect(update).toContain('nextToStarterBalls(');
    expect(update).toContain('this.openStarter()');
    expect(update).toContain('this.disposePanel()');
    expect(SOURCE).toContain('private openStarter(): void {');
    expect(SOURCE).toContain('mountStarter(host, this.view()');
  });

  it('reads interact, confirm and cancel off the shared keybind map', () => {
    expect(SOURCE).toContain("interact: bind('interact')");
    expect(SOURCE).toContain("confirm: bind('confirm')");
    expect(SOURCE).toContain("cancel: bind('cancel')");
    expect(SOURCE).toContain("if (keys.cancel.some(down)) return 'cancel';");
  });

  it('drops the panel on confirm and never repaints an empty offer', () => {
    const confirm = bodyOf('private confirm(): void {');

    expect(confirm).toContain('this.disposePanel()');
    expect(confirm).not.toContain('render(');
    expect(confirm).toContain('takeStarter(');
  });

  it('draws one item-atlas Poké Ball per starter-ball tile', () => {
    expect(SOURCE).toContain('ITEM_ICON_TEXTURE_KEY');
    expect(SOURCE).toContain("itemIconFrame('pokeball')");
    expect(SOURCE).toContain('interior.starterBalls');
    expect(SOURCE).toContain('this.add');
  });
});
