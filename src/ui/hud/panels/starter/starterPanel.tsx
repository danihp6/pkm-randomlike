import type { JSX } from 'preact';
import { Panel, TypeBadge } from '../../kit';
import type { StarterIntent } from './mount';
import type { StarterView } from './view';
import './starter.css';

export type StarterPanelProps = Readonly<{
  view: StarterView;
  onIntent?: ((intent: StarterIntent) => void) | undefined;
}>;

/**
 * The starter pick (`04` / `m04`): the title, the cards with their portrait
 * placeholders, names and type badges, the share line and the controls hint.
 * A card is a real button, so Enter and Space are the browser's own click and
 * the scene's keybinds stay the only keyboard listener.
 */
export function StarterPanel(props: StarterPanelProps): JSX.Element {
  const { view } = props;
  const send = props.onIntent;

  const intent = (next: StarterIntent): void => {
    if (send !== undefined) send(next);
  };

  return (
    <div class="starter" data-hud-starter>
      <div class="starter__stage">
        <h1 class="starter__title" data-hud-starter-title>
          {view.title}
        </h1>
        <div class="starter__cards">
          {view.cards.map((card, index) => {
            const selected = index === view.selected;
            return (
              <button
                key={card.speciesId}
                type="button"
                class="starter__card"
                data-hud-starter-card={card.speciesId}
                data-selected={selected ? 'true' : undefined}
                aria-current={selected ? 'true' : undefined}
                onMouseEnter={() => intent({ type: 'select', index })}
                onFocus={() => intent({ type: 'select', index })}
                onClick={() => intent({ type: 'choose', index })}
              >
                <Panel class="starter__skin" />
                <span class="starter__portrait" data-hud-starter-portrait />
                <span class="starter__name">{card.name}</span>
                <span class="starter__badges">
                  {card.types.map((type) => (
                    <span key={type} class="starter__badge" data-hud-starter-badge={type}>
                      <TypeBadge type={type} />
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <p class="starter__share" data-hud-starter-share>
          {view.share}
        </p>
        <p class="starter__hint" data-hud-starter-hint>
          {view.hint}
        </p>
      </div>
    </div>
  );
}
