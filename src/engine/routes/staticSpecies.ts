import type { GateKind } from '../../data/gates';
import {
  LEGENDARY_ROOM,
  LEGENDARY_SPECIES,
  STATIC_GATES,
  STATIC_SPECIES,
  type StaticGate,
} from '../../data/staticSpecies';
import { hashSeed, Rng } from '../rng';
import { partyHasAbility, partyHasType } from '../run/party';
import { squadLevel, type RunState } from '../run/state';

/**
 * The **static-species** room (`docs/maps-spec.md` §7): a dead-end leaf whose route
 * carves the shipped one-tile vault behind one obstacle, and whose prize is one
 * static species at the squad's level rather than a ground item. The room's content
 * is a pure function of the run's own facts and two minted streams, so a fixed seed
 * reproduces the leaf, its seal and its species and no shipped stream moves.
 */

/** Which content a floor's static leaf holds. */
export type StaticRoomVariant = 'ordinary' | 'legendary';

/** What the room places behind its seal, and the property that opens it. */
export type StaticRoomContent = Readonly<{
  variant: StaticRoomVariant;
  /** The species the room fields, at the squad's current level. */
  speciesId: string;
  /** `squadLevel(run)` when the room was built. */
  level: number;
  /** The gate row the obstacle reads. */
  gate: StaticGate;
}>;

/** The seal's stable opening mark in `pickedItems`: `static-<mapIndex>-<roomId>`. */
export function staticGateId(mapIndex: number, roomId: number): string {
  return `static-${mapIndex}-${roomId}`;
}

/** The static species' own mark in `pickedItems`: `static-mon-<mapIndex>-<roomId>`. */
export function staticSpeciesId(mapIndex: number, roomId: number): string {
  return `static-mon-${mapIndex}-${roomId}`;
}

/** True when the party holds the gate's property (a type list, or an ability list). */
export function staticGateOpen(run: RunState, gate: StaticGate): boolean {
  return gate.kind === 'type' ? partyHasType(run, gate.values) : partyHasAbility(run, gate.values);
}

/**
 * The content this floor's static leaf holds, from the run and the leaf's own
 * streams. The legendary gate reads only the two fields `advanceMap` writes
 * (`missionsCompleted` and `mission.id`), never `missionMet`, `hpLost` or the
 * casualty count, so a mid-floor loss or a rebuild can never flip a room the run has
 * already seen into its legendary variant.
 */
export function staticRoomContent(
  run: RunState,
  mapIndex: number,
  roomId: number,
  obstacle: GateKind,
): StaticRoomContent {
  const floor = Math.max(1, Math.floor(mapIndex));
  const eligible =
    floor >= LEGENDARY_ROOM.fromMap && run.missionsCompleted === 1 && run.mission?.id === 'flawless';
  const legendary =
    eligible &&
    new Rng(hashSeed(`${run.seed}:map:${floor}:static-variant:${roomId}`)).next() <
      LEGENDARY_ROOM.chance;
  const list = legendary ? LEGENDARY_SPECIES : STATIC_SPECIES;
  const speciesId =
    list[new Rng(hashSeed(`${run.seed}:map:${floor}:static-species:${roomId}`)).int(0, list.length - 1)];
  return {
    variant: legendary ? 'legendary' : 'ordinary',
    speciesId,
    level: squadLevel(run),
    gate: STATIC_GATES[obstacle],
  };
}
