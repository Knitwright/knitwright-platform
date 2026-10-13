import type { Dropped, SpecAction } from "@/lib/garment";

/**
 * Everything the editor remembers about changes on their way to the server, as a plain
 * reducer with no React in it. The screen sends an event for each thing that happens and
 * does what the state asks: send the change that is `inFlight`, read the design again when
 * `needsRefresh` is set. Keeping it here means it can be tested without a browser.
 *
 * The rules:
 * - Changes go one at a time, each at the newest version known. That version never goes down.
 * - Two waiting changes to one control become one: the later wins.
 * - A conflict drops the rest of the queue and stops, with one message. A newer version
 *   arriving (for example after Reload) clears it.
 * - When a reply is lost the server may or may not have saved, so nothing else is sent
 *   until the design has been read again.
 * - A problem belongs to the control that caused it. A success elsewhere never clears it.
 * - A choice shown before the server agrees is dropped when that control settles, and when
 *   the design's version changes.
 */

export type Request =
  | Readonly<{ kind: "action"; action: SpecAction }>
  /** Several changes saved as one version, so one undo takes them all back. */
  | Readonly<{ kind: "actions"; actions: readonly SpecAction[] }>
  | Readonly<{ kind: "restore"; version: number }>
  | Readonly<{ kind: "undo" }>;

export type Change = Readonly<{
  id: number;
  /** The control that asked, used to keep problems and choices with it. */
  key: string;
  request: Request;
  /** True when the person asked for the save with Enter or a button. */
  focus: boolean;
}>;

export type InFlight = Change & Readonly<{ expectedVersion: number }>;

export type Problem = Readonly<{
  message: string;
  /** What went wrong underneath, kept for the log. The person sees the message. */
  detail?: string;
  focus: boolean;
}>;

export interface EditorState {
  /** The newest version known. It never goes down. */
  readonly version: number;
  readonly nextId: number;
  readonly queue: readonly Change[];
  readonly inFlight: InFlight | null;
  readonly problems: Readonly<Record<string, Problem>>;
  /** One message for the whole design. While set, nothing more is sent. */
  readonly conflict: string | null;
  readonly needsRefresh: boolean;
  readonly optimistic: Readonly<Record<string, string>>;
  readonly status: string | null;
  readonly dropped: readonly Dropped[] | null;
  /** The control that should take focus, until the page has done it. */
  readonly focusKey: string | null;
}

export type EditorEvent =
  | Readonly<{ type: "choose"; key: string; value: string }>
  | Readonly<{ type: "enqueue"; key: string; request: Request; focus: boolean }>
  | Readonly<{ type: "start" }>
  | Readonly<{ type: "succeeded"; id: number; version: number; dropped: readonly Dropped[] }>
  | Readonly<{ type: "failed"; id: number; code: string; message: string }>
  | Readonly<{ type: "lost"; id: number; message: string; detail: string }>
  | Readonly<{ type: "refreshed"; version: number }>
  | Readonly<{ type: "refreshFailed"; message: string }>
  | Readonly<{ type: "seen"; version: number }>
  | Readonly<{ type: "problem"; key: string; message: string; focus: boolean }>
  | Readonly<{ type: "clearProblem"; key: string }>
  | Readonly<{ type: "focused" }>;

export const initialEditorState = (version: number): EditorState => ({
  version,
  nextId: 1,
  queue: [],
  inFlight: null,
  problems: {},
  conflict: null,
  needsRefresh: false,
  optimistic: {},
  status: null,
  dropped: null,
  focusKey: null,
});

/** True while anything is waiting, on its way, or picked but not yet sent. Undo and restore wait for it to end. */
export const isBusy = (state: EditorState): boolean =>
  state.inFlight !== null || state.queue.length > 0 || Object.keys(state.optimistic).length > 0;

export const canStart = (state: EditorState): boolean =>
  state.inFlight === null && state.queue.length > 0 && state.conflict === null && !state.needsRefresh;

/** What a control shows: the choice being saved if there is one, else the server's. */
export const shownChoice = (state: EditorState, key: string, serverChoice: string | null): string | null =>
  state.optimistic[key] ?? serverChoice;

