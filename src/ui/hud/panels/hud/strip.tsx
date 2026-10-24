import type { CSSProperties, JSX } from 'preact';
import type { HudCommand } from '../../commands';
import type { StripChip, StripView } from './view';
import './strip.css';

export type HudStripProps = Readonly<{
  view: StripView;
  onCommand?: ((command: HudCommand) => void) | undefined;
}>;

function boxStyle(chip: StripChip): CSSProperties {
  return {
    left: `${chip.box.x}px`,
    top: `${chip.box.y}px`,
    width: `${chip.box.w}px`,
    height: `${chip.box.h}px`,
  };
}

/**
 * One edge chip: the panel's initial, its live quick key in the accessible label,
 * and a press that toggles the panel exactly as its quick key does. The 44 px hit
 * overlay is the `::after` in `strip.css`, so a thumb finds a 26 px badge.
 */
function StripChipButton(
  props: Readonly<{ chip: StripChip; onCommand: HudStripProps['onCommand'] }>,
): JSX.Element {
  const { chip, onCommand } = props;
  return (
    <button
      type="button"
      class="hud-strip__chip"
      data-hud-strip-chip={chip.id}
      aria-label={chip.label}
      style={boxStyle(chip)}
      onClick={() => onCommand?.({ type: 'panel', panel: chip.id })}
    >
      <span class="hud-strip__letter" data-hud-strip-letter>
        {chip.letter}
      </span>
    </button>
  );
}

/**
 * The route strip: the collapsed panels' edge chips, laid out by `stripView` and
 * painted over the `#hud` layer. It draws no purse, no level and no meter — those
 * are the bag's and the party's own cards — and it takes no press beyond a chip.
 */
export function HudStrip(props: HudStripProps): JSX.Element {
  const { view } = props;
  return (
    <div class="hud-strip" data-hud-strip hidden={!view.open}>
      {view.chips.map((chip) => (
        <StripChipButton key={chip.id} chip={chip} onCommand={props.onCommand} />
      ))}
    </div>
  );
}
