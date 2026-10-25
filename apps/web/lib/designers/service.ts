import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { failureFromDatabase } from "@/lib/projects/database-errors";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { loadStored } from "@/lib/settings/store";
import { specFromSnapshot } from "@/lib/templates/copy";
import { SPORTS, STYLE_IDS } from "@/lib/templates/catalogue";
import { COLOUR_FAMILIES } from "@/lib/templates/colour-family";
import { PAYOUT_STATES, SUBMISSION_STATUSES, type PayoutState } from "./copy";
import { rateFromSetting, summarise, type LedgerLine, type LedgerSummary } from "./royalty";
import type { NewSubmission } from "./schemas";

/**
 * Reads go through the signed-in person's own client, so row security decides what they see. Writes go through the
 * database functions with the server's client; the person comes from the session, never from a form.
 */

export const ROYALTY_SETTING_KEY = "designer.royalty_per_unit";

const HINT_MESSAGES: Readonly<Record<string, string>> = {
  rights_required: "Say that you hold the rights to every artwork in the design.",
  not_a_draft: "Only a draft can be sent.",
  not_submitted: "Only a design that is waiting for review can be accepted.",
  already_decided: "That submission has already been decided.",
  reason_required: "Say why.",
};

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

/** A database refusal in words; anything not listed here goes through the usual mapping. */
export function designerFailure(error: { code?: string; hint?: string; message: string }): AppError {
  const message = error.hint ? HINT_MESSAGES[error.hint] : undefined;
  return message ? new AppError("invalid_input", message) : failureFromDatabase(error);
}

async function call(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw designerFailure(error);
  return data;
}

export async function enrol(admin: SupabaseClient, userId: string, displayName: string): Promise<void> {
  await call(admin, "designer_enrol", { p_user_id: userId, p_display_name: displayName });
}

/**
 * Freezes the newest saved version of one of the member's designs as a draft submission. The design is read with the
 * member's own client, so it must be in a brand they belong to, and it must be readable as a design.
 */
export async function createSubmission(admin: SupabaseClient, client: SupabaseClient, userId: string, input: NewSubmission): Promise<string> {
  const project = await client.from("projects").select("current_version").eq("id", input.projectId).maybeSingle();
  if (project.error) throw unreadable(project.error);
  if (!project.data) throw new AppError("not_found", "That design does not exist.");
  const version = await client
    .from("spec_versions")
    .select("spec")
    .eq("project_id", input.projectId)
    .eq("version", (project.data as { current_version: number }).current_version)
    .maybeSingle();
  if (version.error) throw unreadable(version.error);
  const copy = specFromSnapshot((version.data as { spec: unknown } | null)?.spec);
  if (!copy.ok) throw new AppError("invalid_input", copy.reason);
  const id = await call(admin, "template_submission_create", {
    p_user_id: userId,
    p_title: input.title,
    p_sport: input.sport,
    p_article_id: copy.spec.typeId,
    p_wearer: copy.spec.wearer,
    p_style_tags: [input.style],
    p_colour_family: input.colourFamily,
    p_snapshot: copy.spec,
  });
  return z.uuid().parse(id);
}

export async function sendSubmission(admin: SupabaseClient, userId: string, submissionId: string): Promise<void> {
  await call(admin, "template_submission_submit", { p_user_id: userId, p_submission_id: submissionId, p_rights_attested: true });
}

/** Accepts a submission and returns the id of the template it became. */
export async function acceptSubmission(admin: SupabaseClient, actor: string, submissionId: string): Promise<string> {
  return z.uuid().parse(await call(admin, "template_submission_approve", { p_actor: actor, p_submission_id: submissionId }));
}

export async function rejectSubmission(admin: SupabaseClient, actor: string, submissionId: string, reason: string): Promise<void> {
  await call(admin, "template_submission_reject", { p_actor: actor, p_submission_id: submissionId, p_reason: reason });
}

export async function setPayoutState(admin: SupabaseClient, actor: string, designerId: string, state: PayoutState, note: string): Promise<void> {
  await call(admin, "designer_set_payout_state", { p_actor: actor, p_designer_id: designerId, p_state: state, p_note: note });
}

