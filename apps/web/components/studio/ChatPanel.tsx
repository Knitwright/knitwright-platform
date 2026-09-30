"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { MAX_UTTERANCE_LENGTH } from "@/lib/intent/text-flow";
import { applyProposalAction } from "@/lib/projects/actions";
import { chatReducer, initialChat, pendingText, readEvents, refusalMessage, type ChatMessage } from "@/lib/projects/chat";

const UNREACHABLE = "We could not reach the server. Check your connection and try again.";
const CUT_OFF = "The answer was cut off. Nothing may have changed. Reload the page to check.";

type Props = Readonly<{
  projectId: string;
  version: number;
  /** False when no model is configured. Short requests the rules can read still work. */
  available: boolean;
  /** True while the editor is saving, so the design is not changed from two places at once. */
  busy: boolean;
  /** A sentence to send once, as soon as the panel opens: the guided flow's first words. */
  initialUtterance?: string | undefined;
  /** Called once the first sentence has been sent, so the page can forget it. */
  onInitialSent?: (() => void) | undefined;
}>;

/**
 * Talk to the assistant about this design. Every sentence and rule is in lib/projects/chat
 * and lib/intent; this holds the form, the list and the wiring to the server.
 */
export function ChatPanel({ projectId, version, available, busy, initialUtterance, onInitialSent }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(chatReducer, initialChat);
  const [text, setText] = useState("");
  const waiting = state.pending !== null;
  const initialSent = useRef(false);

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
        body: JSON.stringify({ utterance, expectedVersion: version }),
      });
      if (!response.ok || !response.body) {
        dispatch({ type: "failed", message: await refusalMessage(response) });
        return;
      }
      const finished = await readEvents(response.body, (streamed) => {
        if (streamed.type === "outcome" && streamed.outcome.kind === "applied") changed = true;
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
    dispatch({ type: "chose", id: message.id, index });
    if (!choice.token) return;
    try {
      const result = await applyProposalAction({ projectId, expectedVersion: version, token: choice.token });
      if (!result.success) {
        dispatch({ type: "failed", message: result.error.message });
        return;
      }
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
          id="chat-text"
          value={text}
          maxLength={MAX_UTTERANCE_LENGTH}
          rows={2}
          onChange={(event) => setText(event.target.value)}
          placeholder="For example: slim fit with long sleeves"
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-[15px] text-ink"
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
