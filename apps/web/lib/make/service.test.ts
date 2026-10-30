import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { addPhoto, addPom, addReading, carryOver, listGoldenSamples, openGoldenSample, requestChanges, signOff, startGoldenSample, submitMakeOrder } from "./service";

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const PRODUCT = "33333333-3333-4333-8333-333333333333";
const RUN = "44444444-4444-4444-8444-444444444444";
const RELEASE = "55555555-5555-4555-8555-555555555555";
const GS = "66666666-6666-4666-8666-666666666666";
const ORDER = "77777777-7777-4777-8777-777777777777";
const ROW_ID = "88888888-8888-4888-8888-888888888888";
const who = { brandId: BRAND, userId: USER };

const row = (over: Record<string, unknown> = {}) => ({
  id: GS,
  product_id: PRODUCT,
  run_id: RUN,
  design_version: 2,
  version: 1,
  state: "approved",
  fit_rating: 4,
  colour_rating: 5,
  notes: "Good",
  factory_profile_id: "knitwright-default",
  approved_at: "2026-11-02T10:00:00Z",
  closed_at: null,
  created_at: "2026-11-01T10:00:00Z",
  golden_sample_photos: [{ id: ROW_ID, file_id: ROW_ID, angle: "front", caption: "As it arrived" }],
  golden_sample_poms: [{ id: ROW_ID, size_label: "M", letter: "A", code: "chest", description: "", measured_mm: 532, target_mm: 530, tol_minus_mm: 10, tol_plus_mm: 10, rule_id: "R-GAP-000" }],
  // PostgREST hands numeric back as a string: the view keeps it a number.
  golden_sample_colour_readings: [{ id: ROW_ID, colour_name: "Navy", delta_e: "1.240", target_hex: "#0B1F4B", instrument: null, white_point: null, observer: null, rule_id: "R-GAP-000" }],
  golden_sample_carryovers: [{ id: ROW_ID, to_version: 3, changed_fields: [{ field: "artwork", group: "surface" }] }],
  ...over,
});