const profileRow = z.object({ user_id: z.uuid(), display_name: z.string() });
export type DesignerProfile = Readonly<{ userId: string; displayName: string }>;

export async function loadProfile(client: SupabaseClient, userId: string): Promise<DesignerProfile | null> {
  const { data, error } = await client.from("designer_profiles").select("user_id, display_name").eq("user_id", userId).maybeSingle();
  if (error) throw unreadable(error);
  const row = profileRow.nullish().parse(data);
  return row ? { userId: row.user_id, displayName: row.display_name } : null;
}

const submissionRow = z.object({
  id: z.uuid(),
  designer_id: z.uuid(),
  title: z.string(),
  sport: z.enum(SPORTS),
  article_id: z.string(),
  style_tags: z.array(z.enum(STYLE_IDS)),
  colour_family: z.enum(COLOUR_FAMILIES),
  status: z.enum(SUBMISSION_STATUSES),
  rejection_reason: z.string().nullable(),
  rights_attested: z.boolean(),
  template_id: z.uuid().nullable(),
  created_at: z.string(),
});
const SUBMISSION_COLUMNS = "id, designer_id, title, sport, article_id, style_tags, colour_family, status, rejection_reason, rights_attested, template_id, created_at";

export type Submission = Readonly<{
  id: string;
  designerId: string;
  title: string;
  sport: (typeof SPORTS)[number];
  articleId: string;
  style: (typeof STYLE_IDS)[number];
  colourFamily: (typeof COLOUR_FAMILIES)[number];
  status: (typeof SUBMISSION_STATUSES)[number];
  rejectionReason: string | null;
  rightsAttested: boolean;
  templateId: string | null;
  createdAt: string;
}>;

const toSubmission = (r: z.output<typeof submissionRow>): Submission => ({
  id: r.id,
  designerId: r.designer_id,
  title: r.title,
  sport: r.sport,
  articleId: r.article_id,
  style: r.style_tags[0] ?? "plain",
  colourFamily: r.colour_family,
  status: r.status,
  rejectionReason: r.rejection_reason,
  rightsAttested: r.rights_attested,
  templateId: r.template_id,
  createdAt: r.created_at,
});

