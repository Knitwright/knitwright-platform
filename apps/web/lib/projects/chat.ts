import { z } from "zod";
import { parseEvent, splitLines, type BrowserOutcome, type StreamEvent } from "@/lib/intent/stream";

/**
 * What the assistant's chat panel shows, as a pure reducer (plan step 12, task 5). The
 * panel component only sends messages and draws this state.
 */

export type Pending = "sending" | "model" | "retry" | null;

export interface ChatChoice {
  readonly label: string;
  /** The signed proposal to apply, or null for a choice that changes nothing. */
  readonly token: string | null;
  readonly recommended: boolean;
}

export interface ChatMessage {
  readonly id: number;
  readonly from: "person" | "assistant";
  readonly kind: "text" | "applied" | "question" | "rejection" | "failed";
  readonly text: string;
  readonly lines: readonly string[];
  readonly choices: readonly ChatChoice[];
  /** The index of the choice made, once one is made. */
  readonly answered: number | null;
}

export interface ChatState {
  readonly messages: readonly ChatMessage[];
  readonly pending: Pending;
}

export type ChatEvent =
  | { readonly type: "sent"; readonly text: string }
  | { readonly type: "stage"; readonly stage: "model" | "retry" }
  | { readonly type: "outcome"; readonly outcome: BrowserOutcome }
  | { readonly type: "failed"; readonly message: string }
  | { readonly type: "chose"; readonly id: number; readonly index: number }
  | { readonly type: "choiceApplied"; readonly text: string };

export const initialChat: ChatState = { messages: [], pending: null };

export const SAVED_TEXT = "Done. The design is saved as a new version.";
const FAILED_TEXT = "The assistant could not answer just now. Nothing was changed. Try again in a moment.";

const PENDING_TEXT: Readonly<Record<Exclude<Pending, null>, string>> = {
  sending: "Reading your request...",
  model: "Asking the assistant...",
  retry: "Checking with a stronger model before asking you...",
};

export const pendingText = (pending: Pending): string | null => (pending ? PENDING_TEXT[pending] : null);

function add(state: ChatState, message: Omit<ChatMessage, "id" | "lines" | "choices" | "answered"> & Partial<ChatMessage>, pending: Pending = null): ChatState {
  const id = state.messages.length + 1;
  return { pending, messages: [...state.messages, { lines: [], choices: [], answered: null, ...message, id }] };
}

function fromOutcome(state: ChatState, outcome: BrowserOutcome): ChatState {
  switch (outcome.kind) {
    case "applied":
      return add(state, { from: "assistant", kind: "applied", text: SAVED_TEXT, lines: [...outcome.explanations, ...outcome.notes] });
    case "question":
      return add(state, {
        from: "assistant",
        kind: "question",
        text: outcome.question,
        choices: outcome.choices.map((choice, index) => ({ ...choice, recommended: index === outcome.recommended })),
      });
    case "rejection":
      return add(state, { from: "assistant", kind: "rejection", text: outcome.reason });
  }
}

function chose(state: ChatState, id: number, index: number): ChatState {
  const message = state.messages.find((entry) => entry.id === id);
  const choice = message?.choices[index];
  if (!message || !choice || message.answered !== null) return state;
  const answered = { ...state, messages: state.messages.map((entry) => (entry.id === id ? { ...entry, answered: index } : entry)) };
  return add(answered, { from: "person", kind: "text", text: choice.label }, choice.token ? "sending" : null);
}

export function chatReducer(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case "sent":
      return add(state, { from: "person", kind: "text", text: event.text }, "sending");
    case "stage":
      return { ...state, pending: event.stage };
    case "outcome":
      return fromOutcome(state, event.outcome);
    case "failed":
      return add(state, { from: "assistant", kind: "failed", text: event.message });
    case "chose":
      return chose(state, event.id, event.index);
    case "choiceApplied":
      return add(state, { from: "assistant", kind: "applied", text: SAVED_TEXT, lines: [event.text] });
  }
}

/** Reads a streamed answer, handing over each event. True when an outcome or a failure arrived. */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: StreamEvent) => void): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let rest = "";
  let finished = false;
  const hand = (lines: readonly string[]) => {
    for (const line of lines) {
      const event = parseEvent(line);
      if (!event) continue;
      if (event.type !== "stage") finished = true;
      onEvent(event);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const split = splitLines(rest, decoder.decode(value, { stream: true }));
    rest = split.rest;
    hand(split.lines);
  }
  hand(rest.trim() === "" ? [] : [rest]);
  return finished;
}

const refusalSchema = z.object({ error: z.object({ message: z.string() }) });

/** The message of a request the server refused before answering (an allowance, the rate limit, a conflict). */
export async function refusalMessage(response: Response): Promise<string> {
  const parsed = refusalSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data.error.message : FAILED_TEXT;
}
