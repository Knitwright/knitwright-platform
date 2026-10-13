import type { Dropped, GarmentSpec, SpecAction } from "@/lib/garment";
import type { ColourChange } from "./colour-controls";
import { resolveRequest, savedBase } from "./effective-spec";

/**
 * Everything the editor remembers about changes on their way to the server, as a plain
 * reducer with no React in it. The screen sends an event for each thing that happens and
 * does what the state asks: send the change that is `inFlight`, read the design again while
 * `check` is set. Keeping it here means it can be tested without a browser.
 *
 * The rules:
 * - Changes go one at a time, each at the newest version known. That version never goes down.
 * - Each change is worked out when it is sent, on top of every change the server has saved,
 *   even one the page does not show yet. A colour change is kept as the change to one part
 *   until then, so a second colour never undoes the first.
 * - Two waiting changes to one control become one: the later wins, and two colour changes
 *   to one part are joined.
 * - A conflict is checked first. When every newer version is the person's own, the change
 *   is sent again on top of it. Only a change by someone else stops everything, with one
 *   message. A newer version arriving (for example after Reload) clears it.
 * - When a reply is lost the server may or may not have saved, so nothing else is sent
 *   until the design has been read again.
 * - A save that failed on our side, or that never reached the server, can be tried again.
 * - A problem belongs to the control that caused it. A success elsewhere never clears it.
 * - A choice shown before the server agrees is dropped when that control settles, and when
 *   the design's version changes.
 */

export type Request =
  | Readonly<{ kind: "action"; action: SpecAction }>
  /** Several changes saved as one version, so one undo takes them all back. */
  | Readonly<{ kind: "actions"; actions: readonly SpecAction[] }>
  /** A change to the colour of one part. It is made into a colourway change when it is sent. */
  | Readonly<{ kind: "colour"; panelId: string; change: ColourChange; colourwayId?: string }>
  | Readonly<{ kind: "restore"; version: number }>
  | Readonly<{ kind: "undo" }>;

export type Change = Readonly<{
  id: number;
  /** The control that asked, used to keep problems and choices with it. */
  key: string;
  request: Request;
  /** True when the person asked for the save with Enter or a button. */
  focus: boolean;
  /** How many times it was sent again after a conflict with the person's own save. */
  tries?: number;
}>;

export type InFlight = Change & Readonly<{ expectedVersion: number }>;

export type Problem = Readonly<{
  message: string;
  /** What went wrong underneath, kept for the log. The person sees the message. */
  detail?: string;
  focus: boolean;
}>;

/** A change the server saved, kept until the page shows the version it made. */
export type SavedChange = Readonly<{ version: number; action: SpecAction }>;

/** A change whose answer is not known: the reply was lost, or the server said the design moved on. */
export type Check = Readonly<{
  reason: "lost" | "conflict";
  /** The version the change was sent at. */
  since: number;
  change: Change;
  message: string;
}>;

/** A save that did not go through and can be tried again. */
export type Retry = Readonly<{ change: Change; message: string }>;

export interface EditorState {
  /** The newest version known. It never goes down. */
  readonly version: number;
  /** The version of the design the page holds. */
  readonly shown: number;
  /** Changes saved at versions newer than the page shows, oldest first. */
  readonly saved: readonly SavedChange[];
  /** The page must show at least this version before anything more is sent. */
  readonly catchUp: number;
  readonly nextId: number;
  readonly queue: readonly Change[];
  readonly inFlight: InFlight | null;
  readonly problems: Readonly<Record<string, Problem>>;
  /** One message for the whole design. While set, nothing more is sent. */
  readonly conflict: string | null;
  /** While set, the design is read again before anything more is sent. */
  readonly check: Check | null;
  readonly retry: Retry | null;
  readonly optimistic: Readonly<Record<string, string>>;
  readonly status: string | null;
  readonly dropped: readonly Dropped[] | null;
  /** The control that should take focus, until the page has done it. */
  readonly focusKey: string | null;
}

export type EditorEvent =
  | Readonly<{ type: "choose"; key: string; value: string }>
  | Readonly<{ type: "enqueue"; key: string; request: Request; focus: boolean }>
  /** `spec` is the design the page holds. A colour change is worked out from it. */
  | Readonly<{ type: "start"; spec?: GarmentSpec }>
  | Readonly<{ type: "succeeded"; id: number; version: number; dropped: readonly Dropped[] }>
  | Readonly<{ type: "failed"; id: number; code: string; message: string }>
  | Readonly<{ type: "lost"; id: number; message: string; detail: string }>
  /** The design was read again: its version, and how many versions since the check by someone else. */
  | Readonly<{ type: "verified"; version: number; others: number }>
  | Readonly<{ type: "verifyFailed"; message: string }>
  | Readonly<{ type: "retry" }>
  | Readonly<{ type: "seen"; version: number }>
  | Readonly<{ type: "problem"; key: string; message: string; focus: boolean }>
  | Readonly<{ type: "clearProblem"; key: string }>
  | Readonly<{ type: "focused" }>;

