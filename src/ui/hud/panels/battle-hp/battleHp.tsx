import type { CSSProperties, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import itemAtlas from '../../../../data/anil/item-icons.json';
import { ITEM_ICON_ATLAS_URL, itemIconFrame } from '../../../../data/itemIcons';
import { t } from '../../../../i18n';
import { joinClasses, panelClass } from '../../kit';
import {
  BATTLE_BALL_SIZE,
  HP_FILL_MS,
  type BattleHpView,
  type HpBallView,
  type HpBoxView,
  type Rect,
} from './view';
import './battleHp.css';

export type BattleHpProps = Readonly<{ view: BattleHpView }>;

const POKE_BALL_FRAME = itemIconFrame('pokeball') ?? 0;

function rectStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/** The 24 px atlas cell drawn at the row's 16 px ball, positioned inside the row. */
function ballStyle(ball: HpBallView, row: Rect): CSSProperties {
  const col = POKE_BALL_FRAME % itemAtlas.cols;
  const line = Math.floor(POKE_BALL_FRAME / itemAtlas.cols);
  return {
    left: `${ball.box.x - row.x}px`,
    top: `${ball.box.y - row.y}px`,
    width: `${BATTLE_BALL_SIZE}px`,
    height: `${BATTLE_BALL_SIZE}px`,
    backgroundImage: `url("${ITEM_ICON_ATLAS_URL}")`,
    backgroundSize: `${itemAtlas.cols * BATTLE_BALL_SIZE}px auto`,
    backgroundPosition: `-${col * BATTLE_BALL_SIZE}px -${line * BATTLE_BALL_SIZE}px`,
    backgroundRepeat: 'no-repeat',
  };
}

function fillStyle(fraction: number): CSSProperties {
  const clamped = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return { width: `${clamped * 100}%` };
}

/** One card: the highlight, the name-and-level line, the HP track, its fill and the readout. */
function HpBox(props: Readonly<{ box: HpBoxView }>): JSX.Element {
  const { box } = props;
  return (
    <div
      class={panelClass({ class: `battle-hp__box battle-hp__box--${box.side}` })}
      data-hud-hp={box.id}
      style={rectStyle(box.box)}
    >
      <div class="battle-hp__content">
        <span class="battle-hp__highlight" style={rectStyle(box.highlight)} />
        <span class="battle-hp__name">{box.name}</span>
        <span class="battle-hp__level">{t('common.level', { level: box.level })}</span>
        <span class="battle-hp__track" data-hud-hp-track>
          <span class="battle-hp__fill" data-hud-hp-fill style={fillStyle(box.fraction)} />
        </span>
        <span class="battle-hp__value" data-hud-hp-value>
          {box.hpText}
        </span>
        {box.statusLabel === null ? null : <span class="battle-hp__status">{box.statusLabel}</span>}
      </div>
    </div>
  );
}

/**
 * The battle's HP boxes over the canvas, and the foe's remaining team as a ball row
 * under its box. The layer takes no pointer event and the cards take no press: the
 * battle is driven by keys, the pad and the canvas' own zones, so nothing here may
 * eat a tap. The row's count is its accessible name: digits only, no locale.
 */
export function BattleHp(props: BattleHpProps): JSX.Element {
  const [settled, setSettled] = useState(false);
  // The first paint lands at its fraction with no transition; only a change after
  // it animates, so mounting a full-HP box does not drain it from empty.
  useEffect(() => {
    setSettled(true);
  }, []);

  const row = props.view.foeBallsBox;
  const standing = props.view.foeBalls.reduce(
    (count, ball) => (ball.state === 'filled' ? count + 1 : count),
    0,
  );

  return (
    <div
      class={joinClasses('battle-hp', settled ? 'battle-hp--settled' : null)}
      data-hud-battle-hp
      style={{ '--battle-hp-fill-ms': `${HP_FILL_MS}ms` }}
    >
      {props.view.boxes.map((box) => (
        <HpBox key={box.id} box={box} />
      ))}
      {row === null ? null : (
        <div
          class="battle-hp__balls"
          data-hud-battle-hp-balls
          role="img"
          title={`${standing}/${props.view.foeBalls.length}`}
          style={rectStyle(row)}
        >
          {props.view.foeBalls.map((ball) => (
            <span
              key={ball.index}
              class="battle-hp__ball"
              data-hud-ball={ball.state}
              aria-hidden="true"
              style={ballStyle(ball, row)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
