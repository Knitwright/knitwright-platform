/**
 * THE GARMENT STUDIO'S LIBRARY COLUMN (plan v6 G1, decision 0150; `08` v3.6, `09` screen 27, s02–s07).
 *
 * Three groups down the left of the studio, as Fabra draws them: the Knitwright library, the club's
 * own library and the tools. Each entry opens one panel beside the column (a "shelf"). The column
 * is plain data so the studio holds markup and wiring only, and so a test can hold every entry to
 * a panel that exists.
 *
 * The editor's own three toolbars (Form, Library, Specs) are not shelves: they keep their tablist
 * and their addresses (`?rail=`), so every control the editor had before is where a link to it
 * already points. A shelf is held in the address as `?shelf=`; with none, the open toolbar shows.
 */

export const SHELVES = [
  "fabrics",
  "colours",
  "repeats",
  "graphics",
  "trims",
  "own-fabrics",
  "palettes",
  "own-repeats",
  "brand-kit",
  "uploads",
  "repeat-prints",
  "trim-generator",
] as const;

export type ShelfId = (typeof SHELVES)[number];

/** The Lucide glyph a column entry shows. Named here, drawn by the component. */
export type ShelfIcon = "layers" | "paint" | "grid" | "image" | "tag" | "palette" | "shield" | "upload" | "sparkles";

export interface ShelfEntry {
  readonly id: ShelfId;
  readonly label: string;
  /** The heading of the panel it opens. */
  readonly title: string;
  readonly icon: ShelfIcon;
  /** ♛: a paid plan's tool (`10` §6). The mark is drawn; what the plan gates is the plans modal's business. */
  readonly premium: boolean;
}

export interface ShelfGroup {
  readonly id: "knitwright" | "yours" | "tools";
  readonly label: string;
  readonly entries: readonly ShelfEntry[];
}

const entry = (id: ShelfId, label: string, icon: ShelfIcon, title = label, premium = false): ShelfEntry => ({ id, label, title, icon, premium });

export const SHELF_GROUPS: readonly ShelfGroup[] = [
  {
    id: "knitwright",
    label: "Knitwright library",
    entries: [
      entry("fabrics", "Fabrics", "layers"),
      entry("colours", "Colours", "paint"),
      entry("repeats", "Repeats", "grid"),
      entry("graphics", "Graphics", "image"),
      entry("trims", "Trims", "tag"),
    ],
  },
  {
    id: "yours",
    // The club's own name replaces this heading when the studio knows it.
    label: "Your library",
    entries: [
      entry("own-fabrics", "Fabrics", "layers", "Your fabrics"),
      entry("palettes", "Palettes", "palette", "Your palettes"),
      entry("own-repeats", "Repeats", "grid", "Your repeats"),
      entry("brand-kit", "Brand kit", "shield"),
      entry("uploads", "Uploads", "upload"),
    ],
  },
  {
    id: "tools",
    label: "Tools",
    entries: [entry("repeat-prints", "Repeat prints", "grid", "Repeat prints", true), entry("trim-generator", "Trim generator", "sparkles")],
  },
];

const BY_ID: ReadonlyMap<ShelfId, ShelfEntry> = new Map(SHELF_GROUPS.flatMap((group) => group.entries.map((one) => [one.id, one] as const)));

export const isShelf = (value: string): value is ShelfId => BY_ID.has(value as ShelfId);

/** The entry of a shelf. Every id in SHELVES has one; a test holds that. */
export const shelfEntry = (id: ShelfId): ShelfEntry => BY_ID.get(id) as ShelfEntry;

/** The shelf the address names, or null: the open toolbar shows instead. A name given twice counts once. */
export function parseShelf(value: string | readonly string[] | null | undefined): ShelfId | null {
  const first = typeof value === "string" ? value : value?.[0];
  return first && isShelf(first) ? first : null;
}

/** The address with the shelf set, or taken off for null, keeping every other parameter. */
export function withShelf(search: string, shelf: ShelfId | null): string {
  const params = new URLSearchParams(search);
  if (shelf === null) params.delete("shelf");
  else params.set("shelf", shelf);
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}
