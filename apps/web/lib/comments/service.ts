import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { listMembers, type Who } from "@/lib/clubs/service";
import { AppError } from "@/lib/server/core/errors";
import { COMMENT_NOT_FOUND, DESIGN_NOT_FOUND, throwIfFailed } from "./errors";
import type { MemberView, Viewer } from "./answers";
import type { CreateBody, EditBody } from "./schemas";
import type { CommentView } from "./thread";

/**
 * Comments in the database. Reads go through the member's own client, so row level security decides
 * what they see; writes go through the server's client and the comment functions, which check the
 * brand, the role and the author again. The brand and the person always come from the session.
 */

const FORMER_MEMBER = "A former member";

const row = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  version: z.number().int(),
  panel_id: z.string().nullable(),
  x_mm: z.number().nullable(),
  y_mm: z.number().nullable(),
  body: z.string(),
  author_id: z.uuid().nullable(),
  created_at: z.string(),
  edited_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  design_comment_mentions: z.array(z.object({ user_id: z.uuid() })),
});

interface CommentList {
  readonly comments: readonly CommentView[];
  readonly members: readonly MemberView[];
  readonly viewer: Viewer;
}

export async function listComments(client: SupabaseClient, who: Who & { role: Viewer["role"] }, projectId: string): Promise<CommentList> {
  const project = await client.from("projects").select("id").eq("id", projectId).eq("brand_id", who.brandId).maybeSingle();
  throwIfFailed(project.error, DESIGN_NOT_FOUND);
  if (!project.data) throw new AppError("not_found", DESIGN_NOT_FOUND);
  const [found, members] = await Promise.all([
    client
      .from("design_comments")
      .select("id, parent_id, version, panel_id, x_mm, y_mm, body, author_id, created_at, edited_at, deleted_at, resolved_at, design_comment_mentions(user_id)")
      .eq("brand_id", who.brandId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(700),
    listMembers(client, who.brandId),
  ]);
  throwIfFailed(found.error, DESIGN_NOT_FOUND);
  const names = new Map(members.map((m) => [m.userId, m.name]));
  const comments = z.array(row).parse(found.data ?? []).map(
    (r): CommentView => ({
      id: r.id,
      parentId: r.parent_id,
      version: r.version,
      panelId: r.panel_id,
      xMm: r.x_mm,
      yMm: r.y_mm,
      body: r.body,
      authorId: r.author_id,
      authorName: (r.author_id && names.get(r.author_id)) || FORMER_MEMBER,
      createdAt: r.created_at,
      editedAt: r.edited_at,
      deletedAt: r.deleted_at,
      resolvedAt: r.resolved_at,
      mentions: r.design_comment_mentions.map((m) => m.user_id).sort(),
    }),
  );
  return { comments, members: members.map((m) => ({ userId: m.userId, name: m.name })), viewer: { userId: who.userId, role: who.role } };
}

export async function addComment(admin: SupabaseClient, who: Who, projectId: string, body: CreateBody): Promise<string> {
  const { data, error } = await admin.rpc("design_comment_add", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_project_id: projectId,
    p_parent_id: body.parentId,
    p_version: body.version,
    p_panel_id: body.panelId,
    p_x_mm: body.xMm,
    p_y_mm: body.yMm,
    p_body: body.body,
    p_mentions: body.mentions,
  });
  throwIfFailed(error, DESIGN_NOT_FOUND);
  return z.uuid().parse(data);
}

export async function editComment(admin: SupabaseClient, who: Who, commentId: string, body: EditBody): Promise<void> {
  const { error } = await admin.rpc("design_comment_edit", { p_brand_id: who.brandId, p_user_id: who.userId, p_comment_id: commentId, p_body: body.body, p_mentions: body.mentions });
  throwIfFailed(error, COMMENT_NOT_FOUND);
}

/** Returns "removed" when the comment went altogether, "emptied" when replies kept its place. */
export async function deleteComment(admin: SupabaseClient, who: Who, commentId: string): Promise<"removed" | "emptied"> {
  const { data, error } = await admin.rpc("design_comment_delete", { p_brand_id: who.brandId, p_user_id: who.userId, p_comment_id: commentId });
  throwIfFailed(error, COMMENT_NOT_FOUND);
  return z.enum(["removed", "emptied"]).parse(data);
}

export async function resolveComment(admin: SupabaseClient, who: Who, commentId: string, resolved: boolean): Promise<void> {
  const { error } = await admin.rpc("design_comment_resolve", { p_brand_id: who.brandId, p_user_id: who.userId, p_comment_id: commentId, p_resolved: resolved });
  throwIfFailed(error, COMMENT_NOT_FOUND);
}
