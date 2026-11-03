/**
 * The eight gym fights, one row per badge (`docs/region-spec.md` §3). A row names
 * the leader's identity (`LEADER_IDENTITIES`, `src/data/trainers.ts`), the route
 * archetype it borrows its sprite, AI flags and money base from, the party it
 * fields, its double-battle chance, the TM the badge pays and its money
 * multiplier. Retuning a gym is an edit here, never in an engine file; the level
 * cap ladder stays in `src/data/region.ts` (`BADGE_CAPS`, `badgeCap`) and no cap
 * number is written in this file.
 */

/** One gym fight: badge, leader, archetype, party, doubling, TM and payout. */
export type GymRow = Readonly<{
  /** 1..8, the badge the gym awards, also the chain position of its city. */
  badge: number;
  /** A `LEADER_IDENTITIES` id from `src/data/trainers.ts` — the leader's name/class. */
  leaderId: string;
  /** A `TRAINER_ARCHETYPES` id — the sprite, AI flags and money base it fights as. */
  archetypeId: string;
  /** How many party members the fight fields when it is not a fixed party. */
  partySize: number;
  /**
   * Gym 1 only: the three species ids in field order, so the run's on-ramp is the
   * same every time. Absent on every other row (their party is generated).
   */
  fixedParty?: readonly string[];
  /** Probability in `0..1` that the fight fields two actives per side. */
  doubleChance: number;
  /** The machine the badge pays, a TM item id (`tmNNN`, `src/data/tms.ts`). */
  tmItemId: string;
  /** Multiplies the borrowed archetype's `money.base` and `money.jitter`. */
  moneyMultiplier: number;
}>;

export const GYMS: readonly GymRow[] = [
  // The on-ramp: a fixed three, no doubling, the lowest payout.
  {
    badge: 1,
    leaderId: 'leader-1',
    archetypeId: 'blackbelt',
    partySize: 3,
    fixedParty: ['geodude', 'machop', 'onix'],
    doubleChance: 0,
    tmItemId: 'tm058',
    moneyMultiplier: 1,
  },
  {
    badge: 2,
    leaderId: 'leader-2',
    archetypeId: 'fisher',
    partySize: 6,
    doubleChance: 0.1,
    tmItemId: 'tm011',
    moneyMultiplier: 1.2,
  },
  {
    badge: 3,
    leaderId: 'leader-3',
    archetypeId: 'camper',
    partySize: 6,
    doubleChance: 0.1,
    tmItemId: 'tm020',
    moneyMultiplier: 1.4,
  },
  {
    badge: 4,
    leaderId: 'leader-4',
    archetypeId: 'ace',
    partySize: 6,
    doubleChance: 0.1,
    tmItemId: 'tm023',
    moneyMultiplier: 1.6,
  },
  {
    badge: 5,
    leaderId: 'leader-5',
    archetypeId: 'psychic',
    partySize: 6,
    doubleChance: 0.1,
    tmItemId: 'tm026',
    moneyMultiplier: 1.8,
  },
  {
    badge: 6,
    leaderId: 'leader-6',
    archetypeId: 'hiker',
    partySize: 6,
    doubleChance: 0.1,
    tmItemId: 'tm034',
    moneyMultiplier: 2,
  },
  {
    badge: 7,
    leaderId: 'leader-7',
    archetypeId: 'lass',
    partySize: 6,
    doubleChance: 0.1,
    tmItemId: 'tm042',
    moneyMultiplier: 2.2,
  },
  {
    badge: 8,
    leaderId: 'leader-8',
    archetypeId: 'ace',
    partySize: 6,
    doubleChance: 0.1,
    tmItemId: 'tm099',
    moneyMultiplier: 2.4,
  },
];

const BY_BADGE = new Map<number, GymRow>(GYMS.map((row) => [row.badge, row]));

/** The row for `badge`; throws `Error("no gym for badge <n>")` outside 1..8. */
export function gymForBadge(badge: number): GymRow {
  const row = BY_BADGE.get(badge);
  if (!row) throw new Error(`no gym for badge ${badge}`);
  return row;
}