/** The choice a change was for, or undefined when it was not a choice. */
const choiceOf = (change: Change): string | undefined =>
  change.request.kind === "action" && change.request.action.type === "set-option"
    ? change.request.action.choiceId
    : undefined;

/** Drops the choice shown for a control once the change that carried it settles. A newer pick stays. */
const settled = (optimistic: Readonly<Record<string, string>>, change: Change): Record<string, string> => {
  const choice = choiceOf(change);
  const newer = choice !== undefined && optimistic[change.key] !== undefined && optimistic[change.key] !== choice;
  return newer ? { ...optimistic } : without(optimistic, change.key);
};

const without = <T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));

/** A newer version than any known: it replaces the old one and ends a conflict. */
const seenVersion = (state: EditorState, version: number): EditorState =>
  version > state.version ? { ...state, version, conflict: null, optimistic: {} } : state;

const enqueue = (state: EditorState, event: Extract<EditorEvent, { type: "enqueue" }>): EditorState => {
  if (state.conflict !== null) return state;
  const replaces = event.request.kind === "action" || event.request.kind === "actions";
  const kept = replaces ? state.queue.filter((change) => change.key !== event.key) : state.queue;
  const change: Change = { id: state.nextId, key: event.key, request: event.request, focus: event.focus };
  return { ...state, nextId: state.nextId + 1, queue: [...kept, change] };
};

const start = (state: EditorState): EditorState => {
  if (!canStart(state)) return state;
  const [next, ...rest] = state.queue;
  return { ...state, queue: rest, inFlight: { ...next, expectedVersion: state.version } };
};

const succeeded = (state: EditorState, event: Extract<EditorEvent, { type: "succeeded" }>): EditorState => {
  if (state.inFlight?.id !== event.id) return state;
  const { key } = state.inFlight;
  return {
    ...state,
    inFlight: null,
    version: Math.max(state.version, event.version),
    problems: without(state.problems, key),
    optimistic: settled(state.optimistic, state.inFlight),
    status: event.version > state.version ? `Saved as version ${event.version}.` : "Nothing changed.",
    dropped: event.dropped,
  };
};

const failed = (state: EditorState, event: Extract<EditorEvent, { type: "failed" }>): EditorState => {
  const change = state.inFlight;
  if (change?.id !== event.id) return state;
  if (event.code === "conflict") {
    return { ...state, inFlight: null, queue: [], optimistic: {}, conflict: event.message, status: null };
  }
  return {
    ...state,
    inFlight: null,
    optimistic: settled(state.optimistic, change),
    problems: { ...state.problems, [change.key]: { message: event.message, focus: change.focus } },
    focusKey: change.focus ? change.key : state.focusKey,
    status: null,
  };
};

const lost = (state: EditorState, event: Extract<EditorEvent, { type: "lost" }>): EditorState => {
  const change = state.inFlight;
  if (change?.id !== event.id) return state;
  return {
    ...state,
    inFlight: null,
    needsRefresh: true,
    optimistic: settled(state.optimistic, change),
    problems: { ...state.problems, [change.key]: { message: event.message, detail: event.detail, focus: false } },
    status: null,
  };
};

export const editorReducer = (state: EditorState, event: EditorEvent): EditorState => {
  switch (event.type) {
    case "choose":
      return { ...state, optimistic: { ...state.optimistic, [event.key]: event.value } };
    case "enqueue":
      return enqueue(state, event);
    case "start":
      return start(state);
    case "succeeded":
      return succeeded(state, event);
    case "failed":
      return failed(state, event);
    case "lost":
      return lost(state, event);
    case "refreshed":
      return seenVersion({ ...state, needsRefresh: false }, event.version);
    case "refreshFailed":
      return { ...state, needsRefresh: false, queue: [], conflict: event.message };
    case "seen":
      return seenVersion(state, event.version);
    case "problem":
      return {
        ...state,
        problems: { ...state.problems, [event.key]: { message: event.message, focus: event.focus } },
        focusKey: event.focus ? event.key : state.focusKey,
      };
    case "clearProblem":
      return { ...state, problems: without(state.problems, event.key) };
    case "focused":
      return { ...state, focusKey: null };
  }
};
