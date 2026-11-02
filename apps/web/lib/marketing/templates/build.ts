import { MARKETING_RULE } from "../rules";
import { buildLayouts } from "./plans";
import { FORMAT_LABELS, SEED_LABEL, type MarketingLayout, type MarketingTemplate } from "./types";

/**
 * The 50 `templates` rows of kind `marketing` (plan v5 L4; `07`'s launch count), built from the
 * thirty layouts of `plans.ts`. One row is one layout at one format, because a person picks a post
 * at a size, not a layout in the abstract.
 *
 * Built the same way every time -- no date, no random id, no third-party asset -- so the seed can
 * run again and change the rows it made rather than adding more.
 */

/** The marketing layout as it is stored in `templates.snapshot`. A design row's snapshot is a design; this is a layout. */
export interface MarketingSnapshot {
  readonly kind: "marketing";
  readonly schemaVersion: 1;
  readonly layoutKey: string;
  readonly group: string;
  readonly format: string;
  readonly lead: string;
  readonly label: string;
  readonly ruleId: string;
  readonly slots: readonly unknown[];
}

const rowsOfLayout = (layout: MarketingLayout): readonly MarketingTemplate[] =>
  layout.formats.map((format) => ({
    slug: `${layout.key}-${format}`,
    title: `${layout.title} — ${FORMAT_LABELS[format]}`,
    group: layout.group,
    lead: layout.lead,
    format,
    layoutKey: layout.key,
    slots: layout.slots,
    ruleId: MARKETING_RULE,
    label: SEED_LABEL,
  }));

/** Every marketing template: one per layout per format, in the order `07` lists them. */
export const buildMarketingTemplates = (layouts: readonly MarketingLayout[] = buildLayouts()): readonly MarketingTemplate[] =>
  layouts.flatMap(rowsOfLayout);

/** What `templates.snapshot` holds for a marketing row. */
export const snapshotOf = (template: MarketingTemplate): MarketingSnapshot => ({
  kind: "marketing",
  schemaVersion: 1,
  layoutKey: template.layoutKey,
  group: template.group,
  format: template.format,
  lead: template.lead,
  label: template.label,
  ruleId: template.ruleId,
  slots: template.slots,
});

/**
 * The `templates` row of one marketing template.
 *
 * The five columns that describe a design -- the sport, the article, the wearer, the style tags and
 * the colour family -- are null here, and the migration's own constraint says they belong to a
 * design and to nothing else. A marketing layout is not on an article and has no wearer, and filling
 * those in with "general" and a garment code would be five invented facts in the library's own table.
 */
export const marketingRowOf = (template: MarketingTemplate) => ({
  slug: template.slug,
  title: template.title,
  kind: "marketing" as const,
  sport: null,
  article_id: null,
  wearer: null,
  style_tags: null,
  colour_family: null,
  sport_tags: [],
  era_tags: [],
  mood_tags: [],
  snapshot: snapshotOf(template),
  source: "knitwright" as const,
  review_state: "not_reviewed" as const,
});
