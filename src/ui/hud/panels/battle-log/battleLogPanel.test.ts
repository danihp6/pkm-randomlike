import { describe, expect, it } from 'vitest';
import { battleMovesBox } from '../battle-moves/view';
import { BattleLogPanel } from './battleLogPanel';
import { liveBattleLogView, type BattleLogView } from './view';

type Node = Readonly<{ props: Record<string, unknown> }>;

function cardProps(view: BattleLogView, narrow: boolean): Record<string, unknown> {
  return (BattleLogPanel({ view, narrow }) as unknown as Node).props;
}

function lineNodes(props: Record<string, unknown>): Node[] {
  const children = Array.isArray(props.children) ? props.children : [];
  return children.filter(
    (child): child is Node =>
      typeof child === 'object' &&
      child !== null &&
      (child as Node).props['data-hud-battle-log-line'] !== undefined,
  );
}

describe('BattleLogPanel', () => {
  it('paints the live box at the battle menu card, so a menu opening never moves it', () => {
    const card = battleMovesBox({ width: 1280, height: 800 });
    const props = cardProps(liveBattleLogView(true, 'VENUSAUR used SLUDGE BOMB!', card), false);
    expect(props.style).toStrictEqual({
      left: `${card.x}px`,
      top: `${card.y}px`,
      width: `${card.w}px`,
      height: `${card.h}px`,
    });
    expect(props['data-visible']).toBe('true');
    expect(props.hidden).toBe(false);
  });

  it('places the live lines inside that card, on the frame s insets', () => {
    const card = battleMovesBox({ width: 390, height: 844 });
    const props = cardProps(liveBattleLogView(true, 'VENUSAUR used SLUDGE BOMB!', card), false);
    expect(lineNodes(props).map((node) => node.props.style)).toStrictEqual([
      { left: '16px', top: '28px', width: `${card.w - 32}px`, height: '13px' },
    ]);
  });

  it('falls back to the measured board when no card is pushed, as the preview does', () => {
    const props = cardProps(liveBattleLogView(true, 'VENUSAUR used SLUDGE BOMB!'), false);
    expect(props.style).toStrictEqual({
      left: '664px',
      top: '544px',
      width: '576px',
      height: '216px',
    });
  });

  it('keeps the closed box but paints no line', () => {
    const card = battleMovesBox({ width: 1280, height: 800 });
    const props = cardProps(liveBattleLogView(false, null, card), false);
    expect(props.hidden).toBe(true);
    expect(props['data-visible']).toBe('false');
    expect(lineNodes(props)).toStrictEqual([]);
  });
});
