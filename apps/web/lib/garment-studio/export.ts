import type { BaseArticle } from "@/lib/catalogue";
import { PLAN_SETTINGS, type PlanId, type PlanSettings } from "@/lib/plans/catalogue";
import type { ExportPanelTabId } from "@/lib/techpack/exports/panel";

/**
 * THE STUDIO'S EXPORT PANEL, AS DATA (plan v6 G1, decision 0150; `08` v3.6, s16).
 *
 * Fabra's six tabs over the files the platform already makes. Every tab is backed by one of the
 * Export panel's own tabs (decision 0078, `lib/techpack/exports/panel-outputs.ts`), so the studio
 * offers no address that panel does not already serve, and a tab with nothing behind it says so.
 *
 * The "Export tech pack (8)" checklist is the eight sections the tech pack files carry. Both files
 * carry every section today, so the list is shown ticked and is not a set of switches: a box that
 * changed nothing would be a claim the platform cannot keep (the panel's own rule).
 */

export const STUDIO_EXPORT_TABS = ["tech-pack", "images", "pattern", "artwork", "on-model", "flat-lay"] as const;
export type StudioExportTabId = (typeof STUDIO_EXPORT_TABS)[number];

export interface StudioExportTab {
  readonly id: StudioExportTabId;
  readonly label: string;
  /** The Export panel tab whose outputs this one offers. */
  readonly from: ExportPanelTabId;
  /** One plain sentence under the tabs. */
  readonly lead: string;
}

export const STUDIO_TABS: readonly StudioExportTab[] = [
  { id: "tech-pack", label: "Tech pack", from: "tech-pack", lead: "The factory file: every section below, as a PDF and as a workbook." },
  { id: "images", label: "Images", from: "images", lead: "Flat drawings of the garment, made from the design itself." },
  { id: "pattern", label: "Pattern", from: "pattern", lead: "The pattern pieces, at full size." },
  { id: "artwork", label: "Artwork", from: "print-files", lead: "The print file of every piece, with the bleed a printer needs." },
  { id: "on-model", label: "On model", from: "mockups", lead: "Pictures of the kit worn, made in the marketing media screen." },
  { id: "flat-lay", label: "Flat lay", from: "mockups", lead: "Flat-lay pictures, made in the marketing media screen." },
];

export const studioTab = (id: StudioExportTabId): StudioExportTab => STUDIO_TABS.find((tab) => tab.id === id) as StudioExportTab;

export interface ChecklistItem {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  /** Glyph name for the row's icon. */
  readonly icon: "grid" | "layers" | "shirt" | "ruler" | "file" | "message" | "image" | "tag";
}

/** The size run as "XS–3XL", or a single size, or nothing. */
const runOf = (sizes: readonly string[]): string => (sizes.length > 1 ? `${sizes[0]}–${sizes[sizes.length - 1]}` : (sizes[0] ?? ""));

/**
 * The eight sections, in Fabra's order, with Compliance labels (ours) last. The details are read from
 * the base article and the design's own size run; where neither says, the row says so.
 */
export function techPackChecklist(article: BaseArticle | null, sizes: readonly string[]): readonly ChecklistItem[] {
  const sample = article?.sampleSize ?? null;
  const run = runOf(sizes);
  return [
    { id: "overview", label: "Overview", detail: "Product & brand details", icon: "grid" },
    { id: "colourways", label: "Colourways", detail: "Renders & fill details", icon: "layers" },
    { id: "sample-measurements", label: "Sample measurements", detail: sample ? `Sample size ${sample}` : "No sample size on file yet", icon: "shirt" },
    { id: "size-chart", label: "Size chart", detail: run ? `Graded ${run}` : "No size run yet", icon: "ruler" },
    { id: "bom", label: "Bill of materials", detail: "Fabric, trims, labels", icon: "file" },
    { id: "callouts", label: "Construction callouts", detail: "Provided for the factory", icon: "message" },
    { id: "artworks", label: "Artworks", detail: "Placements & print files", icon: "image" },
    { id: "labels", label: "Compliance labels", detail: "Care, fibre and origin", icon: "tag" },
  ];
}

/** Notes is Fabra's ninth row. Nothing writes notes into the tech pack yet, so it is listed as coming. */
export const NOTES_COMING = "Notes: coming soon.";

/** The gold note: ordering never needs an export (`09` screen 29). */
export const ORDER_NOTE = "Making it with Knitwright? You don't need to export: the tech pack goes to the factory free with your order.";

/** What the Pattern tab says about who gets the pattern, by production class (`08` v3.6). */
export function patternNote(article: BaseArticle | null): string {
  if (article?.productionClass === "A") return "Class A patterns stay with the factory: they are graded and cut there.";
  if (article?.productionClass === "B") return "Class B patterns are sent as DXF on request, once the factory has checked them.";
  return "This design is not on a base article yet, so there is no pattern to send.";
}

export interface ExportAccess {
  /** True when the brand's plan includes tech pack exports. */
  readonly allowed: boolean;
  readonly planName: string;
  /** Exports a month, or null for no limit. 0 when not allowed. */
  readonly perMonth: number | null;
}

/**
 * Whether Export may make the files, from the plans' own rows (P6, decision 0144). Every brand is on
 * `currentPlan` until checkout records a subscription, so this reads the setting and nothing else.
 */
export function exportAccess(settings: PlanSettings = PLAN_SETTINGS, plan: PlanId = settings.currentPlan): ExportAccess {
  const row = settings.plans.find((one) => one.id === plan);
  if (!row) return { allowed: false, planName: plan, perMonth: 0 };
  return { allowed: row.techPackExports !== 0, planName: row.name, perMonth: row.techPackExports };
}
