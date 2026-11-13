/**
 * What the editor's Products flyout shows (`08` §5.4; decision 0146): the brand's designs and the
 * catalogue's base articles, read on the server when the canvas opens. Either list is null when it
 * could not be read, so the flyout says so instead of showing an empty shelf.
 */

export interface ShelfDesign {
  readonly id: string;
  readonly name: string;
}

export interface ShelfBase {
  readonly code: string;
  readonly name: string;
  readonly sportTags: readonly string[];
}

export interface ProductsShelf {
  readonly designs: readonly ShelfDesign[] | null;
  readonly bases: readonly ShelfBase[] | null;
}

export const EMPTY_SHELF: ProductsShelf = { designs: [], bases: [] };

/** The sport chips: every sport a base is tagged with, in the catalogue's order, at most five. */
export function sportChips(bases: readonly ShelfBase[], most = 5): readonly string[] {
  const seen: string[] = [];
  for (const base of bases) for (const tag of base.sportTags) if (!seen.includes(tag)) seen.push(tag);
  return seen.slice(0, most);
}

const fold = (text: string): string => text.trim().toLowerCase();

/** The most designs the shelf lists; "Show all" goes to My products for the rest. */
export const SHELF_DESIGNS = 24;

/**
 * Both shelves, each read on its own: a read that fails leaves that shelf unread (null) and the
 * other still shown, and never takes the canvas down with it.
 */
export async function loadShelf(designs: () => Promise<readonly ShelfDesign[]>, bases: () => Promise<readonly ShelfBase[]>): Promise<ProductsShelf> {
  const [mine, catalogue] = await Promise.all([
    designs().then(
      (rows) => rows.map(({ id, name }) => ({ id, name })),
      () => null,
    ),
    bases().then(
      (rows) => rows.map(({ code, name, sportTags }) => ({ code, name, sportTags })),
      () => null,
    ),
  ]);
  return { designs: mine, bases: catalogue };
}

/** The shelf narrowed by the search words (name or code) and, for the bases, a sport. */
export function shelfMatches(shelf: ProductsShelf, query: string, sport: string | null): ProductsShelf {
  const words = fold(query);
  const named = (...fields: readonly string[]) => words === "" || fields.some((field) => fold(field).includes(words));
  return {
    designs: shelf.designs === null ? null : shelf.designs.filter((design) => named(design.name)),
    bases: shelf.bases === null ? null : shelf.bases.filter((base) => named(base.name, base.code) && (sport === null || base.sportTags.includes(sport))),
  };
}
