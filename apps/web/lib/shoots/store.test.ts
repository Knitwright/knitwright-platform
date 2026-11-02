import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { ALL_SHOOT_CONCEPTS, conceptBySlug } from "./concepts";
import { MODEL_PRESET_CATALOGUE } from "./models";
import { ALL_SHOOT_POSES, poseByKey } from "./poses";
import { conceptFromRow, poseFromRow, presetFromRow } from "./schemas";
import { conceptRow, modelPresetRowsFor, poseRow, presetRow, seedShootLibrary, shootConceptRowsFor, shootPoseRowsFor } from "./seed";
import { loadLatestShootJob, loadShootJobs, loadShootLibrary } from "./service";

/**
 * How the library is stored and read back: the rows, the schema that is the one door out of the
 * database, and the seed that is the one writer.
 *
 * The database's own behaviour -- the grants, the row level security, the garment lock, the consent
 * constraint and that a browser cannot write a job -- is `tests/integration/shoots.test.ts`, which
 * CI runs.
 */

function readClient(rows: Readonly<Record<string, unknown[]>>, error: { message: string } | null = null) {
  const asked: { tables: string[]; filters: [string, unknown][] } = { tables: [], filters: [] };
  const query = (table: string) => {
    const self = {
      select: () => self,
      order: () => self,
      eq: (column: string, value: unknown) => (asked.filters.push([column, value]), self),
      limit: async () => ({ data: rows[table] ?? [], error }),
    };
    return self;
  };
  return { client: { from: (table: string) => (asked.tables.push(table), query(table)) } as unknown as SupabaseClient, asked };
}

function writeClient(failure: string | null = null) {
  const upserts: { table: string; rows: unknown[] }[] = [];
  const client = {
    from: (table: string) => ({
      upsert: async (rows: unknown[]) => (upserts.push({ table, rows }), { error: failure ? { message: failure } : null }),
    }),
  } as unknown as SupabaseClient;
  return { client, upserts };
}

const jobRowOf = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  board_id: "22222222-2222-4222-8222-222222222222",
  scene_slug: "floodlit-pitch",
  concept_slug: "floodlit-pitch",
  status: "ready",
  attempts: 1,
  checker_verdict: "kept",
  checker_failed: [],
  moderation: "clear",
  credits: 1,
  refunded_credits: 0,
  output_file_id: "33333333-3333-4333-8333-333333333333",
  message: null,
  model_source: "preset",
  created_at: "2026-11-02T09:00:00.000Z",
  finished_at: "2026-11-02T09:01:00.000Z",
  ...over,
});

describe("the rows the library is seeded as", () => {
  it("writes every pose, preset and concept, in that order, so a concept's presets are there first", async () => {
    const write = writeClient();
    const counts = await seedShootLibrary(write.client);
    expect(write.upserts.map((one) => one.table)).toEqual(["shoot_poses", "model_presets", "shoot_concepts"]);
    expect(counts).toEqual({ poses: ALL_SHOOT_POSES.length, presets: MODEL_PRESET_CATALOGUE.length, concepts: ALL_SHOOT_CONCEPTS.length });
  });

  it("never writes a licence reference, so running the seed again cannot grant or undo one", () => {
    for (const row of modelPresetRowsFor()) {
      expect(Object.keys(row)).not.toContain("licence_ref");
      expect(Object.keys(row)).not.toContain("licence_holder");
    }
  });

  it("writes a concept's own scenes, poses, cameras and output set", () => {
    const concept = conceptBySlug("team-line-up")!;
    const row = conceptRow(concept, 3);
    expect(row.scene_slugs).toEqual([...concept.sceneSlugs]);
    expect(row.pose_keys).toEqual([...concept.poseKeys]);
    expect(row.camera_keys).toEqual([...concept.cameraKeys]);
    expect(row.outputs_count).toBe(concept.outputs.count);
    expect(row.aspects).toEqual([...concept.outputs.aspects]);
    expect(row.sort).toBe(3);
  });

  it("writes a pose with the words that go in the prompt, and whether it needs a person", () => {
    const row = poseRow(poseByKey("running-stride")!, 1);
    expect(row.prompt).toBe("Running stride.");
    expect(row.needs_person).toBe(true);
    expect(row.source).toBe("spec");
  });

  it("writes a preset as a description of a range", () => {
    const row = presetRow(MODEL_PRESET_CATALOGUE[0]!, 0);
    expect(row.label).toContain(MODEL_PRESET_CATALOGUE[0]!.bodyType);
    expect(row.body_type).toBe(MODEL_PRESET_CATALOGUE[0]!.bodyType);
  });

  it("says which table refused a write, rather than a bare message", async () => {
    const write = writeClient("permission denied");
    await expect(seedShootLibrary(write.client)).rejects.toThrow(/shoot_poses: permission denied/);
  });

  it("writes nothing for an empty list", () => {
    expect(shootPoseRowsFor([])).toEqual([]);
    expect(shootConceptRowsFor([])).toEqual([]);
  });
});

