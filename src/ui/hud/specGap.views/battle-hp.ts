import battleHpFixture from '../../../../design/fixtures/05-battle-hud.json';
import { battleHpBox, battleHpView } from '../panels/battle-hp/view';
import type { GapBox, PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '05-battle-hud';

const DESKTOP = { width: 1280, height: 800 };

/**
 * The battle HP boxes against `05 Battle HUD`, at the desk viewport the frame draws.
 *
 * `battleHpView` is handed the frame's own fixture, whose `state` carries **no battle**
 * (`battle: null`), so the panel paints no HP box and no string: the foe's and the
 * player's names, levels, HP readouts, statuses, the ball row and the stage chips all come
 * from `state.battle`, which this snapshot does not have. The one box claimed below is the
 * foe's plate from the panel's **own exported geometry**, `battleHpBox`, and it lands on
 * the frame's `foe panel` to the pixel — the only rect the frame and the panel agree on.
 * Everything inside that plate is `HpBoxView.highlight` and `battleHp.css`, so no colour is
 * carried here and no string is invented: the frame's 44 strings stay unmeasured until a
 * fixture task adds the `battle` block.
 *
 * The boxes this view does **not** claim:
 *
 * | frame box | frame rect | shipped | why not claimed |
 * | --- | --- | --- | --- |
 * | `player panel` | `64, 660, 368, 100` | `battleHpBox(…, 'player', 0)` = `64, 674, 368, 100` | dy +14: the plate ends on the command card's shared bottom line 774 (`DESKTOP_BOTTOM_MARGIN` 26), the board's on 760 |
 * | `foe panel highlight`, `player panel highlight` | `76, 60, 344, 1` / `76, 672, 344, 1` | `HpBoxView.highlight` = `box + (12, 12, w − 24, 1)` | the foe's matches the board exactly; it is not a view box (it is the snapshot's), and the player's inherits the plate's dy |
 * | `foe hp track`, `foe hp fill`, `player hp track`, `player hp fill` | `88, 126, 220/195, 8` … | `battle-hp` track/fill spans, `battleHp.css` | painted by CSS off `HpBoxView.fraction`; the fill's width is the snapshot's fraction |
 * | `player status ENV` | `376, 736, 44, 16` | `.battle-hp__status` | painted by CSS when `statusLabel !== null`, and the fixture has no battle |
 * | `foe party ball 1…3` | `88, 160, 24, 24`, 28 px pitch | `foeBallRow` = `64, 156, 16, 16`, 20 px pitch | the shipped ball row is 16 px, 4 px apart, 8 px under the plate (`panels/battle-hp/README.md` rule 5) |
 * | `stat stages`, `stage atk…acc` | `448, 673, 114, 74`, 34 px chips at a 40 px pitch | `battleHpStages` | right-aligned to the plate's column (432) 8 px above it, because the board's own origin sits inside the shipped menu card |
 * | `battle menu`, `battle menu highlight`, `menu tab 0…3`, `move cell 0…3`, `attack detail`, `weather chip`, `foe sprite art`, `player sprite art`, `battle field`, `* shadow` | — | `battleMovesBox({1280, 800})` = `{ x: 676, y: 582, w: 564, h: 192 }`, the scene's canvas | **not this adapter's**: the menu card, its cells and the field belong to the battle-command / battle-moves / battle-log rows, and the sprites are the canvas's (`D49`) |
 */
export function buildView(spec: ScreenSpec): PanelView {
  const view = battleHpView(battleHpFixture.state, DESKTOP, { enemy: false, player: false });
  const foe = view.boxes.find((box) => box.side === 'enemy' && box.slot === 0);
  const plate: GapBox = {
    name: 'foe panel',
    ...(foe?.box ?? battleHpBox(DESKTOP, 'enemy', 0)),
  };
  const frame = spec.boxes.some((entry) => entry.name === plate.name);
  return {
    boxes: frame ? [plate] : [],
    strings: [],
    colours: [],
  };
}
