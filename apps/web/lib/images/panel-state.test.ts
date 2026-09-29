import { describe, expect, it } from "vitest";
import type { JobView } from "./job-view";
import { ILLUSTRATION_LABEL, MAX_POLLS, TIRED_MESSAGE, canStart, initialPanel, nextPanel, versionNote, type PanelState } from "./panel-state";

const IMAGES = [
  { view: "front" as const, fileId: "f" },
  { view: "back" as const, fileId: "b" },
];

const view = (patch: Partial<JobView>): JobView => ({
  id: "job-1",
  version: 2,
  status: "working",
  images: [],
  message: null,
  ...patch,
});

const working = (): PanelState =>
  nextPanel(nextPanel(initialPanel([]), { type: "start" }), { type: "started", jobId: "job-1" });

describe("panel state", () => {
  it("starts idle, showing the images made before", () => {
    expect(initialPanel(IMAGES)).toMatchObject({ phase: "idle", images: IMAGES, message: null });
  });

  it("goes from starting to working once the server answers with a job", () => {
    const starting = nextPanel(initialPanel([]), { type: "start" });

    expect(starting.phase).toBe("starting");
    expect(canStart(starting)).toBe(false);
    expect(working()).toMatchObject({ phase: "working", jobId: "job-1", polls: 0 });
  });

  it("keeps the old images and shows the reason when the start is refused", () => {
    const state = nextPanel(nextPanel(initialPanel(IMAGES), { type: "start" }), {
      type: "start-failed",
      message: "You have used today's allowance.",
    });

    expect(state).toMatchObject({ phase: "failed", images: IMAGES, message: "You have used today's allowance." });
    expect(canStart(state)).toBe(true);
  });

  it("counts polls while the job works", () => {
    const state = nextPanel(working(), { type: "polled", job: view({}) });

    expect(state).toMatchObject({ phase: "working", polls: 1 });
    expect(canStart(state)).toBe(false);
  });

  it("shows the new images when the job succeeds", () => {
    const state = nextPanel(working(), { type: "polled", job: view({ status: "succeeded", images: IMAGES }) });

    expect(state).toMatchObject({ phase: "done", images: IMAGES, jobId: null });
    expect(canStart(state)).toBe(true);
  });

  it("shows the job's sentence when it fails", () => {
    const state = nextPanel(working(), { type: "polled", job: view({ status: "failed", message: "It broke." }) });

    expect(state).toMatchObject({ phase: "failed", message: "It broke." });
  });

  it("stops polling after the most polls, and says the images may still come", () => {
    let state = working();
    for (let poll = 0; poll < MAX_POLLS; poll += 1) state = nextPanel(state, { type: "poll-failed" });

    expect(state).toMatchObject({ phase: "failed", message: TIRED_MESSAGE });
  });

  it("ignores an answer for a job it is not waiting for", () => {
    const idle = initialPanel(IMAGES);

    expect(nextPanel(idle, { type: "polled", job: view({ status: "succeeded" }) })).toBe(idle);
    expect(nextPanel(idle, { type: "started", jobId: "job-9" })).toBe(idle);
  });
});

describe("versionNote", () => {
  it("says nothing when the images show the design as it is", () => {
    expect(versionNote(4, 4)).toBeNull();
  });

  it("says which version the images show once the design has moved on", () => {
    expect(versionNote(2, 5)).toBe("Made from version 2. The design has changed since.");
  });
});

describe("ILLUSTRATION_LABEL", () => {
  it("says the pictures are illustrations and not the specification", () => {
    expect(ILLUSTRATION_LABEL).toMatch(/illustration/i);
    expect(ILLUSTRATION_LABEL).toMatch(/specification/i);
  });
});
