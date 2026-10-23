/** A Vite module map: what `import.meta.glob(..., { eager: true })` returns. */
export type FixtureModules = Readonly<Record<string, unknown>>;

/**
 * The eager, build-time map of `design/fixtures/*.json`, keyed by path. Empty —
 * not absent, not an error — while the folder does not exist, so `Task-127` may
 * add the first payload without touching this file.
 */
export const FIXTURE_MODULES: FixtureModules = import.meta.glob('../../../../design/fixtures/*.json', {
  eager: true,
  import: 'default',
});
