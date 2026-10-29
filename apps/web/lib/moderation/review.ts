import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { moderationFailure } from "./errors";
import { IMAGE_HASH } from "./image-hash";
import type { Report } from "./report";
import type { ModerationSettings } from "./settings";
import type { Reason } from "./types";

/**
 * The ops review queue (plan v5 X8, task 5): flagged checks waiting for a person, the takedown notices, the registry, and the
 * repeat-infringer count per brand. Reads run as the signed-in person, so row level security lets only platform admins see
 * rows; writes go through database functions that check the actor again.
 */
type Reader = Pick<SupabaseClient, "from">;
type Admin = Pick<SupabaseClient, "rpc">;

const reasonText = z.string().trim().min(1, "Give a reason.").max(500, "Keep the reason to 500 characters.");

export const reviewSchema = z.object({ checkId: z.uuid(), decision: z.enum(["allowed", "blocked"]), reason: reasonText });
export const noticeDecisionSchema = z
  .object({ noticeId: z.uuid(), status: z.enum(["upheld", "rejected"]), brandId: z.union([z.uuid(), z.literal("")]).default(""), note: reasonText })
  .refine((v) => v.status === "rejected" || v.brandId !== "", { message: "Give the id of the brand the notice is about.", path: ["brandId"] });
export const markSchema = z
  .object({
    holder: z.string().trim().min(1, "Name the owner.").max(200),
    markText: z.string().trim().max(120).default(""),
    imageHash: z.union([z.string().regex(IMAGE_HASH, "An image hash is 32 hex digits."), z.literal("")]).default(""),
    contact: z.string().trim().max(320).default(""),
    source: z.enum(["rights-holder", "ops"]).default("ops"),
  })
  .refine((v) => v.markText.length >= 2 || v.imageHash !== "", { message: "Give the mark's name, at least 2 characters.", path: ["markText"] });
export const markActiveSchema = z.object({ markId: z.uuid(), active: z.enum(["true", "false"]).transform((v) => v === "true") });

export type QueueItem = Readonly<{
  id: string;
  brandId: string;
  targetKind: string;
  targetId: string | null;
  hook: string;
  label: string;
  result: "flagged" | "blocked";
  reasons: readonly Reason[];
  createdAt: string;
}>;

const reasonRow = z.object({ code: z.string(), severity: z.string(), message: z.string(), ruleId: z.string().default("R-GAP-000"), term: z.string().optional() });
const checkRow = z.object({
  id: z.string(), brand_id: z.string(), target_kind: z.string(), target_id: z.string().nullable(), hook: z.string(), label: z.string(),
  result: z.enum(["flagged", "blocked"]), reasons: z.array(reasonRow), created_at: z.string(),
});

/** Flagged and blocked checks nobody has decided yet, oldest first. */
export async function listQueue(client: Reader): Promise<readonly QueueItem[]> {
  const { data, error } = await client
    .from("moderation_checks")
    .select("id, brand_id, target_kind, target_id, hook, label, result, reasons, created_at")
    .is("decision", null)
    .neq("result", "clear")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw moderationFailure(error);
  return (data ?? []).map((row) => {
    const r = checkRow.parse(row);
    return { id: r.id, brandId: r.brand_id, targetKind: r.target_kind, targetId: r.target_id, hook: r.hook, label: r.label, result: r.result, reasons: r.reasons as Reason[], createdAt: r.created_at };
  });
}

export type Notice = Readonly<Report & { id: string; status: "received" | "upheld" | "rejected"; brandId: string | null; strikeNumber: number | null; createdAt: string }>;

const noticeRow = z.object({
  id: z.string(), reporter_name: z.string(), reporter_email: z.string(), holder: z.string(), mark: z.string(), location: z.string(), details: z.string(),
  status: z.enum(["received", "upheld", "rejected"]), brand_id: z.string().nullable(), strike_number: z.number().nullable(), created_at: z.string(),
});

