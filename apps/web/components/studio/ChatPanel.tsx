"use client";

import { TEXT_AREA } from "@/components/ui/field-styles";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState, type ActionDispatch, type FormEvent, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { MAX_UTTERANCE_LENGTH } from "@/lib/intent/text-flow";
import { applyProposalAction } from "@/lib/projects/actions";
import {
  chatFromHistory,
  chatReducer,
  pendingText,
  readEvents,
  refusalMessage,
  type ChatEvent,
  type ChatMessage,
  type ChatState,
  type StoredLine,
} from "@/lib/projects/chat";

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
 * The newest version this panel saved. A way on offered with a change is signed at it, and
 * may be tapped before the page has caught up.
 */
function useSavedVersion(version: number) {
  const saved = useRef(version);
  const latest = (): number => Math.max(version, saved.current);
  const sawVersion = (next: number): void => {
    saved.current = Math.max(saved.current, next);
  };
  return { latest, sawVersion };
}

/** Sends the guided flow's first words once, when the panel first opens. */
function useSendOnce(initialUtterance: string | undefined, sendText: (utterance: string) => Promise<void>, onInitialSent: (() => void) | undefined) {
  const initialSent = useRef(false);
  useEffect(() => {
    const utterance = initialUtterance?.trim();
    if (!utterance || initialSent.current) return;
    initialSent.current = true;
    void sendText(utterance).then(() => onInitialSent?.());
    // Sent once, when the panel first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Talk to the assistant about this design. Every sentence and rule is in lib/projects/chat
 * and lib/intent; this holds the form, the list and the wiring to the server.
 */
export function ChatPanel({ projectId, version, available, busy, conversation = [], initialUtterance, onInitialSent }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(chatReducer, conversation, chatFromHistory);
  const [text, setText] = useState("");
  const waiting = state.pending !== null;
  const box = useRef<HTMLTextAreaElement>(null);
  const { latest, sawVersion } = useSavedVersion(version);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const utterance = text.trim();
    if (!utterance || waiting || busy) return;
    setText("");
    await sendText(utterance);
  };

  const sendText = async (utterance: string) => {
    dispatch({ type: "sent", text: utterance });
    const changed = await streamIntent(projectId, utterance, latest(), dispatch, sawVersion);
    if (changed) router.refresh();
  };

  useSendOnce(initialUtterance, sendText, onInitialSent);

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
    await applyChoice({ projectId, expectedVersion: latest(), token: choice.token }, dispatch, (applied) => {
      sawVersion(applied);
      dispatch({ type: "choiceApplied", text: choice.label });
      router.refresh();
    });
  };

  const form = <ChatForm box={box} text={text} onText={setText} onSubmit={(event) => void send(event)} waiting={waiting} busy={busy} />;
  return <ChatView state={state} available={available} busy={busy} onChoose={(message, index) => void choose(message, index)} form={form} />;
}

/** Applies the change a tapped choice was signed for. `onApplied` gets the new version; a refusal or no connection is passed on as a failed message. */
async function applyChoice(
  request: Parameters<typeof applyProposalAction>[0],
  dispatch: ActionDispatch<[ChatEvent]>,
  onApplied: (version: number) => void,
): Promise<void> {
  try {
    const result = await applyProposalAction(request);
    if (!result.success) {
      dispatch({ type: "failed", message: result.error.message });
      return;
    }
    onApplied(result.data.version);
  } catch {
    dispatch({ type: "failed", message: UNREACHABLE });
  }
}

/**
 * Sends one sentence to the assistant and passes on what it streams back. True when the design was changed. A refusal,
 * a cut-off answer or no connection is passed on as a failed message.
 */
async function streamIntent(
  projectId: string,
  utterance: string,
  expectedVersion: number,
  dispatch: ActionDispatch<[ChatEvent]>,
  sawVersion: (version: number) => void,
): Promise<boolean> {
  let changed = false;
  try {
    const response = await fetch(`/api/projects/${projectId}/intent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ utterance, expectedVersion }),
    });
    if (!response.ok || !response.body) {
      dispatch({ type: "failed", message: await refusalMessage(response) });
      return changed;
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
  return changed;
}

type ChatViewProps = Readonly<{
  state: ChatState;
  available: boolean;
  busy: boolean;
  onChoose: (message: ChatMessage, index: number) => void;
  form: ReactNode;
}>;

function ChatView({ state, available, busy, onChoose, form }: ChatViewProps) {
  const waiting = state.pending !== null;

  return (
    <div className="flex flex-col gap-4" data-testid="chat-panel">
      {available ? null : (
        <Notice>
          The assistant is not switched on yet. Short requests that name a choice still work, such as &quot;slim fit&quot; or
          &quot;long sleeves&quot;.
        </Notice>
      )}
      <MessageList messages={state.messages} disabled={waiting || busy} onChoose={onChoose} />
      {waiting ? (
        <p className="text-sm text-muted" role="status" data-testid="chat-pending">
          {pendingText(state.pending)}
        </p>
      ) : null}
      {form}
    </div>
  );
}

function MessageList({
  messages,
  disabled,
  onChoose,
}: Readonly<{ messages: readonly ChatMessage[]; disabled: boolean; onChoose: (message: ChatMessage, index: number) => void }>) {
  return (
    <ol className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto" aria-live="polite">
      {messages.map((message) => (
        <li key={message.id} className={message.from === "person" ? "self-end" : "self-start"}>
          <MessageView message={message} disabled={disabled} onChoose={(index) => onChoose(message, index)} />
        </li>
      ))}
    </ol>
  );
}

type ChatFormProps = Readonly<{
  box: RefObject<HTMLTextAreaElement | null>;
  text: string;
  onText: (text: string) => void;
  onSubmit: (event: FormEvent) => void;
  waiting: boolean;
  busy: boolean;
}>;

function ChatForm({ box, text, onText, onSubmit, waiting, busy }: ChatFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <label htmlFor="chat-text" className="text-sm font-medium text-ink">
        Describe a change
      </label>
      <textarea
        ref={box}
        id="chat-text"
        value={text}
        maxLength={MAX_UTTERANCE_LENGTH}
        rows={2}
        onChange={(event) => onText(event.target.value)}
        placeholder="For example: slim fit with long sleeves"
        className={TEXT_AREA}
      />
      <Button type="submit" pending={waiting} disabled={busy || text.trim() === ""}>
        Send
      </Button>
    </form>
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
