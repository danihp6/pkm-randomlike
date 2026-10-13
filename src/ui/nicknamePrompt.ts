import { NICKNAME_MAX_LENGTH } from '../engine/run/nickname';

/**
 * The nickname prompt: a small DOM overlay, the same pattern as `seedPrompt`,
 * because a name wants real text input. It holds **no** nickname rule of its own
 * - it hands the field's raw text to the caller and the pure `normalizeNickname`
 * decides - so the sanitiser and the "typing the species name clears it" rule
 * live in `src/engine/run/nickname.ts`. Every key event inside it is stopped
 * while it is open, so typing a name never also drives the game underneath.
 */
export const NICKNAME_PROMPT_ID = 'nickname-prompt';

export type NicknamePromptOptions = Readonly<{
  /** What the field starts with: the member's nickname, or its species name. */
  initial: string;
  /** The species name, shown in the hint so the canon "typing it clears the name" rule is visible. */
  speciesName: string;
  /** The field's raw text on confirm; `''` means "clear the nickname". */
  onConfirm: (value: string) => void;
  onCancel?: () => void;
}>;

let closeActive: (() => void) | null = null;

/** Closes an open prompt without confirming; safe when none is open. */
export function closeNicknamePrompt(): void {
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

/** Mounts the prompt. Any prompt already open is closed first. */
export function openNicknamePrompt(options: NicknamePromptOptions): void {
  closeNicknamePrompt();

  const root = document.createElement('div');
  root.id = NICKNAME_PROMPT_ID;
  root.style.cssText =
    'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;display:flex;' +
    'flex-direction:column;gap:10px;padding:16px;min-width:320px;background:#10161ff2;' +
    'border:2px solid #7dd3fc;border-radius:8px;color:#e2e8f0;font:13px/1.4 monospace;';

  const title = document.createElement('div');
  title.textContent = 'NICKNAME';
  title.style.cssText = 'font-weight:700;color:#7dd3fc;';

  const hint = document.createElement('div');
  hint.textContent = `type a name, or ${options.speciesName} to clear it`;
  hint.style.cssText = 'color:#94a3b8;';

  const input = document.createElement('input');
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.maxLength = NICKNAME_MAX_LENGTH;
  input.value = options.initial;
  input.style.cssText = SHARED_INPUT_STYLE;

  const confirmButton = button('OK');
  confirmButton.style.cssText += 'background:#0e7490;color:#f8fafc;font-weight:700;';
  const cancelButton = button('Cancel');
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
  buttons.append(cancelButton, confirmButton);

  const confirm = (): void => {
    const value = input.value;
    close();
    options.onConfirm(value);
  };

  const cancel = (): void => {
    close();
    options.onCancel?.();
  };

  function close(): void {
    closeActive = null;
    (document.activeElement as HTMLElement | null)?.blur();
    root.remove();
  }

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

  root.append(title, hint, input, buttons);
  document.body.append(root);
  closeActive = close;
  input.focus();
  input.select();
}
