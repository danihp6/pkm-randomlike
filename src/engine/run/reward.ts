import type { LevelBand } from '../../data/run';
import { TRAINER_MONEY_BAND_SCALE, type TrainerArchetype } from '../../data/trainers';
import type { Rng } from '../rng';

/** What a floor's boss pays over a regular trainer of the same archetype. */
export const BOSS_MONEY_MULTIPLIER = 3;

/**
 * The Poké Dollars a beaten trainer drops: the archetype's **fixed base** plus a
 * **jitter**, both scaled by the band its roster fields (`docs/maps-spec.md` §7,
 * D33). The `rng` is the caller's, so the roll is deterministic for a fixed seed
 * (D11); `multiplier` lets a boss pay more without new data. Pure, so the shop
 * and the battle resolution can both trust it.
 */
export function trainerMoney(
  archetype: TrainerArchetype,
  band: LevelBand,
  rng: Rng,
  multiplier = 1,
): number {
  const scale = TRAINER_MONEY_BAND_SCALE[band.id] * Math.max(1, multiplier);
  const base = Math.round(archetype.money.base * scale);
  const jitter = Math.round(archetype.money.jitter * scale);
  return base + rng.int(0, jitter);
}
