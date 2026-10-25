"use client";

import { useState } from "react";
import { COMMENT_MAX_LENGTH } from "@/lib/comments/text";
import type { MemberView } from "@/lib/comments/answers";

export type PanelChoice = Readonly<{ id: string; label: string }>;
export type Draft = Readonly<{
  body: string;
  panelId: string | null;
  xMm: number | null;
  yMm: number | null;
  mentions: readonly string[];
}>;

type Props = Readonly<{
  label: string;
  submitLabel: string;
  initialBody?: string;
  initialMentions?: readonly string[];
  /** Panels to anchor to. Left out for a reply or a change, which keep their place. */
  panels?: readonly PanelChoice[];
  members: readonly MemberView[];
  /** Whoever is writing cannot name themselves. */
  selfId: string;
  busy: boolean;
  onSubmit: (draft: Draft) => Promise<boolean>;
  onCancel?: () => void;
}>;

const number = (text: string): number | null => (text.trim() === "" || Number.isNaN(Number(text)) ? null : Number(text));

/** The box for a new comment, a reply or a change: words, an optional panel and point, and who to name. */
export function CommentForm({ label, submitLabel, initialBody = "", initialMentions = [], panels, members, selfId, busy, onSubmit, onCancel }: Props) {
  const [body, setBody] = useState(initialBody);
  const [panelId, setPanelId] = useState("");
  const [across, setAcross] = useState("");
  const [down, setDown] = useState("");
  const [named, setNamed] = useState<readonly string[]>(initialMentions);
  const others = members.filter((m) => m.userId !== selfId);
  const x = number(across);
  const y = number(down);
  const pointOk = panelId === "" ? across === "" && down === "" : (x === null) === (y === null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const done = await onSubmit({ body, panelId: panelId || null, xMm: panelId ? x : null, yMm: panelId ? y : null, mentions: named });
    if (done) {
      setBody("");
      setAcross("");
      setDown("");
      setNamed([]);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" data-testid="comment-form">
      <label className="flex flex-col gap-1 text-sm text-ink">
        {label}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={COMMENT_MAX_LENGTH}
          rows={3}
          className="rounded-xl border border-hairline bg-surface p-2 text-[15px]"
        />
      </label>
      {panels ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm text-ink">
            About
            <select value={panelId} onChange={(e) => setPanelId(e.target.value)} className="min-h-10 rounded-xl border border-hairline bg-surface p-2 text-sm">
              <option value="">The whole design</option>
              {panels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {panelId ? (
            <>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Across (mm)
                <input inputMode="decimal" value={across} onChange={(e) => setAcross(e.target.value)} className="min-h-10 w-24 rounded-xl border border-hairline bg-surface p-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-ink">
                Down (mm)
                <input inputMode="decimal" value={down} onChange={(e) => setDown(e.target.value)} className="min-h-10 w-24 rounded-xl border border-hairline bg-surface p-2 text-sm" />
              </label>
            </>
          ) : null}
        </div>
      ) : null}
      {others.length > 0 ? (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="text-sm text-ink">Tell</legend>
          {others.map((m) => (
            <label key={m.userId} className="flex items-center gap-1 text-sm text-ink">
              <input
                type="checkbox"
                checked={named.includes(m.userId)}
                onChange={(e) => setNamed(e.target.checked ? [...named, m.userId] : named.filter((id) => id !== m.userId))}
              />
              {m.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      {!pointOk ? <p className="text-sm text-red-700">Give both distances for a point, or neither.</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !pointOk || body.trim() === ""} className="min-h-10 rounded-full bg-ink px-4 py-2 text-sm text-white disabled:opacity-50">
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="min-h-10 rounded-full border border-hairline px-4 py-2 text-sm text-ink">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
