"use client";

import { TEXT_AREA } from "@/components/ui/field-styles";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { MAX_UTTERANCE_LENGTH } from "@/lib/intent/text-flow";
import { applyProposalAction } from "@/lib/projects/actions";
import { chatFromHistory, chatReducer, pendingText, readEvents, refusalMessage, type ChatMessage, type StoredLine } from "@/lib/projects/chat";

const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
const CUT_OFF = "The answer was cut off. Nothing may have changed. Reload the page to check.";

type Props = Readonly<{
  projectId: string;
  version: number;
  /** False when no model is configured. Short requests the rules can read still work. */
  available: boolean;
  /** True while the editor is saving, so the design is not changed from two places at once. */
  busy: boolean;
  /** The conversation kept for the design, shown again when the panel opens. */
  conversation?: readonly StoredLine[] | undefined;
  /** A sentence to send once, as soon as the panel opens: the guided flow's first words. */
  initialUtterance?: string | undefined;
  /** Called once the first sentence has been sent, so the page can forget it. */
  onInitialSent?: (() => void) | undefined;
}>;

/**
 * Talk to the assistant about this design. Every sentence and rule is in lib/projects/chat
 * and lib/intent; this holds the form, the list and the wiring to the server.
 */
export function ChatPanel({ projectId, version, available, busy, conversation = [], initialUtterance, onInitialSent }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(chatReducer, conversation, chatFromHistory);
  const [text, setText] = useState("");
  const waiting = state.pending !== null;
  const initialSent = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
  // The newest version this panel saved. A way on offered with a change is signed at it, and
  // may be tapped before the page has caught up.
  const saved = useRef(version);
  const latest = (): number => Math.max(version, saved.current);
  const sawVersion = (next: number): void => {
    saved.current = Math.max(saved.current, next);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const utterance = text.trim();
    if (!utterance || waiting || busy) return;
    setText("");
    await sendText(utterance);
  };

  const sendText = async (utterance: string) => {
    dispatch({ type: "sent", text: utterance });
    let changed = false;
    try {
      const response = await fetch(`/api/projects/${projectId}/intent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ utterance, expectedVersion: latest() }),
      });
      if (!response.ok || !response.body) {
        dispatch({ type: "failed", message: await refusalMessage(response) });
        return;
      }
      const finished = await readEvents(response.body, (streamed) => {
        if (streamed.type === "outcome" && streamed.outcome.kind === "applied") {
          changed = true;
          sawVersion(streamed.outcome.version);
        }
        dispatch(streamed);
      });
      if (!finished) dispatch({ type: "failed", message: CUT_OFF });
    } catch {
      dispatch({ type: "failed", message: UNREACHABLE });
    }
    if (changed) router.refresh();
  };

  useEffect(() => {
    const utterance = initialUtterance?.trim();
    if (!utterance || initialSent.current) return;
    initialSent.current = true;
    void sendText(utterance).then(() => onInitialSent?.());
    // Sent once, when the panel first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = async (message: ChatMessage, index: number) => {
    const choice = message.choices[index];
    if (!choice || message.answered !== null || waiting || busy) return;
    // Words to finish go in the box; only the person can give the rest, such as a measurement.
    if (choice.words?.kind === "fill") {
      setText(choice.words.text);
      box.current?.focus();
      return;
    }
    dispatch({ type: "chose", id: message.id, index });
    if (choice.words?.kind === "say") {
      await sendText(choice.words.text);
      return;
    }
    if (!choice.token) return;
    try {
      const result = await applyProposalAction({ projectId, expectedVersion: latest(), token: choice.token });
      if (!result.success) {
        dispatch({ type: "failed", message: result.error.message });
        return;
      }
      sawVersion(result.data.version);
      dispatch({ type: "choiceApplied", text: choice.label });
      router.refresh();
    } catch {
      dispatch({ type: "failed", message: UNREACHABLE });
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="chat-panel">
      {available ? null : (
        <Notice>
          The assistant is not switched on yet. Short requests that name a choice still work, such as &quot;slim fit&quot; or
          &quot;long sleeves&quot;.
        </Notice>
      )}
      <ol className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto" aria-live="polite">
        {state.messages.map((message) => (
          <li key={message.id} className={message.from === "person" ? "self-end" : "self-start"}>
            <MessageView message={message} disabled={waiting || busy} onChoose={(index) => void choose(message, index)} />
          </li>
        ))}
      </ol>
      {waiting ? (
        <p className="text-sm text-muted" role="status" data-testid="chat-pending">
          {pendingText(state.pending)}
        </p>
      ) : null}
      <form onSubmit={(event) => void send(event)} className="flex flex-col gap-2">
        <label htmlFor="chat-text" className="text-sm font-medium text-ink">
          Describe a change
        </label>
        <textarea
          ref={box}
          id="chat-text"
          value={text}
          maxLength={MAX_UTTERANCE_LENGTH}
          rows={2}
          onChange={(event) => setText(event.target.value)}
          placeholder="For example: slim fit with long sleeves"
          className={TEXT_AREA}
        />
        <Button type="submit" pending={waiting} disabled={busy || text.trim() === ""}>
          Send
        </Button>
      </form>
    </div>
  );
}

const BUBBLE: Readonly<Record<ChatMessage["kind"], string>> = {
  text: "bg-cobalt text-white",
  applied: "bg-ok-wash text-ok",
  question: "bg-cobalt-wash text-ink-2",
  rejection: "bg-warn-wash text-warn",
  failed: "bg-warn-wash text-warn",
};

function MessageView({ message, disabled, onChoose }: Readonly<{ message: ChatMessage; disabled: boolean; onChoose: (index: number) => void }>) {
  return (
    <div className={`max-w-[22rem] rounded-xl px-3 py-2 text-sm leading-relaxed ${BUBBLE[message.kind]}`} data-testid={`chat-${message.kind}`}>
      <p>{message.text}</p>
      {message.lines.length > 0 ? (
        <ul className="mt-1 list-disc pl-4">
          {message.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {message.choices.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          {message.choices.map((choice, index) => (
            <Button
              key={choice.label}
              type="button"
              variant={choice.recommended ? "primary" : "secondary"}
              disabled={disabled || message.answered !== null}
              aria-pressed={message.answered === index}
              onClick={() => onChoose(index)}
            >
              {choice.label}
              {choice.recommended ? <span className="text-xs font-normal">(recommended)</span> : null}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
