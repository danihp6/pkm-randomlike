import type { TranslationKey } from '../i18n';

/**
 * The special-NPC table (`docs/maps-spec.md` §7): every special NPC a trainer room
 * can hold, its art, its per-floor chance and the party gate that makes it
 * eligible. Pure data — the roll lives in `src/engine/routes/npcs.ts` and the card
 * the interact key opens in `src/ui/npcPanel.ts`, so this file carries no function
 * that reads a run and no Phaser.
 */

/** What a party must carry for an NPC row to be eligible (never the box). */
export type NpcRequirement =
  | Readonly<{ kind: 'type'; types: readonly string[] }>
  | Readonly<{ kind: 'move'; moves: readonly string[] }>
  | Readonly<{ kind: 'ability'; abilities: readonly string[] }>;

/** One choice the panel shell prints; `label` is an i18n key. */
export type NpcChoice = Readonly<{ id: string; label: TranslationKey }>;

/** One special NPC: identity, its art, its per-floor chance and its gate. */
export type NpcRow = Readonly<{
  id: string;
  /** The i18n key of the NPC's name, printed as the panel's title. */
  nameKey: TranslationKey;
  /** The i18n key of the one paragraph the panel opens with. */
  greetingKey: TranslationKey;
  /** A key of `NPC_SPRITE_KEYS` (`src/data/overworldSprites.ts`). */
  spriteKey: string;
  /** Base chance, 0..1, on map 1. */
  chance: number;
  /** Added to `chance` for every floor after the first. */
  floorStep: number;
  /**
   * When present, the floor places this row **itself** (no roll) in its first
   * `trainers` room as soon as `mapIndex >= guaranteedFromMap`. The row's
   * `chance` is `0` beside it, so the roll never picks it.
   */
  guaranteedFromMap?: number;
  /** When present, a party member must satisfy it before the row is eligible. */
  requires?: NpcRequirement;
  /** The rows the panel prints, in order; `LEAVE` is the shell's own last row. */
  choices?: readonly NpcChoice[];
}>;

/**
 * Every special NPC. The **merchant** is the floor's one guaranteed row: from map 2
 * on it stands in the floor's first trainer room and opens the Mart, so the shop
 * room could retire and the run still has its counter (`docs/maps-spec.md` §7).
 * Later content tasks add their own rolled rows beside it.
 */
export const NPC_ROWS: readonly NpcRow[] = [
  {
    id: 'merchant',
    nameKey: 'npc.merchant.name',
    greetingKey: 'npc.merchant.greeting',
    spriteKey: 'merchant',
    chance: 0,
    floorStep: 0,
    guaranteedFromMap: 2,
    choices: [{ id: 'mart', label: 'npc.merchant.trade' }],
  },
];

export function getNpcRow(id: string): NpcRow | undefined {
  return NPC_ROWS.find((row) => row.id === id);
}
