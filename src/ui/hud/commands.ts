import { HUD_PANEL_IDS, type HudPanelId } from '../../data/hudLayout';
import { isKeybindAction, type KeybindAction } from '../../data/keybinds';
import { MAX_MOVES } from '../../engine/run/progression';

/** The four rows of the battle's command grid, in the order the grid draws them. */
export const BATTLE_COMMAND_ROWS = ['fight', 'bag', 'switch', 'run'] as const;
export type BattleCommandRow = (typeof BATTLE_COMMAND_ROWS)[number];

/** Every variant of the union, for a total test and for a component's own switch. */
export const HUD_COMMAND_TYPES = [
  'press',
  'battleCommand',
  'move',
  'item',
  'member',
  'panel',
  'answer',
] as const;
export type HudCommandType = (typeof HUD_COMMAND_TYPES)[number];

/** What a HUD control can ask for. Plain data: it can carry no run or battle state. */
export type HudCommand =
  | Readonly<{ type: 'press'; action: KeybindAction }>
  | Readonly<{ type: 'battleCommand'; row: BattleCommandRow }>
  | Readonly<{ type: 'move'; moveIndex: number }>
  | Readonly<{ type: 'item'; itemId: string }>
  | Readonly<{ type: 'member'; memberId: string }>
  | Readonly<{ type: 'panel'; panel: HudPanelId }>
  | Readonly<{ type: 'answer'; accept: boolean }>;

/** What a scene receives. `kind: 'action'` is the path a key or pad press already takes. */
export type HudIntent =
  | Readonly<{ kind: 'action'; action: KeybindAction }>
  | Readonly<{ kind: 'battleCommand'; row: BattleCommandRow }>
  | Readonly<{ kind: 'move'; moveIndex: number }>
  | Readonly<{ kind: 'item'; itemId: string }>
  | Readonly<{ kind: 'member'; memberId: string }>
  | Readonly<{ kind: 'panel'; panel: HudPanelId }>
  | Readonly<{ kind: 'answer'; accept: boolean }>;

function isMoveIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < MAX_MOVES;
}

function trimmedId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return id === '' ? null : id;
}

/** Total, state-free, and `null` when the command cannot reach a scene. */
export function reduceHudCommand(command: HudCommand): HudIntent | null {
  switch (command.type) {
    case 'press':
      return isKeybindAction(command.action) ? { kind: 'action', action: command.action } : null;
    case 'battleCommand':
      return BATTLE_COMMAND_ROWS.includes(command.row)
        ? { kind: 'battleCommand', row: command.row }
        : null;
    case 'move':
      return isMoveIndex(command.moveIndex) ? { kind: 'move', moveIndex: command.moveIndex } : null;
    case 'item': {
      const itemId = trimmedId(command.itemId);
      return itemId === null ? null : { kind: 'item', itemId };
    }
    case 'member': {
      const memberId = trimmedId(command.memberId);
      return memberId === null ? null : { kind: 'member', memberId };
    }
    case 'panel':
      return HUD_PANEL_IDS.includes(command.panel) ? { kind: 'panel', panel: command.panel } : null;
    case 'answer':
      return typeof command.accept === 'boolean' ? { kind: 'answer', accept: command.accept } : null;
  }
  return null;
}
