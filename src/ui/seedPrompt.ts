import { decodeRunShare, encodeRunShare, type RunMode, type RunShare } from '../engine/run';

/**
 * The seed / share-string prompt (Phase 7). A small DOM overlay, like the dev
 * debug menu, because a seed wants real text input and a share string wants
 * paste (`S` on the starter screen opens it). It never touches Phaser: the
 * caller hands in the run's current seed and mode and gets a run back on
 * confirm. Every key event inside it is stopped while it is open, so typing a
 * seed never also drives the game underneath.
 */
export const SEED_PROMPT_ID = 'seed-prompt';

export type SeedPromptOptions = Readonly<{
  /** What the field starts with: the seed and mode in use right now. */
  initial: RunShare;
  onConfirm: (share: RunShare) => void;
  onCancel?: () => void;
}>;

let closeActive: (() => void) | null = null;

/** Closes an open prompt without confirming it; safe when none is open. */
export function closeSeedPrompt(): void {
  closeActive?.();
}

const SHARED_INPUT_STYLE =
  'padding:6px 8px;border:1px solid #334155;border-radius:5px;background:#0f172a;color:#e2e8f0;font:inherit;';

function button(label: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.style.cssText =
    'padding:5px 12px;border:1px solid #7dd3fc;border-radius:5px;background:#1e293b;color:#e2e8f0;font:inherit;cursor:pointer;';
  return element;
}

function row(label: string): HTMLLabelElement {
  const element = document.createElement('label');
  element.textContent = label;
  element.style.cssText = 'display:flex;align-items:center;gap:8px;';
  return element;
}

/** Mounts the prompt. Any prompt already open is closed first. */
export function openSeedPrompt(options: SeedPromptOptions): void {
  closeSeedPrompt();

  const root = document.createElement('div');
  root.id = SEED_PROMPT_ID;
  root.style.cssText =
    'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;display:flex;' +
    'flex-direction:column;gap:10px;padding:16px;min-width:420px;background:#10161ff2;' +
    'border:2px solid #7dd3fc;border-radius:8px;color:#e2e8f0;font:13px/1.4 monospace;';

  const title = document.createElement('div');
  title.textContent = 'SEED / SHARE STRING';
  title.style.cssText = 'font-weight:700;color:#7dd3fc;';

  const hint = document.createElement('div');
  hint.textContent =
    'Paste a share string (PKRL-…) or type a seed. The same seed always plays the same run.';
  hint.style.cssText = 'color:#94a3b8;';

  const input = document.createElement('input');
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.value = encodeRunShare(options.initial);
  input.style.cssText = SHARED_INPUT_STYLE;

  const seedRow = row('Share');
  seedRow.append(input);

  const modeSelect = document.createElement('select');
  for (const [value, label] of [
    ['finite', 'Finite (ends at the final boss)'],
    ['infinite', 'Infinite (ends when the party falls)'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    modeSelect.append(option);
  }
  modeSelect.value = options.initial.mode;
  modeSelect.style.cssText = SHARED_INPUT_STYLE;

  const modeRow = row('Mode');
  modeRow.append(modeSelect);

  const status = document.createElement('div');
  status.style.cssText = 'min-height:18px;color:#94a3b8;';

  const confirmButton = button('Start');
  confirmButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';
  const cancelButton = button('Cancel');
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
  buttons.append(cancelButton, confirmButton);

  const resolve = (): RunShare | null =>
    decodeRunShare(input.value, modeSelect.value as RunMode);

  const refresh = (): void => {
    const share = resolve();
    if (!share) {
      status.textContent = 'not a valid share string';
      confirmButton.disabled = true;
      return;
    }
    // A prefixed share string always carries its mode; a bare seed keeps the
    // player's mode choice, which is what `resolve` handed back.
    modeSelect.value = share.mode;
    status.textContent = `${share.mode} · ${share.seed}`;
    confirmButton.disabled = false;
  };

  const confirm = (): void => {
    const share = resolve();
    if (!share) {
      refresh();
      return;
    }
    close();
    options.onConfirm(share);
  };

  const cancel = (): void => {
    close();
    options.onCancel?.();
  };

  function close(): void {
    closeActive = null;
    (document.activeElement as HTMLElement | null)?.blur();
    input.removeEventListener('input', refresh);
    modeSelect.removeEventListener('change', refresh);
    root.remove();
  }

  input.addEventListener('input', refresh);
  modeSelect.addEventListener('change', refresh);
  confirmButton.addEventListener('click', confirm);
  cancelButton.addEventListener('click', cancel);
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      confirm();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
    // Keep the typing out of the game's window-level key handlers.
    event.stopPropagation();
  });
  for (const type of ['keyup', 'keypress']) {
    root.addEventListener(type, (event) => event.stopPropagation());
  }

  root.append(title, hint, seedRow, modeRow, buttons, status);
  document.body.append(root);
  closeActive = close;
  refresh();
  input.focus();
  input.select();
}