/** Notices, open ones first, then the latest decided. */
export async function listNotices(client: Reader): Promise<readonly Notice[]> {
  const { data, error } = await client
    .from("takedown_notices")
    .select("id, reporter_name, reporter_email, holder, mark, location, details, status, brand_id, strike_number, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw moderationFailure(error);
  const all = (data ?? []).map((row) => {
    const r = noticeRow.parse(row);
    return {
      id: r.id, reporterName: r.reporter_name, reporterEmail: r.reporter_email, holder: r.holder, mark: r.mark, location: r.location, details: r.details,
      status: r.status, brandId: r.brand_id, strikeNumber: r.strike_number, createdAt: r.created_at,
    };
  });
  return [...all.filter((n) => n.status === "received").reverse(), ...all.filter((n) => n.status !== "received")];
}

export type Strikes = Readonly<{ brandId: string; upheld: number; repeatInfringer: boolean }>;

/** Upheld notices per brand, most first, with the repeat-infringer mark at the settings' threshold. */
export function strikesByBrand(notices: readonly Notice[], settings: ModerationSettings): readonly Strikes[] {
  const counts = new Map<string, number>();
  for (const n of notices) if (n.status === "upheld" && n.brandId) counts.set(n.brandId, (counts.get(n.brandId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([brandId, upheld]) => ({ brandId, upheld, repeatInfringer: upheld >= settings.repeatInfringerStrikes }))
    .sort((a, b) => b.upheld - a.upheld || a.brandId.localeCompare(b.brandId));
}

export type MarkRow = Readonly<{ id: string; holder: string; markText: string | null; imageHash: string | null; source: string; active: boolean }>;

const markRowSchema = z.object({ id: z.string(), holder: z.string(), mark_text: z.string().nullable(), image_hash: z.string().nullable(), source: z.string(), active: z.boolean() });

export async function listMarks(client: Reader): Promise<readonly MarkRow[]> {
  const { data, error } = await client.from("rights_holder_marks").select("id, holder, mark_text, image_hash, source, active").order("holder").limit(1000);
  if (error) throw moderationFailure(error);
  return (data ?? []).map((row) => {
    const r = markRowSchema.parse(row);
    return { id: r.id, holder: r.holder, markText: r.mark_text, imageHash: r.image_hash, source: r.source, active: r.active };
  });
}

const call = async (admin: Admin, fn: string, args: Record<string, unknown>): Promise<unknown> => {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw moderationFailure(error);
  return data;
};

export const reviewCheck = (admin: Admin, actor: string, input: z.output<typeof reviewSchema>) =>
  call(admin, "moderation_review", { p_actor: actor, p_check_id: input.checkId, p_decision: input.decision, p_reason: input.reason });

export const decideNotice = async (admin: Admin, actor: string, input: z.output<typeof noticeDecisionSchema>): Promise<number | null> => {
  const strike = await call(admin, "takedown_decide", {
    p_actor: actor, p_notice_id: input.noticeId, p_status: input.status, p_brand_id: input.status === "upheld" ? input.brandId : null, p_note: input.note,
  });
  return typeof strike === "number" ? strike : null;
};

export const addMark = async (admin: Admin, actor: string, input: z.output<typeof markSchema>): Promise<string> =>
  z.string().parse(
    await call(admin, "rights_mark_add", { p_actor: actor, p_holder: input.holder, p_mark_text: input.markText, p_image_hash: input.imageHash, p_contact: input.contact, p_source: input.source }),
  );

export const setMarkActive = (admin: Admin, actor: string, input: z.output<typeof markActiveSchema>) =>
  call(admin, "rights_mark_set_active", { p_actor: actor, p_mark_id: input.markId, p_active: input.active });

export const saveReport = async (admin: Admin, report: Report): Promise<string> =>
  z.string().parse(
    await call(admin, "takedown_submit", {
      p_reporter_name: report.reporterName, p_reporter_email: report.reporterEmail, p_holder: report.holder, p_mark: report.mark, p_location: report.location, p_details: report.details,
    }),
  );
