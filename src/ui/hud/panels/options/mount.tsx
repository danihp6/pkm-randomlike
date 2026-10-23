import { h, render } from 'preact';
import { signal, type Signal } from '@preact/signals';
import type { HudCommand } from '../../commands';
import { OptionsPanel } from './optionsPanel';
import type { OptionsView } from './view';

/** A signals `Signal` is an object with a `value` accessor; a getter is a function. */
function isSignal(value: Signal<OptionsView> | (() => OptionsView)): value is Signal<OptionsView> {
  if (typeof value === 'function') return 'value' in value;
  return typeof value === 'object' && value !== null && 'value' in value;
}

/**
 * Mounts the options panel into `host` and returns the disposer. A signal pushes a
 * new view with one render per set; a plain getter paints once.
 */
export function mountOptionsPanel(
  host: Element,
  view: Signal<OptionsView> | (() => OptionsView),
  onCommand?: ((command: HudCommand) => void) | undefined,
): () => void {
  const source = isSignal(view) ? view : signal(view());
  const container = document.createElement('div');
  container.className = 'options-mount';
  host.appendChild(container);

  const paint = (): void => {
    render(h(OptionsPanel, { view: source.value, onCommand }), container);
  };
  paint();
  const stop = source.subscribe(paint);

  return () => {
    stop();
    render(null, container);
    container.remove();
  };
}
