import { describe, expect, it } from 'vitest';
import { playableSpecies } from '../../data/dex/species';
import { Rng } from '../rng';
import { chooseAiCommand } from './ai';
import { legalMoveIndices } from './commands';
import { createFighter } from './fighter';
import { activeFighter, createBattle } from './state';
import { autoReplace, needsReplacement, takeTurn } from './turn';

const SAMPLE = playableSpecies().filter((_, i) => i % 23 === 0);
const SEEDS = ['stress-a', 'stress-b'];

/**
 * The randomizer feeds wild, trainer and player movesets, so a roll has to be
 * safe for the engine: every sampled species battles headless to an end without
 * throwing (an unimplemented move effect is a no-op, never a crash).
 */
describe('randomized movesets in battle', () => {
  it('runs headless battles for sampled species without throwing', () => {
    for (let i = 0; i < SAMPLE.length; i++) {
      const player = SAMPLE[i];
      const enemy = SAMPLE[(i * 7 + 3) % SAMPLE.length];
      for (const seed of SEEDS) {
        const state = createBattle({
          player: [
            createFighter({
              id: 'player',
              speciesId: player.id,
              level: 100,
              nature: 'serious',
              learnsetSeed: seed,
            }),
          ],
          enemy: [
            createFighter({
              id: 'enemy',
              speciesId: enemy.id,
              level: 99,
              nature: 'serious',
              learnsetSeed: seed,
            }),
          ],
          rng: new Rng(2026),
          isWild: true,
        });

        // A form the dex has no learnset for ends up with no moves; skip it.
        if (
          activeFighter(state, 'player').moves.length === 0 ||
          activeFighter(state, 'enemy').moves.length === 0
        ) {
          continue;
        }

        for (let guard = 0; state.winner === null && guard < 80; guard++) {
          if (needsReplacement(state).length > 0) autoReplace(state);
          const legal = legalMoveIndices(activeFighter(state, 'player'));
          takeTurn(state, { type: 'fight', moveIndex: legal[0] ?? 0 }, chooseAiCommand(state, 'enemy'));
        }

        expect(state.log.length, `${player.id} vs ${enemy.id}`).toBeGreaterThan(0);
      }
    }
  });
});
