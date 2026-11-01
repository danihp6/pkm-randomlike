import { describe, expect, it } from 'vitest';
import tokens from '../../../design/tokens.json';
import { gapFor, gapIsEmpty, type PanelView, type ScreenSpec } from './specGap';

/**
 * The spec gap, walked (`D57`): every screen spec the board ships is measured here, and a
 * panel whose view model is wired is compared against its own spec. A frame that arrives
 * with no mapping and no reason fails this test, so the board can never grow a screen the
 * table does not account for.
 *
 * **One adapter per panel**, in `./specGap.views/`: each module exports the `slug` it
 * answers for and a `buildView(spec)` that returns the panel's three facts. That shape is
 * what lets a per-panel task own one file and nothing else, so four of them can ride a
 * batch without touching a shared registry.
 */

type Spec = ScreenSpec &
  Readonly<{ caption: string; snapshot: Readonly<{ file: string; sha256: string }> }>;

type Adapter = Readonly<{ slug: string; buildView: (spec: Spec) => PanelView }>;

const MODULES = import.meta.glob('../../../design/screens/*.json', {
  eager: true,
  import: 'default',
}) as Readonly<Record<string, Spec>>;

const ADAPTERS = import.meta.glob('./specGap.views/*.ts', {
  eager: true,
}) as Readonly<Record<string, Adapter>>;

const SLUGS = Object.keys(MODULES)
  .map((path) => path.slice(path.lastIndexOf('/') + 1, path.length - '.json'.length))
  .sort();

const specOf = (slug: string): Spec => MODULES[`../../../design/screens/${slug}.json`]!;

/** Every adapter, keyed by the slug it answers for. */
const MAPPED: ReadonlyMap<string, Adapter> = new Map(
  Object.values(ADAPTERS).map((adapter) => [adapter.slug, adapter]),
);

/**
 * The frames no view model is wired to yet, each with the reason. The per-panel tasks are
 * cut from `docs/hud-fidelity.md`'s table, which is this list plus the measurements; a task
 * that wires a panel deletes its line here and adds an adapter in `./specGap.views/`.
 */
const PENDING: Readonly<Record<string, string>> = {
  '01b-main-menu-no-save': 'the same screen with no save; no view builder is wired',
  '02-options': 'every options row is data, and no view builder is wired',
  '03-route-hud': 'the strip is the HUD shell, not a panel; measured from the frames',
  '03b-panels-row-view': 'party row view; no view builder is wired',
  '03c-panels-compress': 'the collapsed state; no view builder is wired',
  '03d-route-shop-buy': 'shop, one of its two states; no view builder is wired',
  '03e-route-shop-sell': 'shop, the other state; no view builder is wired',
  '03f-panels-reward-item': 'rewards, one choice; no view builder is wired',
  '03g-panels-reward-pokemon': 'rewards, the other choice; no view builder is wired',
  '03h-panels-rocket-slots': 'the rocket panel; no view builder is wired',
  '03i-panels-trade-pick': 'trade, the pick step; no view builder is wired',
  '03j-panels-trade-result': 'trade, the result step; no view builder is wired',
  '03l-panels-notice-level-up': 'the level-up notice; no view builder is wired',
  '03m-panels-pokemon-moves': 'the member detail card; no view builder is wired',
  '03n-panels-pause-menu': 'the pause menu; no view builder is wired',
  '03o-panels-map-routes': 'the floor map; no view builder is wired',
  '03p-panels-pc-rip': 'the PC box and its RIP tab; no view builder is wired',
  '04-starter-pick': 'the starter cards; no view builder is wired',
  '05-battle-hud': 'the battle HP boxes; no view builder is wired',
  '05b-battle-message': 'the battle message box; no view builder is wired',
  '05c-battle-bag': 'the battle bag; no view builder is wired',
  '05d-battle-pokemon': 'the SWITCH window; no view builder is wired',
  '05e-battle-stats': 'the SWITCH window stats; no view builder is wired',
  '06-run-over-defeat': 'the defeat card; no view builder is wired',
  '07-run-over-victory': 'the victory card; no view builder is wired',
  '07b-run-over-victory-pokemon': 'the victory card table; no view builder is wired',
  '08-stats-totals': 'the stats totals; no view builder is wired',
  '08b-stats-runs': 'the stats run list; no view builder is wired',
  '08c-stats-pokemon': 'the stats species table; no view builder is wired',
  '09-ranking': 'the global ranking; no view builder is wired',
  '09b-ranking-pokemon': 'the ranking species table; no view builder is wired',
};

const PALETTE: readonly string[] = (
  (tokens as { palette?: readonly { colour: string }[] }).palette ?? []
).map((entry) => entry.colour.toLowerCase());

describe('the spec gap, walked', () => {
  it('finds the 33 screens the board ships', () => {
    expect(SLUGS).toHaveLength(33);
  });

  it('accounts for every screen: mapped, or a named reason', () => {
    const unaccounted = SLUGS.filter(
      (slug) => MAPPED.get(slug) === undefined && PENDING[slug] === undefined,
    );
    expect(unaccounted, `screens with no mapping and no reason: ${unaccounted.join(', ')}`).toEqual(
      [],
    );
    const both = SLUGS.filter(
      (slug) => MAPPED.get(slug) !== undefined && PENDING[slug] !== undefined,
    );
    expect(both, `screens both mapped and pending: ${both.join(', ')}`).toEqual([]);
  });

  it('keys every adapter to a spec that exists', () => {
    for (const [slug, adapter] of MAPPED) {
      expect(SLUGS, slug).toContain(slug);
      expect(adapter.slug, slug).toBe(slug);
    }
  });

  it('measures every spec the same way: boxes, strings, colours and its snapshot', () => {
    for (const slug of SLUGS) {
      const spec = specOf(slug);
      expect(spec.slug, slug).toBe(slug);
      expect(spec.caption.length, slug).toBeGreaterThan(0);
      expect(spec.boxes.length, slug).toBeGreaterThan(0);
      expect(spec.snapshot.file, slug).toBe(`design/exports/${slug}.png`);
      expect(spec.snapshot.sha256.length, slug).toBe(64);
      for (const literal of spec.colours) {
        const base = literal.split('@')[0]!.toLowerCase();
        expect(PALETTE, `${slug}: ${literal}`).toContain(base);
      }
    }
  });

  it('reports no gap between a wired panel and its own spec', () => {
    for (const [slug, adapter] of MAPPED) {
      expect(gapIsEmpty(gapFor(adapter.buildView(specOf(slug)), specOf(slug))), slug).toBe(true);
    }
  });
});
