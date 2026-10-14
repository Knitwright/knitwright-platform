import { listOf } from "./text";
import type { SectionId } from "./types";

/**
 * Where a cell of the document is, and what to call it, worked out from its path. It is how the
 * suggested values page names each cell it finds. A path this file does not know is named by the
 * path itself, so a new kind of cell is listed with an ugly name rather than left off.
 */
export interface CellPlace {
  readonly sectionId: SectionId;
  /** What the value belongs to, such as "Chest width". */
  readonly subject: string;
  /** The part of it that this cell is, such as "tolerance". Empty when the subject says it all. */
  readonly field: string;
  /** For a length in the table, the size it is for. */
  readonly size: string | null;
}

const SECTION_OF_ROOT: Readonly<Record<string, SectionId>> = {
  cover: "cover",
  readiness: "readiness",
  patternAndCutting: "pattern-and-cutting",
  fabric: "fabric",
  artworkAndColour: "artwork-and-colour",
  operations: "operations",
  flats: "flats",
  measurements: "measurements",
  howToMeasure: "how-to-measure",
  components: "components",
  construction: "construction",
  colourways: "colourways",
  artwork: "artwork",
  labelling: "labelling",
  suggested: "suggested",
  signOff: "sign-off",
};

const COVER_NAMES: Readonly<Record<string, string>> = {
  styleNumber: "Style number",
  season: "Season",
  brand: "Brand",
  designName: "Design name",
  garmentType: "Garment type",
  wearer: "Made for",
  baseSize: "Base size",
  sizeRun: "Size run",
};

const ARTWORK_FIELDS: Readonly<Record<string, string>> = {
  panel: "part",
  anchor: "place",
  rotation: "turn",
  technique: "how it is made",
  "content.text": "shows",
  "content.description": "shows",
};

const PLAYER_MARK_FIELDS: Readonly<Record<string, string>> = {
  place: "",
  panel: "part",
  anchor: "place",
  shows: "shows",
  height: "height",
  style: "lettering style",
  colour: "colour",
  screenColour: "screen colour",
  technique: "how it is made",
};

const SEAM_FIELDS: Readonly<Record<string, string>> = {
  seamClass: "seam class",
  stitchClass: "stitch class",
  stitchDensity: "stitch density",
};

/** Follows a path such as `a.b[2].c` down from the root. */
export function valueAt(root: unknown, path: string): unknown {
  const steps = path.match(/[^.[\]]+/g) ?? [];
  return steps.reduce<unknown>(
    (here, step) => (typeof here === "object" && here !== null ? (here as Record<string, unknown>)[step] : undefined),
    root,
  );
}

const text = (root: unknown, path: string): string => {
  const found = valueAt(root, path);
  return typeof found === "string" ? found : "";
};

const at = (sectionId: SectionId, subject: string, field = "", size: string | null = null): CellPlace => ({
  sectionId,
  subject,
  field,
  size,
});

function panelsText(root: unknown, path: string): string {
  const panels = (valueAt(root, path) as { label: string }[] | undefined) ?? [];
  return listOf(panels.map((panel) => panel.label));
}

type Rule = readonly [RegExp, (root: unknown, match: RegExpMatchArray) => CellPlace];

const RULES: readonly Rule[] = [
  [/^cover\.options\[(\d+)\]\.choice$/, (root, m) => at("cover", text(root, `cover.options[${m[1]}].label`), "choice")],
  [/^cover\.(\w+)$/, (_root, m) => at("cover", COVER_NAMES[m[1] ?? ""] ?? `cover.${m[1]}`)],
  [
    /^measurements\.groups\[(\d+)\]\.rows\[(\d+)\]\.tolerance$/,
    (root, m) => at("measurements", text(root, `measurements.groups[${m[1]}].rows[${m[2]}].label`), "tolerance"),
  ],
  [
    /^measurements\.groups\[(\d+)\]\.rows\[(\d+)\]\.values\[(\d+)\]$/,
    (root, m) =>
      at(
        "measurements",
        text(root, `measurements.groups[${m[1]}].rows[${m[2]}].label`),
        "value",
        (valueAt(root, `measurements.columns[${m[3]}].size`) as string | null | undefined) ?? null,
      ),
  ],
  [
    /^components\.fabrics\[(\d+)\]\.(\w+)$/,
    (root, m) => at("components", `Fabric for ${panelsText(root, `components.fabrics[${m[1]}].panels`)}`, m[2] === "consumption" ? "consumption" : (m[2] ?? "")),
  ],
  [
    /^components\.others\[(\d+)\]\.(\w+)$/,
    (root, m) => at("components", text(root, `components.others[${m[1]}].label`), m[2] === "proposalNote" ? "" : (m[2] ?? "")),
  ],
  [
    /^construction\.seams\[(\d+)\]\.(\w+)$/,
    (root, m) => at("construction", text(root, `construction.seams[${m[1]}].label`), SEAM_FIELDS[m[2] ?? ""] ?? m[2] ?? ""),
  ],
  [
    /^colourways\.colourways\[(\d+)\]\.rows\[(\d+)\]\.(code|screenColour)$/,
    (root, m) =>
      at(
        "colourways",
        `${text(root, `colourways.colourways[${m[1]}].name`)}: ${text(root, `colourways.colourways[${m[1]}].rows[${m[2]}].label`)}`,
        m[3] === "code" ? "colour code" : "screen colour",
      ),
  ],
  [
    /^artwork\.items\[(\d+)\]\.(.+)$/,
    (root, m) => at("artwork", text(root, `artwork.items[${m[1]}].name.value`), ARTWORK_FIELDS[m[2] ?? ""] ?? m[2] ?? ""),
  ],
  [
    /^artwork\.playerMarks\[(\d+)\]\.(\w+)$/,
    (root, m) => at("artwork", text(root, `artwork.playerMarks[${m[1]}].place.value`), PLAYER_MARK_FIELDS[m[2] ?? ""] ?? m[2] ?? ""),
  ],
  [/^fabric\.rows\[(\d+)\]\.measure$/, (root, m) => at("fabric", text(root, `fabric.rows[${m[1]}].label`))],
  [/^labelling\.rows\[(\d+)\]\.value$/, (root, m) => at("labelling", text(root, `labelling.rows[${m[1]}].label`))],
];

export function describeCell(root: unknown, path: string): CellPlace {
  for (const [pattern, place] of RULES) {
    const match = path.match(pattern);
    if (match) return place(root, match);
  }
  const first = path.split(/[.[]/)[0] ?? "";
  return at(SECTION_OF_ROOT[first] ?? "cover", path);
}
