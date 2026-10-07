import { describe, expect, it } from 'vitest';
import { OVERWORLD_FACINGS } from '../data/overworldSprites';
import { TRAINER_ARCHETYPES } from '../data/trainers';
import { TRAINER_WALK_ANIMS, trainerFacingPose, trainerWalkAnimKey } from './trainerAnim';

describe('trainer facing pose', () => {
  it('reads a route facing on the three-direction sheet', () => {
    expect(trainerFacingPose('N')).toEqual({ facing: 'up', flipX: false });
    expect(trainerFacingPose('S')).toEqual({ facing: 'down', flipX: false });
    expect(trainerFacingPose('W')).toEqual({ facing: 'side', flipX: false });
    expect(trainerFacingPose('E')).toEqual({ facing: 'side', flipX: true });
  });
});

describe('trainer walk animations', () => {
  it('registers a two-frame cycle for every archetype and facing', () => {
    const keyed = new Map(TRAINER_WALK_ANIMS.map((anim) => [anim.key, anim]));
    for (const archetype of TRAINER_ARCHETYPES) {
      const spriteKey = archetype.spriteKey;
      expect(spriteKey, archetype.id).toBeTruthy();
      for (const facing of OVERWORLD_FACINGS) {
        const key = trainerWalkAnimKey(spriteKey!, facing);
        const anim = keyed.get(key);
        expect(anim, key).toBeDefined();
        expect(anim!.frames.length).toBe(2);
        expect(new Set(anim!.frames).size).toBe(2);
      }
    }
  });

  it('keeps the animation keys unique', () => {
    const keys = TRAINER_WALK_ANIMS.map((anim) => anim.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
