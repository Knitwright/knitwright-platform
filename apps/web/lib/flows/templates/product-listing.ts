import { FLOW_GAP_RULE, type FlowStepSpec, type FlowTemplateSpec } from "../types";
import { designStep, EXPORT_NOTE, step, SWAP_NOTE, TEMPLATE_NOTE, tutorialFor } from "./shared";

/**
 * "Shopify product listing" (`07`): design -> 5 listing images -> size chart image -> product
 * carousel video. **7 assets.**
 *
 * Every output is one the platform draws itself, so the whole pack is free. The five listing images
 * are F-L1's e-commerce and free scenes; the carousel is the deterministic twelve-second video of
 * `07`'s video table.
 *
 * This pack makes files. It does not connect a store, push a product or set a price: that is
 * wave 5's hand-off (O2), and "Publish to store" here only writes a payload for it to collect.
 */

const SECTIONS = ["1 PICK YOUR DESIGN", "2 LISTING IMAGES", "3 SIZE CHART", "4 CAROUSEL"] as const;

const LISTING: readonly Readonly<{ key: string; name: string; scene: string; aspect: string }>[] = [
  { key: "white-square", name: "White background 1:1", scene: "ecommerce-white", aspect: "1:1" },
  { key: "white-portrait", name: "White background 4:5", scene: "ecommerce-white", aspect: "4:5" },
  { key: "flat-lay", name: "Flat lay", scene: "flat-lay", aspect: "1:1" },
  { key: "hanger", name: "On a hanger", scene: "hanger", aspect: "1:1" },
  { key: "ghost", name: "Ghost mannequin", scene: "ghost-mannequin", aspect: "1:1" },
];

const listingSteps: readonly FlowStepSpec[] = LISTING.map((one, at) =>
  step({
    key: one.key,
    section: SECTIONS[1],
    kind: "mockup",
    name: one.name,
    settings: { scene: one.scene, aspect: one.aspect },
    feeds: ["design"],
    note: at === 0 ? "Five pictures a listing needs, all free and all drawn from your design." : null,
  }),
);

export const SHOPIFY_PRODUCT_LISTING: FlowTemplateSpec = {
  slug: "shopify-product-listing",
  title: "Shopify product listing",
  lead: "The seven files a product listing needs: five images, a size chart and a carousel clip.",
  sections: [...SECTIONS],
  assets: 7,
  sort: 4,
  note: TEMPLATE_NOTE,
  ruleId: FLOW_GAP_RULE,
  tutorial: tutorialFor(
    "Shopify product listing",
    "Run it, then Export all. The zip holds a png folder and an mp4 folder, which is what a listing wants. Publishing to a store is a separate hand-off.",
  ),
  steps: [
    designStep(SECTIONS[0], "The design you are listing", SWAP_NOTE),
    ...listingSteps,
    step({
      key: "size-chart",
      section: SECTIONS[2],
      kind: "info_card",
      name: "Size chart image",
      settings: { card: "size_chart", aspect: "1:1" },
      feeds: ["design"],
      note: "Garment measurements, from the factory file. A listing that shows body sizes instead is a return waiting to happen.",
    }),
    step({
      key: "carousel",
      section: SECTIONS[3],
      kind: "mockup",
      name: "Product carousel",
      settings: { scene: "product-carousel", seconds: 12, aspect: "1:1" },
      format: "mp4",
      feeds: ["design"],
      note: EXPORT_NOTE,
    }),
  ],
};
