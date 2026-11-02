import battleMessageFixture from '../../../../design/fixtures/05b-battle-message.json';
import { battleLogBoard, fixtureBattleLogView, type BattleLogView } from '../panels/battle-log/view';
import { GAP_TOLERANCE, type GapBox, type PanelView, type ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '05b-battle-message';

/** The frame's own copy (`design/fixtures/05b-battle-message.json`), as the preview reads it. */
const FIXTURE: unknown = battleMessageFixture;

/** The frame's name for the card, and the one box this adapter claims. */
const BOX = 'message box';

/**
 * The battle message box against `05b Battle · message`, built exactly as the fixture preview
 * builds it: `fixtureBattleLogView` on the frame's own fixture, whose two lines are the frame's
 * two message lines. No battle, no scene, no i18n and no clock is read.
 *
 * The one box claimed below is the card the scene mounts the log at, `battleLogBoard('desktop')`,
 * and it lands on the frame's own box to the pixel: a **zero delta**. Nothing else lands.
 *
 * | frame box | frame rect | shipped | why not claimed |
 * | --- | --- | --- | --- |
 * | `message box` | `664, 544, 576, 216` | `battleLogBoard('desktop').box` = `664, 544, 576, 216` | **claimed**: the fixture preview's measured board |
 * | `message box highlight` | `676, 556, 552, 1` | `BattleLogPanel`'s rule = `box + (12, 12, w − 24, 1)` | the card draws its own 1 px rule 12 px inside the top edge (`battleLogPanel.tsx`); it is not a view field, and it lands on the frame's rect to the pixel |
 * | `type cursor` | `696, 648, 10, 16` | — | the typewriter's caret: the line reveals character by character and the shipped card paints no cursor |
 * | `battle field`, `Vector` ×46, `foe shadow`, `player shadow` | `0, 0, 1280, 800` … | the scene's canvas | the painted battle, its speckles and the two shadows are the canvas's (`D49`) |
 * | `foe panel`, `foe panel highlight`, `foe hp track`, `foe hp fill`, `foe type GRASS`, `foe type POISON`, `player panel`, `player panel highlight`, `player hp track`, `player hp fill`, `player type FIRE`, `player type FLYING`, `player status ENV`, `foe party ball 1…3` | `64, 48, 368, 100` … | `battle-hp`, the `05-battle-hud` row | the plates, their type chips, the status badge and the ball row are the battle HP row's, which claims only the foe's plate |
 * | `weather chip` | `1076, 40, 144, 26` | `battle-field`'s 32 px chip row | the field chips are their own panel's; this frame's 144 × 26 corner chip is not a rect the log view carries |
 * | `foe sprite art`, `player sprite art` | `821, 111, 237, 207` / `204, 303, 252, 243` | the canvas's sprite layer | the sprites are the canvas's (`D49`) |
 *
 * The copy it does **not** claim: the frame's other seven strings — `foe name`, `foe lv`,
 * `foe hp text`, `player name`, `player lv`, `player hp text`, `weather text` — are the battle
 * HP and battle field rows'. The two it does claim are the fixture's own, folded by `gapFor`.
 *
 * No colour is claimed: the 92 % glass, the hairline and the effect red are `battleLog.css`'s
 * tokens, which `scripts/design/check.mjs` covers, and the view model carries no colour literal.
 */
export function buildView(spec: ScreenSpec): PanelView {
  return { boxes: boxClaims(spec), strings: visibleLines(fixtureBattleLogView(FIXTURE)), colours: [] };
}

/**
 * The lines the view actually carries, so the copy claim is total: a payload the parser rejects
 * (`null`) and a hidden box (`visible: false`) print nothing, whatever their `lines` hold.
 */
export function visibleLines(view: BattleLogView | null): readonly string[] {
  if (view === null || !view.visible) return [];
  return view.lines.map((line) => line.text).filter((line) => line !== '');
}

/**
 * The card the panel paints, claimed only when the frame draws `message box` at the shipped
 * rect: the board and the frame are the same numbers today, so the claim is a zero delta, and
 * a board moved off the frame stops being a claim instead of passing silently.
 */
function boxClaims(spec: ScreenSpec): readonly GapBox[] {
  const frame = spec.boxes.find((box) => box.name === BOX);
  if (frame === undefined) return [];
  const shipped = battleLogBoard('desktop').box;
  const near =
    Math.abs(shipped.x - frame.x) <= GAP_TOLERANCE &&
    Math.abs(shipped.y - frame.y) <= GAP_TOLERANCE &&
    Math.abs(shipped.w - frame.width) <= GAP_TOLERANCE &&
    Math.abs(shipped.h - frame.height) <= GAP_TOLERANCE;
  return near ? [{ name: BOX, ...shipped }] : [];
}
