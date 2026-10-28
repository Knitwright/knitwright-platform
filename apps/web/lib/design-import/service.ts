import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { deleteArtwork } from "@/lib/artwork-intake";
import { MM_LIMIT, parseArtworkStack, roundMm, type ArtworkStack, type AssetReader, type Layer } from "@/lib/artwork-stack";
import { AppError } from "@/lib/server/core/errors";
import { log } from "@/lib/server/log";
import { derivedAssetOf, derivedIds } from "./derived";
import type { ImportOutcome, Overlay } from "./pipeline";
import { readingSchema } from "./read";
import type { ImportReport } from "./report";

/**
 * Design imports in the database. Reads for a person go through their own client, so the database's rules decide
 * what they see. Every write goes through the server's client and the brand always comes from the session. Nothing
 * is the person's design until `acceptImport`: before it `accepted_stack` is null.
 */

export const DAILY_BRAND_CAP = 10;
export const DAY_MS = 24 * 60 * 60 * 1000;

export const OVER_DAILY_CAP = `Your brand has read ${DAILY_BRAND_CAP} pictures in the last day, which is the most for now. Try again tomorrow.`;
export const IMPORT_NOT_FOUND = "That reading could not be found.";
export const ALREADY_SETTLED = "That reading has already been accepted or discarded.";
export const CHOOSE_A_LAYER = "Choose at least one layer to accept, or discard the reading.";
export const NOT_A_LAYER = "One of the layers you chose is not in this reading.";
export const NOT_REPLACEABLE = "That layer was not redrawn from your picture, so there is nothing to replace.";
export const NO_SUCH_ARTWORK = "That artwork could not be found in your brand's files.";
export const REPLACED_NOTE = "Replaced with your own file.";

type Who = Readonly<{ brandId: string; userId: string }>;
type Ready = Extract<ImportOutcome, { ok: true }>;

const failIf = (error: { message: string } | null, what: string): void => {
  if (error) throw new Error(what, { cause: error });
};

const rowSchema = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  source_file_id: z.uuid(),
  status: z.enum(["ready", "accepted", "discarded"]),
  reading: z.unknown(),
  report: z.unknown(),
  overlay: z.unknown(),
  result: z.unknown(),
  accepted_stack: z.unknown().nullable(),
  accepted_layer_ids: z.array(z.string()).nullable(),
  accepted_at: z.string().nullable(),
  generated_pixels: z.boolean(),
  created_at: z.string(),
});

export interface StoredImport {
  readonly id: string;
  readonly sourceFileId: string;
  readonly status: "ready" | "accepted" | "discarded";
  readonly reading: ReturnType<typeof readingSchema.parse>;
  readonly report: ImportReport;
  readonly overlay: Overlay;
  readonly stack: ArtworkStack;
  readonly acceptedStack: ArtworkStack | null;
  readonly acceptedLayerIds: readonly string[] | null;
  readonly acceptedAt: string | null;
  readonly generatedPixels: boolean;
  readonly createdAt: string;
}

function fromRow(data: unknown): StoredImport {
  const row = rowSchema.safeParse(data);
  const stack = row.success ? parseArtworkStack(row.data.result) : null;
  const reading = row.success ? readingSchema.safeParse(row.data.reading) : null;
  if (!row.success || !stack?.ok || !reading?.success) throw new Error("The database gave an unexpected answer for a design import.");
  const accepted = row.data.accepted_stack === null ? null : parseArtworkStack(row.data.accepted_stack);
  return {
    id: row.data.id,
    sourceFileId: row.data.source_file_id,
    status: row.data.status,
    reading: reading.data,
    report: row.data.report as ImportReport,
    overlay: row.data.overlay as Overlay,
    stack: stack.stack,
    acceptedStack: accepted?.ok ? accepted.stack : null,
    acceptedLayerIds: row.data.accepted_layer_ids,
    acceptedAt: row.data.accepted_at,
    generatedPixels: row.data.generated_pixels,
    createdAt: row.data.created_at,
  };
}

/** Refuses another import when the brand has already read the day's allowance of pictures. Counts failed-to-save attempts too only if they were saved. */
export async function assertUnderDailyCap(client: SupabaseClient, brandId: string, now: Date = new Date()): Promise<void> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const { data, error } = await client.from("design_imports").select("id").eq("brand_id", brandId).gte("created_at", since);
  failIf(error, "The design imports could not be counted.");
  if ((data ?? []).length >= DAILY_BRAND_CAP) throw new AppError("rate_limited", OVER_DAILY_CAP);
}

