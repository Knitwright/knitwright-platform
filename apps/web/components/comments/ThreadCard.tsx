"use client";

import { useState } from "react";
import type { MemberView, Viewer } from "@/lib/comments/answers";
import { anchorLabel, canChange, canResolve, type CommentView, type Thread } from "@/lib/comments/thread";
import { CommentForm, type Draft } from "./CommentForm";

export type ThreadActions = Readonly<{
  reply: (parentId: string, version: number, draft: Draft) => Promise<boolean>;
  edit: (commentId: string, draft: Draft) => Promise<boolean>;
  remove: (commentId: string) => Promise<void>;
  resolve: (commentId: string, resolved: boolean) => Promise<void>;
}>;

type Props = Readonly<{
  thread: Thread;
  viewer: Viewer;
  members: readonly MemberView[];
  panelLabel: (panelId: string) => string | null;
  nowMs: number;
  busy: boolean;
  actions: ThreadActions;
}>;

const when = (iso: string): string => iso.slice(0, 16).replace("T", " ");

type EntryProps = Readonly<Omit<Props, "thread" | "panelLabel"> & { comment: CommentView }>;

function Entry({ comment, viewer, members, nowMs, busy, actions }: EntryProps) {
  const [editing, setEditing] = useState(false);
  const mayChange = canChange(comment, viewer.userId, nowMs);
  const names = comment.mentions.map((id) => members.find((m) => m.userId === id)?.name ?? "A former member");
  if (comment.deletedAt !== null) return <p className="text-sm italic text-muted">This comment was removed.</p>;
  return (
    <div className="flex flex-col gap-1" data-testid="comment">
      <p className="text-sm text-muted">
        <span className="font-medium text-ink">{comment.authorName}</span> · {when(comment.createdAt)}
        {comment.editedAt ? " · changed" : ""}
      </p>
      {editing ? (
        <CommentForm
          label="Your words"
          submitLabel="Save"
          initialBody={comment.body}
          initialMentions={comment.mentions}
          members={members}
          selfId={viewer.userId}
          busy={busy}
          onSubmit={async (draft) => {
            const done = await actions.edit(comment.id, draft);
            if (done) setEditing(false);
            return done;
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        // Plain text only: React escapes it, and line breaks are kept.
        <p className="whitespace-pre-wrap break-words text-[15px] text-ink">{comment.body}</p>
      )}
      {names.length > 0 ? <p className="text-sm text-muted">Told: {names.join(", ")}</p> : null}
      {mayChange && !editing ? (
        <p className="flex gap-3 text-sm">
          <button type="button" className="min-h-10 underline" onClick={() => setEditing(true)}>
            Change
          </button>
          <button type="button" className="min-h-10 underline" disabled={busy} onClick={() => actions.remove(comment.id)}>
            Remove
          </button>
        </p>
      ) : null}
    </div>
  );
}

/** One thread: its first comment with where it points, the replies, a reply box, and resolve for those allowed. */
export function ThreadCard({ thread, panelLabel, ...rest }: Props) {
  const { viewer, members, busy, actions } = rest;
  const { root } = thread;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-3" data-testid="comment-thread" data-resolved={thread.resolved}>
      <p className="text-sm text-muted" data-testid="comment-anchor">
        {anchorLabel(root, panelLabel)}
        {thread.resolved ? " · Resolved" : ""}
      </p>
      <Entry comment={root} {...rest} />
      {thread.replies.length > 0 ? (
        <ul className="flex flex-col gap-3 border-l border-hairline pl-3">
          {thread.replies.map((reply) => (
            <li key={reply.id}>
              <Entry comment={reply} {...rest} />
            </li>
          ))}
        </ul>
      ) : null}
      {root.deletedAt === null && !thread.resolved ? (
        <CommentForm
          label="Reply"
          submitLabel="Send reply"
          members={members}
          selfId={viewer.userId}
          busy={busy}
          onSubmit={(draft) => actions.reply(root.id, root.version, draft)}
        />
      ) : null}
      {canResolve(viewer.role) && root.deletedAt === null ? (
        <button type="button" disabled={busy} className="min-h-10 self-start rounded-full border border-hairline px-4 py-2 text-sm text-ink" onClick={() => actions.resolve(root.id, !thread.resolved)}>
          {thread.resolved ? "Open again" : "Mark resolved"}
        </button>
      ) : null}
    </li>
  );
}
