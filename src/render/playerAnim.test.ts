import { describe, expect, it } from 'vitest';
import { PLAYER_FACINGS, playerWalkFrames } from '../data/playerSprite';
import {
  PLAYER_WALK_ANIMS,
  PLAYER_WALK_FRAME_RATE,
  playerWalkAnimKey,
  playerWalkTimeScale,
} from './playerAnim';

describe('player walk animations', () => {
  it('builds one two-frame cycle per facing, with unique keys', () => {
    expect(PLAYER_WALK_ANIMS).toHaveLength(PLAYER_FACINGS.length);
    const keys = new Set<string>();
    for (const anim of PLAYER_WALK_ANIMS) {
      expect(anim.key).toBe(playerWalkAnimKey(anim.facing));
      expect(anim.frames).toHaveLength(2);
      expect(new Set(anim.frames).size).toBe(2);
      expect([...anim.frames]).toEqual([...playerWalkFrames(anim.facing)]);
      keys.add(anim.key);
    }
    expect(keys.size).toBe(PLAYER_FACINGS.length);
    expect(PLAYER_WALK_FRAME_RATE).toBeGreaterThan(0);
  });

  it('speeds the same cycle up to run', () => {
    expect(playerWalkTimeScale(false, 200, 110)).toBe(1);
    expect(playerWalkTimeScale(true, 200, 110)).toBeCloseTo(200 / 110);
    // Running is only ever faster, never slower.
    expect(playerWalkTimeScale(true, 200, 110)).toBeGreaterThan(1);
  });
});
