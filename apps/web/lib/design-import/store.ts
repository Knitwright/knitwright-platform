import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { parseArtworkStack, type ArtworkStack } from "@/lib/artwork-stack";
import { parseReport, type ImportReport } from "./report";
import { parseStored } from "./stored";
import type { StoredLandmarks } from "./pipeline";

/**
 * The `design_imports` table. Every read and write names the brand from the session, and every write goes through
 * the server's client (the browser has no write grant). A reading is a proposal until `accept` runs.
 */

export type ImportStatus = "reading" | "ready" | "failed" | "accepted" | "discarded";

const rowSchema = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  source_file_id: z.uuid(),
  status: z.enum(["reading", "ready", "failed", "accepted", "discarded"]),
  report: z.unknown(),
  result_stack: z.unknown(),
  landmarks: z.unknown(),
  error: z.string().nullish(),
  accepted_layers: z.array(z.string()).nullish(),
  accepted_at: z.string().nullish(),
  created_at: z.string(),
});

/** An import as the app reads it: the stored JSON parsed again, so a row that does not parse shows as empty, not as trusted. */
export interface ImportRecord {
  readonly id: string;
  readonly projectId: string;
  readonly sourceFileId: string;
  readonly status: ImportStatus;
  readonly report: ImportReport | null;
  readonly stack: ArtworkStack | null;
  readonly stored: StoredLandmarks | null;
  readonly error: string | null;
  readonly acceptedLayers: readonly string[];
  readonly acceptedAt: string | null;
  readonly createdAt: string;
}

export interface Who {
  readonly brandId: string;
  readonly userId: string;
}

export interface FinishPatch {
  readonly report: ImportReport;
  readonly stack: ArtworkStack | null;
  readonly stored: StoredLandmarks;
  readonly visionCalls: number;
  readonly imageEdits: number;
  readonly costMicrodollars: number;
  readonly error?: string;
}

export interface ImportStore {
  create(who: Who, input: { projectId: string; fileId: string }): Promise<string>;
  finish(who: Who, id: string, patch: FinishPatch): Promise<void>;
  fail(who: Who, id: string, error: string, costMicrodollars: number): Promise<void>;
  get(brandId: string, id: string): Promise<ImportRecord | null>;
  saveRefit(brandId: string, id: string, stored: StoredLandmarks, report: ImportReport): Promise<boolean>;
  accept(who: Who, id: string, layerIds: readonly string[]): Promise<boolean>;
  discard(brandId: string, id: string): Promise<boolean>;
  /** How many readings the brand has started since a time. Failed ones count: they cost. */
  countSince(brandId: string, sinceIso: string): Promise<number>;
}

const failIf = (error: { message: string } | null, what: string): void => {
  if (error) throw new Error(what, { cause: error });
};

function recordFrom(data: unknown): ImportRecord | null {
  const row = rowSchema.safeParse(data);
  if (!row.success) return null;
  const r = row.data;
  const stack = r.result_stack == null ? null : parseArtworkStack(r.result_stack);
  return {
    id: r.id,
    projectId: r.project_id,
    sourceFileId: r.source_file_id,
    status: r.status,
    report: r.report == null ? null : parseReport(r.report),
    stack: stack?.ok ? stack.stack : null,
    stored: r.landmarks == null ? null : parseStored(r.landmarks),
    error: r.error ?? null,
    acceptedLayers: r.accepted_layers ?? [],
    acceptedAt: r.accepted_at ?? null,
    createdAt: r.created_at,
  };
}

/** Writes go through `admin` (the server's client); reads go through `reader`, a member's own client where there is one, so the database's rules decide as well. */
export function createImportStore(admin: SupabaseClient, reader: SupabaseClient = admin): ImportStore {
  const now = (): string => new Date().toISOString();
  return {
    async create(who, input) {
      const { data, error } = await admin
        .from("design_imports")
        .insert({ brand_id: who.brandId, project_id: input.projectId, source_file_id: input.fileId, status: "reading", created_by: who.userId })
        .select("id")
        .single();
      failIf(error, "The reading could not be started.");
      return z.object({ id: z.uuid() }).parse(data).id;
    },
    async finish(who, id, patch) {
      const { error } = await admin
        .from("design_imports")
        .update({
          status: patch.stack === null ? "failed" : "ready",
          report: patch.report,
          result_stack: patch.stack,
          landmarks: patch.stored,
          vision_calls: patch.visionCalls,
          image_edits: patch.imageEdits,
          cost_microdollars: patch.costMicrodollars,
          error: patch.stack === null ? (patch.error ?? "The picture could not be read.") : null,
          updated_at: now(),
        })
        .eq("id", id)
        .eq("brand_id", who.brandId)
        .eq("status", "reading");
      failIf(error, "The reading could not be saved.");
    },
    async fail(who, id, error, costMicrodollars) {
      const result = await admin
        .from("design_imports")
        .update({ status: "failed", error: error.slice(0, 300), cost_microdollars: costMicrodollars, updated_at: now() })
        .eq("id", id)
        .eq("brand_id", who.brandId)
        .eq("status", "reading");
      failIf(result.error, "The reading could not be marked as failed.");
    },
    async get(brandId, id) {
      const { data, error } = await reader.from("design_imports").select("*").eq("id", id).eq("brand_id", brandId).maybeSingle();
      failIf(error, "The reading could not be loaded.");
      return data === null ? null : recordFrom(data);
    },
    async saveRefit(brandId, id, stored, report) {
      const { data, error } = await admin
        .from("design_imports")
        .update({ landmarks: stored, report, updated_at: now() })
        .eq("id", id)
        .eq("brand_id", brandId)
        .eq("status", "ready")
        .select("id");
      failIf(error, "The new fit could not be saved.");
      return (data ?? []).length === 1;
    },
    async accept(who, id, layerIds) {
      const { data, error } = await admin
        .from("design_imports")
        .update({ status: "accepted", accepted_layers: [...layerIds], accepted_by: who.userId, accepted_at: now(), updated_at: now() })
        .eq("id", id)
        .eq("brand_id", who.brandId)
        .eq("status", "ready")
        .select("id");
      failIf(error, "The reading could not be accepted.");
      return (data ?? []).length === 1;
    },
    async countSince(brandId, sinceIso) {
      const { count, error } = await reader
        .from("design_imports")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brandId)
        .gte("created_at", sinceIso);
      failIf(error, "The readings could not be counted.");
      return count ?? 0;
    },
    async discard(brandId, id) {
      const { data, error } = await admin
        .from("design_imports")
        .update({ status: "discarded", updated_at: now() })
        .eq("id", id)
        .eq("brand_id", brandId)
        .in("status", ["ready", "failed"])
        .select("id");
      failIf(error, "The reading could not be discarded.");
      return (data ?? []).length === 1;
    },
  };
}
