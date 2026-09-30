import { describe, expect, it, vi } from "vitest";
import type { GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { DEFAULT_CHART_SET } from "@/lib/sizing";
import { stubImageProvider } from "@/lib/providers/image-stub";
import { AppError } from "@/lib/server/core/errors";
import { NO_DRAWING_MESSAGE, NOT_SET_UP_MESSAGE, startImageJob, type StartDeps } from "./start";

const makeDeps = (patch: Partial<StartDeps> = {}) => {
  const scheduled: (() => Promise<unknown>)[] = [];
  const stub = stubImageProvider();
  const deps: StartDeps = {
    provider: stub,
    loadDesign: async () => ({ spec: start("crew-tee"), version: 4, charts: DEFAULT_CHART_SET }),
    loadPictures: async () => new Map(),
    createJob: vi.fn(async () => "job-1"),
    schedule: (work) => void scheduled.push(work),
    jobs: {
      markRunning: vi.fn(async () => {}),
      markSucceeded: vi.fn(async () => {}),
      markFailed: vi.fn(async () => {}),
    },
    saveImage: vi.fn(async (view) => `${view}-file`),
    removeImages: vi.fn(async () => {}),
    refund: vi.fn(async () => true),
    log: vi.fn(),
    ...patch,
  };
  return { deps, scheduled, stub };
};

describe("startImageJob", () => {
  it("records a job for the design's version and answers before the work is done", async () => {
    const { deps, scheduled, stub } = makeDeps();

    expect(await startImageJob(deps, { eventId: "event-1" })).toEqual({ jobId: "job-1" });
    expect(deps.createJob).toHaveBeenCalledWith(4);
    expect(scheduled).toHaveLength(1);
    expect(stub.requests).toHaveLength(0);
  });

  it("carries on with a front and a back, each with its own prompt and flat", async () => {
    const { deps, scheduled, stub } = makeDeps();
    await startImageJob(deps, { eventId: "event-1" });

    await scheduled[0]();

    expect(stub.requests).toHaveLength(2);
    const prompts = stub.requests.map((request) => request.prompt);
    expect(prompts.some((prompt) => prompt.includes("front view"))).toBe(true);
    expect(prompts.some((prompt) => prompt.includes("back view"))).toBe(true);
    for (const request of stub.requests) expect([...request.reference.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(deps.jobs.markSucceeded).toHaveBeenCalledWith("job-1", { front: "front-file", back: "back-file" });
  });

  it("says the feature is not set up when there is no provider, before recording anything", async () => {
    const { deps } = makeDeps({ provider: null });

    const error = await startImageJob(deps, { eventId: "event-1" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "unavailable", message: NOT_SET_UP_MESSAGE });
    expect(deps.createJob).not.toHaveBeenCalled();
  });

  it("refuses a design with no drawing, since there is nothing to send", async () => {
    const { deps } = makeDeps({
      loadDesign: async () => ({ spec: { ...start("crew-tee"), typeId: "no-such-type" } as GarmentSpec, version: 1, charts: DEFAULT_CHART_SET }),
    });

    await expect(startImageJob(deps, { eventId: "event-1" })).rejects.toMatchObject({
      code: "invalid_input",
      message: NO_DRAWING_MESSAGE,
    });
    expect(deps.createJob).not.toHaveBeenCalled();
  });
});
