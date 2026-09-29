import type { ComponentSlot, Condition, SeamDefinition } from "../../definitions";

/**
 * How the seams of a top are proposed to be sewn. This is a STARTING PROPOSAL from general
 * knitwear practice, not a factory's method. Each rule names a seam class and a stitch
 * class, which are names of kinds and not quantities. Every rule is listed in
 * OWNER-QUESTIONS.md for a factory to confirm. The user can override any of them in a design.
 */

const when = (option: string, choices: readonly string[]): Condition => ({ option, in: choices });

const SET_IN = [when("sleeve-type", ["set-in"])];
const NO_SIDE_PANELS = [when("side-panels", ["none"])];
const RIB_CUFFS = [when("cuffs", ["rib-cuff"])];
const SLEEVES = ["sleeve-left", "sleeve-right"];
const BODY = ["body-front", "body-back"];

/** A seam that applies always unless a condition is given. */
const seam = (
  id: string,
  label: string,
  panels: readonly string[],
  seamClass: string,
  stitchClass: string,
  extra: Partial<Pick<SeamDefinition, "appliesWhen" | "unlessWhen">> = {},
): SeamDefinition => ({
  id,
  label,
  panels,
  seamClass,
  stitchClass,
  appliesWhen: extra.appliesWhen ?? [],
  unlessWhen: extra.unlessWhen ?? [],
});

export const TOPS_SEAMS: readonly SeamDefinition[] = [
  seam("shoulder-seam", "Shoulder seam", BODY, "superimposed", "four-thread-overedge", { appliesWhen: SET_IN }),
  seam("raglan-seam", "Raglan seam", [...BODY, ...SLEEVES], "superimposed", "four-thread-overedge", {
    appliesWhen: [when("sleeve-type", ["raglan"])],
  }),
  seam("armhole-seam", "Armhole seam", [...SLEEVES, ...BODY], "superimposed", "four-thread-overedge", {
    appliesWhen: SET_IN,
  }),
  seam("sleeve-underarm-seam", "Sleeve underarm seam", SLEEVES, "superimposed", "four-thread-overedge"),
  seam("side-seam", "Side seam", BODY, "superimposed", "four-thread-overedge", { appliesWhen: NO_SIDE_PANELS }),
  seam("side-panel-seam", "Side panel seam", [...BODY, "side-panels"], "superimposed", "four-thread-overedge", {
    appliesWhen: [when("side-panels", ["contrast-insert"])],
  }),
  seam("sleeve-hem", "Sleeve hem", SLEEVES, "edge-finishing", "two-needle-cover-stitch", { unlessWhen: RIB_CUFFS }),
  seam("cuff-seam", "Cuff seam", [...SLEEVES, "cuffs"], "superimposed", "four-thread-overedge", {
    appliesWhen: RIB_CUFFS,
  }),
  seam("body-hem", "Body hem", BODY, "edge-finishing", "two-needle-cover-stitch"),
  seam("side-vent-seam", "Side vent finish", BODY, "edge-finishing", "lockstitch", {
    appliesWhen: [when("hem-shape", ["side-vent"])],
  }),
  seam("neckband-seam", "Neckband seam", ["neckband", ...BODY], "superimposed", "four-thread-overedge", {
    appliesWhen: [when("collar", ["none"])],
  }),
  seam("collar-seam", "Collar seam", ["collar", ...BODY], "superimposed", "four-thread-overedge", {
    appliesWhen: [when("collar", ["polo-collar", "band-collar"])],
  }),
  seam("placket-seam", "Placket seam", ["placket", "body-front"], "lapped", "lockstitch", {
    appliesWhen: [when("placket", ["buttons", "zip"])],
  }),
  seam("zip-seam", "Zip seam", ["placket"], "lapped", "lockstitch", { appliesWhen: [when("placket", ["zip"])] }),
];

const slot = (
  id: string,
  label: string,
  kind: ComponentSlot["kind"],
  help: string,
  appliesWhen: readonly Condition[] = [],
  panels: readonly string[] = [],
): ComponentSlot => ({ id, label, kind, help, appliesWhen, panels });

/** What a top implies beyond its fabric. The user describes each one. Nothing here has a quantity. */
export const TOPS_COMPONENTS: readonly ComponentSlot[] = [
  slot("main-thread", "Main thread", "thread", "The thread used to sew the garment. Give its type, colour and brand if you know them."),
  slot("brand-label", "Brand label", "label", "The label that carries your brand name, usually sewn in at the back of the neck."),
  slot("care-label", "Care label", "label", "The label that tells the wearer how to wash the garment."),
  slot("size-label", "Size label", "label", "The label that shows the size."),
  slot("rib-neckband", "Neckband rib", "rib", "The stretchy ribbed fabric that finishes the neck opening.", [when("collar", ["none"])], ["neckband"]),
  slot("rib-cuffs", "Cuff rib", "rib", "The stretchy ribbed fabric used for the cuffs.", RIB_CUFFS, ["cuffs"]),
  slot("rib-collar", "Collar rib", "rib", "The ribbed or knitted fabric used for the collar, if it is not the main fabric.", [when("collar", ["polo-collar", "band-collar"])], ["collar"]),
  slot("buttons", "Buttons", "trim", "The buttons that fasten the placket. Give their size, material and how many.", [when("placket", ["buttons"])], ["placket"]),
  slot("zip", "Zip", "trim", "The zip that fastens the placket. Give its type, length and colour.", [when("placket", ["zip"])], ["placket"]),
];
