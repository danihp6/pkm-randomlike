import { describe, expect, it } from 'vitest';
import { HUD_PANEL_IDS } from '../../data/hudLayout';
import { KEYBIND_ACTIONS } from '../../data/keybinds';
import {
  BATTLE_COMMAND_ROWS,
  HUD_COMMAND_TYPES,
  reduceHudCommand,
  type HudCommand,
  type HudCommandType,
} from './commands';

const INTENT_KEYS: readonly string[] = [
  'accept',
  'action',
  'itemId',
  'kind',
  'memberId',
  'moveIndex',
  'panel',
  'row',
];

const INTENT_KEYS_BY_TYPE: Readonly<Record<HudCommandType, readonly string[]>> = {
  press: ['action', 'kind'],
  battleCommand: ['kind', 'row'],
  move: ['kind', 'moveIndex'],
  item: ['itemId', 'kind'],
  member: ['kind', 'memberId'],
  panel: ['kind', 'panel'],
  answer: ['accept', 'kind'],
};

const VALID_COMMANDS: Readonly<Record<HudCommandType, HudCommand>> = {
  press: { type: 'press', action: 'confirm' },
  battleCommand: { type: 'battleCommand', row: 'fight' },
  move: { type: 'move', moveIndex: 0 },
  item: { type: 'item', itemId: 'potion' },
  member: { type: 'member', memberId: 'catch-1' },
  panel: { type: 'panel', panel: 'party' },
  answer: { type: 'answer', accept: true },
};

describe('reduceHudCommand', () => {
  it('turns a press into the shipped action id', () => {
    const actions = ['confirm', 'cancel', 'up', 'bag', 'party', 'run', 'settings'] as const;
    for (const action of actions) {
      expect(reduceHudCommand({ type: 'press', action })).toStrictEqual({ kind: 'action', action });
    }
  });

  it('maps the four battle command rows', () => {
    for (const row of BATTLE_COMMAND_ROWS) {
      expect(reduceHudCommand({ type: 'battleCommand', row })).toStrictEqual({
        kind: 'battleCommand',
        row,
      });
    }
  });

  it('maps a move index', () => {
    expect(reduceHudCommand({ type: 'move', moveIndex: 0 })).toStrictEqual({
      kind: 'move',
      moveIndex: 0,
    });
    expect(reduceHudCommand({ type: 'move', moveIndex: 3 })).toStrictEqual({
      kind: 'move',
      moveIndex: 3,
    });
    expect(reduceHudCommand({ type: 'move', moveIndex: -1 })).toBeNull();
    expect(reduceHudCommand({ type: 'move', moveIndex: 4 })).toBeNull();
    expect(reduceHudCommand({ type: 'move', moveIndex: 1.5 })).toBeNull();
  });

  it('maps an item id', () => {
    expect(reduceHudCommand({ type: 'item', itemId: 'potion' })).toStrictEqual({
      kind: 'item',
      itemId: 'potion',
    });
    expect(reduceHudCommand({ type: 'item', itemId: '  potion ' })).toStrictEqual({
      kind: 'item',
      itemId: 'potion',
    });
    expect(reduceHudCommand({ type: 'item', itemId: '' })).toBeNull();
    expect(reduceHudCommand({ type: 'item', itemId: '   ' })).toBeNull();
  });

  it('maps a member id', () => {
    expect(reduceHudCommand({ type: 'member', memberId: 'catch-1' })).toStrictEqual({
      kind: 'member',
      memberId: 'catch-1',
    });
    expect(reduceHudCommand({ type: 'member', memberId: '' })).toBeNull();
    expect(reduceHudCommand({ type: 'member', memberId: '  ' })).toBeNull();
  });

  it('maps a panel id', () => {
    for (const panel of HUD_PANEL_IDS) {
      expect(reduceHudCommand({ type: 'panel', panel })).toStrictEqual({ kind: 'panel', panel });
    }
    expect(reduceHudCommand({ type: 'panel', panel: 'nope' } as unknown as HudCommand)).toBeNull();
  });

  it('maps a modal answer', () => {
    expect(reduceHudCommand({ type: 'answer', accept: true })).toStrictEqual({
      kind: 'answer',
      accept: true,
    });
    expect(reduceHudCommand({ type: 'answer', accept: false })).toStrictEqual({
      kind: 'answer',
      accept: false,
    });
  });

  it('refuses anything that is not a shipped action', () => {
    const notAction = { type: 'press', action: 'fight' } as unknown as HudCommand;
    expect(reduceHudCommand(notAction)).toBeNull();

    const notRow = { type: 'battleCommand', row: 'menu' } as unknown as HudCommand;
    expect(reduceHudCommand(notRow)).toBeNull();

    const notAnswer = { type: 'answer', accept: 'yes' } as unknown as HudCommand;
    expect(reduceHudCommand(notAnswer)).toBeNull();
  });

  it('covers every variant', () => {
    expect(Object.keys(VALID_COMMANDS).sort()).toStrictEqual([...HUD_COMMAND_TYPES].sort());
    for (const type of HUD_COMMAND_TYPES) {
      expect(reduceHudCommand(VALID_COMMANDS[type])).not.toBeNull();
    }
  });

  it('carries no run state', () => {
    for (const type of HUD_COMMAND_TYPES) {
      const intent = reduceHudCommand(VALID_COMMANDS[type]);
      expect(intent).not.toBeNull();
      const keys = Object.keys(intent!).sort();
      expect(keys).toStrictEqual(INTENT_KEYS_BY_TYPE[type]);
      for (const key of keys) {
        expect(INTENT_KEYS).toContain(key);
        expect(['run', 'battle', 'money', 'state', 'rng']).not.toContain(key);
      }
    }
  });

  it('takes a command and nothing else', () => {
    expect(reduceHudCommand.length).toBe(1);
    for (const action of KEYBIND_ACTIONS) {
      expect(reduceHudCommand({ type: 'press', action })).toStrictEqual({ kind: 'action', action });
    }
  });
});
