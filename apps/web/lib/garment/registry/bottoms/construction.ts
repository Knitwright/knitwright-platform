import type { ComponentSlot, SeamDefinition } from "../../definitions";
import { THREAD_AND_LABELS, seam, slot, when } from "../shared";

/**
 * How the seams of bottoms are proposed to be sewn. Like the tops rules, this is a STARTING
 * PROPOSAL from general knitwear practice, not a factory's method. Every rule is listed in
 * OWNER-QUESTIONS.md for a factory to confirm, and the user can override any of them.
 */

const LEGS = ["legs-front", "legs-back"];
const STRIPE = [when("side-stripe", ["contrast-stripe"])];
const DRAWCORD = [when("waistband", ["elastic-drawcord"])];

export const BOTTOMS_SEAMS: readonly SeamDefinition[] = [
  seam("front-rise-seam", "Front rise seam", ["legs-front"], "superimposed", "four-thread-overedge"),
  seam("back-rise-seam", "Back rise seam", ["legs-back"], "superimposed", "four-thread-overedge"),
  seam("inside-leg-seam", "Inside leg seam", LEGS, "superimposed", "four-thread-overedge"),
  seam("outside-leg-seam", "Outside leg seam", LEGS, "superimposed", "four-thread-overedge", { unlessWhen: STRIPE }),
  seam("side-stripe-seam", "Side stripe seam", [...LEGS, "side-stripes"], "superimposed", "four-thread-overedge", {
    appliesWhen: STRIPE,
  }),
  seam("gusset-seam", "Gusset seam", ["gusset", ...LEGS], "superimposed", "four-thread-overedge", {
    appliesWhen: [when("gusset", ["crotch-gusset"])],
  }),
  seam("waistband-seam", "Waistband seam", ["waistband", ...LEGS], "superimposed", "four-thread-overedge"),
  seam("waistband-casing", "Waistband casing", ["waistband"], "edge-finishing", "two-needle-bottom-cover-stitch", {
    appliesWhen: [when("waistband", ["elastic-drawcord", "elastic"])],
  }),
  seam("leg-hem", "Leg hem", LEGS, "edge-finishing", "two-needle-bottom-cover-stitch", {
    appliesWhen: [when("leg-finish", ["hem", "ankle-zip"])],
  }),
  seam("cuff-seam", "Cuff seam", [...LEGS, "cuffs"], "superimposed", "four-thread-overedge", {
    appliesWhen: [when("leg-finish", ["rib-cuff"])],
  }),
  seam("ankle-zip-seam", "Ankle zip seam", LEGS, "lapped", "lockstitch", { appliesWhen: [when("leg-finish", ["ankle-zip"])] }),
  seam("side-pocket-seam", "Side pocket seam", LEGS, "superimposed", "four-thread-overedge", {
    appliesWhen: [when("pockets", ["side-seam"])],
  }),
  seam("zip-pocket-seam", "Zipped pocket seam", ["legs-front"], "lapped", "lockstitch", {
    appliesWhen: [when("pockets", ["zip-side"])],
  }),
];

/** What bottoms imply beyond their fabric. The user describes each one. Nothing here has a quantity. */
export const BOTTOMS_COMPONENTS: readonly ComponentSlot[] = [
  ...THREAD_AND_LABELS,
  slot(
    "waistband-elastic",
    "Waistband elastic",
    "trim",
    "The elastic inside the waistband. Give its type and width.",
    [when("waistband", ["elastic-drawcord", "elastic"])],
    ["waistband"],
  ),
  slot("drawcord", "Drawcord", "trim", "The cord that pulls the waist tighter. Give its type, colour and how its ends are finished.", DRAWCORD, ["waistband"]),
  slot(
    "drawcord-exits",
    "Drawcord exits",
    "trim",
    "The eyelets or buttonholes the drawcord comes out through, if used. Knitwright proposes them from general practice.",
    DRAWCORD,
    ["waistband"],
    true,
  ),
  slot("rib-cuffs", "Cuff rib", "rib", "The stretchy ribbed fabric used for the cuffs.", [when("leg-finish", ["rib-cuff"])], ["cuffs"]),
  slot("ankle-zips", "Ankle zips", "trim", "The zips at the bottom of the legs. Give their type, length and colour.", [when("leg-finish", ["ankle-zip"])], LEGS),
  slot("pocket-zips", "Pocket zips", "trim", "The zips that close the side pockets. Give their type, length and colour.", [when("pockets", ["zip-side"])], ["legs-front"]),
  slot(
    "pocket-bags",
    "Pocket bags",
    "trim",
    "The fabric of the pocket bags, if it is not the main fabric.",
    [when("pockets", ["side-seam", "zip-side"])],
    LEGS,
  ),
];
