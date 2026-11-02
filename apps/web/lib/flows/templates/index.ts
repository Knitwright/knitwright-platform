import type { FlowStepSpec, FlowTemplateSpec } from "../types";
import { CLUB_KIT_LAUNCH_PACK } from "./club-kit";
import { COLOURWAY_SET } from "./colourways";
import { BRAND_DROP_PACK } from "./drop-pack";
import { SHOPIFY_PRODUCT_LISTING } from "./product-listing";
import { SPONSOR_PACK } from "./sponsor-pack";
import { TEAM_STORE_PROMO } from "./store-promo";

/**
 * The six flow templates of `docs/spec/07-template-library.md`, in the order it lists them.
 *
 * THIS IS THE ONE PLACE A FLOW TEMPLATE IS WRITTEN DOWN, and the migration seeds the same six
 * packs from it (`flow_templates`, `flow_template_steps`, `flow_template_links`), exactly as the
 * credit prices are set in one file and seeded from it. `migration.test.ts` fails when the two
 * disagree, so neither side can drift. At run time the screens read the rows, never this file: a
 * platform admin who changes a pack changes a row (decision 0096).
 */
export const FLOW_TEMPLATES: readonly FlowTemplateSpec[] = [
  CLUB_KIT_LAUNCH_PACK,
  BRAND_DROP_PACK,
  TEAM_STORE_PROMO,
  SHOPIFY_PRODUCT_LISTING,
  COLOURWAY_SET,
  SPONSOR_PACK,
];

export const FLOW_TEMPLATE_SLUGS: readonly string[] = FLOW_TEMPLATES.map((one) => one.slug);

/** One pack by its slug, or null. A slug that is not one of the six is not a pack. */
export const flowTemplate = (slug: string): FlowTemplateSpec | null => FLOW_TEMPLATES.find((one) => one.slug === slug) ?? null;

/** How many finished assets a pack's steps make between them. Held to `07`'s count by a test. */
export const assetsOf = (spec: FlowTemplateSpec): number => spec.steps.reduce((total, one) => total + one.assets, 0);

/** The steps of one section, in order, for the canvas's yellow section labels. */
export const stepsOfSection = (spec: FlowTemplateSpec, section: string): readonly FlowStepSpec[] =>
  spec.steps.filter((one) => one.section === section);

/** The grey instruction notes of a pack, in order, each with the step it sits beside (spec F-L4). */
export const notesOf = (spec: FlowTemplateSpec): readonly Readonly<{ key: string; name: string; note: string }>[] =>
  spec.steps.flatMap((one) => (one.note === null ? [] : [{ key: one.key, name: one.name, note: one.note }]));

/** The step a key names, or null. */
export const stepOf = (spec: FlowTemplateSpec, key: string): FlowStepSpec | null => spec.steps.find((one) => one.key === key) ?? null;

export { CLUB_KIT_LAUNCH_PACK, BRAND_DROP_PACK, TEAM_STORE_PROMO, SHOPIFY_PRODUCT_LISTING, COLOURWAY_SET, SPONSOR_PACK };
