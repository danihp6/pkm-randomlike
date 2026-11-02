import optionsFixture from '../../../../design/fixtures/02-options.json';
import { fixtureOptionsView, type OptionsView } from '../panels/options/view';
import type { PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '02-options';

/** The frame's own fixture, whose `panel` block is the desktop payload the preview mounts. */
const FIXTURE: unknown = optionsFixture;

/**
 * The options screen against `02 Options`, built exactly as the fixture preview builds it:
 * `fixtureOptionsView` on the frame's own fixture with its narrow switch `false`, so the view is
 * the fixture's desktop `panel` block. The panel takes no viewport — `options.css` owns the
 * geometry and the only viewport switch in the model is the narrow block, which this row does not
 * claim — so the desk frame is the one it answers for.
 *
 * `boxes: []` is the measurement, not an omission. `OptionsView` is copy and state only —
 * `title`, `subtitle`, `footer`, `back`, `reset`, `selected`, and `groups` of
 * `{ id, kind, label, value, fraction, on }` — so the model carries no rect for this adapter to
 * claim, while the frame draws 33. The two the comparison would want first:
 *
 * | frame box | frame rect |
 * | --- | --- |
 * | `card gameplay` | `96, 200, 640, 470` |
 * | `card keybinds` | `760, 200, 424, 470` |
 *
 * Both are painted by `options.css` off the two cards (`D57`: the stylesheet paints the options
 * screen) and `scripts/design/check.mjs` measures the live DOM against them, so a box claimed
 * here would be a regression, not a fix. Every fill, stroke and hairline of the frame's other 31
 * boxes is a stylesheet token for the same reason, so no colour is claimed either.
 *
 * The strings are the model's copy in view order — `title`, `subtitle`, `footer`, `back`,
 * `reset`, then each group's `title` and each row's `label` and `value` — with `''` and `null`
 * dropped. `selected` is a row id, not copy, and the frame's four `<` / `>` step glyphs are the
 * panel's own literals rather than fields of the model, which is how the frame's 35 text nodes
 * meet the 31 lines claimed here.
 *
 * Deterministic and total: no `Rng`, no clock, no DOM, no store, no i18n — the fixture is a
 * module constant and `fixtureOptionsView` is pure, so the same spec always gives the same view.
 * A payload that does not read as an `OptionsView` yields `{ boxes: [], strings: [], colours: [] }`.
 */
export function buildView(_spec: ScreenSpec): PanelView {
  return { boxes: [], strings: printedCopy(fixtureOptionsView(FIXTURE, false)), colours: [] };
}

/**
 * The copy one view prints, in draw order: the five head lines, then each group's title and each
 * row's label and value. `''` and `null` print nothing, so a group without a title and a screen
 * without a reset control leave no empty line behind.
 */
export function printedCopy(view: OptionsView | null): readonly string[] {
  if (view === null) return [];
  const lines: (string | null)[] = [view.title, view.subtitle, view.footer, view.back, view.reset];
  for (const group of view.groups) {
    lines.push(group.title);
    for (const row of group.rows) lines.push(row.label, row.value);
  }
  return lines.filter((line): line is string => line !== null && line !== '');
}
