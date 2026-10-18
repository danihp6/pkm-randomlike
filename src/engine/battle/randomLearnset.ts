import { learnsetOf, type Learnset, type LearnSource, type LevelUpMove } from '../../data/dex/learnsets';
import { allMoves, getMove, type Move } from '../../data/dex/moves';
import { hashSeed, Rng } from '../rng';

/**
 * Per-run randomized learnsets (`D17`): every Pokémon sees the same shape as the
 * canon — the same level-up levels and the same number of TM/tutor/egg slots —
 * but which move fills each slot is rolled from the run seed. A damage move is
 * ordered least-power to most, the first level-up move is always damaging, and
 * every learnset keeps at least `MIN_DAMAGE_RATIO` damage and `MIN_STATUS_RATIO`
 * status moves so a mon never ends up all-status. OHKO moves are never rolled;
 * fixed-damage moves only appear from level `FIXED_DAMAGE_MIN_LEVEL`.
 *
 * The result is a pure function of `(speciesId, seed)`, so the learnset a Pokémon
 * has when caught is the one it keeps as it levels (D11).
 */

const LEVEL_GEN = 9;
const MIN_DAMAGE_RATIO = 0.6;
const MIN_STATUS_RATIO = 0.2;
const FIXED_DAMAGE_MIN_LEVEL = 20;

/** Fixed-damage moves: their power does not come from the damage formula, so
 * they are held back to level 20 rather than sorted by a meaningless base power.
 * `damage` covers Seismic Toss / Night Shade; the rest are the fixed-fraction
 * and self-fainting moves. */
const FIXED_DAMAGE_IDS: ReadonlySet<string> = new Set([
  'seismictoss',
  'nightshade',
  'superfang',
  'ruination',
  'endeavor',
  'finalgambit',
]);

function isFixedDamage(move: Move): boolean {
  return FIXED_DAMAGE_IDS.has(move.id) || move.damage !== undefined;
}

type Pools = Readonly<{
  /** Damaging moves with a real base power (fixed-damage moves excluded). */
  damage: readonly Move[];
  /** Fixed-damage moves, legal only from `FIXED_DAMAGE_MIN_LEVEL`. */
  fixed: readonly Move[];
  /** Status moves. */
  status: readonly Move[];
}>;

let cachedPools: Pools | undefined;

function pools(): Pools {
  if (cachedPools) return cachedPools;
  const damage: Move[] = [];
  const fixed: Move[] = [];
  const status: Move[] = [];
  for (const move of allMoves()) {
    if (move.id === 'struggle' || move.ohko) continue;
    if (move.category === 'Status') status.push(move);
    else if (isFixedDamage(move)) fixed.push(move);
    else damage.push(move);
  }
  cachedPools = { damage, fixed, status };
  return cachedPools;
}

function bestLevelSource(sources: readonly LearnSource[]): LearnSource | undefined {
  let best: LearnSource | undefined;
  for (const source of sources) {
    if (source.method !== 'level') continue;
    if (!best || source.gen > best.gen) best = source;
  }
  return best;
}

function levelSource(level: number): LearnSource {
  return { code: `${LEVEL_GEN}L${level}`, gen: LEVEL_GEN, method: 'level', level };
}

/** `basePower`, except a fixed-damage move sorts last (it may only sit late). */
function sortPower(move: Move): number {
  return isFixedDamage(move) ? Number.MAX_SAFE_INTEGER : move.basePower;
}

/** Draws `count` distinct moves from `pool`, skipping every id already in `used`. */
function drawDistinct(rng: Rng, pool: readonly Move[], count: number, used: Set<string>): Move[] {
  if (count <= 0) return [];
  const available = pool.filter((move) => !used.has(move.id));
  const picked: Move[] = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const index = rng.int(0, available.length - 1);
    const [move] = available.splice(index, 1);
    used.add(move.id);
    picked.push(move);
  }
  return picked;
}

const learnsetCache = new Map<string, Learnset | undefined>();

