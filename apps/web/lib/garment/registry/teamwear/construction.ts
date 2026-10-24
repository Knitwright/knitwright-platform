import type { ComponentSlot, SeamDefinition } from "../../definitions";
import { THREAD_AND_LABELS, seam, slot, when } from "../shared";

/**
 * How the new articles are proposed to be made. A STARTING PROPOSAL from general practice, not
 * a factory's method, listed in OWNER-QUESTIONS.md. Socks are knitted, not cut and sewn, so
 * their seams are labelled as knitted and the programme is shown as not supplied.
 */

const KNITTED = "knitted, factory programme not supplied";
const CONTRAST_BAND = [when("sock-top", ["contrast-band"])];

export const SOCK_SEAMS: readonly SeamDefinition[] = [
  seam("sock-toe-closing", `Toe closing (${KNITTED})`, ["sock-foot"], "superimposed", "three-thread-overedge"),
  seam("sock-leg-foot-join", `Leg and foot join (${KNITTED})`, ["sock-leg", "sock-foot"], "superimposed", "three-thread-overedge"),
  seam("sock-top-finish", `Top edge (${KNITTED})`, ["sock-leg"], "edge-finishing", "two-needle-cover-stitch", { unlessWhen: CONTRAST_BAND }),
  seam("sock-top-band-seam", `Top band join (${KNITTED})`, ["sock-leg", "sock-top-band"], "superimposed", "three-thread-overedge", {
    appliesWhen: CONTRAST_BAND,
  }),
];

export const CAP_SEAMS: readonly SeamDefinition[] = [
  seam("crown-seam", "Crown seam", ["cap-crown"], "superimposed", "lockstitch"),
  seam("peak-seam", "Peak seam", ["cap-crown", "cap-peak"], "superimposed", "lockstitch"),
  seam("cap-band-seam", "Head band seam", ["cap-crown", "cap-band"], "superimposed", "lockstitch"),
];

export const SOCK_COMPONENTS: readonly ComponentSlot[] = [
  ...THREAD_AND_LABELS,
  slot(
    "knit-programme",
    "Knitting programme, not supplied",
    "trim",
    "Socks are knitted to the sock factory's programme, not cut and sewn. No programme has been supplied, so how this sock is knitted is not described here.",
  ),
  slot("sock-yarn", "Sock yarn", "thread", "The yarn the sock is knitted from, if known. Give its type, colour and brand."),
];

export const CAP_COMPONENTS: readonly ComponentSlot[] = [
  ...THREAD_AND_LABELS,
  slot("peak-stiffener", "Peak stiffener", "trim", "The stiff board or plastic inside the peak, if used.", [], ["cap-peak"]),
  slot("cap-sweatband", "Sweatband", "trim", "The band of fabric inside the cap against the forehead, if used.", [], ["cap-band"]),
  slot("cap-closure", "Back closure", "trim", "The strap, buckle or elastic that adjusts the fit at the back.", [when("cap-adjuster", ["back-strap"])]),
];

export const KEEPER_COMPONENTS: readonly ComponentSlot[] = [
  slot(
    "elbow-padding",
    "Elbow padding",
    "trim",
    "The padding built into each sleeve at the elbow. Give its material and thickness.",
    [when("elbow-pads", ["padded-elbows"])],
    ["sleeve-left", "sleeve-right"],
  ),
];
