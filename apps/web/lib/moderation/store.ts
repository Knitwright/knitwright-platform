import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { moderationFailure } from "./errors";
import type { Hook, Mark, ModerationResult, TargetKind, Verdict } from "./types";

/**
 * Where the screens read the registry and keep their results. An interface so every screen is tested with the in-memory double
 * (`fixtures/memory-store.ts`); `createSupabaseStore` is the database one, through the server's own key.
 */
export type NewCheck = Readonly<{
  brandId: string;
  userId: string | null;
  targetKind: TargetKind;
  targetId: string | null;
  hook: Hook;
  label: string;
  subjectSha256: string | null;
  verdict: Verdict;
}>;

export type TargetState = Readonly<{ targetId: string; result: ModerationResult; decision: "allowed" | "blocked" | null }>;

export interface ModerationStore {
  marks(): Promise<readonly Mark[]>;
  record(check: NewCheck): Promise<string>;
  /** The latest check of each target that has one. */
  latest(kind: TargetKind, ids: readonly string[]): Promise<readonly TargetState[]>;
  /** A person allowed the target and nothing about it was flagged or blocked since. */
  humanAllowed(kind: TargetKind, id: string): Promise<boolean>;
}

type Admin = Pick<SupabaseClient, "rpc" | "from">;

const markRow = z.object({ id: z.string(), holder: z.string(), mark_text: z.string().nullable(), image_hash: z.string().nullable() });
const stateRow = z.object({
  target_id: z.string(),
  seq: z.union([z.number(), z.string()]),
  result: z.enum(["clear", "flagged", "blocked"]),
  decision: z.enum(["allowed", "blocked"]).nullable(),
});

export function createSupabaseStore(admin: Admin): ModerationStore {
  return {
    async marks() {
      const { data, error } = await admin.from("rights_holder_marks").select("id, holder, mark_text, image_hash").eq("active", true).limit(5000);
      if (error) throw moderationFailure(error);
      return (data ?? []).map((row) => {
        const r = markRow.parse(row);
        return { id: r.id, holder: r.holder, markText: r.mark_text, imageHash: r.image_hash };
      });
    },
    async record(check) {
      const { data, error } = await admin.rpc("moderation_record", {
        p_brand_id: check.brandId,
        p_user_id: check.userId,
        p_target_kind: check.targetKind,
        p_target_id: check.targetId,
        p_hook: check.hook,
        p_label: check.label.slice(0, 500),
        p_subject_sha256: check.subjectSha256,
        p_result: check.verdict.result,
        p_reasons: check.verdict.reasons.slice(0, 20),
      });
      if (error) throw moderationFailure(error);
      return z.string().parse(data);
    },
    async latest(kind, ids) {
      if (ids.length === 0) return [];
      const { data, error } = await admin
        .from("moderation_checks")
        .select("target_id, seq, result, decision")
        .eq("target_kind", kind)
        .in("target_id", [...ids])
        .order("seq", { ascending: false })
        .limit(1000);
      if (error) throw moderationFailure(error);
      const seen = new Map<string, TargetState>();
      for (const row of (data ?? []).map((r) => stateRow.parse(r))) {
        if (!seen.has(row.target_id)) seen.set(row.target_id, { targetId: row.target_id, result: row.result, decision: row.decision });
      }
      return [...seen.values()];
    },
    async humanAllowed(kind, id) {
      const { data, error } = await admin.rpc("moderation_human_allowed", { p_target_kind: kind, p_target_id: id });
      if (error) throw moderationFailure(error);
      return data === true;
    },
  };
}