/** The designer's own submissions, newest first. */
export async function loadSubmissions(client: SupabaseClient, designerId: string): Promise<readonly Submission[]> {
  const { data, error } = await client
    .from("template_submissions")
    .select(SUBMISSION_COLUMNS)
    .eq("designer_id", designerId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw unreadable(error);
  return z.array(submissionRow).parse(data ?? []).map(toSubmission);
}

export type QueueEntry = Readonly<{ submission: Submission; designerName: string; snapshot: unknown }>;

/** Submissions waiting for review, oldest first, with the design. For platform admins (row security says so). */
export async function loadReviewQueue(client: SupabaseClient): Promise<readonly QueueEntry[]> {
  const { data, error } = await client
    .from("template_submissions")
    .select(`${SUBMISSION_COLUMNS}, snapshot`)
    .eq("status", "submitted")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw unreadable(error);
  const rows = z.array(submissionRow.extend({ snapshot: z.unknown() })).parse(data ?? []);
  const names = await loadDesignerNames(client, rows.map((r) => r.designer_id));
  return rows.map((r) => ({ submission: toSubmission(r), designerName: names.get(r.designer_id) ?? "Designer", snapshot: r.snapshot }));
}

export type DecidedEntry = Readonly<{ submission: Submission; designerName: string }>;

/** Submissions already accepted or rejected, newest first, so the review page keeps showing what was decided. */
export async function loadDecided(client: SupabaseClient): Promise<readonly DecidedEntry[]> {
  const { data, error } = await client
    .from("template_submissions")
    .select(SUBMISSION_COLUMNS)
    .in("status", ["approved", "rejected"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw unreadable(error);
  const rows = z.array(submissionRow).parse(data ?? []);
  const names = await loadDesignerNames(client, rows.map((r) => r.designer_id));
  return rows.map((r) => ({ submission: toSubmission(r), designerName: names.get(r.designer_id) ?? "Designer" }));
}

async function loadDesignerNames(client: SupabaseClient, ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await client.from("designer_profiles").select("user_id, display_name").in("user_id", [...new Set(ids)]);
  if (error) throw unreadable(error);
  return new Map(z.array(profileRow).parse(data ?? []).map((r) => [r.user_id, r.display_name]));
}

const accrualRow = z.object({
  designer_id: z.uuid(),
  units: z.number().int(),
  rate_minor: z.number().int().nullable(),
  currency: z.string().nullable(),
  accrued_minor: z.number().int(),
});

/** Ledger lines grouped by designer. Pass a designer id for one person's, or none for every designer's (platform admins). */
export async function loadLedger(client: SupabaseClient, designerId?: string): Promise<ReadonlyMap<string, readonly LedgerLine[]>> {
  let query = client.from("royalty_accruals").select("designer_id, units, rate_minor, currency, accrued_minor").order("seq").limit(10000);
  if (designerId) query = query.eq("designer_id", designerId);
  const { data, error } = await query;
  if (error) throw unreadable(error);
  const grouped = new Map<string, LedgerLine[]>();
  for (const r of z.array(accrualRow).parse(data ?? [])) {
    const line = { units: r.units, rateMinor: r.rate_minor, currency: r.currency, accruedMinor: r.accrued_minor };
    grouped.set(r.designer_id, [...(grouped.get(r.designer_id) ?? []), line]);
  }
  return grouped;
}

export type DesignerHome = Readonly<{
  submissions: readonly Submission[];
  liveTemplates: number;
  ledger: LedgerSummary;
  payoutState: PayoutState;
}>;

/** The latest payout state of each designer; "not paid" until the owner sets one. */
export async function loadPayoutStates(client: SupabaseClient): Promise<ReadonlyMap<string, PayoutState>> {
  const { data, error } = await client.from("designer_payout_events").select("designer_id, state").order("seq", { ascending: true }).limit(10000);
  if (error) throw unreadable(error);
  const rows = z.array(z.object({ designer_id: z.uuid(), state: z.enum(PAYOUT_STATES) })).parse(data ?? []);
  return new Map(rows.map((r) => [r.designer_id, r.state]));
}

export async function loadDesignerHome(client: SupabaseClient, userId: string): Promise<DesignerHome> {
  const [submissions, ledger, states] = await Promise.all([loadSubmissions(client, userId), loadLedger(client, userId), loadPayoutStates(client)]);
  return {
    submissions,
    liveTemplates: submissions.filter((s) => s.status === "approved").length,
    ledger: summarise(ledger.get(userId) ?? []),
    payoutState: states.get(userId) ?? "not_paid",
  };
}

export type DesignerRow = Readonly<{ designerId: string; name: string; payoutState: PayoutState; ledger: LedgerSummary }>;

/** Every designer with units, accrued money and payout state. For platform admins. */
export async function loadDesignerRows(client: SupabaseClient): Promise<readonly DesignerRow[]> {
  const { data, error } = await client.from("designer_profiles").select("user_id, display_name").order("display_name").limit(500);
  if (error) throw unreadable(error);
  const profiles = z.array(profileRow).parse(data ?? []);
  const [ledger, states] = await Promise.all([loadLedger(client), loadPayoutStates(client)]);
  return profiles.map((p) => ({
    designerId: p.user_id,
    name: p.display_name,
    payoutState: states.get(p.user_id) ?? "not_paid",
    ledger: summarise(ledger.get(p.user_id) ?? []),
  }));
}

/** The royalty rate now in force, or null while it is not set. Read with the server's client. */
export async function loadRate(admin: SupabaseClient): Promise<number | null> {
  return rateFromSetting((await loadStored(admin))[ROYALTY_SETTING_KEY]?.value);
}

export type DesignChoice = Readonly<{ id: string; name: string }>;

/** The designs of the member's brand, for the form that offers one. */
export async function loadDesignChoices(client: SupabaseClient, brandId: string): Promise<readonly DesignChoice[]> {
  const { data, error } = await client.from("projects").select("id, name").eq("brand_id", brandId).order("updated_at", { ascending: false }).limit(100);
  if (error) throw unreadable(error);
  return z.array(z.object({ id: z.uuid(), name: z.string() })).parse(data ?? []);
}
