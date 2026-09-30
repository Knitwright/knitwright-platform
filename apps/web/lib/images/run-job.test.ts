import { describe, expect, it, vi } from "vitest";
import { ProviderError, type ImageProvider } from "@/lib/providers";
import { AppError } from "@/lib/server/core/errors";
import { STORAGE_FULL_MESSAGE } from "@/lib/storage/quota";
import { failingImageProvider, stubImageProvider } from "@/lib/providers/image-stub";
import { FAILED_MESSAGE, UNAVAILABLE_MESSAGE, runImageJob, type RunJobDeps } from "./run-job";

const REFERENCE = new Uint8Array([1, 2, 3]);

const work = {
  jobId: "job-1",
  eventId: "event-1",
  requests: {
    front: { prompt: "front prompt", reference: REFERENCE },
    back: { prompt: "back prompt", reference: REFERENCE },
  },
};

const makeDeps = (provider: ImageProvider, overrides: Partial<RunJobDeps> = {}) => {
  const calls: string[] = [];
  const deps: RunJobDeps = {
    provider,
    jobs: {
      markRunning: vi.fn(async (id: string) => void calls.push(`running ${id}`)),
      markSucceeded: vi.fn(async (id: string, files: { front: string; back: string }) =>
        void calls.push(`succeeded ${id} ${files.front} ${files.back}`),
      ),
      markFailed: vi.fn(async (id: string, message: string) => void calls.push(`failed ${id} ${message}`)),
    },
    saveImage: vi.fn(async (view: string) => `${view}-file`),
    removeImages: vi.fn(async (ids: readonly string[]) => void calls.push(`removed ${ids.join(" ")}`)),
    refund: vi.fn(async (eventId: string) => {
      calls.push(`refund ${eventId}`);
      return true;
    }),
    log: vi.fn(),
    ...overrides,
  };
  return { deps, calls };
};

describe("runImageJob", () => {
  it("makes a front and a back, stores both and marks the job done, without a refund", async () => {
    const stub = stubImageProvider();
    const { deps, calls } = makeDeps(stub);

    expect(await runImageJob(deps, work)).toBe("succeeded");

    expect(stub.requests.map((request) => request.prompt).sort()).toEqual(["back prompt", "front prompt"]);
    expect(stub.requests.every((request) => request.reference === REFERENCE)).toBe(true);
    expect(calls).toEqual(["running job-1", "succeeded job-1 front-file back-file"]);
    expect(deps.refund).not.toHaveBeenCalled();
  });

  it("gives the cost back and marks the job failed when the model fails", async () => {
    const { deps, calls } = makeDeps(failingImageProvider());

    expect(await runImageJob(deps, work)).toBe("failed");

    expect(calls).toEqual(["running job-1", `failed job-1 ${FAILED_MESSAGE}`, "refund event-1"]);
    expect(deps.saveImage).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(expect.objectContaining({ level: "error" }));
  });

  it("says the feature is unavailable when the provider refused the account", async () => {
    const { calls } = await (async () => {
      const made = makeDeps(failingImageProvider(true));
      await runImageJob(made.deps, work);
      return made;
    })();

    expect(calls).toContain(`failed job-1 ${UNAVAILABLE_MESSAGE}`);
  });

  it("stores nothing unless both views were made", async () => {
    let count = 0;
    const halfWorking: ImageProvider = {
      name: "half",
      generate: async () => {
        count += 1;
        if (count === 2) throw new ProviderError("no", false);
        return { bytes: new Uint8Array([1]), contentType: "image/png" };
      },
    };
    const { deps } = makeDeps(halfWorking);

    expect(await runImageJob(deps, work)).toBe("failed");
    expect(deps.saveImage).not.toHaveBeenCalled();
    expect(deps.refund).toHaveBeenCalledWith("event-1");
  });

  it("gives the cost back when storing fails", async () => {
    const { deps } = makeDeps(stubImageProvider(), {
      saveImage: async () => {
        throw new Error("storage down");
      },
    });

    expect(await runImageJob(deps, work)).toBe("failed");
    expect(deps.refund).toHaveBeenCalledWith("event-1");
  });

  it("removes the stored pictures when the job cannot be marked done, and gives the cost back", async () => {
    const { deps, calls } = makeDeps(stubImageProvider());
    deps.jobs.markSucceeded = async () => {
      throw new Error("The job had already been stopped.");
    };

    expect(await runImageJob(deps, work)).toBe("failed");
    expect(calls).toEqual(["running job-1", "removed front-file back-file", `failed job-1 ${FAILED_MESSAGE}`, "refund event-1"]);
  });

  it("says the brand's storage is full when a picture would pass the quota, and gives the cost back", async () => {
    const { deps, calls } = makeDeps(stubImageProvider(), {
      saveImage: async () => {
        throw new AppError("over_quota", STORAGE_FULL_MESSAGE);
      },
    });

    expect(await runImageJob(deps, work)).toBe("failed");
    expect(calls).toContain(`failed job-1 ${STORAGE_FULL_MESSAGE} The cost has been given back.`);
    expect(deps.refund).toHaveBeenCalledWith("event-1");
  });

  it("removes the first picture when the second cannot be stored", async () => {
    const { deps, calls } = makeDeps(stubImageProvider(), {
      saveImage: async (view) => {
        if (view === "back") throw new Error("storage down");
        return `${view}-file`;
      },
    });

    expect(await runImageJob(deps, work)).toBe("failed");
    expect(calls).toContain("removed front-file");
    expect(deps.refund).toHaveBeenCalledWith("event-1");
  });

  it("still marks the job failed and gives the cost back when the pictures cannot be removed", async () => {
    const { deps } = makeDeps(stubImageProvider(), {
      removeImages: async () => {
        throw new Error("storage down");
      },
    });
    deps.jobs.markSucceeded = async () => {
      throw new Error("The job had already been stopped.");
    };

    expect(await runImageJob(deps, work)).toBe("failed");
    expect(deps.jobs.markFailed).toHaveBeenCalled();
    expect(deps.refund).toHaveBeenCalledWith("event-1");
    expect(deps.log).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/could not be removed/) }));
  });

  it("still gives the cost back when the job row cannot be marked", async () => {
    const { deps } = makeDeps(failingImageProvider());
    deps.jobs.markFailed = async () => {
      throw new Error("db down");
    };

    expect(await runImageJob(deps, work)).toBe("failed");
    expect(deps.refund).toHaveBeenCalledWith("event-1");
  });

  it("never throws, even when the refund fails; it logs instead", async () => {
    const { deps } = makeDeps(failingImageProvider(), {
      refund: async () => {
        throw new Error("meter down");
      },
    });

    await expect(runImageJob(deps, work)).resolves.toBe("failed");
    expect(deps.log).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/refund/i) }));
  });

  it("stops a slow model at the time limit", async () => {
    const slow: ImageProvider = {
      name: "slow",
      generate: (_request, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new ProviderError("stopped", false)));
        }),
    };
    const { deps } = makeDeps(slow, { timeoutMs: 20 });

    expect(await runImageJob(deps, work)).toBe("failed");
    expect(deps.refund).toHaveBeenCalled();
  });
});
