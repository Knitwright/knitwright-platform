"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TEXT_AREA } from "@/components/ui/field-styles";
import type { DiffAnswer } from "@/lib/design-diff";
import { MAX_UTTERANCE_LENGTH } from "@/lib/intent/text-flow";
import { applyProposalAction } from "@/lib/projects/actions";

const UNREACHABLE = "We could not reach the server. Check your connection and try again.";

type Props = Readonly<{ projectId: string; version: number; busy: boolean }>;
type Shown = Extract<DiffAnswer, { kind: "preview" }>;

/** Asks for a preview of the change the words describe: the preview to show, or the sentence to show instead. */
async function requestPreview(projectId: string, utterance: string, expectedVersion: number): Promise<{ shown: Shown } | { message: string }> {
  try {
    const response = await fetch(`/api/projects/${projectId}/design-diff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ utterance, expectedVersion }),
    });
    const answer = response.ok ? ((await response.json()) as DiffAnswer) : null;
    if (!answer) return { message: "That could not be previewed. Nothing was changed." };
    if (answer.kind === "refused") return { message: answer.reason };
    return { shown: answer };
  } catch {
    return { message: UNREACHABLE };
  }
}

/** Makes the previewed change the next version: the new version, or the sentence saying why not. */
async function confirmPreview(projectId: string, token: string, expectedVersion: number): Promise<{ version: number } | { message: string }> {
  try {
    const result = await applyProposalAction({ projectId, expectedVersion, token });
    return result.success ? { version: result.data.version } : { message: result.error.message };
  } catch {
    return { message: UNREACHABLE };
  }
}

/**
 * Preview a change before it is made (plan v4 W2-B): the words become a design change, drawn
 * before and after. Confirm makes it the next version; Discard drops it and leaves no trace.
 */
export function DiffPanel({ projectId, version, busy }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const saved = useRef(version);
  const latest = (): number => Math.max(version, saved.current);
  const clear = () => {
    setShown(null);
    setMessage(null);
  };

  const preview = async (event: FormEvent) => {
    event.preventDefault();
    const utterance = text.trim();
    if (!utterance || working || busy) return;
    setWorking(true);
    clear();
    const answer = await requestPreview(projectId, utterance, latest());
    if ("shown" in answer) setShown(answer.shown);
    else setMessage(answer.message);
    setWorking(false);
  };

  const confirm = async () => {
    if (!shown || working || busy) return;
    setWorking(true);
    const result = await confirmPreview(projectId, shown.token, latest());
    if ("message" in result) setMessage(result.message);
    else {
      saved.current = Math.max(saved.current, result.version);
      setShown(null);
      setText("");
      setMessage(`Done. This is now version ${result.version}.`);
      router.refresh();
    }
    setWorking(false);
  };

  return (
    <section aria-labelledby="diff-title" className="flex flex-col gap-3" data-testid="diff-panel">
      <h3 id="diff-title" className="text-sm font-medium text-ink">Preview a change</h3>
      <DiffForm text={text} onText={setText} onSubmit={(event) => void preview(event)} pending={working && shown === null} disabled={busy || working || text.trim() === ""} />
      {message ? <Notice>{message}</Notice> : null}
      {shown ? <DiffCard shown={shown} onConfirm={() => void confirm()} onDiscard={clear} busy={busy} working={working} /> : null}
    </section>
  );
}

type DiffFormProps = Readonly<{ text: string; onText: (text: string) => void; onSubmit: (event: FormEvent) => void; pending: boolean; disabled: boolean }>;

function DiffForm({ text, onText, onSubmit, pending, disabled }: DiffFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <label htmlFor="diff-text" className="text-sm text-ink-2">
        Say what to change, then check it before it is made
      </label>
      <textarea
        id="diff-text"
        value={text}
        maxLength={MAX_UTTERANCE_LENGTH}
        rows={2}
        onChange={(event) => onText(event.target.value)}
        placeholder="For example: make the sleeves darker"
        className={TEXT_AREA}
      />
      <Button type="submit" variant="secondary" pending={pending} disabled={disabled}>
        Preview change
      </Button>
    </form>
  );
}

type DiffCardProps = Readonly<{ shown: Shown; onConfirm: () => void; onDiscard: () => void; busy: boolean; working: boolean }>;

function DiffCard({ shown, onConfirm, onDiscard, busy, working }: DiffCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 p-3" data-testid="diff-card">
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Before" src={shown.before} />
        <Tile label="After" src={shown.after} />
      </div>
      <ul className="list-disc pl-4 text-sm text-ink-2">
        {shown.changes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {shown.warnings.length > 0 ? (
        <ul className="list-disc pl-4 text-sm text-warn" data-testid="diff-warnings">
          {shown.warnings.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" onClick={onConfirm} disabled={busy || working}>
          Confirm
        </Button>
        <Button type="button" variant="secondary" onClick={onDiscard} disabled={working}>
          Discard
        </Button>
      </div>
    </div>
  );
}

function Tile({ label, src }: Readonly<{ label: string; src: string | null }>) {
  return (
    <figure className="m-0 flex flex-col items-center gap-1">
      <div className="w-full rounded-xl bg-white p-1">
        {src ? (
          // A data address cannot go through next/image, and this is a drawing, not a photo.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${label}: the front of the design`} className="mx-auto h-auto max-h-40 w-full object-contain" />
        ) : (
          <p className="p-4 text-xs text-muted">No drawing</p>
        )}
      </div>
      <figcaption className="font-mono text-xs text-chalk-muted">{label}</figcaption>
    </figure>
  );
}