export interface NewImport {
  readonly sourceFileId: string;
  readonly rightsAcceptedAt: Date;
  readonly outcome: Ready;
  readonly costMicrodollars: number;
}

export async function createImport(admin: SupabaseClient, who: Who, input: NewImport): Promise<string> {
  const { outcome } = input;
  const { data, error } = await admin
    .from("design_imports")
    .insert({
      brand_id: who.brandId,
      source_file_id: input.sourceFileId,
      rights_accepted_at: input.rightsAcceptedAt.toISOString(),
      reading: outcome.reading,
      report: outcome.report,
      overlay: outcome.overlay,
      result: outcome.stack,
      vision_calls: outcome.report.spend.visionCalls,
      image_edits: outcome.report.spend.imageEdits,
      cost_microdollars: input.costMicrodollars,
      generated_pixels: outcome.report.generatedPixels,
      created_by: who.userId,
    })
    .select("id")
    .single();
  failIf(error, "The design import could not be saved.");
  return z.object({ id: z.uuid() }).parse(data).id;
}

export async function getImport(client: SupabaseClient, brandId: string, importId: string): Promise<StoredImport> {
  const { data, error } = await client.from("design_imports").select("*").eq("id", importId).eq("brand_id", brandId).maybeSingle();
  failIf(error, "The design import could not be read.");
  if (data === null) throw new AppError("not_found", IMPORT_NOT_FOUND);
  return fromRow(data);
}

export interface ImportSummary {
  readonly id: string;
  readonly status: StoredImport["status"];
  readonly createdAt: string;
  readonly confidence: number;
}

export async function listImports(client: SupabaseClient, brandId: string): Promise<readonly ImportSummary[]> {
  const { data, error } = await client.from("design_imports").select("*").eq("brand_id", brandId).order("created_at", { ascending: false });
  failIf(error, "The design imports could not be read.");
  return (data ?? []).map((row: unknown) => {
    const stored = fromRow(row);
    return { id: stored.id, status: stored.status, createdAt: stored.createdAt, confidence: stored.report.confidence };
  });
}

/** Replaces a ready proposal with a redone fit. A settled import is not changed. */
export async function replaceProposal(admin: SupabaseClient, who: Who, importId: string, outcome: Ready): Promise<void> {
  const current = await getImport(admin, who.brandId, importId);
  if (current.status !== "ready") throw new AppError("conflict", ALREADY_SETTLED);
  const { error } = await admin
    .from("design_imports")
    .update({ report: outcome.report, overlay: outcome.overlay, result: outcome.stack, updated_at: new Date().toISOString() })
    .eq("id", importId)
    .eq("brand_id", who.brandId)
    .eq("status", "ready");
  failIf(error, "The design import could not be updated.");
}

export const BOTH_CHOSEN = "Choose the pattern from our list or its repeating picture, not both.";
const isAlternative = (id: string): boolean => id.endsWith("-alt");

/**
 * The stack with only the chosen layers. Colours stay, so the ones the chosen layers use are all there. A repeating
 * picture kept as the alternative to a pattern is not drawn (opacity 0) until it is chosen, and then it is drawn; with
 * "all" the alternatives are left out, because the pattern they stand for is in.
 */
export function chooseLayers(stack: ArtworkStack, layerIds: readonly string[] | "all"): ArtworkStack {
  const wanted = layerIds === "all" ? stack.layers.filter((layer) => !isAlternative(layer.id)).map((layer) => layer.id) : layerIds;
  if (wanted.length === 0) throw new AppError("invalid_input", CHOOSE_A_LAYER);
  if (wanted.some((id) => !stack.layers.some((layer) => layer.id === id))) throw new AppError("invalid_input", NOT_A_LAYER);
  if (wanted.some((id) => isAlternative(id) && wanted.includes(id.slice(0, -"-alt".length)))) throw new AppError("invalid_input", BOTH_CHOSEN);
  const layers = stack.layers.filter((layer) => wanted.includes(layer.id)).map((layer) => (isAlternative(layer.id) ? { ...layer, opacity: 1 } : layer));
  const chosen = parseArtworkStack({ ...stack, layers });
  if (!chosen.ok) throw new AppError("invalid_input", chosen.reason);
  return chosen.stack;
}

