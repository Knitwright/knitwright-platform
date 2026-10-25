"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { call } from "@/components/production/orders/call";
import { Button } from "@/components/ui/Button";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { Notice } from "@/components/ui/Notice";
import { resolutionsOf, type Answer, type Answers, type PreviewView } from "./model";
import { ReorderReview } from "./ReorderReview";

type Season = Readonly<{ id: string; name: string; players: number }>;
type Props = Readonly<{ releaseId: string; seasons: readonly Season[] }>;
type Made = Readonly<{ orderId: string; projectId: string; players: number; leftOut: number }>;

/** Reorder from the order history: press Reorder, look at what changed, press Confirm. */
export function ReorderButton({ releaseId, seasons }: Props) {
  const sourceId = useId();
  const fallback = seasons.find((s) => s.players > 0)?.id ?? "";
  const [source, setSource] = useState(fallback);
  const [preview, setPreview] = useState<PreviewView | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [made, setMade] = useState<Made | null>(null);

  const look = async (seasonId: string) => {
    setBusy(true);
    setProblem(null);
    setAnswers({});
    const reply = await call<PreviewView>("/api/club/reorder", "POST", { releaseId, ...(seasonId ? { seasonId } : {}) });
    setBusy(false);
    if (reply.ok) setPreview(reply.data);
    else setProblem(reply.message);
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    const reply = await call<Made>("/api/club/reorder/confirm", "POST", {
      releaseId,
      ...(preview.source === "season" ? { seasonId: source } : {}),
      fingerprint: preview.fingerprint,
      resolutions: resolutionsOf(preview.plan, answers),
    });
    setBusy(false);
    if (reply.ok) {
      setMade(reply.data);
      setPreview(null);
    } else setProblem(reply.message);
  };

  const answer = (index: number, a: Answer) => setAnswers((current) => ({ ...current, [index]: a }));

  return (
    <div className="w-full">
      {made ? (
        <Notice tone="ok">
          The new team list is made with {made.players} {made.players === 1 ? "player" : "players"}{made.leftOut > 0 ? `, and ${made.leftOut} left out` : ""}.{" "}
          <Link href={`/studio/${made.projectId}?tool=production`} className="soft-link">Open it on the design</Link>.
        </Notice>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {preview && seasons.length > 0 ? (
            <div className="flex items-center gap-2">
              <label htmlFor={sourceId} className="text-sm text-muted">Sizes from</label>
              <select id={sourceId} className={FIELD_CONTROL} value={source} onChange={(e) => { setSource(e.target.value); void look(e.target.value); }}>
                <option value="">The earlier order&apos;s list</option>
                {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ) : null}
          {preview ? (
            <Button variant="quiet" type="button" onClick={() => setPreview(null)}>Cancel</Button>
          ) : (
            <Button variant="secondary" type="button" pending={busy} disabled={busy} onClick={() => void look(fallback)}>Reorder</Button>
          )}
        </div>
      )}
      {problem ? <div className="mt-2"><Notice tone="warn" role="alert">{problem}</Notice></div> : null}
      {preview ? <ReorderReview preview={preview} answers={answers} onAnswer={answer} onConfirm={() => void confirm()} busy={busy} /> : null}
    </div>
  );
}
