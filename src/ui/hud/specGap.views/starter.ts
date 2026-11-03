import starterFixture from '../../../../design/fixtures/04-starter-pick.json';
import { STARTER_BOARD, fixtureStarterView } from '../panels/starter';
import type { GapBox, PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '04-starter-pick';

/** The frame's names for the three cards the pick draws, in board order. */
const CARD_BOXES: readonly string[] = ['card 1', 'card 2', 'card 3'];

/**
 * The starter pick's view, built exactly as the running panel builds it — the
 * frame's own payload in `design/fixtures/04-starter-pick.json`, never the live run —
 * and narrowed to the facts frame `04 Starter pick` draws: the three card boxes off
 * `STARTER_BOARD.card` (`x = card.x + i * card.pitch`, so `218 / 510 / 802` at
 * `176`, `260 × 320`), the six strings the board carries (`CHOOSE YOUR STARTER`, the
 * three names, the `SHARE: …` line and `HOLD R FOR NEW SEED`) and no colour (the
 * cards' fills and borders are `starter.css`'s tokens, so the view model carries no
 * literal).
 *
 * `spec` is read only as that structural selector — is this box in the frame at all —
 * never as the answer, so a frame that names two cards emits two boxes. The type
 * badges, the portraits and each card's highlight are painted by the stylesheet at
 * offsets from the card box, so they are not claimed on their own; a box the frame
 * does not name is never emitted and `gapFor` reports no `missing`/`moved` entry.
 */
export function buildView(spec: ScreenSpec): PanelView {
  const built = fixtureStarterView(starterFixture);
  if (built === null) throw new Error(`${slug}: the fixture is not a starter payload`);
  const frame = new Set(
    spec.boxes.flatMap((box) => (box.name === null || box.name === '' ? [] : [box.name])),
  );

  const boxes: readonly GapBox[] = CARD_BOXES.flatMap((name, index) => {
    if (index >= built.cards.length || !frame.has(name)) return [];
    return [
      {
        name,
        x: STARTER_BOARD.card.x + index * STARTER_BOARD.card.pitch,
        y: STARTER_BOARD.card.y,
        w: STARTER_BOARD.card.w,
        h: STARTER_BOARD.card.h,
      },
    ];
  });

  const strings = [built.title, ...built.cards.map((card) => card.name), built.share, built.hint];

  return { boxes, strings, colours: [] };
}
