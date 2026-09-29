import { describe, expect, it } from "vitest";
import { JOB_STALE_AFTER_MS, STALE_MESSAGE, isStale, jobView, type JobRow } from "./job-view";

const NOW = new Date("2026-09-29T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const row = (patch: Partial<JobRow> = {}): JobRow => ({
  id: "job-1",
  version: 3,
  status: "running",
  front_file_id: null,
  back_file_id: null,
  error: null,
  usage_event_id: "event-1",
  created_at: ago(1000),
  ...patch,
});

describe("isStale", () => {
  it("is false for a job still inside its time", () => {
    expect(isStale(row({ created_at: ago(JOB_STALE_AFTER_MS - 1) }), NOW)).toBe(false);
  });

  it("is true for an unfinished job past its time: the server that ran it has stopped", () => {
    expect(isStale(row({ status: "queued", created_at: ago(JOB_STALE_AFTER_MS + 1) }), NOW)).toBe(true);
    expect(isStale(row({ status: "running", created_at: ago(JOB_STALE_AFTER_MS + 1) }), NOW)).toBe(true);
  });

  it("is false for a finished job, however old", () => {
    expect(isStale(row({ status: "succeeded", created_at: ago(JOB_STALE_AFTER_MS * 10) }), NOW)).toBe(false);
    expect(isStale(row({ status: "failed", error: "x", created_at: ago(JOB_STALE_AFTER_MS * 10) }), NOW)).toBe(false);
  });
});

describe("jobView", () => {
  it("says an unfinished job is working, with no images", () => {
    expect(jobView(row({ status: "queued" }), NOW)).toEqual({
      id: "job-1",
      version: 3,
      status: "working",
      images: [],
      message: null,
    });
  });

  it("lists the front and then the back of a finished job", () => {
    const view = jobView(row({ status: "succeeded", front_file_id: "f", back_file_id: "b" }), NOW);

    expect(view.status).toBe("succeeded");
    expect(view.images).toEqual([
      { view: "front", fileId: "f" },
      { view: "back", fileId: "b" },
    ]);
  });

  it("passes on the safe sentence of a failed job", () => {
    expect(jobView(row({ status: "failed", error: "It broke." }), NOW)).toMatchObject({
      status: "failed",
      message: "It broke.",
    });
  });

  it("reports a stale job as failed, before anything has marked it so", () => {
    expect(jobView(row({ created_at: ago(JOB_STALE_AFTER_MS + 1) }), NOW)).toMatchObject({
      status: "failed",
      message: STALE_MESSAGE,
    });
  });
});
