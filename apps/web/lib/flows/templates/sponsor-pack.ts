import { FLOW_GAP_RULE, type FlowTemplateSpec } from "../types";
import { designStep, EXPORT_NOTE, step, SWAP_NOTE, TEMPLATE_NOTE, tutorialFor } from "./shared";

/**
 * "Sponsor pack" (`07`): a kit with a sponsor -> sponsor thank-you post -> kit close-up on the
 * sponsor area -> A4 poster. **4 assets.**
 *
 * The close-up is a deterministic render framed on the sponsor's own placement, so the logo is the
 * artwork the club placed and not something a model drew near it. A sponsor's mark belongs to the
 * sponsor: this pack ships no logo of its own, and the poster's slot is empty until the club fills
 * it (spec F-G1, and `07`'s rule that no template holds a third party's mark).
 */

const SECTIONS = ["1 PICK YOUR KIT", "2 THANK YOU", "3 PRINT"] as const;

export const SPONSOR_PACK: FlowTemplateSpec = {
  slug: "sponsor-pack",
  title: "Sponsor pack",
  lead: "What a club sends a sponsor: the kit, a thank-you post, a close-up of their placement and an A4 poster.",
  sections: [...SECTIONS],
  assets: 4,
  sort: 6,
  note: TEMPLATE_NOTE,
  ruleId: FLOW_GAP_RULE,
  tutorial: tutorialFor(
    "Sponsor pack",
    "Place the sponsor's artwork on the design first; every board here reads it from the design rather than holding a copy. All four outputs are free.",
  ),
  steps: [
    designStep(SECTIONS[0], "The kit with the sponsor's artwork on it", SWAP_NOTE),
    step({
      key: "kit-render",
      section: SECTIONS[0],
      kind: "mockup",
      name: "Kit with the sponsor placed",
      settings: { scene: "render-front", aspect: "1:1" },
      feeds: ["design"],
      note: "The sponsor's artwork is the one on your design, at the placement the factory file holds.",
    }),
    step({
      key: "thank-you",
      section: SECTIONS[1],
      kind: "marketing",
      name: "Sponsor thank-you post",
      settings: { campaign: "sponsor-thank-you", aspect: "1:1", headline: "Thank you", copy: "" },
      feeds: ["kit-render"],
      note: "The sponsor's own mark goes in the empty slot. Knitwright ships no sponsor artwork.",
    }),
    step({
      key: "close-up",
      section: SECTIONS[1],
      kind: "mockup",
      name: "Close-up on the sponsor area",
      settings: { scene: "render-front", frame: "sponsor-placement", aspect: "1:1" },
      feeds: ["design"],
      note: "Framed on the placement, drawn at the print resolution rather than enlarged from the post.",
    }),
    step({
      key: "poster",
      section: SECTIONS[2],
      kind: "marketing",
      name: "A4 poster",
      settings: { campaign: "sponsor-thank-you", preset: "a4-print", dpi: 300, headline: "Thank you", copy: "" },
      format: "pdf",
      feeds: ["kit-render"],
      note: EXPORT_NOTE,
    }),
  ],
};
