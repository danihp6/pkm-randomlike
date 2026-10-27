import type { CSSProperties, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Panel, TypeBadge } from '../../kit';
import { portraitBackground, type PortraitCrop } from '../../portrait';
import type { StarterIntent } from './mount';
import { STARTER_NARROW_QUERY, type StarterView } from './view';
import './starter.css';

/** The portrait box the two boards draw: 128 px on the desk, 80 px on the phone (`starter.css`). */
const PORTRAIT_BOX = 128;
const PORTRAIT_BOX_NARROW = 80;

export type StarterPanelProps = Readonly<{
  view: StarterView;
  onIntent?: ((intent: StarterIntent) => void) | undefined;
}>;

function compactViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(STARTER_NARROW_QUERY).matches;
}

/** Repaints when the panel crosses the breakpoint, so the inline portrait scale follows the box. */
function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(compactViewport);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(STARTER_NARROW_QUERY);
    const sync = (): void => setCompact(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return compact;
}

/** The portrait cell's inline scale, or no background at all when the atlas names no cell. */
function portraitStyle(portrait: PortraitCrop | null, box: number): CSSProperties | undefined {
  if (portrait === null) return undefined;
  const background = portraitBackground(portrait, box);
  return { ...background };
}

/**
 * The starter pick (`04` / `m04`): the title, the cards with their portraits,
 * names and type badges, the share line and the controls hint.
 * A card is a real button, so Enter and Space are the browser's own click and
 * the scene's keybinds stay the only keyboard listener.
 */
export function StarterPanel(props: StarterPanelProps): JSX.Element {
  const { view } = props;
  const send = props.onIntent;
  const compact = useCompactViewport();
  const portraitBox = compact ? PORTRAIT_BOX_NARROW : PORTRAIT_BOX;

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
                <span
                  class="starter__portrait"
                  data-hud-starter-portrait
                  style={portraitStyle(card.portrait, portraitBox)}
                />
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
