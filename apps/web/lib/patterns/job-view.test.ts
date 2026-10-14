import { describe, expect, it } from "vitest";
import { PATTERN_STALE_AFTER_MS, PATTERN_STALE_MESSAGE, isPatternStale, patternJobView, type PatternJobRow } from "./job-view";

const NOW = new Date("2026-10-13T12:00:00Z");

const row = (patch: Partial<PatternJobRow> = {}): PatternJobRow => ({
  id: "job-1",
  version: 3,
  status: "queued",
  size_label: "M",
  kind: "single",
  block_id: null,
  draft: null,
  pieces: null,
  notes: [],
  dxf_file_id: null,
  preview_file_id: null,
  error: null,
  created_at: new Date(NOW.getTime() - 60_000).toISOString(),
  ...patch,
});

describe("patternJobView", () => {
  it("says a queued job is waiting and a running one is being drafted", () => {
    expect(patternJobView(row(), NOW)).toMatchObject({ status: "waiting", size: "M", version: 3 });
    expect(patternJobView(row({ status: "running" }), NOW).status).toBe("drafting");
  });

  it("gives the files, the draft and the notes of a finished pattern", () => {
    const view = patternJobView(
      row({ status: "succeeded", draft: "men_knit_tee", pieces: 4, notes: ["Chest ease 10.2 cm."], dxf_file_id: "dxf", preview_file_id: "png" }),
      NOW,
    );

    expect(view).toMatchObject({
      status: "ready",
      draft: "men_knit_tee",
      pieces: 4,
      notes: ["Chest ease 10.2 cm."],
      dxfFileId: "dxf",
      previewFileId: "png",
      message: null,
    });
  });

  it("passes on the safe sentence of a failed job", () => {
    expect(patternJobView(row({ status: "failed", error: "No draft fits a hoodie yet." }), NOW)).toMatchObject({
      status: "failed",
      message: "No draft fits a hoodie yet.",
    });
  });

  it("gives up a job left unfinished too long, and never a finished one", () => {
    const old = new Date(NOW.getTime() - PATTERN_STALE_AFTER_MS - 1).toISOString();

    expect(isPatternStale(row({ created_at: old }), NOW)).toBe(true);
    expect(patternJobView(row({ created_at: old, status: "running" }), NOW)).toMatchObject({ status: "failed", message: PATTERN_STALE_MESSAGE });
    expect(isPatternStale(row({ created_at: old, status: "succeeded", dxf_file_id: "d" }), NOW)).toBe(false);
  });
});