/** Failures on our side or on the way. The same change may well work a moment later. */
const RETRYABLE = new Set(["internal", "unavailable", "rate_limited"]);

/** A change is sent again after a conflict with the person's own save at most this many times. */
const MAX_TRIES = 1;

const NOT_WORKED_OUT = "This change could not be worked out. Reload the page and try again.";

export const initialEditorState = (version: number): EditorState => ({
  version,
  shown: version,
  saved: [],
  catchUp: version,
  nextId: 1,
  queue: [],
  inFlight: null,
  problems: {},
  conflict: null,
  check: null,
  retry: null,
  optimistic: {},
  status: null,
  dropped: null,
  focusKey: null,
});

/** True while anything is waiting, on its way, being checked, or picked but not yet sent. Undo and restore wait for it to end. */
export const isBusy = (state: EditorState): boolean =>
  state.inFlight !== null ||
  state.queue.length > 0 ||
  state.check !== null ||
  Object.keys(state.optimistic).length > 0;

/** True while a change is waiting for the page to show a version this screen cannot work out itself. */
export const waitingForPage = (state: EditorState): boolean => state.queue.length > 0 && state.shown < state.catchUp;

export const canStart = (state: EditorState): boolean =>
  state.inFlight === null &&
  state.queue.length > 0 &&
  state.conflict === null &&
  state.check === null &&
  state.shown >= state.catchUp;

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

/** The change as it was asked for, without the version it was sent at. */
const asChange = ({ id, key, request, focus, tries }: InFlight): Change => ({ id, key, request, focus, tries });

/** Stops everything with one message. Nothing waiting is kept. */
const stop = (state: EditorState, message: string): EditorState => ({
  ...state,
  inFlight: null,
  queue: [],
  optimistic: {},
  saved: [],
  check: null,
  conflict: message,
  status: null,
});

/** The page shows a version: saved changes it now holds are forgotten. A newer version than any known ends a conflict. */
const seenVersion = (state: EditorState, version: number): EditorState => {
  const shown = Math.max(state.shown, version);
  const saved = state.saved.filter((entry) => entry.version > shown);
  const moved = shown !== state.shown || saved.length !== state.saved.length;
  const known = moved ? { ...state, shown, saved } : state;
  return version > state.version ? { ...known, version, conflict: null, optimistic: {} } : known;
};

/** Two changes to the colour of one part become one, with the later fields winning. */
const joined = (earlier: Change | undefined, request: Request): Request =>
  earlier?.request.kind === "colour" && request.kind === "colour" && earlier.request.panelId === request.panelId
    ? { ...request, change: { ...earlier.request.change, ...request.change } }
    : request;

const enqueue = (state: EditorState, event: Extract<EditorEvent, { type: "enqueue" }>): EditorState => {
  if (state.conflict !== null) return { ...state, optimistic: without(state.optimistic, event.key) };
  const { kind } = event.request;
  const replaces = kind === "action" || kind === "actions" || kind === "colour";
  const earlier = replaces ? state.queue.find((change) => change.key === event.key) : undefined;
  const kept = replaces ? state.queue.filter((change) => change.key !== event.key) : state.queue;
  const change: Change = { id: state.nextId, key: event.key, request: joined(earlier, event.request), focus: event.focus };
  return { ...state, nextId: state.nextId + 1, queue: [...kept, change] };
};

const start = (state: EditorState, spec: GarmentSpec | undefined): EditorState => {
  if (!canStart(state)) return state;
  const [next, ...rest] = state.queue;
  const base = spec ? savedBase(spec, state.saved) : null;
  const resolved = resolveRequest(base, next.request);
  if (resolved.kind === "problem") {
    const problem: Problem = { message: resolved.reason || NOT_WORKED_OUT, focus: next.focus };
    return {
      ...state,
      queue: rest,
      problems: { ...state.problems, [next.key]: problem },
      focusKey: next.focus ? next.key : state.focusKey,
    };
  }
  return { ...state, queue: rest, inFlight: { ...next, request: resolved.request, expectedVersion: state.version } };
};

