import { FLOW_GAP_RULE, type FlowStepSpec, type FlowTemplateSpec } from "../types";
import { designStep, EXPORT_NOTE, step, SWAP_NOTE, TEMPLATE_NOTE, tutorialFor } from "./shared";

/**
 * "Club kit launch pack" (`07`): design -> 6 product renders -> 3 teamwear mockups -> "new kit"
 * post in three formats -> 360 degree turntable -> "order your kit" story with a QR chip.
 * **14 assets**, which is the acceptance test of F-L4.
 *
 * Six of the renders and the turntable are the free deterministic scenes of F-L1; the three
 * teamwear scenes are the ones F-L1 lists under "Teamwear", which are model scenes and so cost
 * credits. The spec's own diagram shows a round figure of 120 credits; the figure this pack shows
 * is read from the platform's credit price instead, because no price has been set (decision 0096).
 */

const SECTIONS = ["1 PICK YOUR KIT", "2 MOCKUPS", "3 SOCIAL POSTS", "4 VIDEO"] as const;

/** The six product renders of `07`, which F-L1 lists as free and deterministic. */
const RENDERS: readonly Readonly<{ key: string; name: string; scene: string }>[] = [
  { key: "render-front", name: "Front render", scene: "render-front" },
  { key: "render-back", name: "Back render", scene: "render-back" },
  { key: "render-three-quarter", name: "Three-quarter render", scene: "render-three-quarter" },
  { key: "render-side", name: "Side render", scene: "render-side" },
  { key: "flat-lay", name: "Flat lay", scene: "flat-lay" },
  { key: "hanger", name: "On a hanger", scene: "hanger" },
];

/** The three teamwear scenes of `07`. A model makes the scene; the garment stays the render. */
const TEAMWEAR: readonly Readonly<{ key: string; name: string; scene: string }>[] = [
  { key: "changing-room", name: "Changing-room kit layout", scene: "changing-room-kit-layout" },
  { key: "line-up", name: "Team line-up (11)", scene: "team-line-up-11" },
  { key: "tunnel", name: "Tunnel walk-out", scene: "tunnel-walk-out" },
];

const renderSteps: readonly FlowStepSpec[] = RENDERS.map((one, at) =>
  step({
    key: one.key,
    section: SECTIONS[1],
    kind: "mockup",
    name: one.name,
    settings: { scene: one.scene, aspect: "1:1" },
    feeds: ["design"],
    note: at === 0 ? "The platform draws these six from your design. They are free and they follow the design." : null,
  }),
);

const teamwearSteps: readonly FlowStepSpec[] = TEAMWEAR.map((one, at) =>
  step({
    key: one.key,
    section: SECTIONS[1],
    kind: "mockup",
    name: one.name,
    generation: "model",
    settings: { scene: one.scene, aspect: "4:5", garmentLocked: true },
    feeds: ["design"],
    note: at === 0 ? "A model makes the scene around the kit. The kit itself stays the picture the platform drew." : null,
  }),
);

const POSTS: readonly Readonly<{ key: string; name: string; aspect: string }>[] = [
  { key: "post-square", name: '"New kit" square', aspect: "1:1" },
  { key: "post-feed", name: '"New kit" post', aspect: "4:5" },
  { key: "post-story", name: '"New kit" story', aspect: "9:16" },
];

const postSteps: readonly FlowStepSpec[] = POSTS.map((one, at) =>
  step({
    key: one.key,
    section: SECTIONS[2],
    kind: "marketing",
    name: one.name,
    settings: { campaign: "new-kit-launch", aspect: one.aspect, headline: "New kit", copy: "" },
    feeds: ["render-front", "line-up"],
    note: at === 0 ? "The three formats of the spec: square, feed and story. Text comes from your brand styles." : null,
  }),
);

export const CLUB_KIT_LAUNCH_PACK: FlowTemplateSpec = {
  slug: "club-kit-launch-pack",
  title: "Club kit launch pack",
  lead: "One design becomes the whole launch: six renders, three teamwear scenes, three posts, a turntable and an order story.",
  sections: [...SECTIONS],
  assets: 14,
  sort: 1,
  note: TEMPLATE_NOTE,
  ruleId: FLOW_GAP_RULE,
  tutorial: tutorialFor(
    "Club kit launch pack",
    "Put your kit on the Design board, press Run all, and the fourteen outputs below are made in order. Swap the design and run it again for the away kit.",
  ),
  steps: [
    designStep(SECTIONS[0], "Home kit", SWAP_NOTE),
    ...renderSteps,
    ...teamwearSteps,
    ...postSteps,
    step({
      key: "turntable",
      section: SECTIONS[3],
      kind: "mockup",
      name: "360° turntable",
      settings: { scene: "turntable-360", seconds: 6, aspect: "1:1" },
      format: "mp4",
      feeds: ["design"],
      note: "Six seconds, drawn from the 3D model, so it is free and it never drifts.",
    }),
    step({
      key: "order-story",
      section: SECTIONS[2],
      kind: "marketing",
      name: '"Order your kit" story',
      settings: { campaign: "team-store-open", aspect: "9:16", qrChip: true, headline: "Order your kit", copy: "" },
      feeds: ["flat-lay"],
      note: EXPORT_NOTE,
    }),
  ],
};
