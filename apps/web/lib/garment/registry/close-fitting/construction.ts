import type { ComponentSlot, Condition, SeamDefinition } from "../../definitions";
import { THREAD_AND_LABELS, seam, slot, when } from "../shared";

/**
 * How the seams of close-fitting garments are proposed to be sewn. A STARTING PROPOSAL from
 * general knitwear practice, not a factory's method. Every rule is listed in
 * OWNER-QUESTIONS.md for a factory to confirm, and the user can override any of them.
 *
 * Each joining seam comes in two forms, one for each choice of seams: overlocked (seam class
 * superimposed, four thread overedge) or flat (seam class flat, flatlock). Only one applies.
 */

const BODY = ["body-front", "body-back"];
const SLEEVES = ["sleeve-left", "sleeve-right"];
const SLEEVED = [when("sleeves", ["short", "long"])];
const UNDERBAND = [when("underband", ["exposed-elastic", "covered-elastic"])];

/** One joining seam in both forms. The flat form's id ends in "-flat". */
function joining(id: string, label: string, panels: readonly string[], appliesWhen: readonly Condition[] = []): SeamDefinition[] {
  return [
    seam(id, label, panels, "superimposed", "four-thread-overedge", { appliesWhen: [...appliesWhen, when("seam-type", ["overlock"])] }),
    seam(`${id}-flat`, label, panels, "flat", "flatlock", { appliesWhen: [...appliesWhen, when("seam-type", ["flatlock"])] }),
  ];
}

export const CLOSE_FITTING_SEAMS: readonly SeamDefinition[] = [
  ...joining("shoulder-seam", "Shoulder seam", BODY),
  ...joining("side-seam", "Side seam", BODY),
  ...joining("armhole-seam", "Armhole seam", [...SLEEVES, ...BODY], SLEEVED),
  ...joining("sleeve-underarm-seam", "Sleeve underarm seam", SLEEVES, SLEEVED),
  ...joining("underband-seam", "Underband seam", ["underband", ...BODY], UNDERBAND),
  // Added in step 24: covered elastic is enclosed in a band of fabric, closed by its own line of stitching.
  seam("underband-casing", "Underband casing", ["underband"], "edge-finishing", "two-needle-cover-stitch", {
    appliesWhen: [when("underband", ["covered-elastic"])],
  }),
  seam("sleeve-hem", "Sleeve hem", SLEEVES, "edge-finishing", "two-needle-bottom-cover-stitch", { appliesWhen: SLEEVED }),
  seam("body-hem", "Body hem", BODY, "edge-finishing", "two-needle-bottom-cover-stitch", { unlessWhen: UNDERBAND }),
  seam("edge-binding", "Edge binding", ["binding", ...BODY], "bound", "two-needle-cover-stitch", {
    appliesWhen: [when("edge-finish", ["bound"])],
  }),
  seam("turned-edges", "Turned edges", BODY, "edge-finishing", "two-needle-bottom-cover-stitch", {
    appliesWhen: [when("edge-finish", ["turned"])],
  }),
  seam("elastic-edges", "Elastic edges", BODY, "edge-finishing", "two-needle-cover-stitch", {
    appliesWhen: [when("edge-finish", ["elastic"])],
  }),
];

/** What close-fitting garments imply beyond their fabric. The user describes each one. Nothing here has a quantity. */
export const CLOSE_FITTING_COMPONENTS: readonly ComponentSlot[] = [
  ...THREAD_AND_LABELS,
  slot(
    "binding",
    "Binding",
    "rib",
    "The strip of fabric that binds the neck and armhole edges, if it is not the main fabric.",
    [when("edge-finish", ["bound"])],
    ["binding"],
  ),
  slot("edge-elastic", "Edge elastic", "trim", "The elastic sewn into the neck and armhole edges. Give its type and width.", [when("edge-finish", ["elastic"])], BODY),
  slot("underband-elastic", "Underband elastic", "trim", "The elastic in the underband. Give its type, width and any logo woven into it.", UNDERBAND, ["underband"]),
  slot(
    "cup-pads",
    "Cup pads",
    "trim",
    "Removable pads in the front, and the openings they slip into, if used. Knitwright proposes them from general practice.",
    UNDERBAND,
    ["body-front"],
    true,
  ),
  slot(
    "printed-label",
    "Printed label",
    "label",
    "Care and size details printed on the inside instead of a sewn label, so nothing rubs the skin, if used. Knitwright proposes it from general practice.",
    [when("seam-type", ["flatlock"])],
    ["body-back"],
    true,
  ),
];
