import { can, type ClubRole } from "@/lib/clubs/roles";
import { EDIT_WINDOW_MINUTES } from "./limits";

/** A comment as the panel shows it. Names are the member's name at the time of reading. */
export interface CommentView {
  readonly id: string;
  /** The first comment of the thread, or null for a first comment. */
  readonly parentId: string | null;
  readonly version: number;
  readonly panelId: string | null;
  readonly xMm: number | null;
  readonly yMm: number | null;
  readonly body: string;
  readonly authorId: string | null;
  readonly authorName: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
  /** Set when the author removed a comment that had replies; the body is then empty. */
  readonly deletedAt: string | null;
  readonly resolvedAt: string | null;
  /** Ids of the members it names. */
  readonly mentions: readonly string[];
}

export interface Thread {
  readonly root: CommentView;
  readonly replies: readonly CommentView[];
  readonly resolved: boolean;
}

const byTime = (a: CommentView, b: CommentView): number =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Threads oldest first, each with its replies oldest first. A reply with no first comment is left out. */
export function buildThreads(comments: readonly CommentView[]): readonly Thread[] {
  const roots = comments.filter((c) => c.parentId === null).sort(byTime);
  return roots.map((root) => ({
    root,
    replies: comments.filter((c) => c.parentId === root.id).sort(byTime),
    resolved: root.resolvedAt !== null,
  }));
}

export type StatusFilter = "open" | "resolved" | "all";
interface ThreadFilter {
  readonly status: StatusFilter;
  readonly panelId?: string;
  readonly version?: number;
}

export function filterThreads(threads: readonly Thread[], filter: ThreadFilter): readonly Thread[] {
  return threads.filter(
    (t) =>
      (filter.status === "all" || (filter.status === "resolved") === t.resolved) &&
      (filter.panelId === undefined || t.root.panelId === filter.panelId) &&
      (filter.version === undefined || t.root.version === filter.version),
  );
}

/** Only the author may change or remove a comment, and only for a short time after writing it. The database decides again. */
export function canChange(comment: CommentView, userId: string, nowMs: number): boolean {
  if (comment.authorId === null || comment.authorId !== userId || comment.deletedAt !== null) return false;
  const written = Date.parse(comment.createdAt);
  return Number.isFinite(written) && nowMs - written <= EDIT_WINDOW_MINUTES * 60_000;
}

/** Owners, admins and kit managers resolve; viewers comment only (decision 0042). */
export const canResolve = (role: ClubRole): boolean => can(role, "manageKit");

/** How many open comments name this person. A resolved thread and a removed comment no longer count. */
export function mentionCount(threads: readonly Thread[], userId: string): number {
  let count = 0;
  for (const thread of threads) {
    if (thread.resolved) continue;
    for (const c of [thread.root, ...thread.replies]) if (c.deletedAt === null && c.mentions.includes(userId)) count += 1;
  }
  return count;
}

const mm = (value: number): string => `${Number.isInteger(value) ? value : Number(value.toFixed(2))}`;

/** "Version 3, Front at 120 mm across, 45.5 mm down". */
export function anchorLabel(root: CommentView, panelLabel: (panelId: string) => string | null): string {
  const parts = [`Version ${root.version}`];
  if (root.panelId !== null) {
    const place = panelLabel(root.panelId) ?? root.panelId;
    parts.push(root.xMm !== null && root.yMm !== null ? `${place} at ${mm(root.xMm)} mm across, ${mm(root.yMm)} mm down` : place);
  }
  return parts.join(", ");
}