/** Keeps what the server saved until the page shows it, so the next change is worked out on top of it. */
const remember = (state: EditorState, change: InFlight, version: number): Partial<EditorState> => {
  if (version <= Math.max(state.version, state.shown)) return {};
  const { request } = change;
  if (request.kind === "action") return { saved: [...state.saved, { version, action: request.action }] };
  // A batch is one version: each of its changes is kept under it, in order.
  if (request.kind === "actions") return { saved: [...state.saved, ...request.actions.map((action) => ({ version, action }))] };
  // An undo or a restore cannot be worked out here, so the page is waited for.
  return { catchUp: Math.max(state.catchUp, version) };
};

const succeeded = (state: EditorState, event: Extract<EditorEvent, { type: "succeeded" }>): EditorState => {
  const change = state.inFlight;
  if (change?.id !== event.id) return state;
  return {
    ...state,
    ...remember(state, change, event.version),
    inFlight: null,
    version: Math.max(state.version, event.version),
    problems: without(state.problems, change.key),
    retry: state.retry?.change.key === change.key ? null : state.retry,
    optimistic: settled(state.optimistic, change),
    status: event.version > state.version ? `Saved as version ${event.version}.` : "Nothing changed.",
    dropped: event.dropped,
  };
};

const failed = (state: EditorState, event: Extract<EditorEvent, { type: "failed" }>): EditorState => {
  const change = state.inFlight;
  if (change?.id !== event.id) return state;
  if (event.code === "conflict") {
    if ((change.tries ?? 0) >= MAX_TRIES) return stop(state, event.message);
    const check: Check = { reason: "conflict", since: change.expectedVersion, change: asChange(change), message: event.message };
    return { ...state, inFlight: null, check, status: null };
  }
  const optimistic = settled(state.optimistic, change);
  if (RETRYABLE.has(event.code)) {
    return { ...state, inFlight: null, optimistic, retry: { change: asChange(change), message: event.message }, status: null };
  }
  return {
    ...state,
    inFlight: null,
    optimistic,
    problems: { ...state.problems, [change.key]: { message: event.message, focus: change.focus } },
    focusKey: change.focus ? change.key : state.focusKey,
    status: null,
  };
};

const lost = (state: EditorState, event: Extract<EditorEvent, { type: "lost" }>): EditorState => {
  const change = state.inFlight;
  if (change?.id !== event.id) return state;
  const check: Check = { reason: "lost", since: change.expectedVersion, change: asChange(change), message: event.message };
  return { ...state, inFlight: null, check, optimistic: settled(state.optimistic, change), status: null };
};

/** Puts a change back at the front of the queue under a new number, so that it is sent again. */
const again = (state: EditorState, change: Change, tries: number): Pick<EditorState, "nextId" | "queue"> => ({
  nextId: state.nextId + 1,
  queue: [{ ...change, id: state.nextId, tries }, ...state.queue],
});

const verified = (state: EditorState, event: Extract<EditorEvent, { type: "verified" }>): EditorState => {
  const { check } = state;
  if (!check) return state;
  const version = Math.max(state.version, event.version);
  const waitFor = { version, catchUp: Math.max(state.catchUp, event.version), check: null };
  if (check.reason === "lost") {
    // A newer version means the change was most likely saved. The page is waited for, to show it.
    if (event.version > check.since) return { ...state, ...waitFor };
    return { ...state, check: null, retry: { change: check.change, message: check.message } };
  }
  if (event.others > 0) return stop(state, check.message);
  return { ...state, ...waitFor, ...again(state, check.change, (check.change.tries ?? 0) + 1) };
};

const retry = (state: EditorState): EditorState => {
  const waiting = state.retry;
  if (!waiting) return state;
  const newer = state.queue.some((change) => change.key === waiting.change.key);
  if (newer || state.conflict !== null) return { ...state, retry: null };
  return { ...state, retry: null, ...again(state, waiting.change, waiting.change.tries ?? 0) };
};

export const editorReducer = (state: EditorState, event: EditorEvent): EditorState => {
  switch (event.type) {
    case "choose":
      if (state.conflict !== null) return state;
      return { ...state, optimistic: { ...state.optimistic, [event.key]: event.value } };
    case "enqueue":
      return enqueue(state, event);
    case "start":
      return start(state, event.spec);
    case "succeeded":
      return succeeded(state, event);
    case "failed":
      return failed(state, event);
    case "lost":
      return lost(state, event);
    case "verified":
      return verified(state, event);
    case "verifyFailed":
      return stop(state, event.message);
    case "retry":
      return retry(state);
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
