import type { Rng } from '../rng';
import type { BattleFighter, StatusId } from './fighter';

export const STATUS_IDS: readonly StatusId[] = ['brn', 'psn', 'tox', 'par', 'slp', 'frz'];

const STATUS_NAMES: Readonly<Record<StatusId, string>> = {
  brn: 'burn',
  psn: 'poison',
  tox: 'bad poison',
  par: 'paralysis',
  slp: 'sleep',
  frz: 'freeze',
};

export function statusName(status: StatusId): string {
  return STATUS_NAMES[status];
}

const TYPE_IMMUNITIES: Readonly<Record<StatusId, readonly string[]>> = {
  brn: ['Fire'],
  psn: ['Poison', 'Steel'],
  tox: ['Poison', 'Steel'],
  par: ['Electric'],
  slp: [],
  frz: ['Ice'],
};

export function canApplyStatus(fighter: BattleFighter, status: StatusId): boolean {
  if (fighter.hp <= 0) return false;
  if (fighter.status !== null) return false;
  return !fighter.types.some((type) => TYPE_IMMUNITIES[status].includes(type));
}

export function applyStatus(fighter: BattleFighter, status: StatusId, rng: Rng): boolean {
  if (!canApplyStatus(fighter, status)) return false;
  fighter.status = status;
  if (status === 'slp') fighter.statusCounter = rng.int(1, 3);
  else if (status === 'tox') fighter.statusCounter = 1;
  else fighter.statusCounter = 0;
  return true;
}

export function cureStatus(fighter: BattleFighter): StatusId | null {
  const status = fighter.status;
  if (!status) return null;
  fighter.status = null;
  fighter.statusCounter = 0;
  return status;
}

export type StatusMoveCheck =
  | Readonly<{ blocked: 'slp' | 'frz' | 'par' }>
  | Readonly<{ cured: StatusId }>
  | null;

/** Run before a move: sleep/freeze counters and the paralysis roll. */
export function beforeMoveStatus(fighter: BattleFighter, rng: Rng): StatusMoveCheck {
  if (fighter.status === 'slp') {
    fighter.statusCounter -= 1;
    if (fighter.statusCounter <= 0) {
      cureStatus(fighter);
      return { cured: 'slp' };
    }
    return { blocked: 'slp' };
  }
  if (fighter.status === 'frz') {
    if (rng.next() < 0.2) {
      cureStatus(fighter);
      return { cured: 'frz' };
    }
    return { blocked: 'frz' };
  }
  if (fighter.status === 'par' && rng.next() < 0.25) {
    return { blocked: 'par' };
  }
  return null;
}

export type ResidualDamage = Readonly<{ status: StatusId; damage: number }>;

/** End-of-turn chip damage. Bad poison's counter rises between ticks. */
export function residualDamage(fighter: BattleFighter): ResidualDamage | null {
  const status = fighter.status;
  if (!status || fighter.hp <= 0) return null;

  if (status === 'brn') {
    return { status, damage: Math.max(1, Math.floor(fighter.maxHp / 16)) };
  }
  if (status === 'psn') {
    return { status, damage: Math.max(1, Math.floor(fighter.maxHp / 8)) };
  }
  if (status === 'tox') {
    const damage = Math.max(1, Math.floor((fighter.maxHp * fighter.statusCounter) / 16));
    fighter.statusCounter = Math.min(15, fighter.statusCounter + 1);
    return { status, damage };
  }
  return null;
}
