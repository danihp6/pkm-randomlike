import type { CSSProperties, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../../../../i18n';
import { joinClasses, panelClass } from '../../kit';
import { HP_FILL_MS, type BattleHpView, type HpBoxView, type Rect } from './view';
import './battleHp.css';

export type BattleHpProps = Readonly<{ view: BattleHpView }>;

function rectStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
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
 * The battle's HP boxes over the canvas. The layer takes no pointer event and the
 * cards take no press: the battle is driven by keys, the pad and the canvas' own
 * zones, so nothing here may eat a tap.
 */
export function BattleHp(props: BattleHpProps): JSX.Element {
  const [settled, setSettled] = useState(false);
  // The first paint lands at its fraction with no transition; only a change after
  // it animates, so mounting a full-HP box does not drain it from empty.
  useEffect(() => {
    setSettled(true);
  }, []);

  return (
    <div
      class={joinClasses('battle-hp', settled ? 'battle-hp--settled' : null)}
      data-hud-battle-hp
      style={{ '--battle-hp-fill-ms': `${HP_FILL_MS}ms` }}
    >
      {props.view.boxes.map((box) => (
        <HpBox key={box.id} box={box} />
      ))}
    </div>
  );
}
