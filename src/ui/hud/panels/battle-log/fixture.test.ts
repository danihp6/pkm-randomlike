import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/05b-battle-message.json';
import mobileFrame from '../../../../../design/frames/m05b-battle-message.json';
import desktopFrame from '../../../../../design/frames/05b-battle-message.json';
import { isHudState } from '../../fixtures';
import { BATTLE_LOG_SLUG, BATTLE_LOG_SLUGS, battleLogBoard, fixtureBattleLogView } from './view';

type FrameNode = Readonly<{
  name?: string;
  children?: readonly FrameNode[];
  properties?: Readonly<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    characters?: string;
  }>;
}>;

type FrameFile = Readonly<{ geometry: readonly FrameNode[]; text: readonly FrameNode[] }>;

function flatten(root: FrameNode): FrameNode[] {
  const nodes: FrameNode[] = [];
  const walk = (node: FrameNode): void => {
    nodes.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(root);
  return nodes;
}

function rectNamed(
  root: FrameNode,
  name: string,
): Readonly<{ x: number; y: number; w: number; h: number }> {
  const node = flatten(root).find((item) => item.name === name && item.properties?.width !== undefined);
  const properties = node?.properties ?? {};
  return {
    x: properties.x ?? Number.NaN,
    y: properties.y ?? Number.NaN,
    w: properties.width ?? Number.NaN,
    h: properties.height ?? Number.NaN,
  };
}

function rectAt(root: FrameNode, x: number, y: number): Readonly<{ x: number; y: number }> {
  const node = flatten(root).find((item) => item.properties?.x === x && item.properties?.y === y);
  const properties = node?.properties ?? {};
  return { x: properties.x ?? Number.NaN, y: properties.y ?? Number.NaN };
}

const DESKTOP = desktopFrame as unknown as FrameFile;
const PHONE = mobileFrame as unknown as FrameFile;
const DESKTOP_GEOMETRY: FrameNode = { children: DESKTOP.geometry };
const DESKTOP_TEXT: FrameNode = { children: DESKTOP.text };
const PHONE_GEOMETRY: FrameNode = { children: PHONE.geometry };

describe('design/fixtures/05b-battle-message.json', () => {
  it('carries a valid HudState, which the panel itself does not read', () => {
    expect(isHudState(fixture.state)).toBe(true);
    expect(Object.keys(fixture.state).sort()).toStrictEqual([
      'bag',
      'battle',
      'money',
      'notice',
      'party',
      'route',
    ]);
  });

  it('carries the frame s own two lines, primary then effect', () => {
    expect(fixture.slug).toBe(BATTLE_LOG_SLUG);
    expect(BATTLE_LOG_SLUGS).toStrictEqual(['05b-battle-message', 'm05b-battle-message']);
    expect(fixtureBattleLogView(fixture)).toStrictEqual({
      visible: true,
      lines: [
        { text: 'VENUSAUR used SLUDGE BOMB!', tone: 'primary' },
        { text: 'CHARIZARD lost 38 HP and is poisoned.', tone: 'effect' },
      ],
    });
  });

  it('is the desktop copy frame 05b draws', () => {
    const text = flatten(DESKTOP_TEXT)
      .filter((node) => node.name?.startsWith('message line '))
      .map((node) => node.properties?.characters);
    expect(text).toStrictEqual(fixture.battleLog.lines.map((line) => line.text));
  });

  it('rejects anything that is not this panel s payload', () => {
    expect(fixtureBattleLogView(null)).toBeNull();
    expect(fixtureBattleLogView({ state: fixture.state })).toBeNull();
    expect(fixtureBattleLogView({ battleLog: { visible: 'yes', lines: [] } })).toBeNull();
    expect(fixtureBattleLogView({ battleLog: { visible: true, lines: 'none' } })).toBeNull();
    expect(
      fixtureBattleLogView({
        battleLog: {
          visible: true,
          lines: [
            { text: 'a', tone: 'primary' },
            { text: 'b', tone: 'effect' },
            { text: 'c', tone: 'primary' },
          ],
        },
      }),
    ).toBeNull();
    expect(
      fixtureBattleLogView({ battleLog: { visible: true, lines: [{ text: 'a', tone: 'shout' }] } }),
    ).toBeNull();
    expect(
      fixtureBattleLogView({ battleLog: { visible: true, lines: [{ text: 3, tone: 'primary' }] } }),
    ).toBeNull();
    expect(
      fixtureBattleLogView({ battleLog: { visible: true, lines: [{ tone: 'primary' }] } }),
    ).toBeNull();
  });
});

describe('battleLogBoard against the exported frames', () => {
  it('is 05b s message box and its two lines, to the pixel', () => {
    const board = battleLogBoard('desktop');
    expect(board.box).toStrictEqual(rectNamed(DESKTOP_GEOMETRY, 'message box'));
    expect(board.line1).toStrictEqual(rectNamed(DESKTOP_GEOMETRY, 'message line 1'));
    expect(board.line2).toStrictEqual(rectNamed(DESKTOP_GEOMETRY, 'message line 2'));
  });

  it('is m05b s menu panel with its own copy at 32,620 and 32,646', () => {
    const board = battleLogBoard('narrow');
    expect(board.box).toStrictEqual(rectNamed(PHONE_GEOMETRY, 'm menu panel'));
    expect(rectAt(PHONE_GEOMETRY, board.line1.x, board.line1.y)).toStrictEqual({ x: 32, y: 620 });
    expect(rectAt(PHONE_GEOMETRY, board.line2.x, board.line2.y)).toStrictEqual({ x: 32, y: 646 });
  });
});
