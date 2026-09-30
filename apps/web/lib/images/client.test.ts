import { describe, expect, it, vi } from "vitest";
import { UNREACHABLE, pollImageJob, requestImages } from "./client";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("requestImages", () => {
  it("posts to the design's images route and returns the job", async () => {
    const fetcher = vi.fn(async () => json({ success: true, data: { jobId: JOB } }));

    expect(await requestImages(PROJECT, "alt", fetcher)).toEqual({ ok: true, jobId: JOB });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/projects/${PROJECT}/images`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ colourway: "alt" });
  });

  it("passes on the server's sentence, such as an allowance used up", async () => {
    const fetcher = async () =>
      json({ success: false, error: { code: "over_allowance", message: "You have used this month's allowance." } }, 429);

    expect(await requestImages(PROJECT, undefined, fetcher)).toEqual({
      ok: false,
      reason: "You have used this month's allowance.",
    });
  });

  it("says the server could not be reached when the network fails", async () => {
    const fetcher = async () => {
      throw new TypeError("offline");
    };

    expect(await requestImages(PROJECT, undefined, fetcher)).toEqual({ ok: false, reason: UNREACHABLE });
  });
});

describe("pollImageJob", () => {
  it("returns the job's state", async () => {
    const job = { id: JOB, version: 1, status: "working", images: [], message: null };
    const fetcher = vi.fn(async () => json({ success: true, data: job }));

    expect(await pollImageJob(PROJECT, JOB, fetcher)).toEqual(job);
    expect((fetcher.mock.calls[0] as unknown as [string])[0]).toBe(`/api/projects/${PROJECT}/images/${JOB}`);
  });

  it("is null when the answer cannot be read, so the panel polls again", async () => {
    expect(await pollImageJob(PROJECT, JOB, async () => json({ nonsense: true }))).toBeNull();
    expect(
      await pollImageJob(PROJECT, JOB, async () => {
        throw new TypeError("offline");
      }),
    ).toBeNull();
  });
});
