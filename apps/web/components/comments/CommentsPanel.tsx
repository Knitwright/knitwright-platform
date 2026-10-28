"use client";

import { readJson } from "@/lib/http/read-json";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseList, parseSaved, UNREADABLE, type ListAnswer } from "@/lib/comments/answers";
import { buildThreads, filterThreads, mentionCount, type StatusFilter } from "@/lib/comments/thread";
import { CommentForm, type Draft, type PanelChoice } from "./CommentForm";
import { ThreadCard, type ThreadActions } from "./ThreadCard";

type Props = Readonly<{ projectId: string; version: number; panels: readonly PanelChoice[] }>;
type Loaded = Extract<ListAnswer, { ok: true }>;

const FILTERS: readonly { id: StatusFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

/** Reads the comments, again whenever `load` is called with the answer passed to `apply`. */
function useCommentList(base: string) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const apply = useCallback((answer: ListAnswer | null) => {
    if (answer === null) return;
    if (answer.ok) {
      setLoaded(answer);
      setNowMs(Date.now());
      setProblem(null);
    } else setProblem(answer.message);
  }, []);

  const load = useCallback(async (signal?: AbortSignal): Promise<ListAnswer | null> => {
    try {
      return parseList(await readJson(await fetch(base, { signal })));
    } catch (error) {
      return error instanceof DOMException && error.name === "AbortError" ? null : { ok: false, message: UNREADABLE };
    }
  }, [base]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then(apply);
    return () => controller.abort();
  }, [load, apply]);

  return { loaded, problem, setProblem, nowMs, apply, load };
}

/** Sends one change. Null when it went through, else the sentence saying why not. */
async function sendChange(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const answer = parseSaved(await readJson(response));
    return answer.ok ? null : answer.message;
  } catch {
    return UNREADABLE;
  }
}

type ListControls = Pick<ReturnType<typeof useCommentList>, "setProblem" | "apply" | "load">;

/** Sending changes: each one, when it goes through, reads the list again. */
function useCommentActions(base: string, { setProblem, apply, load }: ListControls) {
  const [busy, setBusy] = useState(false);

  /** Sends one change and reads the list again. Returns whether it went through. */
  const send = useCallback(async (url: string, method: string, body?: unknown): Promise<boolean> => {
    setBusy(true);
    setProblem(null);
    const refused = await sendChange(url, method, body);
    if (refused !== null) setProblem(refused);
    else apply(await load());
    setBusy(false);
    return refused === null;
  }, [load, apply, setProblem]);

  const actions: ThreadActions = useMemo(
    () => ({
      reply: (parentId, parentVersion, draft) => send(base, "POST", { ...draft, parentId, version: parentVersion }),
      edit: (commentId, draft) => send(`${base}/${commentId}`, "PATCH", { body: draft.body, mentions: draft.mentions }),
      remove: async (commentId) => void (await send(`${base}/${commentId}`, "DELETE")),
      resolve: async (commentId, resolved) => void (await send(`${base}/${commentId}/resolve`, "POST", { resolved })),
    }),
    [base, send],
  );
  return { busy, send, actions };
}

/**
 * Comments on the design, for members of the brand: threads with replies, a box for a new comment
 * that can point at a panel and a point on it, and resolve for those allowed. Everything the browser
 * sends is words, an anchor and the people to tell; the server takes the brand and the author from the session.
 */
export function CommentsPanel({ projectId, version, panels }: Props) {
  const base = `/api/projects/${projectId}/comments`;
  const { loaded, problem, setProblem, nowMs, apply, load } = useCommentList(base);
  const { busy, send, actions } = useCommentActions(base, { setProblem, apply, load });
  const [status, setStatus] = useState<StatusFilter>("open");

  const threads = useMemo(() => buildThreads(loaded?.comments ?? []), [loaded]);
  const shown = filterThreads(threads, { status });
  const panelLabel = (id: string): string | null => panels.find((p) => p.id === id)?.label ?? null;
  const named = loaded ? mentionCount(threads, loaded.viewer.userId) : 0;
  const add = (draft: Draft) => send(base, "POST", { ...draft, parentId: null, version });

  return (
    <div className="flex flex-col gap-5" data-testid="comments-panel">
      <p className="text-[15px] leading-relaxed text-muted">
        Comments are for the members of your brand. They are about the saved version you write them on, and nobody with only a shared link can see them.
      </p>
      {problem ? (
        <p role="alert" className="text-sm text-red-700" data-testid="comments-problem">
          {problem}
        </p>
      ) : null}
      {loaded === null && !problem ? <p className="text-sm text-muted">Reading the comments…</p> : null}
      {loaded ? (
        <>
          <MentionsLine named={named} />
          <CommentForm label={`New comment on version ${version}`} submitLabel="Comment" panels={panels} members={loaded.members} selfId={loaded.viewer.userId} busy={busy} onSubmit={add} />
          <StatusFilters status={status} onStatus={setStatus} />
          {shown.length === 0 ? <p className="text-sm text-muted">No {status === "all" ? "" : `${status} `}comments yet.</p> : null}
          <ul className="flex flex-col gap-3" aria-label="Comment threads">
            {shown.map((thread) => (
              <ThreadCard key={thread.root.id} thread={thread} viewer={loaded.viewer} members={loaded.members} panelLabel={panelLabel} nowMs={nowMs} busy={busy} actions={actions} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function MentionsLine({ named }: Readonly<{ named: number }>) {
  return (
    <p role="status" aria-live="polite" className="text-sm text-ink" data-testid="comments-mentions">
      {named === 0 ? "No open comments name you." : `${named} open ${named === 1 ? "comment names" : "comments name"} you.`}
    </p>
  );
}

function StatusFilters({ status, onStatus }: Readonly<{ status: StatusFilter; onStatus: (status: StatusFilter) => void }>) {
  return (
    <div role="group" aria-label="Show" className="flex gap-2">
      {FILTERS.map((f) => (
        <button key={f.id} type="button" aria-pressed={status === f.id} onClick={() => onStatus(f.id)} className="rounded-full border border-hairline px-3 py-1 min-h-10 text-sm aria-pressed:bg-ink aria-pressed:text-white">
          {f.label}
        </button>
      ))}
    </div>
  );
}
