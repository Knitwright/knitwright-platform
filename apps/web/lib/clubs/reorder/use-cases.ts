import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRoster, type RosterIssue } from "@/lib/orders/checks";
import { rosterContextOf } from "@/lib/orders/context";
import { saveTeamOrder, getTeamOrder } from "@/lib/orders/service";
import type { RosterRow } from "@/lib/production/contract";
import { getProject } from "@/lib/projects/service";
import { AppError } from "@/lib/server/core/errors";
import { readinessFor } from "@/lib/validation/design-input";
import { reportFor } from "@/lib/validation/use-cases";
import { getRoster, type Who } from "../service";
import { planFingerprint, planReorder, type ReorderPlan } from "./plan";
import { reorderReport, type ReorderReport } from "./report";
import { resolveLines } from "./resolve";
import type { ConfirmBody, PreviewBody } from "./schemas";
import { findRelease } from "./service";

type Brand = Readonly<{ id: string; name: string }>;

const ORDER_GONE = "The team list of that order has been erased. Choose a season to reorder from.";
const NAME_MAX = 120;

interface ValidationSummary {
  readonly profileName: string;
  readonly profileLabel: string;
  readonly blockers: number;
  readonly warnings: number;
  /** The first few blockers, in plain words. */
  readonly blockerMessages: readonly string[];
}

interface ReorderPreview {
  readonly releaseId: string;
  readonly releaseLabel: string;
  readonly projectId: string;
  readonly designName: string;
  readonly source: "season" | "order";
  readonly plan: ReorderPlan;
  readonly fingerprint: string;
  /** True when no line needs fixing and no size or player changed: the person only presses Confirm. */
  readonly nothingChanged: boolean;
  readonly report: ReorderReport;
  readonly validation: ValidationSummary;
  /** Problems the list will still have once made, such as a repeated number. They do not stop the order being made. */
  readonly issues: readonly RosterIssue[];
  /** Said when the earlier order's list is gone, so players who left cannot be listed. */
  readonly notes: readonly string[];
}

async function earlierRows(client: SupabaseClient, brandId: string, projectId: string, orderId: string | null): Promise<readonly RosterRow[] | null> {
  if (orderId === null) return null;
  try {
    return (await getTeamOrder(client, brandId, projectId, orderId)).rows;
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") return null;
    throw error;
  }
}

async function validationOf(client: SupabaseClient, brand: Brand, projectId: string): Promise<ValidationSummary> {
  const { design, version } = await readinessFor(client, brand, projectId);
  const report = await reportFor(client, brand.id, projectId, version, design);
  const blockerMessages = report.findings.filter((f) => f.severity === "blocker").slice(0, 5).map((f) => f.message);
  return { profileName: report.profileName, profileLabel: report.profileLabel, blockers: report.blockers, warnings: report.warnings, blockerMessages };
}

async function load(client: SupabaseClient, brand: Brand, body: PreviewBody) {
  const release = await findRelease(client, brand.id, body.releaseId);
  const project = await getProject(client, brand.id, release.projectId);
  const previous = await earlierRows(client, brand.id, release.projectId, release.orderId);
  const run = rosterContextOf(project.spec).run;
  const players = body.seasonId ? await getRoster(client, brand.id, body.seasonId) : null;
  if (players === null && previous === null) throw new AppError("not_found", ORDER_GONE);
  return { release, project, previous, plan: planReorder({ players, previous, run }) };
}

/** What a reorder would do, with nothing saved. The person looks, fixes what needs fixing, and confirms. */
export async function previewReorder(client: SupabaseClient, brand: Brand, body: PreviewBody): Promise<ReorderPreview> {
  const { release, project, previous, plan } = await load(client, brand, body);
  const rows = plan.lines.map((l) => l.row);
  const nothingChanged = plan.counts.fix === 0 && plan.counts.sizeChanged === 0 && plan.counts.newPlayers === 0;
  return {
    releaseId: release.id,
    releaseLabel: release.label,
    projectId: release.projectId,
    designName: project.name,
    source: body.seasonId ? "season" : "order",
    plan,
    fingerprint: planFingerprint(plan),
    nothingChanged,
    report: reorderReport(release.snapshot, project.currentVersion, rows),
    validation: await validationOf(client, brand, release.projectId),
    issues: plan.counts.fix === 0 ? checkRoster(rows, rosterContextOf(project.spec)) : [],
    notes: body.seasonId && previous === null ? ["The earlier order has no team list, so players who left cannot be listed."] : [],
  };
}

interface ConfirmedReorder {
  readonly orderId: string;
  readonly projectId: string;
  readonly players: number;
  readonly leftOut: number;
  readonly issues: readonly RosterIssue[];
}

/**
 * Makes the new team order. The plan is made again here from what is saved now, and must be the one
 * the person looked at; every line that needed fixing must be answered. Nothing is dropped silently.
 */
export async function confirmReorder(clients: Readonly<{ client: SupabaseClient; admin: SupabaseClient }>, who: Who, brand: Brand, body: ConfirmBody): Promise<ConfirmedReorder> {
  const { release, project, plan } = await load(clients.client, brand, body);
  if (planFingerprint(plan) !== body.fingerprint) {
    throw new AppError("conflict", "The roster or the earlier order changed while you were looking. Start the reorder again.");
  }
  const resolved = resolveLines(plan, body.resolutions);
  if (!resolved.ok) throw new AppError("invalid_input", "Some lines still need an answer. Choose a size, a number, or keep or leave out the player.");
  if (resolved.rows.length === 0) throw new AppError("invalid_input", "There are no players left to order.");
  const name = `Reorder of ${release.label}`.slice(0, NAME_MAX);
  const orderId = await saveTeamOrder(clients.admin, { ...who, projectId: release.projectId, name, rows: resolved.rows });
  return { orderId, projectId: release.projectId, players: resolved.rows.length, leftOut: resolved.leftOut, issues: checkRoster(resolved.rows, rosterContextOf(project.spec)) };
}
