import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { productionFailure, throwIfFailed } from "@/lib/orders/errors";
import { SIGN_OFF_ROLES, STRIKE_OFF_STATUSES, type ColourNote, type SignOff, type StrikeOff } from "./types";

/**
 * Strike-offs and sign-offs in the database. Reads go through the member's own client. Every write
 * goes through the server's client and a function that checks the user belongs to the brand and
 * refuses any change to a record that has been decided.
 */

const RELEASE_NOT_FOUND = "That release does not exist.";
const STRIKE_OFF_NOT_FOUND = "That strike-off does not exist.";

const strikeOffRow = z.object({
  id: z.uuid(),
  release_id: z.uuid(),
  status: z.enum(STRIKE_OFF_STATUSES),
  requested_note: z.string(),
  requested_at: z.string(),
  received_at: z.string().nullable(),
  shrink_length_pct: z.number().nullable(),
  shrink_width_pct: z.number().nullable(),
  colour_notes: z.array(z.object({ colour: z.string(), note: z.string() })),
  photo_file_ids: z.array(z.uuid()),
  decided_by_name: z.string().nullable(),
  decided_role: z.string().nullable(),
  decided_on: z.string().nullable(),
  decision_note: z.string(),
});

const STRIKE_OFF_COLUMNS =
  "id, release_id, status, requested_note, requested_at, received_at, shrink_length_pct, shrink_width_pct, colour_notes, photo_file_ids, decided_by_name, decided_role, decided_on, decision_note";

const strikeOffOf = (r: z.output<typeof strikeOffRow>): StrikeOff => ({
  id: r.id,
  releaseId: r.release_id,
  status: r.status,
  requestedNote: r.requested_note,
  requestedAt: r.requested_at,
  receivedAt: r.received_at,
  shrinkLengthPct: r.shrink_length_pct,
  shrinkWidthPct: r.shrink_width_pct,
  colourNotes: r.colour_notes,
  photoFileIds: r.photo_file_ids,
  decidedByName: r.decided_by_name,
  decidedRole: r.decided_role,
  decidedOn: r.decided_on,
  decisionNote: r.decision_note,
});

/** Every strike-off of a design, newest first, so a page can show them against their releases. */
export async function listStrikeOffs(client: SupabaseClient, brandId: string, projectId: string): Promise<readonly StrikeOff[]> {
  const { data, error } = await client
    .from("strike_offs")
    .select(STRIKE_OFF_COLUMNS)
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("requested_at", { ascending: false })
    .limit(400);
  throwIfFailed(error, RELEASE_NOT_FOUND);
  return z.array(strikeOffRow).parse(data ?? []).map(strikeOffOf);
}

const signOffRow = z.object({
  id: z.uuid(),
  release_id: z.uuid(),
  role: z.enum(SIGN_OFF_ROLES),
  signer_name: z.string(),
  signed_on: z.string(),
  note: z.string(),
  created_at: z.string(),
});

export async function listSignOffs(client: SupabaseClient, brandId: string, projectId: string): Promise<readonly SignOff[]> {
  const { data, error } = await client
    .from("sign_offs")
    .select("id, release_id, role, signer_name, signed_on, note, created_at")
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(800);
  throwIfFailed(error, RELEASE_NOT_FOUND);
  return z
    .array(signOffRow)
    .parse(data ?? [])
    .map((r) => ({ id: r.id, releaseId: r.release_id, role: r.role, signerName: r.signer_name, signedOn: r.signed_on, note: r.note, createdAt: r.created_at }));
}

type Who = Readonly<{ brandId: string; userId: string }>;

const idOf = (data: unknown): string => z.uuid().parse(data);

export async function requestStrikeOff(admin: SupabaseClient, who: Who, input: Readonly<{ releaseId: string; note: string }>): Promise<string> {
  const { data, error } = await admin.rpc("request_strike_off", { p_release_id: input.releaseId, p_brand_id: who.brandId, p_user_id: who.userId, p_note: input.note });
  if (error) throw productionFailure(error, RELEASE_NOT_FOUND);
  return idOf(data);
}

type Receipt = Readonly<{
  strikeOffId: string;
  shrinkLengthPct: number | null;
  shrinkWidthPct: number | null;
  colourNotes: readonly ColourNote[];
  photoFileIds: readonly string[];
}>;

export async function receiveStrikeOff(admin: SupabaseClient, who: Who, receipt: Receipt): Promise<void> {
  const { error } = await admin.rpc("receive_strike_off", {
    p_strike_off_id: receipt.strikeOffId,
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_shrink_length: receipt.shrinkLengthPct,
    p_shrink_width: receipt.shrinkWidthPct,
    p_colour_notes: receipt.colourNotes,
    p_photo_file_ids: receipt.photoFileIds,
  });
  if (error) throw productionFailure(error, STRIKE_OFF_NOT_FOUND);
}

export type Decision = Readonly<{ strikeOffId: string; accept: boolean; name: string; role: string; on: string; note: string }>;

export async function decideStrikeOff(admin: SupabaseClient, who: Who, decision: Decision): Promise<void> {
  const { error } = await admin.rpc("decide_strike_off", {
    p_strike_off_id: decision.strikeOffId,
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_accept: decision.accept,
    p_name: decision.name,
    p_role: decision.role,
    p_on: decision.on,
    p_note: decision.note,
  });
  if (error) throw productionFailure(error, STRIKE_OFF_NOT_FOUND);
}

type NewSignOff = Readonly<{ releaseId: string; role: SignOff["role"]; name: string; signedOn: string; note: string }>;

export async function addSignOff(admin: SupabaseClient, who: Who, signOff: NewSignOff): Promise<string> {
  const { data, error } = await admin.rpc("add_sign_off", {
    p_release_id: signOff.releaseId,
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_role: signOff.role,
    p_signer_name: signOff.name,
    p_signed_on: signOff.signedOn,
    p_note: signOff.note,
  });
  if (error) throw productionFailure(error, RELEASE_NOT_FOUND);
  return idOf(data);
}
