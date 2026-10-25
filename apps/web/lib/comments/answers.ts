import type { ClubRole } from "@/lib/clubs/roles";
import type { CommentView } from "./thread";

/** The panel's reading of what the comments routes send back. Plain checks (no zod, so the browser bundle stays small) and tested without a browser. */
export interface MemberView {
  readonly userId: string;
  readonly name: string;
}
export interface Viewer {
  readonly userId: string;
  readonly role: ClubRole;
}

export const UNREADABLE = "The comments could not be read. Try again.";

export type ListAnswer =
  | Readonly<{ ok: true; comments: readonly CommentView[]; members: readonly MemberView[]; viewer: Viewer }>
  | Readonly<{ ok: false; message: string }>;
export type SavedAnswer = Readonly<{ ok: true }> | Readonly<{ ok: false; message: string }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const maybeText = (value: unknown): value is string | null => value === null || typeof value === "string";
const maybeNumber = (value: unknown): value is number | null => value === null || (typeof value === "number" && Number.isFinite(value));
const ROLES: readonly unknown[] = ["owner", "admin", "kit_manager", "viewer"];

const isComment = (v: unknown): v is CommentView =>
  isRecord(v) &&
  text(v.id) &&
  maybeText(v.parentId) &&
  typeof v.version === "number" &&
  maybeText(v.panelId) &&
  maybeNumber(v.xMm) &&
  maybeNumber(v.yMm) &&
  text(v.body) &&
  maybeText(v.authorId) &&
  text(v.authorName) &&
  text(v.createdAt) &&
  maybeText(v.editedAt) &&
  maybeText(v.deletedAt) &&
  maybeText(v.resolvedAt) &&
  Array.isArray(v.mentions) &&
  v.mentions.every(text);

const isMember = (v: unknown): v is MemberView => isRecord(v) && text(v.userId) && text(v.name);
const isViewer = (v: unknown): v is Viewer => isRecord(v) && text(v.userId) && ROLES.includes(v.role);

/** The server's own sentence for a refusal, or the plain one. */
function refusal(body: unknown): { ok: false; message: string } {
  const message = isRecord(body) && body.success === false && isRecord(body.error) ? body.error.message : undefined;
  return { ok: false, message: text(message) ? message : UNREADABLE };
}

export function parseList(body: unknown): ListAnswer {
  if (isRecord(body) && body.success === true && isRecord(body.data)) {
    const { comments, members, viewer } = body.data;
    if (Array.isArray(comments) && comments.every(isComment) && Array.isArray(members) && members.every(isMember) && isViewer(viewer)) {
      return { ok: true, comments, members, viewer };
    }
  }
  return refusal(body);
}

export function parseSaved(body: unknown): SavedAnswer {
  return isRecord(body) && body.success === true ? { ok: true } : refusal(body);
}
