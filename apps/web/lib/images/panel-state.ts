import type { JobImage, JobView } from "./job-view";

/**
 * What the photoreal panel shows, as a pure function of what has happened. The panel
 * asks for images only when the user presses the button, then polls the job. Plan step 14,
 * tasks 3 and 4.
 */

export const POLL_INTERVAL_MS = 2000;
/** About two minutes of polling, past the job's own time limit. */
export const MAX_POLLS = 60;

export const TIRED_MESSAGE = "This is taking longer than usual. Reload the page in a minute to see the images.";

/** Shown next to every generated picture, here and in the tech pack. Plan step 14, task 5. */
export const ILLUSTRATION_LABEL =
  "Illustration made by AI. It can show details the design does not have. The flats and the tech pack are the specification.";

/** A note when the pictures show an older version of the design, or null. */
export const versionNote = (madeFrom: number, current: number): string | null =>
  madeFrom < current ? `Made from version ${madeFrom}. The design has changed since.` : null;

export interface PanelState {
  readonly phase: "idle" | "starting" | "working" | "done" | "failed";
  readonly jobId: string | null;
  readonly polls: number;
  readonly images: readonly JobImage[];
  readonly message: string | null;
}

type PanelEvent =
  | Readonly<{ type: "start" }>
  | Readonly<{ type: "started"; jobId: string }>
  | Readonly<{ type: "start-failed"; message: string }>
  | Readonly<{ type: "polled"; job: JobView }>
  | Readonly<{ type: "poll-failed" }>;

export const initialPanel = (images: readonly JobImage[]): PanelState => ({
  phase: "idle",
  jobId: null,
  polls: 0,
  images,
  message: null,
});

export const canStart = (state: PanelState): boolean => state.phase !== "starting" && state.phase !== "working";

const failed = (state: PanelState, message: string | null): PanelState => ({
  ...state,
  phase: "failed",
  jobId: null,
  message,
});

const polledOnce = (state: PanelState): PanelState =>
  state.polls + 1 >= MAX_POLLS ? failed(state, TIRED_MESSAGE) : { ...state, polls: state.polls + 1 };

export function nextPanel(state: PanelState, event: PanelEvent): PanelState {
  if (event.type === "start") {
    return canStart(state) ? { ...state, phase: "starting", jobId: null, polls: 0, message: null } : state;
  }
  if (event.type === "started") {
    return state.phase === "starting" ? { ...state, phase: "working", jobId: event.jobId } : state;
  }
  if (event.type === "start-failed") return state.phase === "starting" ? failed(state, event.message) : state;
  if (state.phase !== "working") return state;
  if (event.type === "poll-failed") return polledOnce(state);
  if (event.job.id !== state.jobId) return state;
  if (event.job.status === "succeeded") {
    return { ...state, phase: "done", jobId: null, images: event.job.images, message: null };
  }
  if (event.job.status === "failed") return failed(state, event.job.message);
  return polledOnce(state);
}
