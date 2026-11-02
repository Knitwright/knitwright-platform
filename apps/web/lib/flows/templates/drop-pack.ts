import { FLOW_GAP_RULE, type FlowStepSpec, type FlowTemplateSpec } from "../types";
import { designStep, EXPORT_NOTE, step, SWAP_NOTE, TEMPLATE_NOTE, tutorialFor } from "./shared";

/**
 * "Brand drop pack" (`07`): design -> e-commerce listing images (white, 4:5) -> 4 lifestyle mockups
 * -> drop announcement post and story -> 2 AI clips. **16 assets.**
 *
 * `07` does not say how many listing images there are. Sixteen less the four lifestyle scenes, the
 * two posts and the two clips leaves eight, so this pack reads it as the four views of F-L1's
 * e-commerce set at white 1:1 and at 4:5. That split is a labelled default and an owner question
 * (decision 0096); the count of sixteen is the spec's own.
 */

const SECTIONS = ["1 PICK YOUR DESIGN", "2 LISTING IMAGES", "3 LIFESTYLE", "4 SOCIAL", "5 VIDEO"] as const;

const VIEWS = ["front", "back", "three-quarter", "side"] as const;

const listingSteps: readonly FlowStepSpec[] = [
  ...VIEWS.map((view, at) =>
    step({
      key: `white-1-1-${view}`,
      section: SECTIONS[1],
      kind: "mockup",
      name: `White 1:1, ${view.replace("-", " ")}`,
      settings: { scene: "ecommerce-white", view, aspect: "1:1" },
      feeds: ["design"],
      note: at === 0 ? "The e-commerce set: white background, square and 4:5, four views each. Free and deterministic." : null,
    }),
  ),
  ...VIEWS.map((view) =>
    step({
      key: `white-4-5-${view}`,
      section: SECTIONS[1],
      kind: "mockup",
      name: `White 4:5, ${view.replace("-", " ")}`,
      settings: { scene: "ecommerce-white", view, aspect: "4:5" },
      feeds: ["design"],
    }),
  ),
];

const LIFESTYLE: readonly Readonly<{ key: string; name: string; prompt: string }>[] = [
  { key: "lifestyle-city", name: "City street", prompt: "City street at golden hour, shallow depth of field, the garment unchanged" },
  { key: "lifestyle-gym", name: "Gym mirror", prompt: "Gym mirror under hard light, the garment unchanged" },
  { key: "lifestyle-track", name: "Track warm-up", prompt: "Running track at dawn, cool light, the garment unchanged" },
  { key: "lifestyle-studio", name: "Studio backdrop", prompt: "Coloured studio backdrop, soft light, the garment unchanged" },
];

const lifestyleSteps: readonly FlowStepSpec[] = LIFESTYLE.map((one, at) =>
  step({
    key: one.key,
    section: SECTIONS[2],
    kind: "ai_image",
    name: one.name,
    generation: "model",
    settings: { prompt: one.prompt, style: "editorial", aspect: "4:5", count: 1, garmentLocked: true },
    feeds: ["white-1-1-front"],
    note: at === 0 ? "A model changes the scene, the light and the camera. It never redraws the garment." : null,
  }),
);

export const BRAND_DROP_PACK: FlowTemplateSpec = {
  slug: "brand-drop-pack",
  title: "Brand drop pack",
  lead: "A drop announced end to end: eight listing images, four lifestyle scenes, a post, a story and two clips.",
  sections: [...SECTIONS],
  assets: 16,
  sort: 2,
  note: TEMPLATE_NOTE,
  ruleId: FLOW_GAP_RULE,
  tutorial: tutorialFor(
    "Brand drop pack",
    "Everything a drop needs in one run. The listing images are free; the four lifestyle scenes and the two clips cost credits, and the estimate is shown before anything is spent.",
  ),
  steps: [
    designStep(SECTIONS[0], "The design you are dropping", SWAP_NOTE),
    ...listingSteps,
    ...lifestyleSteps,
    step({
      key: "drop-post",
      section: SECTIONS[3],
      kind: "marketing",
      name: "Drop announcement post",
      settings: { campaign: "limited-drop", aspect: "4:5", headline: "The drop", copy: "" },
      feeds: ["lifestyle-city", "white-1-1-front"],
      note: "Pixel-locked: the pictures you feed it stay exactly as they are.",
    }),
    step({
      key: "drop-story",
      section: SECTIONS[3],
      kind: "marketing",
      name: "Drop announcement story",
      settings: { campaign: "limited-drop", aspect: "9:16", headline: "The drop", copy: "" },
      feeds: ["lifestyle-gym"],
    }),
    step({
      key: "clip-orbit",
      section: SECTIONS[4],
      kind: "ai_video",
      name: "Slow orbit clip",
      generation: "model",
      format: "mp4",
      settings: { preset: "slow-orbit", seconds: 6, aspect: "9:16", audio: false, garmentLocked: true },
      feeds: ["lifestyle-city"],
      note: "The first frame is always a picture the platform drew, and the checker samples the frames.",
    }),
    step({
      key: "clip-tracking",
      section: SECTIONS[4],
      kind: "ai_video",
      name: "Smooth tracking clip",
      generation: "model",
      format: "mp4",
      settings: { preset: "smooth-tracking", seconds: 6, aspect: "16:9", audio: false, garmentLocked: true },
      feeds: ["lifestyle-track"],
      note: EXPORT_NOTE,
    }),
  ],
};
