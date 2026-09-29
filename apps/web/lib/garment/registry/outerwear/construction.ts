import type { ComponentSlot, SeamDefinition } from "../../definitions";
import { THREAD_AND_LABELS, seam, slot, when } from "../shared";

/**
 * How the seams of outerwear are proposed to be sewn. A STARTING PROPOSAL from general
 * knitwear practice, not a factory's method. Every rule is listed in OWNER-QUESTIONS.md
 * for a factory to confirm, and the user can override any of them.
 */

const BODY = ["body-front", "body-back"];
const SLEEVES = ["sleeve-left", "sleeve-right"];
const SET_IN = [when("sleeve-type", ["set-in"])];
const HOOD = [when("hood", ["single-layer", "lined"])];
const RIB_CUFFS = [when("cuffs", ["rib-cuff"])];
const RIB_HEM = [when("hem-finish", ["rib-band"])];
const FULL_ZIP = [when("front-opening", ["full-zip"])];
const DRAWCORD = [when("hood-drawcord", ["drawcord"])];

export const OUTERWEAR_SEAMS: readonly SeamDefinition[] = [
  seam("shoulder-seam", "Shoulder seam", BODY, "superimposed", "four-thread-overedge", { appliesWhen: SET_IN }),
  seam("raglan-seam", "Raglan seam", [...BODY, ...SLEEVES], "superimposed", "four-thread-overedge", {
    appliesWhen: [when("sleeve-type", ["raglan"])],
  }),
  seam("armhole-seam", "Armhole seam", [...SLEEVES, ...BODY], "superimposed", "four-thread-overedge", { appliesWhen: SET_IN }),
  seam("sleeve-underarm-seam", "Sleeve underarm seam", SLEEVES, "superimposed", "four-thread-overedge"),
  seam("side-seam", "Side seam", BODY, "superimposed", "four-thread-overedge"),
  seam("hood-centre-seam", "Hood centre seam", ["hood"], "superimposed", "four-thread-overedge", { appliesWhen: HOOD }),
  seam("hood-neck-seam", "Hood to neckline seam", ["hood", ...BODY], "superimposed", "four-thread-overedge", { appliesWhen: HOOD }),
  seam("hood-lining-seam", "Hood lining seam", ["hood", "hood-lining"], "superimposed", "four-thread-overedge", {
    appliesWhen: [when("hood", ["lined"])],
  }),
  seam("hood-edge", "Hood opening hem", ["hood"], "edge-finishing", "two-needle-bottom-cover-stitch", {
    appliesWhen: [when("hood", ["single-layer"])],
  }),
  seam("collar-seam", "Collar seam", ["collar", ...BODY], "superimposed", "four-thread-overedge", {
    appliesWhen: [when("collar", ["stand-collar"])],
  }),
  seam("neckband-seam", "Neckband seam", ["neckband", ...BODY], "superimposed", "four-thread-overedge", {
    appliesWhen: [when("collar", ["none"])],
  }),
  seam("front-zip-seam", "Front zip seam", ["body-front"], "lapped", "lockstitch", { appliesWhen: FULL_ZIP }),
  seam("kangaroo-pocket-seam", "Kangaroo pocket seam", ["kangaroo-pocket", "body-front"], "lapped", "two-needle-cover-stitch", {
    appliesWhen: [when("pockets", ["kangaroo"])],
  }),
  seam("side-pocket-seam", "Side pocket seam", BODY, "superimposed", "four-thread-overedge", {
    appliesWhen: [when("pockets", ["side-seam"])],
  }),
  seam("zip-pocket-seam", "Zipped pocket seam", ["body-front"], "lapped", "lockstitch", {
    appliesWhen: [when("pockets", ["zip-side"])],
  }),
  seam("cuff-seam", "Cuff seam", [...SLEEVES, "cuffs"], "superimposed", "four-thread-overedge", { appliesWhen: RIB_CUFFS }),
  seam("sleeve-hem", "Sleeve hem", SLEEVES, "edge-finishing", "two-needle-bottom-cover-stitch", { unlessWhen: RIB_CUFFS }),
  seam("hem-band-seam", "Hem band seam", ["hem-band", ...BODY], "superimposed", "four-thread-overedge", { appliesWhen: RIB_HEM }),
  seam("body-hem", "Body hem", BODY, "edge-finishing", "two-needle-bottom-cover-stitch", { unlessWhen: RIB_HEM }),
];

/** What outerwear implies beyond its fabric. The user describes each one. Nothing here has a quantity. */
export const OUTERWEAR_COMPONENTS: readonly ComponentSlot[] = [
  ...THREAD_AND_LABELS,
  slot("front-zip", "Front zip", "trim", "The zip down the centre front. Give its type, length and colour.", FULL_ZIP, ["body-front"]),
  slot(
    "zip-guard",
    "Zip guard",
    "trim",
    "A small fold of fabric at the top of the zip that covers its end under the chin, if used. Knitwright proposes it from general practice.",
    FULL_ZIP,
    ["body-front"],
    true,
  ),
  slot("hood-drawcord", "Hood drawcord", "trim", "The cord round the hood opening. Give its type, colour and how its ends are finished.", DRAWCORD, ["hood"]),
  slot(
    "drawcord-exits",
    "Drawcord exits",
    "trim",
    "The eyelets or buttonholes the hood drawcord comes out through, if used. Knitwright proposes them from general practice.",
    DRAWCORD,
    ["hood"],
    true,
  ),
  slot("rib-cuffs", "Cuff rib", "rib", "The stretchy ribbed fabric used for the cuffs.", RIB_CUFFS, ["cuffs"]),
  slot("rib-hem-band", "Hem band rib", "rib", "The stretchy ribbed fabric used for the hem band.", RIB_HEM, ["hem-band"]),
  slot("rib-collar", "Collar rib", "rib", "The ribbed or knitted fabric used for the collar, if it is not the main fabric.", [when("collar", ["stand-collar"])], ["collar"]),
  slot("rib-neckband", "Neckband rib", "rib", "The stretchy ribbed fabric that finishes the neck opening.", [when("collar", ["none"])], ["neckband"]),
  slot("pocket-zips", "Pocket zips", "trim", "The zips that close the side pockets. Give their type, length and colour.", [when("pockets", ["zip-side"])], ["body-front"]),
  slot("pocket-bags", "Pocket bags", "trim", "The fabric of the pocket bags, if it is not the main fabric.", [when("pockets", ["side-seam", "zip-side"])], BODY),
];
