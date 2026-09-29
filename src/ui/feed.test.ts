import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../engine/battle/state';
import { battleFrames } from './feed';

describe('battle feed frames', () => {
  it('groups the events before each message into one frame', () => {
    const events: BattleEvent[] = [
      { kind: 'turn', turn: 1 },
      { kind: 'move', side: 'player', moveId: 'tackle' },
      { kind: 'text', text: 'Charmander used Tackle!' },
      { kind: 'damage', side: 'enemy', amount: 5, hp: 15, maxHp: 20, effectiveness: 1, crit: false },
      { kind: 'text', text: 'It hit!' },
    ];
    const frames = battleFrames(events);
    expect(frames).toHaveLength(2);
    expect(frames[0].message).toBe('Charmander used Tackle!');
    expect(frames[0].events.map((event) => event.kind)).toEqual(['turn', 'move', 'text']);
    expect(frames[1].message).toBe('It hit!');
    expect(frames[1].events.map((event) => event.kind)).toEqual(['damage', 'text']);
  });

  it('collects events after the last message into a silent frame', () => {
    const events: BattleEvent[] = [
      { kind: 'text', text: 'Go!' },
      { kind: 'turn', turn: 1 },
      { kind: 'damage', side: 'player', amount: 3, hp: 7, maxHp: 10, effectiveness: 1, crit: false },
    ];
    const frames = battleFrames(events);
    expect(frames).toHaveLength(2);
    expect(frames[1].message).toBeNull();
    expect(frames[1].events.map((event) => event.kind)).toEqual(['turn', 'damage']);
  });

  it('returns nothing for an empty log', () => {
    expect(battleFrames([])).toEqual([]);
  });
});
