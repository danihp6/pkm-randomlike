import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../../../../engine/battle/state';
import { scriptedBattle } from '../../../../engine/battle/harness';
import { battleFrames, type FeedFrame } from '../../../feed';
import { HP_FILL_MS } from '../battle-hp/view';
import { battleMovesBox, compactCard } from '../battle-moves/view';
import {
  BATTLE_LOG_DWELL_MS,
  HIT_FRAME_MS,
  battleLogBoard,
  battleLogLayout,
  feedStep,
  frameHoldMs,
  hitFrameAt,
  liveBattleLogView,
} from './view';

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

  it('carries the live card the battle menu paints, and none without one', () => {
    const card = { x: 440, y: 582, w: 564, h: 192 };
    expect(liveBattleLogView(true, 'hit', card)).toStrictEqual({
      visible: true,
      lines: [{ text: 'hit', tone: 'primary' }],
      card,
    });
    expect(liveBattleLogView(false, null, card)).toStrictEqual({
      visible: false,
      lines: [],
      card,
    });
    expect(liveBattleLogView(true, 'hit')).toStrictEqual({
      visible: true,
      lines: [{ text: 'hit', tone: 'primary' }],
    });
  });

  it('keeps the flag off a closed box, line or not', () => {
    expect(liveBattleLogView(false, null)).toStrictEqual({ visible: false, lines: [] });
    expect(liveBattleLogView(false, 'VENUSAUR used SLUDGE BOMB!')).toStrictEqual({
      visible: false,
      lines: [],
    });
  });
});