describe("listGoldenSamples", () => {
  it("reads a golden sample with its evidence, newest attempt first", async () => {
    const { client, calls } = fakeClient({ golden_samples: { data: [row({ version: 2 }), row({ version: 1 })] } });
    const samples = await listGoldenSamples(client, BRAND, PRODUCT);
    expect(samples.map((s) => s.version)).toEqual([2, 1]);
    expect(samples[0]).toMatchObject({ state: "approved", designVersion: 2, fitRating: 4, colourRating: 5 });
    expect(samples[0]!.poms[0]).toMatchObject({ letter: "A", measuredMm: 532, targetMm: 530, tolPlusMm: 10 });
    expect(samples[0]!.readings[0]!.deltaE).toBe(1.24);
    expect(samples[0]!.photos[0]!.angle).toBe("front");
    expect(samples[0]!.carriedTo).toEqual([{ toVersion: 3, changed: [{ field: "artwork", group: "surface" }] }]);
    expect(calls[0]!.steps.map(([step]) => step)).toEqual(["select", "eq", "eq", "order", "limit"]);
  });

  it("reads nothing for a product with no golden sample", async () => {
    expect(await listGoldenSamples(fakeClient({}).client, BRAND, PRODUCT)).toEqual([]);
    expect(openGoldenSample([])).toBeNull();
  });

  it("finds the one still being judged", async () => {
    const { client } = fakeClient({ golden_samples: { data: [row({ state: "draft", approved_at: null, fit_rating: null, colour_rating: null })] } });
    const samples = await listGoldenSamples(client, BRAND, PRODUCT);
    expect(openGoldenSample(samples)?.id).toBe(GS);
  });

  it("fails in plain words when the read fails or the shape is not the one described", async () => {
    await expect(listGoldenSamples(fakeClient({ golden_samples: { error: { code: "XX000", message: "boom" } } }).client, BRAND, PRODUCT)).rejects.toMatchObject({ code: "internal" });
    await expect(listGoldenSamples(fakeClient({ golden_samples: { data: [{ id: GS }] } }).client, BRAND, PRODUCT)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("the writes", () => {
  it("sends the brand and the person from the session to every function", async () => {
    const { client, calls } = fakeClient({
      start_golden_sample: { data: GS },
      add_golden_sample_photo: { data: ROW_ID },
      add_golden_sample_pom: { data: ROW_ID },
      add_golden_sample_colour_reading: { data: ROW_ID },
      sign_off_golden_sample: { data: "approved" },
      request_golden_sample_changes: { data: "changes_requested" },
      carry_over_golden_sample: { data: ROW_ID },
    });
    expect(await startGoldenSample(client, who, { productId: PRODUCT, runId: RUN })).toBe(GS);
    expect(await addPhoto(client, who, { goldenSampleId: GS, fileId: ROW_ID, angle: "front", caption: "" })).toBe(ROW_ID);
    expect(await addPom(client, who, { goldenSampleId: GS, sizeLabel: "M", letter: "A", code: "chest", description: "", measuredMm: 532, targetMm: 530, tolMinusMm: 10, tolPlusMm: 10, ruleId: "R-GAP-000" })).toBe(ROW_ID);
    expect(await addReading(client, who, { goldenSampleId: GS, colourName: "Navy", deltaE: 1.2, targetHex: null, targetLab: null, measuredLab: null, instrument: null, whitePoint: null, observer: null, ruleId: "R-GAP-000" })).toBe(ROW_ID);
    expect(await signOff(client, who, { goldenSampleId: GS, fitRating: 4, colourRating: 5, notes: "" })).toBe("approved");
    expect(await requestChanges(client, who, { goldenSampleId: GS, notes: "Short hem" })).toBe("changes_requested");
    expect(await carryOver(client, who, { goldenSampleId: GS, toVersion: 3, changed: [{ field: "artwork", group: "surface" }], ruleId: "R-GAP-000" })).toBe(ROW_ID);
    for (const call of calls) {
      expect(call.steps[0]![1][0]).toMatchObject({ p_brand_id: BRAND, p_user_id: USER });
    }
    expect(calls.map((c) => c.name)).toEqual([
      "start_golden_sample",
      "add_golden_sample_photo",
      "add_golden_sample_pom",
      "add_golden_sample_colour_reading",
      "sign_off_golden_sample",
      "request_golden_sample_changes",
      "carry_over_golden_sample",
    ]);
  });

  it("hands a run over and says which golden sample allowed it", async () => {
    const { client, calls } = fakeClient({
      submit_make_order: { data: [{ run_id: RUN, order_id: ORDER, status: "submitted", cutoff_at: "2026-11-09T07:00:00Z", promised_on: null, created: true, golden_sample_id: GS }] },
    });
    const sent = await submitMakeOrder(client, who, {
      productId: PRODUCT, kind: "run", releaseId: RELEASE, factoryProfileId: "knitwright-default", fabricKey: "F-STK-TEE", sizes: { M: 60 }, flags: [], requestKey: "abcdefgh",
    });
    expect(sent).toEqual({ runId: RUN, orderId: ORDER, status: "submitted", cutoffAt: "2026-11-09T07:00:00Z", promisedOn: null, created: true, goldenSampleId: GS });
    expect(calls[0]!.steps[0]![1][0]).toMatchObject({ p_kind: "run", p_sizes: { M: 60 }, p_flags: [], p_request_key: "abcdefgh" });
  });

  it("turns each refusal of the database into the right kind of failure", async () => {
    const cases = [
      ["42501", "forbidden"],
      ["P0002", "not_found"],
      ["P0001", "conflict"],
      ["22023", "conflict"],
      ["23505", "conflict"],
      ["23514", "conflict"],
      ["XX000", "internal"],
    ] as const;
    for (const [code, kind] of cases) {
      const { client } = fakeClient({ start_golden_sample: { error: { code, message: "no" } } });
      await expect(startGoldenSample(client, who, { productId: PRODUCT, runId: RUN })).rejects.toMatchObject({ code: kind });
    }
  });

  it("says what is missing when a function answers nothing at all", async () => {
    const { client } = fakeClient({ start_golden_sample: { error: { code: "P0002", message: "" } } });
    await expect(startGoldenSample(client, who, { productId: PRODUCT, runId: RUN })).rejects.toMatchObject({ message: "That golden sample does not exist." });
  });
});
