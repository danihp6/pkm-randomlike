import type { HudSink, HudState } from '../state';
import type { HudFlags } from './flags';
import type { FixtureModules } from './registry';

export type { HudFlags } from './flags';
export { normaliseSlug, parseHudFlags } from './flags';
export type { FixtureModules } from './registry';
export { FIXTURE_MODULES } from './registry';

/**
 * One frame of the board, as the HUD renders it: the file's slug, the screen it draws and the
 * snapshot it holds. `screen` is the `data-hud-panel` value the frame carries — a marker id for the
 * panels whose root is a bare attribute — and null when the file names none.
 */
export type HudFixture = Readonly<{ slug: string; screen: string | null; state: HudState }>;

const HUD_STATE_KEYS = ['party', 'bag', 'money', 'route', 'battle', 'notice'] as const;

/** The lower-kebab a `screen` value shares with a fixture slug. */
const SCREEN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Paths already complained about, so a rejected file warns once per page load. */
const REJECTED = new Set<string>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function basename(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return cut < 0 ? path : path.slice(cut + 1);
}

function hasId(value: unknown, key: 'id' | 'itemId'): boolean {
  if (!isPlainObject(value)) return false;
  const id = value[key];
  return typeof id === 'string' && id.length > 0;
}

/** Structural validation of `HudState`: the six keys, kinds and row ids. */
export function isHudState(value: unknown): value is HudState {
  if (!isPlainObject(value)) return false;
  if (Object.keys(value).length !== HUD_STATE_KEYS.length) return false;
  for (const key of HUD_STATE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  }
  const { party, bag, money, route, battle, notice } = value;
  if (!Array.isArray(party) || !party.every((row) => hasId(row, 'id'))) return false;
  if (!Array.isArray(bag) || !bag.every((row) => hasId(row, 'itemId'))) return false;
  if (money !== null && !(typeof money === 'number' && Number.isFinite(money))) return false;
  for (const panel of [route, battle, notice]) {
    if (panel !== null && !isPlainObject(panel)) return false;
  }
  return true;
}

function reject(path: string, reason: string): null {
  if (REJECTED.has(path)) return null;
  REJECTED.add(path);
  console.warn(`hud fixture ${path}: ${reason}`);
  return null;
}

/** A glob map without `import: 'default'` hands back the module namespace; a lone `default` is unwrapped so either shape loads. */
function fixtureValue(entry: unknown): unknown {
  if (!isPlainObject(entry)) return entry;
  if ('slug' in entry || !('default' in entry)) return entry;
  return entry.default;
}

/** The slugs a module map carries, ascending. Paths that are not `*.json` are skipped. */
export function fixtureSlugs(modules: FixtureModules): readonly string[] {
  const slugs = new Set<string>();
  for (const path of Object.keys(modules)) {
    const name = basename(path);
    if (!name.toLowerCase().endsWith('.json') || name.length === '.json'.length) continue;
    slugs.add(name.slice(0, -'.json'.length));
  }
  return [...slugs].sort();
}

/** The `screen` a fixture file names: a lower-kebab string, or null when absent or malformed. */
export function fixtureScreen(value: unknown): string | null {
  return typeof value === 'string' && SCREEN.test(value) ? value : null;
}

/**
 * The fixture for `slug`, or null. The entry's basename must equal `<slug>.json`,
 * the value must be a plain object with a string `slug` equal to the filename's
 * slug and a `state` that passes `isHudState`; anything else is null. A missing or
 * malformed `screen` is null and never rejects the frame.
 */
export function fixtureFor(modules: FixtureModules, slug: string): HudFixture | null {
  const file = `${slug}.json`;
  for (const [path, entry] of Object.entries(modules)) {
    if (basename(path) !== file) continue;
    const value = fixtureValue(entry);
    if (!isPlainObject(value)) return reject(path, 'not a JSON object');
    const claimed = value.slug;
    if (typeof claimed !== 'string') return reject(path, `no string "slug" for "${file}"`);
    if (claimed !== slug) return reject(path, `slug "${claimed}" does not match "${file}"`);
    const state = value.state;
    if (!isHudState(state)) return reject(path, 'state is not a HudState');
    return { slug, screen: fixtureScreen(value.screen), state };
  }
  return null;
}

/** The fixture this URL asks for: null unless the flag is on and the slug resolves. */
export function installFixture(flags: HudFlags, modules: FixtureModules): HudFixture | null {
  if (!flags.dom || flags.fixture === null) return null;
  return fixtureFor(modules, flags.fixture);
}

/**
 * The sink a scene installs while a fixture is on: it emits the fixture's state on
 * its first call and drops every later live emission. With `null` it returns `sink`
 * unchanged, so a scene always installs the result.
 */
export function holdForFixture(fixture: HudFixture | null, sink: HudSink): HudSink {
  if (fixture === null) return sink;
  let held = false;
  return (): void => {
    if (held) return;
    held = true;
    sink(fixture.state);
  };
}