/** Layers that need the person's own file: a crest or sponsor redrawn from the picture and not yet replaced. */
export const needsOwnFile = (stack: ArtworkStack): readonly string[] =>
  stack.layers.flatMap((layer) => (layer.kind === "graphic" && layer.provenance === "read-from-image" ? [layer.id] : []));

/** Removes the pictures cut for layers that are not kept. A picture that cannot be removed is left in the person's artwork, where they can delete it. */
async function forget(admin: SupabaseClient, brandId: string, layers: readonly Layer[]): Promise<void> {
  await Promise.all(derivedIds(layers).map((id) => deleteArtwork(admin, brandId, id).catch(
    (error: unknown) => log({ level: "warn", message: `A cut picture could not be removed: ${id}`, where: "design import cleanup", error }),
  )));
}

export async function acceptImport(admin: SupabaseClient, who: Who, importId: string, layerIds: readonly string[] | "all", now: Date = new Date()): Promise<{ stack: ArtworkStack; needsOwnFile: readonly string[] }> {
  const current = await getImport(admin, who.brandId, importId);
  if (current.status !== "ready") throw new AppError("conflict", ALREADY_SETTLED);
  const stack = chooseLayers(current.stack, layerIds);
  const { error } = await admin
    .from("design_imports")
    .update({
      status: "accepted",
      accepted_stack: stack,
      accepted_layer_ids: stack.layers.map((layer) => layer.id),
      accepted_by: who.userId,
      accepted_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", importId)
    .eq("brand_id", who.brandId)
    .eq("status", "ready");
  failIf(error, "The design import could not be accepted.");
  await forget(admin, who.brandId, current.stack.layers.filter((layer) => !stack.layers.some((kept) => kept.id === layer.id)));
  return { stack, needsOwnFile: needsOwnFile(stack) };
}

export async function discardImport(admin: SupabaseClient, who: Who, importId: string): Promise<void> {
  const current = await getImport(admin, who.brandId, importId);
  if (current.status !== "ready") throw new AppError("conflict", ALREADY_SETTLED);
  const { error } = await admin.from("design_imports").update({ status: "discarded", updated_at: new Date().toISOString() }).eq("id", importId).eq("brand_id", who.brandId).eq("status", "ready");
  failIf(error, "The design import could not be discarded.");
  await forget(admin, who.brandId, current.stack.layers);
}

/**
 * Points a crest, sponsor or badge redrawn from the picture at the person's own artwork (W7b intake has already taken
 * it in, with the rights statement). Only artwork of this brand can be named: the reader answers for one brand. The
 * layer keeps its width and place and takes the file's own proportions; the crop made here is removed.
 */
export async function replaceGraphic(admin: SupabaseClient, who: Who, importId: string, layerId: string, artworkId: string, reader: AssetReader): Promise<void> {
  const current = await getImport(admin, who.brandId, importId);
  if (current.status !== "ready") throw new AppError("conflict", ALREADY_SETTLED);
  const layer = current.stack.layers.find((entry) => entry.id === layerId);
  if (layer?.kind !== "graphic" || layer.provenance !== "read-from-image") throw new AppError("invalid_input", NOT_REPLACEABLE);
  const asset = await reader.getAsset(artworkId);
  if (asset === null) throw new AppError("not_found", NO_SUCH_ARTWORK);
  const heightMm = Math.min(MM_LIMIT, Math.max(0.01, roundMm((layer.widthMm * asset.heightPx) / asset.widthPx)));
  const replaced = { ...layer, source: { kind: "asset" as const, assetId: artworkId }, heightMm, provenance: "user-edited" as const };
  const stack = parseArtworkStack({ ...current.stack, layers: current.stack.layers.map((entry) => (entry.id === layerId ? replaced : entry)) });
  if (!stack.ok) throw new AppError("invalid_input", stack.reason);
  const report = { ...current.report, items: current.report.items.map((item) => (item.layerId === layerId ? { ...item, confidence: 1, note: REPLACED_NOTE } : item)) };
  const { error } = await admin.from("design_imports").update({ report, result: stack.stack, updated_at: new Date().toISOString() }).eq("id", importId).eq("brand_id", who.brandId).eq("status", "ready");
  failIf(error, "The design import could not be updated.");
  const crop = derivedAssetOf(layer);
  if (crop !== null) await deleteArtwork(admin, who.brandId, crop).catch(
    (error: unknown) => log({ level: "warn", message: `A cut picture could not be removed: ${crop}`, where: "design import cleanup", error }),
  );
}