describe('battleLogLayout', () => {
  it('takes the battle menu card at both widths, so a menu never resizes the box', () => {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      const card = battleMovesBox(viewport);
      const board = battleLogLayout(card, compactCard(card));
      expect(board.box, `${viewport.width}x${viewport.height}`).toStrictEqual(card);
      expect(board.box).not.toBe(card);
    }
  });

  it('keeps the frame s insets and takes the card s whole content column', () => {
    expect(battleLogLayout({ x: 440, y: 582, w: 564, h: 192 }, false)).toStrictEqual({
      box: { x: 440, y: 582, w: 564, h: 192 },
      line1: { x: 472, y: 618, w: 500, h: 20 },
      line2: { x: 472, y: 650, w: 500, h: 15 },
    });
    expect(battleLogLayout({ x: 16, y: 592, w: 358, h: 236 }, true)).toStrictEqual({
      box: { x: 16, y: 592, w: 358, h: 236 },
      line1: { x: 32, y: 620, w: 326, h: 13 },
      line2: { x: 32, y: 646, w: 326, h: 13 },
    });
  });

  it('keeps both lines inside the card at both widths', () => {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      const card = battleMovesBox(viewport);
      const board = battleLogLayout(card, compactCard(card));
      for (const line of [board.line1, board.line2]) {
        expect(line.x).toBeGreaterThan(board.box.x);
        expect(line.y).toBeGreaterThan(board.box.y);
        expect(line.x + line.w).toBeLessThanOrEqual(board.box.x + board.box.w);
        expect(line.y + line.h).toBeLessThanOrEqual(board.box.y + board.box.h);
      }
    }
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

const HIT_DAMAGE: BattleEvent = {
  kind: 'damage',
  side: 'enemy',
  amount: 20,
  hp: 75,
  maxHp: 95,
  effectiveness: 1,
  crit: false,
};
const HIT_LINE: BattleEvent = {
  kind: 'text',
  key: 'battle.log.hit',
  params: { move: 'Double Kick', name: 'Shuckle' },
};

function frame(message: string | null, events: readonly BattleEvent[]): FeedFrame {
  return { message, events };
}

/**
 * The hit-loop frames of the player's own move. The foe answers on the same
 * scripted turn and its reply is a hit frame of its own, so the count is taken on
 * the hits the move under test lands.
 */
function playerHits(frames: readonly FeedFrame[]): number[] {
  return frames.flatMap((each, index) =>
    hitFrameAt(frames, index) &&
    each.events.some((event) => event.kind === 'damage' && event.side === 'enemy')
      ? [index]
      : [],
  );
}

const DOUBLE_KICK_FRAMES = battleFrames(
  scriptedBattle({
    player: [{ id: 'p', speciesId: 'hitmonlee', level: 50, moves: ['doublekick', 'splash'] }],
    enemy: [{ id: 'e', speciesId: 'shuckle', level: 50 }],
    seed: 2026,
    turnCap: 1,
  }).log,
);

const TACKLE_FRAMES = battleFrames(
  scriptedBattle({
    player: [{ id: 'p', speciesId: 'hitmonlee', level: 50, moves: ['tackle', 'splash'] }],
    enemy: [{ id: 'e', speciesId: 'shuckle', level: 50 }],
    seed: 2026,
    turnCap: 1,
  }).log,
);

const MISS_ON_THE_THIRD: readonly FeedFrame[] = [
  frame('Hitmonlee used Double Kick!', [
    { kind: 'move', side: 'player', moveId: 'doublekick' },
    { kind: 'text', key: 'battle.log.used', params: { name: 'Hitmonlee', move: 'Double Kick' } },
  ]),
  frame('Double Kick hit Shuckle!', [HIT_DAMAGE, HIT_LINE]),
  frame('Double Kick hit Shuckle!', [HIT_DAMAGE, HIT_LINE]),
  frame("Hitmonlee's attack missed!", [
    { kind: 'text', key: 'battle.log.missed', params: { name: 'Hitmonlee' } },
  ]),
];

describe('HIT_FRAME_MS', () => {
  it('HIT_FRAME_MS is the fill plus one beat', () => {
    expect(HIT_FRAME_MS).toBe(HP_FILL_MS + 150);
    expect(HIT_FRAME_MS).toBeGreaterThan(HP_FILL_MS);
    expect(HIT_FRAME_MS).toBeLessThan(BATTLE_LOG_DWELL_MS);
  });
});

describe('hitFrameAt', () => {
  it('a two-hit move gets one frame per landing hit', () => {
    const hits = playerHits(DOUBLE_KICK_FRAMES);
    expect(hits).toHaveLength(2);
    for (const index of hits) {
      expect(hitFrameAt(DOUBLE_KICK_FRAMES, index), `frame ${index}`).toBe(true);
      expect(
        DOUBLE_KICK_FRAMES[index].events.filter((event) => event.kind === 'damage'),
        `frame ${index}`,
      ).toHaveLength(1);
    }
  });

  it('only the last hit of a sequence keeps the ordinary dwell', () => {
    const [iFirst, iSecond] = playerHits(DOUBLE_KICK_FRAMES);
    expect(frameHoldMs(DOUBLE_KICK_FRAMES, iFirst, BATTLE_LOG_DWELL_MS)).toBe(HIT_FRAME_MS);
    expect(frameHoldMs(DOUBLE_KICK_FRAMES, iSecond, BATTLE_LOG_DWELL_MS)).toBe(
      BATTLE_LOG_DWELL_MS,
    );
  });

  it('a miss on the third hit keeps the two segments already shown', () => {
    expect(hitFrameAt(MISS_ON_THE_THIRD, 1)).toBe(true);
    expect(hitFrameAt(MISS_ON_THE_THIRD, 2)).toBe(true);
    expect(hitFrameAt(MISS_ON_THE_THIRD, 3)).toBe(false);
    expect(frameHoldMs(MISS_ON_THE_THIRD, 1, BATTLE_LOG_DWELL_MS)).toBe(HIT_FRAME_MS);
    expect(frameHoldMs(MISS_ON_THE_THIRD, 2, BATTLE_LOG_DWELL_MS)).toBe(BATTLE_LOG_DWELL_MS);
    const hitFrames = MISS_ON_THE_THIRD.flatMap((_each, index) =>
      hitFrameAt(MISS_ON_THE_THIRD, index) ? [index] : [],
    );
    expect(hitFrames).toStrictEqual([1, 2]);
  });

  it('a one-hit move keeps the ordinary dwell', () => {
    const hits = playerHits(TACKLE_FRAMES);
    expect(hits).toHaveLength(1);
    expect(hitFrameAt(TACKLE_FRAMES, hits[0])).toBe(true);
    expect(frameHoldMs(TACKLE_FRAMES, hits[0], BATTLE_LOG_DWELL_MS)).toBe(BATTLE_LOG_DWELL_MS);
  });

  it('a residual chip is not a hit frame', () => {
    const residual: readonly FeedFrame[] = [
      frame('Hitmonlee used Double Kick!', [
        { kind: 'move', side: 'player', moveId: 'doublekick' },
        { kind: 'text', key: 'battle.log.used', params: { name: 'Hitmonlee', move: 'Double Kick' } },
      ]),
      frame('Double Kick hit Shuckle!', [HIT_DAMAGE, HIT_LINE]),
      frame('Shuckle is buffeted by the sandstorm!', [
        HIT_DAMAGE,
        { kind: 'text', key: 'battle.log.weather.buffeted.sand', params: { name: 'Shuckle' } },
      ]),
    ];
    expect(hitFrameAt(residual, 2)).toBe(false);
    expect(frameHoldMs(residual, 2, BATTLE_LOG_DWELL_MS)).toBe(BATTLE_LOG_DWELL_MS);
    expect(frameHoldMs(residual, 1, BATTLE_LOG_DWELL_MS)).toBe(BATTLE_LOG_DWELL_MS);
  });

  it('the hit rule is total and pure', () => {
    expect(hitFrameAt([], 0)).toBe(false);
    expect(hitFrameAt([], -1)).toBe(false);
    expect(hitFrameAt(MISS_ON_THE_THIRD, 999)).toBe(false);
    expect(frameHoldMs(MISS_ON_THE_THIRD, 999, 900)).toBe(900);
    const first = [
      hitFrameAt(MISS_ON_THE_THIRD, 1),
      hitFrameAt(DOUBLE_KICK_FRAMES, 0),
      frameHoldMs(MISS_ON_THE_THIRD, 1, BATTLE_LOG_DWELL_MS),
      frameHoldMs(DOUBLE_KICK_FRAMES, 999, 900),
    ];
    const again = [
      hitFrameAt(MISS_ON_THE_THIRD, 1),
      hitFrameAt(DOUBLE_KICK_FRAMES, 0),
      frameHoldMs(MISS_ON_THE_THIRD, 1, BATTLE_LOG_DWELL_MS),
      frameHoldMs(DOUBLE_KICK_FRAMES, 999, 900),
    ];
    expect(again).toStrictEqual(first);
  });
});
