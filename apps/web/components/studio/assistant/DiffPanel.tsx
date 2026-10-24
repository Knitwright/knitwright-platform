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

  const preview = async (event: FormEvent) => {
    event.preventDefault();
    const utterance = text.trim();
    if (!utterance || working || busy) return;
    setWorking(true);
    setShown(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/design-diff`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ utterance, expectedVersion: latest() }),
      });
      const answer = response.ok ? ((await response.json()) as DiffAnswer) : null;
      if (!answer) setMessage("That could not be previewed. Nothing was changed.");
      else if (answer.kind === "refused") setMessage(answer.reason);
      else setShown(answer);
    } catch {
      setMessage(UNREACHABLE);
    }
    setWorking(false);
  };

  const confirm = async () => {
    if (!shown || working || busy) return;
    setWorking(true);
    try {
      const result = await applyProposalAction({ projectId, expectedVersion: latest(), token: shown.token });
      if (!result.success) {
        setMessage(result.error.message);
      } else {
        saved.current = Math.max(saved.current, result.data.version);
        setShown(null);
        setText("");
        setMessage(`Done. This is now version ${result.data.version}.`);
        router.refresh();
      }
    } catch {
      setMessage(UNREACHABLE);
    }
    setWorking(false);
  };

  const discard = () => {
    setShown(null);
    setMessage(null);
  };

  return (
    <section aria-labelledby="diff-title" className="flex flex-col gap-3" data-testid="diff-panel">
      <h3 id="diff-title" className="text-sm font-medium text-ink">
        Preview a change
      </h3>
      <form onSubmit={(event) => void preview(event)} className="flex flex-col gap-2">
        <label htmlFor="diff-text" className="text-sm text-ink-2">
          Say what to change, then check it before it is made
        </label>
        <textarea
          id="diff-text"
          value={text}
          maxLength={MAX_UTTERANCE_LENGTH}
          rows={2}
          onChange={(event) => setText(event.target.value)}
          placeholder="For example: make the sleeves darker"
          className={TEXT_AREA}
        />
        <Button type="submit" variant="secondary" pending={working && shown === null} disabled={busy || working || text.trim() === ""}>
          Preview change
        </Button>
      </form>
      {message ? <Notice>{message}</Notice> : null}
      {shown ? (
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
            <Button type="button" onClick={() => void confirm()} disabled={busy || working}>
              Confirm
            </Button>
            <Button type="button" variant="secondary" onClick={discard} disabled={working}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}
    </section>
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
