import { FLOW_GAP_RULE, type FlowStepSpec, type FlowTemplateSpec } from "../types";
import { designStep, EXPORT_NOTE, step, SWAP_NOTE, TEMPLATE_NOTE, tutorialFor } from "./shared";

/**
 * "Colourway set" (`07`): design -> 3 colourway variants -> render each -> comparison post.
 * **7 assets.**
 *
 * The three colourways are the ones a club kit has: home, away and goalkeeper, which is also the
 * switcher F-L1 puts on a mockup board. Seven assets less one comparison post leaves six, so this
 * pack reads it as a front render and a flat lay of each colourway. A labelled default with an
 * owner question (decision 0096).
 */

const SECTIONS = ["1 PICK YOUR KIT", "2 COLOURWAYS", "3 COMPARISON"] as const;

const COLOURWAYS = ["home", "away", "goalkeeper"] as const;

const LABELS: Readonly<Record<(typeof COLOURWAYS)[number], string>> = {
  home: "Home",
  away: "Away",
  goalkeeper: "Goalkeeper",
};

const colourwaySteps: readonly FlowStepSpec[] = COLOURWAYS.flatMap((colourway, at): readonly FlowStepSpec[] => [
  step({
    key: `render-${colourway}`,
    section: SECTIONS[1],
    kind: "mockup",
    name: `${LABELS[colourway]} front render`,
    settings: { scene: "render-front", colourway, aspect: "1:1" },
    feeds: ["design"],
    note: at === 0 ? "One board per colourway. The switcher on each board is the colourway it renders." : null,
  }),
  step({
    key: `flat-lay-${colourway}`,
    section: SECTIONS[1],
    kind: "mockup",
    name: `${LABELS[colourway]} flat lay`,
    settings: { scene: "flat-lay", colourway, aspect: "1:1" },
    feeds: ["design"],
  }),
]);

export const COLOURWAY_SET: FlowTemplateSpec = {
  slug: "colourway-set",
  title: "Colourway set",
  lead: "Home, away and goalkeeper side by side: a render and a flat lay of each, and one post that compares them.",
  sections: [...SECTIONS],
  assets: 7,
  sort: 5,
  note: TEMPLATE_NOTE,
  ruleId: FLOW_GAP_RULE,
  tutorial: tutorialFor(
    "Colourway set",
    "Every board here is free. Change a colour on the design and press Run all: the six pictures and the comparison post are all redrawn from it.",
  ),
  steps: [
    designStep(SECTIONS[0], "The kit whose colourways you are showing", SWAP_NOTE),
    ...colourwaySteps,
    step({
      key: "comparison",
      section: SECTIONS[2],
      kind: "marketing",
      name: "Colourway comparison post",
      settings: { campaign: "new-kit-launch", aspect: "4:5", headline: "Three ways to play", copy: "" },
      feeds: ["render-home", "render-away", "render-goalkeeper"],
      note: EXPORT_NOTE,
    }),
  ],
};
