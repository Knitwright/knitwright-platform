import { seamClassById, seamsFor, stitchClassById, type GarmentSpec, type Provenance } from "@/lib/garment";
import { textCell, type ClassCell } from "./cell";
import { PROPOSAL_WORDS } from "./text";
import type { ConstructionSection, SeamLine } from "./types";
import { SECTION_TITLES } from "./types";

const PROPOSAL =
  "The seam classes and stitch classes are a starting proposal from general knitwear practice. Ask your factory to confirm them.";
const NO_SEAMS = "This garment type has no seams listed yet.";

type Named = { readonly name: string; readonly iso: string; readonly explanation: string };

/** A class the user chose has their source. One that comes from the registry rule is a proposal. */
const classCell = (named: Named, provenance: Provenance, proposal: boolean): ClassCell => ({
  status: "set",
  value: named.name,
  provenance,
  iso: named.iso,
  explanation: named.explanation,
  proposal,
});

/**
 * The construction section: for each seam of the garment, its seam class and stitch class. They
 * come from the rules in the registry and are marked as worked out from those rules, unless the
 * user changed one, and then the user is the source. Stitch density is only what the user typed.
 */
export function buildConstruction(spec: GarmentSpec): ConstructionSection {
  const seams: readonly SeamLine[] = seamsFor(spec).map((seam) => {
    const entry = spec.construction.find((candidate) => candidate.seamId === seam.id);
    const seamOverride = entry?.seamClass === undefined ? undefined : seamClassById(entry.seamClass);
    const stitchOverride = entry?.stitchClass === undefined ? undefined : stitchClassById(entry.stitchClass);
    const seamClass = seamOverride && entry ? classCell(seamOverride, entry.provenance, false) : classCell(seam.seamClass, "derived", true);
    const stitchClass =
      stitchOverride && entry ? classCell(stitchOverride, entry.provenance, false) : classCell(seam.stitchClass, "derived", true);
    return {
      seamId: seam.id,
      label: seam.label,
      panels: seam.panels,
      seamClass,
      stitchClass,
      stitchDensity: entry ? textCell(entry.stitchDensity, entry.provenance) : textCell("", "user-edited"),
      caveat: seamClass.proposal || stitchClass.proposal ? PROPOSAL_WORDS : null,
    };
  });
  return {
    id: "construction",
    title: SECTION_TITLES.construction,
    note: seams.length === 0 ? NO_SEAMS : PROPOSAL,
    seams,
  };
}
