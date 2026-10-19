import {
  BOSS_BATTLEFIELD_CHANCE,
  ROOM_BATTLEFIELDS,
  ROOM_BATTLEFIELD_CHANCE,
  type RoomBattlefield,
} from '../../data/battlefields';
import { FIELD_CONDITION_TURNS } from '../battle/effects/conditions';
import { TERRAIN_TURNS } from '../battle/effects/terrain';
import { WEATHER_TURNS } from '../battle/effects/weather';
import type { BattleSetup } from '../battle/state';
import { hashSeed, Rng } from '../rng';

/** The roll a plan room earns from its own role (`docs/maps-spec.md` §6/§7). */
export type RoomKind = 'trainer' | 'boss' | 'quiet';

/** The `BattleSetup` fields a rolled condition fills. */
export type BattlefieldSeeds = Pick<BattleSetup, 'weather' | 'terrain' | 'field' | 'fog'>;

/**
 * The kind of roll a room earns: the boss room, a room that fields regular trainers,
 * or a quiet leaf (the entry room and every special leaf: shop, mini-boss,
 * mega-stone). `boss` wins over `quiet` — the boss room is both.
 */
export function roomKindOf(
  room: Readonly<{ entry: boolean; boss: boolean; special: string | null }>,
): RoomKind {
  if (room.boss) return 'boss';
  return room.entry || room.special !== null ? 'quiet' : 'trainer';
}

/**
 * The condition `roomIndex` starts its battles under, or null. Exactly one
 * `rng.next()` is drawn for the chance and, on a hit, one `rng.int` over the
 * table; a `quiet` room draws nothing at all.
 */
export function roomBattlefield(
  seed: string,
  roomIndex: number,
  kind: RoomKind,
): RoomBattlefield | null {
  if (kind === 'quiet') return null;
  const rng = new Rng(hashSeed(`${seed}:battlefield:${roomIndex}`));
  const chance = kind === 'boss' ? BOSS_BATTLEFIELD_CHANCE : ROOM_BATTLEFIELD_CHANCE;
  if (rng.next() >= chance) return null;
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
  }
}
