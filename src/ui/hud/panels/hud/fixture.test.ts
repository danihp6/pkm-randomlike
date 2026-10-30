import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYBINDS } from '../../../../data/keybinds';
import { isHudState } from '../../fixtures';
import fixture from '../../../../../design/fixtures/03-route-hud.json';
import { stripView, type StripInput, type StripSlot } from './index';

/** The one node shape this test reads off the frame: a name and a box. */
type FrameNode = Readonly<{
  name?: string;
  properties?: Readonly<{ x?: number; y?: number; width?: number; height?: number }>;
  children?: readonly FrameNode[];
}>;

const FRAME = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../../../design/frames/m03-route-hud.json', import.meta.url)),
    'utf8',
  ),
) as Readonly<{ slug: string; geometry: readonly FrameNode[] }>;

function findNode(nodes: readonly FrameNode[], name: string): FrameNode | undefined {
  for (const node of nodes) {
    if (node.name === name) return node;
    const found = findNode(node.children ?? [], name);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The shipped docks, which is what the scene hands the view on a fresh save. */
const DEFAULT_SLOTS: readonly StripSlot[] = [
  { id: 'header', x: 8, y: 8, dx: 0, dy: 0, collapsed: true },
  { id: 'party', x: 38, y: 8, dx: 0, dy: 0, collapsed: false },
  { id: 'bag', x: 38, y: 422, dx: 0, dy: 0, collapsed: true },
  { id: 'box', x: 576, y: 72, dx: 0, dy: 0, collapsed: true },
  { id: 'detail', x: 8, y: 8, dx: 0, dy: 0, collapsed: true },
];

const DEFAULT_INPUT: StripInput = {
  open: true,
  slots: DEFAULT_SLOTS,
  keybinds: DEFAULT_KEYBINDS,
};

describe('design/fixtures/03-route-hud.json', () => {
  it('is the route HUD frame and carries a HudState the store accepts unchanged', () => {
    expect(fixture.slug).toBe('03-route-hud');
    expect(fixture.strip.frame).toBe('design/frames/m03-route-hud.json');
    expect(isHudState(fixture.state)).toBe(true);
  });

  it('takes every narrow chip box from the frame’s own node, byte for byte', () => {
    expect(FRAME.slug).toBe('m03-route-hud');
    expect(fixture.strip.narrow.viewport).toEqual({ width: 390, height: 844 });
    for (const chip of fixture.strip.narrow.chips) {
      const name = fixture.strip.nodes[chip.id as keyof typeof fixture.strip.nodes];
      const node = findNode(FRAME.geometry, name);
      expect(node, name).toBeDefined();
      const { x, y, width, height } = node!.properties!;
      expect({ x, y, w: width, h: height }, name).toEqual(chip.box);
    }
  });

  it('paints the rail the frame draws on a phone', () => {
    const view = stripView(DEFAULT_INPUT, fixture.strip.narrow.viewport);
    expect(view.chips.map(({ id, letter, box }) => ({ id, letter, box }))).toEqual(
      fixture.strip.narrow.chips,
    );
  });

  it('contributes no chip on the desktop frame, where every badge is inside an open panel', () => {
    expect(fixture.strip.wide.viewport).toEqual({ width: 1280, height: 800 });
    expect(fixture.strip.wide.chips).toEqual([]);
  });
});
