import type { MediaSetView } from "@/lib/media/view";
import { SAME_VERSION_MESSAGE, TIMEOUT_MESSAGE, UNLOCKED_LABEL } from "./copy";

/** What the media screen is doing, as plain data and one reducer, so the screen holds markup and wiring only. */

export const POLL_INTERVAL_MS = 1500;
/** About a minute and a half: past the server's own 50 second limit for a set. */
export const POLL_LIMIT = 60;

export type Notice = Readonly<{ tone: "ok" | "info" | "warn"; text: string }>;
export type Busy = "start" | "unlock" | "clip" | "turntable";

export type State = Readonly<{
  phase: "loading" | "empty" | "working" | "ready" | "failed";
  set: MediaSetView | null;
  busy: Busy | null;
  /** Set while a clip has been asked for and is not in the set yet. */
  awaiting: "clip" | null;
  message: Notice | null;
  polls: number;
}>;

export const INITIAL: State = { phase: "loading", set: null, busy: null, awaiting: null, message: null, polls: 0 };

export type Action =
  | { type: "loaded"; set: MediaSetView | null }
  | { type: "problem"; message: string }
  | { type: "make" }
  | { type: "made"; created: boolean; set: MediaSetView }
  | { type: "polled"; set: MediaSetView }
  | { type: "pollFailed" }
  | { type: "unlock" }
  | { type: "unlocked"; set: MediaSetView }
  | { type: "clip" }
  | { type: "clipStarted"; state: "exists" | "started" }
  | { type: "turntable" }
  | { type: "turntableDone"; message: string; tone: "ok" | "warn"; set: MediaSetView | null };

const phaseOf = (set: MediaSetView | null): State["phase"] => {
  if (!set) return "empty";
  if (set.status === "failed") return "failed";
  return set.status === "succeeded" ? "ready" : "working";
};

const hasClip = (set: MediaSetView): boolean => set.items.some((entry) => entry.kind === "clip");

/** A new set from the server: the phase follows it, and a clip that has arrived ends the wait for it. */
const withSet = (state: State, set: MediaSetView): State => ({
  ...state,
  set,
  phase: phaseOf(set),
  awaiting: state.awaiting === "clip" && !hasClip(set) ? "clip" : null,
});

const waiting = (state: State): boolean => state.phase === "working" || state.awaiting === "clip";

/** One more look at the server. At the limit the screen stops looking and says so. */
const tick = (state: State): State => {
  const polls = state.polls + 1;
  return polls >= POLL_LIMIT && waiting(state) ? { ...state, polls, awaiting: null, message: { tone: "warn", text: TIMEOUT_MESSAGE } } : { ...state, polls };
};

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "loaded":
      return { ...state, set: action.set, phase: phaseOf(action.set), message: null, polls: 0 };
    case "problem":
      // Whatever pictures the screen already has stay; a first load that failed shows the empty screen with the reason.
      return { ...state, busy: null, awaiting: null, phase: state.phase === "loading" ? "empty" : state.phase, message: { tone: "warn", text: action.message } };
    case "make":
      return { ...state, busy: "start", message: null };
    case "made": {
      const next = withSet({ ...state, busy: null, polls: 0, message: null }, action.set);
      return !action.created && action.set.status === "succeeded" ? { ...next, message: { tone: "info", text: SAME_VERSION_MESSAGE } } : next;
    }
    case "polled":
      return tick(withSet(state, action.set));
    case "pollFailed":
      return tick(state);
    case "unlock":
      return { ...state, busy: "unlock", message: null };
    case "unlocked":
      return { ...withSet(state, action.set), busy: null, message: { tone: "ok", text: UNLOCKED_LABEL } };
    case "clip":
      return { ...state, busy: "clip", message: null };
    case "clipStarted":
      return { ...state, busy: null, polls: 0, awaiting: action.state === "started" ? "clip" : null };
    case "turntable":
      return { ...state, busy: "turntable", message: null };
    case "turntableDone": {
      const next = action.set ? withSet(state, action.set) : state;
      return { ...next, busy: null, message: { tone: action.tone, text: action.message } };
    }
  }
}

/** True while the screen should read the set again: it is being made, or a clip is on its way. */
export const shouldPoll = (state: State): boolean => waiting(state) && state.polls < POLL_LIMIT;

/** Making is allowed unless a request is out or the set is being made; once the screen has given up waiting, asking again reads where it got to. */
export const canMake = (state: State): boolean =>
  state.busy === null && (state.phase === "empty" || state.phase === "ready" || state.phase === "failed" || (state.phase === "working" && state.polls >= POLL_LIMIT));

/** Credits are used only on a finished set that is still locked. */
export const canUnlock = (state: State): boolean => state.busy === null && state.phase === "ready" && state.set !== null && !state.set.unlocked;
