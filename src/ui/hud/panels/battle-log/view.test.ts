import { describe, expect, it } from 'vitest';
import { BATTLE_LOG_DWELL_MS, battleLogBoard, feedStep, liveBattleLogView } from './view';

describe('feedStep', () => {
  it('holds at zero while the line is still typing', () => {
    expect(feedStep(false, 500, BATTLE_LOG_DWELL_MS, false, 16)).toStrictEqual({
      elapsedMs: 0,
      advance: false,
    });
    expect(feedStep(false, 0, BATTLE_LOG_DWELL_MS, true, 16)).toStrictEqual({
      elapsedMs: 0,
      advance: false,
    });
  });

  it('advances on the 900 ms dwell, not a millisecond before', () => {
    expect(feedStep(true, 0, BATTLE_LOG_DWELL_MS, false, 899)).toStrictEqual({
      elapsedMs: 899,
      advance: false,
    });
    expect(feedStep(true, 0, BATTLE_LOG_DWELL_MS, false, 900)).toStrictEqual({
      elapsedMs: 900,
      advance: true,
    });
  });

  it('banks the frame delta across ticks', () => {
    expect(feedStep(true, 450, BATTLE_LOG_DWELL_MS, false, 440)).toStrictEqual({
      elapsedMs: 890,
      advance: false,
    });
    expect(feedStep(true, 890, BATTLE_LOG_DWELL_MS, false, 16)).toStrictEqual({
      elapsedMs: 906,
      advance: true,
    });
  });

  it('uses the 45 ms rush floor while a confirm is held', () => {
    expect(feedStep(true, 0, BATTLE_LOG_DWELL_MS, true, 44)).toStrictEqual({
      elapsedMs: 44,
      advance: false,
    });
    expect(feedStep(true, 0, BATTLE_LOG_DWELL_MS, true, 45)).toStrictEqual({
      elapsedMs: 45,
      advance: true,
    });
    // The rush floor ignores the frame's own hold, the capture beat's included.
    expect(feedStep(true, 0, 4000, true, 45).advance).toBe(true);
  });
});

describe('liveBattleLogView', () => {
  it('paints the revealed slice as one primary line', () => {
    expect(liveBattleLogView(true, 'VENUSAUR used SLUDGE BOMB!')).toStrictEqual({
      visible: true,
      lines: [{ text: 'VENUSAUR used SLUDGE BOMB!', tone: 'primary' }],
    });
  });

  it('paints the empty slice while the typewriter starts', () => {
    expect(liveBattleLogView(true, '')).toStrictEqual({
      visible: true,
      lines: [{ text: '', tone: 'primary' }],
    });
  });

  it('carries no line when there is none', () => {
    expect(liveBattleLogView(true, null)).toStrictEqual({ visible: true, lines: [] });
  });

  it('keeps the flag off a closed box, line or not', () => {
    expect(liveBattleLogView(false, null)).toStrictEqual({ visible: false, lines: [] });
    expect(liveBattleLogView(false, 'VENUSAUR used SLUDGE BOMB!')).toStrictEqual({
      visible: false,
      lines: [],
    });
  });
});

describe('battleLogBoard', () => {
  it('is frame 05b at 1280×800', () => {
    expect(battleLogBoard('desktop')).toStrictEqual({
      box: { x: 664, y: 544, w: 576, h: 216 },
      line1: { x: 696, y: 580, w: 292, h: 20 },
      line2: { x: 696, y: 612, w: 294, h: 15 },
    });
  });

  it('is frame m05b on the phone, the two lines 16 px inside the card', () => {
    const board = battleLogBoard('narrow');
    expect(board.box).toStrictEqual({ x: 16, y: 592, w: 358, h: 236 });
    expect(board.line1).toStrictEqual({ x: 32, y: 620, w: 326, h: 13 });
    expect(board.line2).toStrictEqual({ x: 32, y: 646, w: 326, h: 13 });
  });

  it('keeps both lines inside their card', () => {
    for (const viewport of ['desktop', 'narrow'] as const) {
      const board = battleLogBoard(viewport);
      for (const line of [board.line1, board.line2]) {
        expect(line.x, viewport).toBeGreaterThan(board.box.x);
        expect(line.y, viewport).toBeGreaterThan(board.box.y);
        expect(line.x + line.w, viewport).toBeLessThanOrEqual(board.box.x + board.box.w);
        expect(line.y + line.h, viewport).toBeLessThanOrEqual(board.box.y + board.box.h);
      }
    }
  });

  it('hands back a fresh rect every call, so a paint can never mutate the board', () => {
    const first = battleLogBoard('desktop');
    const second = battleLogBoard('desktop');
    expect(first).toStrictEqual(second);
    expect(first).not.toBe(second);
    expect(first.box).not.toBe(second.box);
  });
});