describe("reading a row back", () => {
  it("round-trips a pose, a preset and a concept through the row and the schema", () => {
    expect(poseFromRow(poseRow(poseByKey("hero-front")!, 0))).toEqual(poseByKey("hero-front"));
    const preset = MODEL_PRESET_CATALOGUE[0]!;
    expect(presetFromRow({ ...presetRow(preset, 0), licence_ref: null, licence_holder: null })).toEqual(preset);
    const concept = conceptBySlug("gym-session")!;
    expect(conceptFromRow(conceptRow(concept, 0))).toEqual(concept);
  });

  it("reads a licence reference an admin put against a preset", () => {
    const row = { ...presetRow(MODEL_PRESET_CATALOGUE[0]!, 0), licence_ref: "LIC-1", licence_holder: "A studio" };
    expect(presetFromRow(row)!.licenceRef).toBe("LIC-1");
  });

  it("treats a blank licence reference as none at all", () => {
    const row = { ...presetRow(MODEL_PRESET_CATALOGUE[0]!, 0), licence_ref: "   ", licence_holder: null };
    expect(presetFromRow(row)!.licenceRef).toBeNull();
  });

  it("is nothing for a row of the wrong shape, rather than half a row", () => {
    expect(poseFromRow({ key: "x" })).toBeNull();
    expect(presetFromRow(null)).toBeNull();
    expect(conceptFromRow({ slug: "x", style: "not-a-style" })).toBeNull();
  });
});

describe("the library, read with a member's own client", () => {
  it("reads the three tables and gives back what parsed", async () => {
    const read = readClient({
      shoot_concepts: [...shootConceptRowsFor()],
      shoot_poses: [...shootPoseRowsFor()],
      model_presets: modelPresetRowsFor().map((row) => ({ ...row, licence_ref: null, licence_holder: null })),
    });
    const library = await loadShootLibrary(read.client);
    expect(library.concepts).toHaveLength(12);
    expect(library.poses).toHaveLength(ALL_SHOOT_POSES.length);
    expect(library.presets).toHaveLength(MODEL_PRESET_CATALOGUE.length);
    expect(library.unreadable).toBe(0);
    expect(read.asked.tables.sort()).toEqual(["model_presets", "shoot_concepts", "shoot_poses"]);
  });

  it("leaves out a row it cannot read, and counts it", async () => {
    const read = readClient({
      shoot_concepts: [...shootConceptRowsFor(), { slug: "broken" }],
      shoot_poses: [],
      model_presets: [],
    });
    const library = await loadShootLibrary(read.client);
    expect(library.concepts).toHaveLength(12);
    expect(library.unreadable).toBe(1);
  });

  it("fails with the internal message rather than the database's own words", async () => {
    const read = readClient({}, { message: "relation does not exist" });
    await expect(loadShootLibrary(read.client)).rejects.toThrow(AppError);
  });
});

describe("a board's own runs", () => {
  it("reads the newest first, filtered to that board", async () => {
    const read = readClient({ shoot_jobs: [jobRowOf(), jobRowOf({ id: "44444444-4444-4444-8444-444444444444", status: "failed", finished_at: "2026-11-02T09:02:00.000Z", refunded_credits: 1, checker_verdict: "turned_away" })] });
    const jobs = await loadShootJobs(read.client, "22222222-2222-4222-8222-222222222222");
    expect(jobs).toHaveLength(2);
    expect(read.asked.filters).toEqual([["board_id", "22222222-2222-4222-8222-222222222222"]]);
    expect((await loadLatestShootJob(read.client, "22222222-2222-4222-8222-222222222222"))!.status).toBe("ready");
  });

  it("is empty for a board nobody has run", async () => {
    const read = readClient({ shoot_jobs: [] });
    expect(await loadShootJobs(read.client, "board-1")).toEqual([]);
    expect(await loadLatestShootJob(read.client, "board-1")).toBeNull();
  });

  it("refuses a row of the wrong shape rather than showing half a result", async () => {
    const read = readClient({ shoot_jobs: [{ id: "not-a-uuid" }] });
    await expect(loadShootJobs(read.client, "board-1")).rejects.toThrow(AppError);
  });

  it("fails with the internal message when the read itself is refused", async () => {
    const read = readClient({}, { message: "permission denied" });
    await expect(loadShootJobs(read.client, "board-1")).rejects.toThrow(AppError);
  });
});
