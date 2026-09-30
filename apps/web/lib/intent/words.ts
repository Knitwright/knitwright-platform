/**
 * The shape of one family's words: phrases that name each garment type, and each choice of
 * each option. Phrases are lower case with spaces. The same phrase may name a choice in two
 * families ("ribbed cuffs" on a top and on joggers); the matcher then finds both.
 */

export type Table = Readonly<Record<string, readonly string[]>>;

export interface FamilyWords {
  /** Garment type id to the phrases that name it. */
  readonly types: Table;
  /** Option id, then choice id, to the phrases that name that choice. */
  readonly choices: Readonly<Record<string, Table>>;
}
