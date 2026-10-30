import type { EditorDesign } from "@/lib/editor/slots";
import { KIT_PATTERN_LABELS, type KitPatternStyle } from "@/lib/garment";
import { GENERATORS, presetsFor } from "@/lib/pattern-generators";
import { GAP_RULE_ID } from "@/lib/rulebook/constants";
import { NO_GRAPHICS, NO_OWN_LIBRARY, NO_TCX_LICENCE } from "./library-ports";
import { PALETTE_LABEL, PALETTE_RULE_ID, SPORTSWEAR_PALETTES } from "./palettes";

/**
 * The Library toolbar of spec F-S4 (plan v5 Y3, decision 0076), as plain data: the Knitwright
 * library (Fabrics with their spec cards, Colours, Pattern fills, Graphics), Your library (Brand
 * kit, Palettes, Pattern fills, Uploads) and Inspiration, which is a labelled slot for wave 3.
 *
 * Nothing in here is a literal list of fabrics or styles. The fabrics are the base article's own
 * allowed fabrics (X1, decision 0066), the pattern fills are the pattern generators the platform
 * can actually draw (`lib/pattern-generators`), and the colours are the design's own colourway plus
 * the seeded sportswear palettes. A section whose data is not on the slot contract says so in its
 * own words instead of showing an invented list.
 */

export type LibraryItemKind = "fabric" | "colour" | "pattern-fill" | "graphic";

/** One line of a spec card: what it is and what the data says. */
export interface CardLine {
  readonly label: string;
  readonly value: string;
}

/** What the shell is asked to do when an item is applied. `none` is an item that cannot be applied yet. */
export type LibraryApply =
  | { readonly kind: "fabric"; readonly code: string; readonly name: string; readonly composition: string; readonly weightGsm: number | null }
  | { readonly kind: "colour"; readonly colour: string; readonly swatch: string }
  | { readonly kind: "option"; readonly group: string; readonly code: string }
  | { readonly kind: "kit-pattern"; readonly style: KitPatternStyle; readonly params: Readonly<Record<string, number | boolean>> }
  | { readonly kind: "none"; readonly reason: string };

export interface LibraryItem {
  readonly id: string;
  readonly kind: LibraryItemKind;
  readonly label: string;
  /** The catalogue code, where the item has one (`F-POLY-INT`, `P01`). */
  readonly code: string | null;
  /** `#rrggbb` for a colour, else null. */
  readonly swatch: string | null;
  readonly card: readonly CardLine[];
  readonly ruleId: string;
  readonly apply: LibraryApply;
}

export interface LibrarySection {
  readonly id: string;
  readonly title: string;
  readonly items: readonly LibraryItem[];
  /** What to say where the items would be. Null when the section has items. */
  readonly empty: string | null;
  /** A labelled note shown under the title, or null. */
  readonly note: string | null;
}

export interface LibraryGroup {
  readonly id: "knitwright" | "yours" | "inspiration";
  readonly title: string;
  readonly sections: readonly LibrarySection[];
}

const NO_ARTICLE_FABRICS = "This design is not on a base article yet, so there is no approved fabric list to choose from.";
const INSPIRATION_SLOT = "The inspiration board (F-S1) is built in wave 3. This is the labelled slot it opens into.";

const line = (label: string, value: string | number | null, unit = ""): readonly CardLine[] =>
  value === null || value === "" ? [] : [{ label, value: `${value}${unit}` }];

/** The article's allowed fabrics, each with the spec card X1 holds for it. */
function fabricSection(design: EditorDesign): LibrarySection {
  const fabrics = design.article?.fabrics ?? [];
  const items = fabrics.map((fabric): LibraryItem => ({
    id: `fabric-${fabric.code}`,
    kind: "fabric",
    label: fabric.description ?? fabric.code,
    code: fabric.code,
    swatch: null,
    card: [
      ...line("Role", fabric.role),
      ...line("Weight", fabric.gsm),
      ...line("Width", fabric.widthCm, " cm"),
      ...line("Press shrink, length", fabric.pressShrinkLengthPct, "%"),
      ...line("Press shrink, width", fabric.pressShrinkWidthPct, "%"),
      ...line("Source", fabric.sourceNote),
    ],
    ruleId: GAP_RULE_ID,
    apply: {
      kind: "fabric",
      code: fabric.code,
      name: fabric.description ?? fabric.code,
      composition: fabric.description ?? "",
      weightGsm: null,
    },
  }));
  return {
    id: "kw-fabrics",
    title: "Fabrics",
    items,
    empty: items.length === 0 ? (design.article === null ? NO_ARTICLE_FABRICS : `${design.article.code} has no fabric list on file yet. ${design.article.dataLabel}.`) : null,
    note: design.article === null ? null : design.article.dataLabel,
  };
}

