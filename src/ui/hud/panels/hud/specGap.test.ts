import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03-route-hud.json';
import screen from '../../../../../design/screens/03-route-hud.json';
import { buildView, slug } from '../../specGap.views/hud';
import { gapFor, gapIsEmpty, type ScreenSpec, type SpecBox } from '../../specGap';

const SPEC: ScreenSpec = screen;

function boxesNamed(name: string): readonly SpecBox[] {
  return SPEC.boxes.filter((box) => box.name === name);
}

function rectOf(box: SpecBox): Readonly<{ x: number; y: number; w: number; h: number }> {
  return { x: box.x, y: box.y, w: box.width, h: box.height };
}

/** Every box the frame names after a chip control, in caps order. */
function chipNames(): readonly string[] {
  const names = SPEC.boxes.map((box) => box.name ?? '').filter((name) => name.startsWith('key '));
  return [...new Set(names)].sort();
}

describe('the route strip’s spec gap', () => {
  it('keys to the route HUD frame', () => {
    expect(slug).toBe('03-route-hud');
    expect(screen.slug).toBe(slug);
    expect(screen.caption).toBe('03 Route HUD');
  });

  it('reports nothing at the desk, where all four cards are open and the strip is empty', () => {
    expect(buildView(SPEC)).toStrictEqual({ boxes: [], strings: [], colours: [] });
    expect(gapIsEmpty(gapFor(buildView(SPEC), SPEC))).toBe(true);
  });

  it('carries no strip badge: no `chip …`, no `strip …` and no `strip badge` box', () => {
    const names = SPEC.boxes.map((box) => box.name ?? '');
    expect(names.filter((name) => name.startsWith('chip') || name.startsWith('strip'))).toEqual([]);
    expect(names).not.toContain('strip badge');
  });

  it('carries the four cards’ own chips plus the detail tab’s, all measured by 03c', () => {
    expect(boxesNamed('key map').map(rectOf)).toStrictEqual([{ x: 942.59, y: 36, w: 29.18, h: 24 }]);
    expect(boxesNamed('key bag').map(rectOf)).toStrictEqual([{ x: 36, y: 36, w: 24, h: 24 }]);
    expect(boxesNamed('key party').map(rectOf)).toStrictEqual([{ x: 940, y: 320, w: 26, h: 26 }]);
    expect(boxesNamed('key pc').map(rectOf)).toStrictEqual([{ x: 36, y: 360, w: 24, h: 24 }]);
    expect(chipNames()).toStrictEqual(['key bag', 'key map', 'key party', 'key pc', 'key stats']);
    expect(boxesNamed('key stats').map(rectOf)).toStrictEqual([{ x: 460, y: 100, w: 24, h: 24 }]);
  });

  it('rests on the fixture’s own wide projection: 1280 × 800 with no chip', () => {
    expect(fixture.strip.wide.viewport).toStrictEqual({ width: 1280, height: 800 });
    expect(fixture.strip.wide.chips).toStrictEqual([]);
  });
});