function buildRandomLearnset(speciesId: string, seed: string): Learnset | undefined {
  const canonical = learnsetOf(speciesId);
  if (!canonical) return undefined;

  const rng = new Rng(hashSeed(`${seed}:learnset:${speciesId}`));
  const used = new Set<string>();
  const { damage, fixed, status } = pools();

  // Canonical shape: one level-up slot per level move, one slot per move that a
  // method can teach. Levels and counts are kept so the learn pacing is stable.
  const levels: number[] = [];
  const methodCount: Record<'tm' | 'tutor' | 'egg', number> = { tm: 0, tutor: 0, egg: 0 };
  for (const sources of Object.values(canonical)) {
    const level = bestLevelSource(sources);
    if (level && level.level !== null) levels.push(level.level);
    if (sources.some((source) => source.method === 'tm')) methodCount.tm++;
    if (sources.some((source) => source.method === 'tutor')) methodCount.tutor++;
    if (sources.some((source) => source.method === 'egg')) methodCount.egg++;
  }
  levels.sort((a, b) => a - b);
  // Nine alternate forms ship no level-up moves. Guarantee a level-1 slot so no
  // species ends up with an empty moveset and the first move is always damaging.
  if (levels.length === 0) levels.push(1);

  const n = levels.length;

  // Damage / status mix: every slot is damage unless rolled status, but at least
  // `minDamage` damage and `minStatus` status survive. Slot 0 (the lowest level)
  // is never status, so the first move learned is always damaging.
  const types: ('damage' | 'status')[] = new Array(n).fill('damage');
  if (n > 0) {
    const minDamage = Math.min(n, Math.ceil(n * MIN_DAMAGE_RATIO));
    let minStatus = Math.min(n - minDamage, Math.ceil(n * MIN_STATUS_RATIO));
    if (minDamage + minStatus > n) minStatus = n - minDamage;
    let statusCount = minStatus;
    const free = n - minDamage - minStatus;
    for (let i = 0; i < free; i++) if (rng.next() < 0.5) statusCount++;

    const positions: number[] = [];
    for (let i = 1; i < n; i++) positions.push(i);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    for (let i = 0; i < statusCount && i < positions.length; i++) types[positions[i]] = 'status';
  }

  const damageSlots: number[] = [];
  const statusSlots: number[] = [];
  for (let i = 0; i < n; i++) (types[i] === 'damage' ? damageSlots : statusSlots).push(i);

  // Damage moves drawn together, then sorted weakest to strongest so the lowest
  // slot gets the weakest move. Fixed-damage moves sort last and are only kept
  // in a level-20+ slot.
  const chosenDamage = drawDistinct(rng, [...damage, ...fixed], damageSlots.length, used).sort(
    (a, b) => sortPower(a) - sortPower(b) || a.id.localeCompare(b.id),
  );
  for (let i = 0; i < damageSlots.length; i++) {
    const move = chosenDamage[i];
    if (move && isFixedDamage(move) && levels[damageSlots[i]] < FIXED_DAMAGE_MIN_LEVEL) {
      used.delete(move.id);
      const replacement = drawDistinct(rng, damage, 1, used)[0];
      if (replacement) chosenDamage[i] = replacement;
      else used.add(move.id);
    }
  }

  const chosenStatus = drawDistinct(rng, status, statusSlots.length, used);

  const entries: { moveId: string; source: LearnSource }[] = [];
  damageSlots.forEach((slot, i) => {
    const move = chosenDamage[i];
    if (move) entries.push({ moveId: move.id, source: levelSource(levels[slot]) });
  });
  statusSlots.forEach((slot, i) => {
    const move = chosenStatus[i];
    if (move) entries.push({ moveId: move.id, source: levelSource(levels[slot]) });
  });

  // TM/tutor/egg: the same number of slots as the canon, a random move in each.
  // Fixed-damage moves stay out of these (they are not level-gated).
  const methodPool: readonly Move[] = [...damage, ...status];
  const letters: Record<'tm' | 'tutor' | 'egg', string> = { tm: 'M', tutor: 'T', egg: 'E' };
  for (const method of ['tm', 'tutor', 'egg'] as const) {
    for (const move of drawDistinct(rng, methodPool, methodCount[method], used)) {
      entries.push({
        moveId: move.id,
        source: { code: `${LEVEL_GEN}${letters[method]}`, gen: LEVEL_GEN, method, level: null },
      });
    }
  }

  const learnset: Record<string, LearnSource[]> = {};
  for (const { moveId, source } of entries) {
    const bucket = learnset[moveId];
    if (bucket) bucket.push(source);
    else learnset[moveId] = [source];
  }
  return learnset;
}

/** The randomized learnset for a species under a run seed, memoized per pair. */
export function randomLearnset(speciesId: string, seed: string): Learnset | undefined {
  const key = `${seed}\u0000${speciesId}`;
  if (learnsetCache.has(key)) return learnsetCache.get(key);
  const value = buildRandomLearnset(speciesId, seed);
  learnsetCache.set(key, value);
  return value;
}

/**
 * The level-up moves a randomized learnset knows at `level`, in learn order.
 * Damage sorts before status on an equal level, and by base power among damage,
 * so the list reads least-power to most and opens with a damaging move.
 */
export function randomLevelUpMoves(
  speciesId: string,
  level: number,
  seed: string,
): readonly LevelUpMove[] {
  const learnset = randomLearnset(speciesId, seed);
  if (!learnset) return [];
  const moves: LevelUpMove[] = [];
  for (const [moveId, sources] of Object.entries(learnset)) {
    const source = bestLevelSource(sources);
    if (!source || source.level === null || source.level > level) continue;
    moves.push({ moveId, level: source.level });
  }
  return moves.sort(compareLearned);
}

function compareLearned(a: LevelUpMove, b: LevelUpMove): number {
  if (a.level !== b.level) return a.level - b.level;
  const ma = getMove(a.moveId);
  const mb = getMove(b.moveId);
  const sa = ma && ma.category !== 'Status' ? 0 : 1;
  const sb = mb && mb.category !== 'Status' ? 0 : 1;
  if (sa !== sb) return sa - sb;
  const pa = ma ? sortPower(ma) : 0;
  const pb = mb ? sortPower(mb) : 0;
  if (pa !== pb) return pa - pb;
  return a.moveId.localeCompare(b.moveId);
}
