import { readJson } from "@/lib/http/read-json";
import { z } from "zod";
import { parseEvent, splitLines, type BrowserFollowUp, type BrowserOutcome, type StreamEvent } from "@/lib/intent/stream";

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
  /** Words to send as a new message, or to put in the box to finish. Null for a choice that applies changes. */
  readonly words: { readonly kind: "say" | "fill"; readonly text: string } | null;
}

/** One line of the conversation as it is kept for the design (lib/projects/chat-history). */
export interface StoredLine {
  readonly role: "person" | "assistant";
  readonly kind: ChatMessage["kind"];
  readonly body: string;
  readonly lines: readonly string[];
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

const followUpChoices = (followUp: BrowserFollowUp): ChatChoice[] =>
  followUp.choices.map((choice) =>
    choice.kind === "apply"
      ? { label: choice.label, token: choice.token, recommended: false, words: null }
      : { label: choice.label, token: null, recommended: false, words: { kind: choice.kind, text: choice.text } },
  );

/** Each part of a request that was not made, as its own bubble with its ways on. */
const withFollowUps = (state: ChatState, followUps: readonly BrowserFollowUp[]): ChatState =>
  followUps.reduce((current, followUp) => add(current, { from: "assistant", kind: "question", text: followUp.text, choices: followUpChoices(followUp) }), state);

function fromOutcome(state: ChatState, outcome: BrowserOutcome): ChatState {
  switch (outcome.kind) {
    case "applied": {
      const saved = add(state, { from: "assistant", kind: "applied", text: SAVED_TEXT, lines: [...outcome.explanations, ...outcome.notes] });
      return withFollowUps(saved, outcome.followUps ?? []);
    }
    case "question":
      return add(state, {
        from: "assistant",
        kind: "question",
        text: outcome.question,
        choices: outcome.choices.map((choice, index) => ({ ...choice, recommended: index === outcome.recommended, words: null })),
      });
    case "rejection": {
      const followUps = outcome.followUps ?? [];
      // A single part's reason is the answer itself, so its ways on go under it.
      if (followUps.length === 1) return add(state, { from: "assistant", kind: "rejection", text: outcome.reason, choices: followUpChoices(followUps[0]) });
      return withFollowUps(add(state, { from: "assistant", kind: "rejection", text: outcome.reason }), followUps);
    }
  }
}

function chose(state: ChatState, id: number, index: number): ChatState {
  const message = state.messages.find((entry) => entry.id === id);
  const choice = message?.choices[index];
  if (!message || !choice || message.answered !== null) return state;
  const answered = { ...state, messages: state.messages.map((entry) => (entry.id === id ? { ...entry, answered: index } : entry)) };
  // Words are said as a message of their own, so the label is not said as well.
  if (choice.words) return answered;
  return add(answered, { from: "person", kind: "text", text: choice.label }, choice.token ? "sending" : null);
}

/** The panel as it opens: the conversation kept for the design, oldest first. */
export const chatFromHistory = (lines: readonly StoredLine[]): ChatState =>
  lines.reduce<ChatState>((state, line) => add(state, { from: line.role, kind: line.kind, text: line.body, lines: [...line.lines] }), initialChat);

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
  const parsed = refusalSchema.safeParse(await readJson(response));
  return parsed.success ? parsed.data.error.message : FAILED_TEXT;
}
