import { PLAN_SETTINGS, type PlanSettings } from "@/lib/plans/catalogue";
import { planNamed } from "@/lib/plans/view";

/**
 * Whether the brand's plan exports tech packs (P6's plan data, decision 0144): a plan whose
 * `techPackExports` is 0 shows ♛ on the sheets' Download .xlsx and PDF and opens "Upgrade to export
 * tech packs" (`08` v3.7). A null allowance is no limit. Ordering through Knitwright never needs one.
 */
export const canExportTechPacks = (settings: PlanSettings = PLAN_SETTINGS): boolean =>
  planNamed(settings.currentPlan, settings).techPackExports !== 0;

/** The two downloads of the sheets preview, through the tech pack's own export route. */
export const sheetsDownloads = (projectId: string): Readonly<{ xlsx: string; pdf: string }> => ({
  xlsx: `/api/projects/${projectId}/exports/xlsx?layout=sheets`,
  pdf: `/api/projects/${projectId}/exports/pdf`,
});
