import {
  ALL_TYPES_OVERRIDE,
  ROOM_BATTLEFIELDS,
  ROOM_BATTLEFIELD_CHANCE,
  ROOM_CRIT_STAGE,
  type RoomBattlefield,
} from '../../data/battlefields';
import { BOSS_OPENINGS, type BossOpeningSide } from '../../data/bosses';
import { FIELD_CONDITION_TURNS } from '../battle/effects/conditions';
import { TERRAIN_TURNS } from '../battle/effects/terrain';
import { WEATHER_TURNS } from '../battle/effects/weather';
import type { BoostId } from '../battle/fighter';
import type { BattleSetup } from '../battle/state';
import { hashSeed, Rng } from '../rng';

/** The roll a plan room earns from its own role (`docs/maps-spec.md` §6/§7). */
export type RoomKind = 'trainer' | 'boss' | 'quiet';

/** The resolved opening: the data row's side and boosts, its battlefield row looked up. */
export type BossOpeningRoll = Readonly<{
  side: BossOpeningSide;
  battlefield: RoomBattlefield;
  boosts: Readonly<Partial<Record<BoostId, number>>>;
}>;

/** The `BattleSetup` fields a rolled condition fills. */
export type BattlefieldSeeds = Pick<BattleSetup, 'weather' | 'terrain' | 'field' | 'fog' | 'roomField'>;

/**
 * The kind of roll a room earns: the boss room, a room that fields regular trainers,
 * or a quiet leaf (the entry room and every special leaf: mini-boss, mega-stone,
 * gated, trade, no-heal, static, secret-shop). `boss` wins over `quiet` — the boss
 * room is both.
 */
export function roomKindOf(
  room: Readonly<{ entry: boolean; boss: boolean; special: string | null }>,
): RoomKind {
  if (room.boss) return 'boss';
  return room.entry || room.special !== null ? 'quiet' : 'trainer';
}

/**
 * The boss room's opening on its own stream, `Rng(hashSeed(`${seed}:battlefield:${roomIndex}`))`:
 * **one** `rng.int(0, BOSS_OPENINGS.length - 1)`, no `rng.next()`. `battlefield` is the
 * `ROOM_BATTLEFIELDS` row whose `id` the drawn `BOSS_OPENINGS` row names. A missing row
 * is a data bug, so it throws.
 */
export function bossOpeningRoll(seed: string, roomIndex: number): BossOpeningRoll {
  const rng = new Rng(hashSeed(`${seed}:battlefield:${roomIndex}`));
  const opening = BOSS_OPENINGS[rng.int(0, BOSS_OPENINGS.length - 1)];
  const battlefield = ROOM_BATTLEFIELDS.find((row) => row.id === opening.battlefield);
  if (!battlefield) {
    throw new Error(`boss opening names an unknown room condition: ${opening.battlefield}`);
  }
  return { side: opening.side, battlefield, boosts: opening.boosts };
}

/**
 * The condition `roomIndex` starts its battles under, or null. A `quiet` room draws
 * nothing at all; a `trainer` room draws one `rng.next()` for `ROOM_BATTLEFIELD_CHANCE`
 * and, on a hit, one `rng.int` over the table; the **boss room always takes one
 * opening** of `BOSS_OPENINGS`, never a chance roll.
 */
export function roomBattlefield(
  seed: string,
  roomIndex: number,
  kind: RoomKind,
): RoomBattlefield | null {
  if (kind === 'quiet') return null;
  if (kind === 'boss') return bossOpeningRoll(seed, roomIndex).battlefield;
  const rng = new Rng(hashSeed(`${seed}:battlefield:${roomIndex}`));
  if (rng.next() >= ROOM_BATTLEFIELD_CHANCE) return null;
  return ROOM_BATTLEFIELDS[rng.int(0, ROOM_BATTLEFIELDS.length - 1)];
}

/** The battle-start seeds a rolled condition implies, at each rule's canonical duration. */
export function battlefieldSeeds(battlefield: RoomBattlefield): BattlefieldSeeds {
  switch (battlefield.id) {
    case 'sun':
    case 'rain':
    case 'sand':
    case 'snow':
      return { weather: { id: battlefield.id, turns: WEATHER_TURNS } };
    case 'electric':
    case 'grassy':
    case 'misty':
    case 'psychic':
      return { terrain: { id: battlefield.id, turns: TERRAIN_TURNS } };
    case 'fog':
      return { fog: true };
    case 'gravity':
      return { field: { gravity: FIELD_CONDITION_TURNS.gravity } };
    case 'trickroom':
      return { field: { trickroom: FIELD_CONDITION_TURNS.trickroom } };
    case 'radiant':
      return { roomField: { abilitiesOff: true } };
    case 'darkaura':
      return { roomField: { darkAura: true } };
    case 'fairyaura':
      return { roomField: { fairyAura: true } };
    case 'alltypes':
      return { roomField: { overrideType: ALL_TYPES_OVERRIDE } };
    case 'endure':
      return { roomField: { endure: true } };
    case 'crit':
      return { roomField: { critStage: ROOM_CRIT_STAGE } };
  }
}
