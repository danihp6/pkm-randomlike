import type { CSSProperties, JSX } from 'preact';
import type { BattleFieldView, FieldChipView, Rect } from './view';
import './battleField.css';

export type BattleFieldProps = Readonly<{ view: BattleFieldView }>;

function rectStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/**
 * One condition: its drawn glyph filling the 32 px cell, with the remaining turns on
 * the chip's own corner plate. The chip's whole accessible name is the view's label,
 * numeral included, so neither the glyph nor the plate is read twice.
 */
function FieldChip(props: Readonly<{ chip: FieldChipView }>): JSX.Element {
  const { chip } = props;
  return (
    <div
      class="battle-field__chip"
      data-hud-field={chip.id}
      data-hud-field-kind={chip.kind}
      role="img"
      aria-label={chip.label}
      style={rectStyle(chip.box)}
    >
      <svg
        class="battle-field__icon"
        data-hud-field-icon
        aria-hidden="true"
        focusable="false"
        viewBox={`0 0 ${chip.viewBox} ${chip.viewBox}`}
      >
        <path d={chip.path} fill="currentColor" />
      </svg>
      <span class="battle-field__turn" data-hud-field-turn aria-hidden="true">
        {chip.turns}
      </span>
    </div>
  );
}

/**
 * The battle's field chips over the canvas (`D49`): the weather and the terrain the
 * battle is under, one 32 px cell each at the stage's top right. The layer takes no
 * pointer event and no chip takes one either: the chips are a readout, never a
 * control, and they spend no turn.
 */
export function BattleFieldPanel(props: BattleFieldProps): JSX.Element {
  return (
    <div class="battle-field" data-hud-panel="battle-field">
      {props.view.chips.map((chip) => (
        <FieldChip key={chip.id} chip={chip} />
      ))}
    </div>
  );
}
