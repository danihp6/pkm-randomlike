/**
 * The map passives (`docs/routes-spec.md` §2): the **out-of-battle** abilities a
 * route rewards, read by `src/engine/run/passives.ts`. Pure data; the rule and its
 * stream live in the engine.
 */

/** When a row pays: a room entry, or a battle won in the room. */
export type MapPassiveTrigger = 'room' | 'win';

/** What a row pays: one chance roll, then one item from its own list. */
export type MapPassiveEffect = Readonly<{
  /** Chance the row pays, in `(0, 1]`; rolled first on the row's own stream. */
  chance: number;
  /** Run-catalogue ids (`src/data/items.ts`), drawn uniformly; never empty. */
  itemIds: readonly string[];
}>;

export type MapPassive = Readonly<{
  /** The **dex** ability id (`getAbility`), never the display name. */
  ability: string;
  trigger: MapPassiveTrigger;
  effect: MapPassiveEffect;
}>;

/** Every row, in the order the rule walks them (and the notices are raised). */
export const MAP_PASSIVES: readonly MapPassive[] = [
  {
    ability: 'pickup',
    trigger: 'room',
    effect: { chance: 0.5, itemIds: ['pokeball', 'potion', 'antidote', 'stardust'] },
  },
  {
    ability: 'honeygather',
    trigger: 'win',
    effect: { chance: 0.5, itemIds: ['sitrusberry', 'leppaberry', 'persimberry'] },
  },
];

/** The rows a trigger walks, in `MAP_PASSIVES` order. */
export function mapPassivesFor(trigger: MapPassiveTrigger): readonly MapPassive[] {
  return MAP_PASSIVES.filter((row) => row.trigger === trigger);
}
