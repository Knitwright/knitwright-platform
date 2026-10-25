import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/server/core/errors";
import { throwIfPatternFailed } from "./errors";
import { EVENT_COLUMNS, REQUEST_COLUMNS, toEvent, toRequest, type PatternEvent, type PatternRequest } from "./rows";
import type { Snapshot } from "./snapshot";
import type { Quote } from "./quote";

type Admin = Pick<SupabaseClient, "rpc">;

/** A design's requests, newest first. Read with the person's own client: row level security lets members see their brand's. */
export async function listForProject(client: SupabaseClient, brandId: string, projectId: string): Promise<readonly PatternRequest[]> {
  const { data, error } = await client
    .from("pattern_requests")
    .select(REQUEST_COLUMNS)
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("design_version", { ascending: false })
    .limit(50);
  throwIfPatternFailed(error);
  return (data ?? []).map(toRequest);
}

/** The ops queue: open requests first (oldest first), then the ones that are done. Row level security lets platform admins read all. */
export async function listQueue(client: SupabaseClient): Promise<readonly PatternRequest[]> {
  const { data, error } = await client.from("pattern_requests").select(REQUEST_COLUMNS).order("created_at", { ascending: true }).limit(500);
  throwIfPatternFailed(error);
  const all = (data ?? []).map(toRequest);
  const open = (r: PatternRequest) => r.status === "requested" || r.status === "accepted" || r.status === "in_progress";
  return [...all.filter(open), ...all.filter((r) => !open(r)).reverse()];
}

export async function getRequest(client: SupabaseClient, requestId: string): Promise<PatternRequest | null> {
  const { data, error } = await client.from("pattern_requests").select(REQUEST_COLUMNS).eq("id", requestId).maybeSingle();
  throwIfPatternFailed(error);
  return data ? toRequest(data) : null;
}

export async function listEvents(client: SupabaseClient, requestId: string): Promise<readonly PatternEvent[]> {
  const { data, error } = await client.from("pattern_request_events").select(EVENT_COLUMNS).eq("request_id", requestId).order("seq", { ascending: true }).limit(200);
  throwIfPatternFailed(error);
  return (data ?? []).map(toEvent);
}

export type NewRequest = Readonly<{
  brandId: string;
  userId: string;
  projectId: string;
  designVersion: number;
  articleId: string;
  snapshot: Snapshot;
  snapshotHash: string;
  quote: Quote;
  /** True when the credits gate is on: a priced request then takes its credits in the same step. */
  charge: boolean;
}>;

export type Created = Readonly<{ requestId: string; created: boolean; charged: boolean; balance: number }>;

const answer = (data: unknown): Record<string, unknown> => (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;

/** Makes the request and, when asked, takes its credits, in one database step. Asking again for the same version changes nothing. */
export async function createRequest(admin: Admin, input: NewRequest): Promise<Created> {
  const { data, error } = await admin.rpc("pattern_request_create", {
    p_brand_id: input.brandId,
    p_user_id: input.userId,
    p_project_id: input.projectId,
    p_design_version: input.designVersion,
    p_article_id: input.articleId,
    p_snapshot: input.snapshot,
    p_snapshot_hash: input.snapshotHash,
    p_price_credits: input.quote.priceCredits,
    p_turnaround_days: input.quote.turnaroundWorkingDays,
    p_charge: input.charge,
  });
  throwIfPatternFailed(error);
  const out = answer(data);
  if (out?.ok !== true) {
    const price = Number(out?.price ?? 0);
    throw new AppError("conflict", `A pattern request costs ${price} ${price === 1 ? "credit" : "credits"}. Your balance is ${Number(out?.balance ?? 0)}.`);
  }
  return { requestId: String(out.request_id), created: out.created === true, charged: out.charged === true, balance: Number(out.balance) };
}

export async function moveRequest(admin: Admin, actor: string, requestId: string, to: string, note: string): Promise<void> {
  const { error } = await admin.rpc("pattern_request_move", { p_actor: actor, p_request_id: requestId, p_to: to, p_note: note });
  throwIfPatternFailed(error);
}

export async function attachFiles(admin: Admin, actor: string, requestId: string, fileIds: readonly string[]): Promise<void> {
  const { error } = await admin.rpc("pattern_request_attach_files", { p_actor: actor, p_request_id: requestId, p_file_ids: fileIds });
  throwIfPatternFailed(error);
}

export async function markReviewed(admin: Admin, actor: string, requestId: string, reviewerName: string): Promise<void> {
  const { error } = await admin.rpc("pattern_request_mark_reviewed", { p_actor: actor, p_request_id: requestId, p_reviewer_name: reviewerName });
  throwIfPatternFailed(error);
}
