import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SHARE_ACCESS, type LinkAudience, type ShareAccess, type ShareInvite } from "./invite-fields";
import { shareFailure } from "./service";
import { newShareToken } from "./token";

/**
 * Share invites in the database (plan v5 Y8, decision 0081). Every write goes through the invite
 * functions, which only the server's own key may run and which check the member's brand
 * themselves. A member's list is read through their own client, so the database's rules decide
 * what they see. The brand always comes from the session.
 */

const INVITE_NOT_FOUND = "That invite does not exist.";
const DESIGN_NOT_FOUND = "That design does not exist.";
const LINK_NOT_FOUND = "That link does not exist.";

/** The most invites listed for one design. The database holds the same number open at once. */
const INVITES_LISTED = 50;

const throwIf = (error: Parameters<typeof shareFailure>[0] | null, notFound: string): void => {
  if (error) throw shareFailure(error, notFound);
};

const createdRow = z.object({ id: z.uuid(), expires_at: z.string(), replaced: z.boolean() });

export interface NewShareInvite {
  readonly id: string;
  readonly expiresAt: string;
  /** True when the address already had an open invite, which took the new access and a new token. */
  readonly replaced: boolean;
  /** Shown to the member once. Only its hash is stored, so it cannot be shown again. */
  readonly token: string;
}

export async function createShareInvite(
  admin: SupabaseClient,
  input: Readonly<{ projectId: string; userId: string; email: string; access: ShareAccess; message: string; days: number }>,
): Promise<NewShareInvite> {
  const token = newShareToken();
  const { data, error } = await admin.rpc("create_share_invite", {
    p_project_id: input.projectId,
    p_user_id: input.userId,
    p_email: input.email,
    p_access: input.access,
    p_message: input.message,
    p_token: token,
    p_days: input.days,
  });
  throwIf(error, DESIGN_NOT_FOUND);
  const row = createdRow.parse(Array.isArray(data) ? data[0] : data);
  return { id: row.id, expiresAt: row.expires_at, replaced: row.replaced, token };
}

export async function revokeShareInvite(admin: SupabaseClient, input: Readonly<{ inviteId: string; userId: string }>): Promise<void> {
  const { error } = await admin.rpc("revoke_share_invite", { p_invite_id: input.inviteId, p_user_id: input.userId });
  throwIf(error, INVITE_NOT_FOUND);
}

/** Records that an email really went out. Called only after a provider took the message. */
export async function markShareInviteEmailed(admin: SupabaseClient, input: Readonly<{ inviteId: string; userId: string }>): Promise<void> {
  const { error } = await admin.rpc("share_invite_emailed", { p_invite_id: input.inviteId, p_user_id: input.userId });
  throwIf(error, INVITE_NOT_FOUND);
}

/** Sets who may open the design through one of its links. Returns what it now is. */
export async function setShareLinkAudience(
  admin: SupabaseClient,
  input: Readonly<{ linkId: string; userId: string; audience: LinkAudience }>,
): Promise<LinkAudience> {
  const { data, error } = await admin.rpc("set_share_link_audience", {
    p_link_id: input.linkId,
    p_user_id: input.userId,
    p_audience: input.audience,
  });
  throwIf(error, LINK_NOT_FOUND);
  return z.enum(["invited", "anyone"]).parse(data);
}

const inviteRow = z.object({
  id: z.uuid(),
  email: z.string(),
  access: z.enum(SHARE_ACCESS),
  message: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
  email_sent_at: z.string().nullable(),
  accepted_at: z.string().nullable(),
});

/** A design's invites, newest first, read as the member so the database decides what they see. */
export async function listShareInvites(client: SupabaseClient, brandId: string, projectId: string): Promise<readonly ShareInvite[]> {
  const { data, error } = await client
    .from("share_invites")
    .select("id, email, access, message, created_at, expires_at, revoked_at, email_sent_at, accepted_at")
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(INVITES_LISTED);
  throwIf(error, DESIGN_NOT_FOUND);
  return z
    .array(inviteRow)
    .parse(data ?? [])
    .map((row) => ({
      id: row.id,
      email: row.email,
      access: row.access,
      message: row.message,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      emailSentAt: row.email_sent_at,
      acceptedAt: row.accepted_at,
    }));
}
