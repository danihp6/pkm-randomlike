import type { Ability } from './abilities';

/** A hand-authored ability row: the dex shape plus its Spanish copy. */
export type CustomAbility = Ability &
  Readonly<{
    nameEs: string;
    descEs: string;
    shortDescEs: string;
  }>;

/** The abilities the generated dex does not carry. One today. */
export const CUSTOM_ABILITIES: readonly CustomAbility[] = [
  {
    id: 'darkmatter',
    name: 'Dark Matter',
    desc: "The holder's moves ignore the type chart: no weaknesses, no resistances, no immunities.",
    shortDesc: "The holder's moves ignore the type chart.",
    nameEs: 'Materia Oscura',
    descEs: 'Los movimientos de quien la posee ignoran la tabla de tipos: sin debilidades, sin resistencias ni inmunidades.',
    shortDescEs: 'Los movimientos de quien la posee ignoran la tabla de tipos.',
  },
];
