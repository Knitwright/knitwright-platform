import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { ShareAnswer, ShareLink } from "./responses";
import type { ShareVote } from "./schemas";
import { isShareToken, newShareToken } from "./token";

/**
 * Share links and their answers in the database. Writes, and every read made with a token, go
 * through the share functions, which only the server's own key may run and which check the
 * member's brand or the token themselves. A member's list is read through their own client, so the
 * database's rules decide what they see. The brand always comes from the session or the token.
 */

export const LINK_NOT_FOUND = "That link does not exist.";
const DESIGN_NOT_FOUND = "That design does not exist.";

/** The most links listed for one design, and the most answers read for them. */
const LINKS_LISTED = 50;
const ANSWERS_LISTED = 1000;

type DatabaseError = Readonly<{ code?: string; hint?: string | null; message: string }> | null;

const CONFLICTS: Readonly<Record<string, string>> = {
  too_many_links: "This design has 20 links that still work. Revoke one first.",
  too_many_answers: "This link has taken as many answers as it can.",
  link_closed: "That link no longer works. Make a new one.",
};

/** What the share functions raise, as a failure the user may read. Unknown faults say nothing more. */
export const shareFailure = (error: NonNullable<DatabaseError>, notFound: string): AppError => {
  const conflict = error.hint ? CONFLICTS[error.hint] : undefined;
  if (conflict) return new AppError("conflict", conflict);
  switch (error.code) {
    case "P0002":
    case "22P02":
      return new AppError("not_found", notFound);
    case "22023":
    case "23514":
      return new AppError("invalid_input", MESSAGES.invalid_input);
    default:
      return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
  }
};

const throwIf = (error: DatabaseError, notFound: string): void => {
  if (error) throw shareFailure(error, notFound);
};

interface NewShareLink {
  readonly id: string;
  readonly version: number;
  readonly expiresAt: string;
  /** Shown to the member once. Only its hash is stored. */
  readonly token: string;
}

const createdRow = z.object({ id: z.uuid(), version: z.number().int(), expires_at: z.string() });

export async function createShareLink(
  admin: SupabaseClient,
  input: Readonly<{ projectId: string; userId: string; days: number }>,
): Promise<NewShareLink> {
  const token = newShareToken();
  const { data, error } = await admin.rpc("create_share_link", {
    p_project_id: input.projectId,
    p_user_id: input.userId,
    p_token: token,
    p_days: input.days,
  });
  throwIf(error, DESIGN_NOT_FOUND);
  const row = createdRow.parse(Array.isArray(data) ? data[0] : data);
  return { id: row.id, version: row.version, expiresAt: row.expires_at, token };
}

export async function revokeShareLink(admin: SupabaseClient, input: Readonly<{ linkId: string; userId: string }>): Promise<void> {
  const { error } = await admin.rpc("revoke_share_link", { p_link_id: input.linkId, p_user_id: input.userId });
  throwIf(error, LINK_NOT_FOUND);
}

/** Moves an open link to the design's newest version. Returns the version it now shows. */
export async function moveShareLink(admin: SupabaseClient, input: Readonly<{ linkId: string; userId: string }>): Promise<number> {
  const { data, error } = await admin.rpc("move_share_link", { p_link_id: input.linkId, p_user_id: input.userId });
  throwIf(error, LINK_NOT_FOUND);
  return z.number().int().parse(data);
}

const linkRow = z.object({
  id: z.uuid(),
  version: z.number().int(),
  created_at: z.string(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
});

const answerRow = z.object({
  link_id: z.uuid(),
  name: z.string(),
  vote: z.enum(["yes", "not_yet"]).nullable(),
  comment: z.string().nullable(),
  updated_at: z.string(),
});

interface ShareLinksOfDesign {
  readonly links: readonly ShareLink[];
  readonly answers: readonly ShareAnswer[];
}

/** A design's links, newest first, and the answers left through them, read as the member. */
export async function listShareLinks(client: SupabaseClient, brandId: string, projectId: string): Promise<ShareLinksOfDesign> {
  const links = await client
    .from("share_links")
    .select("id, version, created_at, expires_at, revoked_at")
    .eq("brand_id", brandId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(LINKS_LISTED);
  throwIf(links.error, DESIGN_NOT_FOUND);
  const parsedLinks = z.array(linkRow).parse(links.data ?? []);
  if (parsedLinks.length === 0) return { links: [], answers: [] };

  const answers = await client
    .from("share_responses")
    .select("link_id, name, vote, comment, updated_at")
    .eq("brand_id", brandId)
    .in(
      "link_id",
      parsedLinks.map((link) => link.id),
    )
    .order("updated_at", { ascending: false })
    .limit(ANSWERS_LISTED);
  throwIf(answers.error, DESIGN_NOT_FOUND);

  return {
    links: parsedLinks.map((row) => ({
      id: row.id,
      version: row.version,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
    })),
    answers: z
      .array(answerRow)
      .parse(answers.data ?? [])
      .map((row) => ({ linkId: row.link_id, name: row.name, vote: row.vote, comment: row.comment, updatedAt: row.updated_at })),
  };
}

/** What the server reads to draw a share page. The brand id and the stored design never reach the visitor. */
export interface OpenShare {
  readonly linkId: string;
  readonly brandId: string;
  readonly brandName: string;
  readonly projectName: string;
  readonly version: number;
  readonly isCurrent: boolean;
  readonly spec: unknown;
  readonly savedAt: string;
  readonly expiresAt: string;
}

const openRow = z.object({
  link_id: z.uuid(),
  brand_id: z.uuid(),
  brand_name: z.string(),
  project_name: z.string(),
  version: z.number().int(),
  is_current: z.boolean(),
  spec: z.unknown(),
  saved_at: z.string(),
  expires_at: z.string(),
});

/**
 * The link a token opens, or null for a token that is malformed, unknown, expired or revoked. The
 * last three take the same path through the database and give the same answer.
 */
export async function openShare(admin: SupabaseClient, token: string): Promise<OpenShare | null> {
  if (!isShareToken(token)) return null;
  const { data, error } = await admin.rpc("open_share", { p_token: token });
  throwIf(error, LINK_NOT_FOUND);
  const rows = z.array(openRow).parse(data ?? []);
  const row = rows[0];
  if (!row) return null;
  return {
    linkId: row.link_id,
    brandId: row.brand_id,
    brandName: row.brand_name,
    projectName: row.project_name,
    version: row.version,
    isCurrent: row.is_current,
    spec: row.spec,
    savedAt: row.saved_at,
    expiresAt: row.expires_at,
  };
}

export interface ShareAnswerInput {
  readonly token: string;
  readonly visitorKey: string;
  readonly name: string;
  readonly vote: ShareVote | null;
  readonly comment: string | null;
}

/** Keeps a visitor's answer, replacing what the same browser said before through the same link. */
export async function respondToShare(admin: SupabaseClient, input: ShareAnswerInput): Promise<void> {
  const { error } = await admin.rpc("share_respond", {
    p_token: input.token,
    p_visitor_key: input.visitorKey,
    p_name: input.name,
    p_vote: input.vote,
    p_comment: input.comment,
  });
  throwIf(error, LINK_NOT_FOUND);
}
