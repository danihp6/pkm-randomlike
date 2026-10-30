import { h, render } from 'preact';
import { BattleFieldPanel } from './battleField';
import { battleFieldView, type BattleFieldInput, type BattleFieldView } from './view';

export type BattleFieldController = Readonly<{
  /** Pushes the battle's field state; a clear sky paints no chip. */
  update(input: BattleFieldInput): void;
  dispose(): void;
}>;

/** The clear sky painted on mount, so the layer exists before the first push. */
const EMPTY: BattleFieldInput = {
  viewport: { width: 0, height: 0 },
  doubles: { enemy: false, player: false },
  weather: null,
  weatherTurns: 0,
  terrain: null,
  terrainTurns: 0,
};

/**
 * Mounts the field chips into `host` and returns the controller the scene feeds. The
 * empty row is painted on mount, so `[data-hud-panel="battle-field"]` is there from
 * the moment the battle mounts; Preact reuses the chips between pushes.
 */
export function mountBattleField(host: Element): BattleFieldController {
  const container = document.createElement('div');
  container.className = 'battle-field-mount';
  host.appendChild(container);

  let view: BattleFieldView = battleFieldView(EMPTY);
  const paint = (): void => {
    render(h(BattleFieldPanel, { view }), container);
  };
  paint();

  return {
    update: (input: BattleFieldInput): void => {
      view = battleFieldView(input);
      paint();
    },
    dispose: (): void => {
      render(null, container);
      container.remove();
    },
  };
}