/** The sportswear palettes and the design's own colourway. A swatch is a screen colour, never a colour reference. */
function colourSection(design: EditorDesign): LibrarySection {
  const own = design.spec.colourways
    .find((way) => way.id === design.colourwayId)
    ?.colours.flatMap((entry) => (entry.swatch === undefined ? [] : [{ id: `own-${entry.panelId}`, label: entry.colour === "" ? entry.panelId : entry.colour, swatch: entry.swatch }])) ?? [];
  const palettes = SPORTSWEAR_PALETTES.flatMap((palette) => palette.colours.map((entry) => ({ ...entry, label: `${palette.label} · ${entry.label}` })));
  const items = [...own, ...palettes].map((entry): LibraryItem => ({
    id: `colour-${entry.id}`,
    kind: "colour",
    label: entry.label,
    code: null,
    swatch: entry.swatch,
    card: [{ label: "Screen colour", value: entry.swatch }],
    ruleId: PALETTE_RULE_ID,
    apply: { kind: "colour", colour: "", swatch: entry.swatch },
  }));
  return { id: "kw-colours", title: "Colours", items, empty: null, note: `${PALETTE_LABEL} ${NO_TCX_LICENCE}` };
}

/**
 * The pattern fills: the base article's own approved pattern-fill options first, because the factory
 * has approved those, then every style the platform can draw.
 */
function patternSection(design: EditorDesign): LibrarySection {
  const approved = (design.article?.options ?? [])
    .filter((option) => option.group === "pattern_fill")
    .map((option): LibraryItem => ({
      id: `fill-option-${option.code}`,
      kind: "pattern-fill",
      label: option.label,
      code: option.code,
      swatch: null,
      card: [{ label: "Approved by", value: option.approvedBySampleId === null ? "Not yet sampled" : option.approvedBySampleId }],
      ruleId: option.ruleId,
      apply: { kind: "option", group: option.group, code: option.code },
    }));
  const styles = GENERATORS.flatMap((generator) =>
    presetsFor(generator.id).map((preset): LibraryItem => ({
      id: `fill-${preset.id}`,
      kind: "pattern-fill",
      label: `${generator.label} · ${preset.label}`,
      code: null,
      swatch: null,
      card: [
        { label: "Repeat", value: generator.repeat.kind === "tile" ? `${generator.repeat.tileMm.width} × ${generator.repeat.tileMm.height} mm tile` : "Drawn to the panel, no tile" },
        { label: "Colours", value: `Up to ${generator.maxColours}` },
      ],
      ruleId: GAP_RULE_ID,
      apply: applyForStyle(generator.id, preset.params),
    })),
  );
  return { id: "kw-pattern-fills", title: "Pattern fills", items: [...approved, ...styles], empty: null, note: null };
}

const KIT_PREFIX = "kit-";

/** A style the stored design can hold is applied as a kit pattern; one it cannot says so. */
function applyForStyle(generatorId: string, params: Readonly<Record<string, number | boolean>>): LibraryApply {
  const style = generatorId.startsWith(KIT_PREFIX) ? (generatorId.slice(KIT_PREFIX.length) as KitPatternStyle) : null;
  if (style !== null && style in KIT_PATTERN_LABELS) return { kind: "kit-pattern", style, params };
  return {
    kind: "none",
    reason: "A design can only store the eight kit styles today, so this one cannot be saved yet. The repeat maker (Y8) publishes a tile instead.",
  };
}

/** The whole toolbar: three groups, in the order the spec draws them. */
export function libraryGroups(design: EditorDesign): readonly LibraryGroup[] {
  return [
    {
      id: "knitwright",
      title: "Knitwright library",
      sections: [
        fabricSection(design),
        colourSection(design),
        patternSection(design),
        { id: "kw-graphics", title: "Graphics", items: [], empty: NO_GRAPHICS, note: null },
      ],
    },
    {
      id: "yours",
      title: "Your library",
      sections: (["Brand kit", "Palettes", "Pattern fills", "Uploads"] as const).map((title) => ({
        id: `yours-${title.toLowerCase().replaceAll(" ", "-")}`,
        title,
        items: [],
        empty: NO_OWN_LIBRARY,
        note: null,
      })),
    },
    {
      id: "inspiration",
      title: "Inspiration",
      sections: [{ id: "inspiration-board", title: "Inspiration board", items: [], empty: INSPIRATION_SLOT, note: null }],
    },
  ];
}
