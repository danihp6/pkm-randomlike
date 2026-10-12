import manifest from './moveCoverage.json';

export type MoveCoverageStatus = 'port' | 'no-op' | 'excluded';

export type MoveCoverageEntry = Readonly<{
  id: string;
  name: string;
  status: MoveCoverageStatus;
  note: string;
}>;

type MoveCoverageManifest = Readonly<{
  source: string;
  moves: readonly MoveCoverageEntry[];
}>;

// The generated JSON is cast once here; `moveCoverage.test.ts` guards the shape.
// It is written by `scripts/effect-coverage.mjs` (`npm run docs:coverage`), which
// owns the classification (see `docs/balance/effect-coverage.md`).
const MANIFEST = manifest as unknown as MoveCoverageManifest;

/** Every classified move, in the manifest's order. */
export const MOVE_COVERAGE: readonly MoveCoverageEntry[] = MANIFEST.moves;

function normalizeMoveId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const BY_ID = new Map<string, MoveCoverageEntry>(
  MOVE_COVERAGE.map((entry) => [normalizeMoveId(entry.id), entry]),
);

/** The classification of a move id, normalized like `getMove`; undefined for an unknown id. */
export function moveCoverage(id: string): MoveCoverageEntry | undefined {
  return BY_ID.get(normalizeMoveId(id));
}

/** True when a run can meet the move and the engine has no handler for it. */
export function isUnportedMove(id: string): boolean {
  return moveCoverage(id)?.status === 'no-op';
}

/** The `no-op` ids, in manifest order — the port list a later task works through. */
export function unportedMoveIds(): readonly string[] {
  return MOVE_COVERAGE.filter((entry) => entry.status === 'no-op').map((entry) => entry.id);
}
