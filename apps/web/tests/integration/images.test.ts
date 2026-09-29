import { beforeAll, describe, expect, it } from "vitest";
import { PHOTOREAL_COST } from "@/lib/images/cost";
import { JOB_STALE_AFTER_MS, type JobRow } from "@/lib/images/job-view";
import { runImageJob } from "@/lib/images/run-job";
import { createJob, expireJob, imageSaver, jobStore, latestImages, readJob } from "@/lib/images/service";
import type { ImageProvider } from "@/lib/providers";
import { failingImageProvider, stubImageProvider } from "@/lib/providers/image-stub";
import { createUsageMeter, type UsageMeter } from "@/lib/usage/meter";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Photoreal images. Plan step 14, acceptance criteria: with the provider stubbed a design
 * produces two images and one usage record; with the provider failing the cost is given
 * back and the rest of the product works; M5 (brands see only their own) and M6 (spend is
 * capped) hold.
 */

const HUGE = 1_000_000_000_000;

let owner: Person;
let stranger: Person;
let brandId: string;
let strangerBrand: string;
let projectId: string;
let meter: UsageMeter;

const REFERENCE = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

const meterWith = (photoreal: number): UsageMeter =>
  createUsageMeter({
    rpc: (fn, args) => adminClient().rpc(fn, args),
    allowances: {
      user: { ai: HUGE, photoreal },
      brand: { ai: HUGE, photoreal: HUGE },
      globalCeiling: HUGE,
    },
    alert: async () => {},
  });

/** What the route does: reserve the cost, record the job, carry the work on. */
const makeImages = async (provider: ImageProvider) => {
  const reservation = await meter.reserve({
    userId: owner.userId,
    brandId,
    cost: PHOTOREAL_COST,
    route: "POST /api/projects/images",
  });
  if (!reservation.ok) throw new Error("refused");
  const jobId = await createJob(adminClient(), {
    brandId,
    projectId,
    version: 1,
    userId: owner.userId,
    eventId: reservation.eventId,
  });
  const outcome = await runImageJob(
    {
      provider,
      jobs: jobStore(adminClient()),
      saveImage: imageSaver(adminClient(), brandId, owner.userId),
      refund: meter.refund,
      log: () => {},
    },
    {
      jobId,
      eventId: reservation.eventId,
      requests: {
        front: { prompt: "front", reference: REFERENCE },
        back: { prompt: "back", reference: REFERENCE },
      },
    },
  );
  return { jobId, eventId: reservation.eventId, outcome };
};

const eventsOfBrand = async () =>
  must(await adminClient().from("usage_events").select("id, refunded_at, feature").eq("brand_id", brandId));

beforeAll(async () => {
  [owner, stranger] = await Promise.all([person("painter"), person("snoop")]);
  brandId = await brandOf(owner, "Painted Kits");
  strangerBrand = await brandOf(stranger, "Snoop Sports");
  projectId = must(
    await adminClient().rpc("create_project", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_name: "Tee",
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { seeded: true },
      p_schema_version: 1,
    }),
  ) as string;
  meter = meterWith(HUGE);
});

describe("photoreal images with the provider stubbed", () => {
  let jobId: string;

  beforeAll(async () => {
    ({ jobId } = await makeImages(stubImageProvider()));
  });

  it("makes two images, stored as the brand's generated pictures", async () => {
    const job = await readJob(owner.client, brandId, projectId, jobId);
    expect(job?.status).toBe("succeeded");

    const files = must(
      await adminClient()
        .from("files")
        .select("bucket, kind, path, content_type")
        .in("id", [job?.front_file_id, job?.back_file_id]),
    );
    expect(files).toHaveLength(2);
    for (const file of files) {
      expect(file).toMatchObject({ bucket: "images", kind: "render", content_type: "image/png" });
      expect(file.path.startsWith(`${brandId}/render/`)).toBe(true);
    }
  });

  it("records one usage record for the two, and keeps its cost", async () => {
    const events = await eventsOfBrand();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ feature: "photoreal", refunded_at: null });
  });

  it("shows the member the images, and another brand nothing (M5)", async () => {
    expect((await latestImages(owner.client, brandId, projectId))?.images).toHaveLength(2);
    expect(await readJob(stranger.client, brandId, projectId, jobId)).toBeNull();
    expect(await latestImages(stranger.client, brandId, projectId)).toBeNull();
    expect(await readJob(stranger.client, strangerBrand, projectId, jobId)).toBeNull();
  });

  it("does not let a member change a job", async () => {
    await owner.client.from("jobs").update({ status: "failed", error: "x" }).eq("id", jobId);

    expect((await readJob(owner.client, brandId, projectId, jobId))?.status).toBe("succeeded");
  });
});

describe("photoreal images with the provider failing", () => {
  let failed: Awaited<ReturnType<typeof makeImages>>;

  beforeAll(async () => {
    failed = await makeImages(failingImageProvider());
  });

  it("marks the job failed with a sentence that is safe to show", async () => {
    const job = await readJob(owner.client, brandId, projectId, failed.jobId);

    expect(job).toMatchObject({ status: "failed", front_file_id: null, back_file_id: null });
    expect(job?.error).toMatch(/cost has been given back/);
  });

  it("gives the cost back", async () => {
    const event = (await eventsOfBrand()).find((row) => row.id === failed.eventId);

    expect(event?.refunded_at).not.toBeNull();
  });

  it("leaves the rest working: the earlier images are still there", async () => {
    expect((await latestImages(owner.client, brandId, projectId))?.images).toHaveLength(2);
  });
});

describe("a job whose server stopped", () => {
  it("is given up and its cost given back, once", async () => {
    const reservation = await meter.reserve({
      userId: owner.userId,
      brandId,
      cost: PHOTOREAL_COST,
      route: "POST /api/projects/images",
    });
    if (!reservation.ok) throw new Error("refused");
    const old = new Date(Date.now() - JOB_STALE_AFTER_MS * 2).toISOString();
    const row = must(
      await adminClient()
        .from("jobs")
        .insert({
          brand_id: brandId,
          project_id: projectId,
          version: 1,
          kind: "photoreal",
          status: "running",
          usage_event_id: reservation.eventId,
          created_by: owner.userId,
          created_at: old,
        })
        .select("id, version, status, front_file_id, back_file_id, error, usage_event_id, created_at")
        .single(),
    ) as JobRow;

    await expireJob(adminClient(), row, meter.refund);
    await expireJob(adminClient(), row, meter.refund);

    expect((await readJob(owner.client, brandId, projectId, row.id))?.status).toBe("failed");
    const event = (await eventsOfBrand()).find((entry) => entry.id === reservation.eventId);
    expect(event?.refunded_at).not.toBeNull();
  });
});

describe("the photoreal allowance (M6)", () => {
  it("refuses a request once the user's allowance is used", async () => {
    const tight = meterWith(PHOTOREAL_COST.microdollars);
    const [first, second] = await Promise.all(
      [1, 2].map(() =>
        tight.reserve({ userId: stranger.userId, brandId: strangerBrand, cost: PHOTOREAL_COST, route: "POST /x" }),
      ),
    );

    expect([first.ok, second.ok].sort()).toEqual([false, true]);
  });
});
