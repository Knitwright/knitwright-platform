import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { ALL_SHOOT_CONCEPTS, CONSENT_STATEMENT, MODEL_PRESET_CATALOGUE, ALL_SHOOT_POSES } from "@/lib/shoots";
import { seedShootLibrary } from "@/lib/shoots/seed";
import { loadShootJobs, loadShootLibrary } from "@/lib/shoots/service";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261201020000: the shoot ideas, the pose and camera presets, the model presets with
 * their licence references, and the shoot jobs (plan v5 L3, spec F-L1's AI half; decision 0093),
 * against local Supabase. Needs `pnpm db:start`.
 *
 * What the database itself must hold, whatever the application believes:
 *
 *   * **the garment is locked.** A shoot names the Design board its garment came from; a job on a
 *     board with no design behind it is refused, and so is one whose board is not an AI image board.
 *   * **a person's likeness needs consent.** A preset with no licence reference cannot be run, and an
 *     upload with no recorded consent cannot be written at all.
 *   * **money is honest.** A refund can only be on a shoot that failed, and never more than the
 *     charge.
 *   * only the two shoot functions write a job: a direct insert or update answers permission denied.
 *
 * Every test reads apart from those writes. The one library write is the seed, which is platform data
 * found by key or slug, so running it again changes the rows it made and adds nothing (plan v5,
 * lesson on the shared database).
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);
const canvasName = (label: string) => `${label} ${randomUUID().slice(0, 8)}`;

const makeCanvas = async (who: Person, brandId: string, label = "Shoot"): Promise<string> =>
  must(await rpc("create_launch_project", { p_brand_id: brandId, p_user_id: who.userId, p_name: canvasName(label), p_units: "px", p_design_project_id: null })) as string;

const makeBoard = async (who: Person, brandId: string, canvasId: string, kind: string, over: Record<string, unknown> = {}): Promise<string> =>
  must(await rpc("save_launch_board", {
    p_brand_id: brandId, p_user_id: who.userId, p_launch_project_id: canvasId, p_board_id: null, p_kind: kind,
    p_name: kind, p_x: 0, p_y: 0, p_width: 1080, p_height: 1080, p_settings: {}, p_input_version: 1, ...over,
  })) as string;

const connect = (who: Person, brandId: string, from: string, to: string, index = 1) =>
  rpc("connect_launch_boards", { p_brand_id: brandId, p_user_id: who.userId, p_from_board_id: from, p_to_board_id: to, p_input_index: index });

const startShoot = (who: Person, brandId: string, canvasId: string, boardId: string, designId: string, over: Record<string, unknown> = {}) =>
  rpc("start_shoot_job", {
    p_brand_id: brandId, p_user_id: who.userId, p_launch_project_id: canvasId, p_board_id: boardId,
    p_design_board_id: designId, p_scene_slug: "kit-on-a-bench", p_style: "editorial", p_aspect: "match",
    p_image_count: 1, p_pose_key: null, p_camera_key: null, p_model_source: "none", p_model_preset_key: null,
    p_model_file_id: null, p_consent_ref: null, p_consent_statement: null, p_consent_given_at: null,
    p_concept_slug: null, p_input_version: 1, ...over,
  });

const finishShoot = (who: Person, brandId: string, jobId: string, over: Record<string, unknown> = {}) =>
  rpc("finish_shoot_job", {
    p_brand_id: brandId, p_user_id: who.userId, p_job_id: jobId, p_status: "ready", p_attempts: 1,
    p_checker_verdict: "kept", p_checker_failed: [], p_moderation: "clear", p_credits: 1,
    p_refunded_credits: 0, p_spend_entry_id: null, p_output_file_id: null, p_message: null, ...over,
  });

let ann: Person;
let ben: Person;
let annBrand: string;
let benBrand: string;

/** A canvas with a design board feeding an AI image board, which is a shoot's own shape. */
async function shootCanvas(who: Person, brandId: string): Promise<Readonly<{ canvasId: string; designId: string; boardId: string }>> {
  const canvasId = await makeCanvas(who, brandId);
  const designId = await makeBoard(who, brandId, canvasId, "design");
  const boardId = await makeBoard(who, brandId, canvasId, "ai_image");
  must(await connect(who, brandId, designId, boardId));
  return { canvasId, designId, boardId };
}

beforeAll(async () => {
  [ann, ben] = await Promise.all([person("shoot-ann"), person("shoot-ben")]);
  annBrand = await brandOf(ann, "Ann Shoots");
  benBrand = await brandOf(ben, "Ben Shoots");
  await seedShootLibrary(adminClient());
});

describe("the shoot library in the database", () => {
  it("is readable by a signed-in member and refused to a visitor", async () => {
    const library = await loadShootLibrary(ann.client);

    expect(library.concepts.length).toBeGreaterThanOrEqual(ALL_SHOOT_CONCEPTS.length);
    expect(library.poses.length).toBeGreaterThanOrEqual(ALL_SHOOT_POSES.length);
    expect(library.presets.length).toBeGreaterThanOrEqual(MODEL_PRESET_CATALOGUE.length);
    expect(library.unreadable).toBe(0);
    expect((await anonClient().from("shoot_concepts").select("slug")).error).not.toBeNull();
    expect((await anonClient().from("model_presets").select("key")).error).not.toBeNull();
  });

  it("holds every model preset with no licence on file, so none of them can be generated yet", async () => {
    const rows = must(await ann.client.from("model_presets").select("key, licence_ref, licence_holder")) as { key: string; licence_ref: string | null }[];
    const seeded = rows.filter((row) => MODEL_PRESET_CATALOGUE.some((preset) => preset.key === row.key));

    expect(seeded).toHaveLength(MODEL_PRESET_CATALOGUE.length);
    expect(seeded.every((row) => row.licence_ref === null)).toBe(true);
  });

  it("refuses a member writing a preset, a pose or an idea, even a licence reference", async () => {
    for (const refused of [
      await ann.client.from("model_presets").update({ licence_ref: "MINE" }).eq("key", MODEL_PRESET_CATALOGUE[0]!.key),
      await ann.client.from("shoot_poses").insert({ key: "made-up", kind: "pose", label: "x", prompt: "x", source: "spec", note: "x" }),
      await ann.client.from("shoot_concepts").insert({ slug: "made-up", title: "x", lead: "x", scene_slugs: ["x"], lighting: "x", pose_keys: ["hero-front"], camera_keys: ["low-angle"], style: "editorial", outputs_count: 1, aspects: ["match"], note: "x" }),
    ]) {
      expect(refused.error).not.toBeNull();
    }
  });

  it("refuses an idea that names a pose, a camera or a preset that is not a row", async () => {
    const refused = await adminClient().from("shoot_concepts").insert({
      slug: `unknown-${randomUUID().slice(0, 8)}`, title: "Unknown", lead: "x", scene_slugs: ["kit-on-a-bench"],
      lighting: "x", pose_keys: ["not-a-pose"], camera_keys: ["low-angle"], style: "editorial",
      outputs_count: 1, aspects: ["match"], note: "x",
    });

    expect(refused.error?.hint ?? refused.error?.message).toMatch(/pose_not_found|names a pose/);
  });

  it("writes the library again without adding a row", async () => {
    const before = must(await adminClient().from("shoot_concepts").select("slug"));
    await seedShootLibrary(adminClient());
    const after = must(await adminClient().from("shoot_concepts").select("slug"));

    expect(after).toHaveLength(before.length);
  });
});

describe("the garment lock, in the database", () => {
  it("starts a shoot on a board a design feeds", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const jobId = must(await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId)) as string;
    const row = must(await ann.client.from("shoot_jobs").select("status, design_board_id, model_source").eq("id", jobId).single());

    expect(row).toEqual({ status: "running", design_board_id: canvas.designId, model_source: "none" });
  });

  it("refuses a shoot on a board with no design behind it", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const designId = await makeBoard(ann, annBrand, canvasId, "design");
    const alone = await makeBoard(ann, annBrand, canvasId, "ai_image");
    const refused = await startShoot(ann, annBrand, canvasId, alone, designId);

    expect(refused.error?.hint).toBe("garment_not_locked");
  });

  it("refuses a shoot that would fill a board the platform draws itself", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const designId = await makeBoard(ann, annBrand, canvasId, "design");
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    must(await connect(ann, annBrand, designId, mockup));
    const refused = await startShoot(ann, annBrand, canvasId, mockup, designId);

    expect(refused.error).not.toBeNull();
  });

  it("refuses a job written straight past the function, with no design board on it", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const refused = await adminClient().from("shoot_jobs").insert({
      brand_id: annBrand, launch_project_id: canvas.canvasId, board_id: canvas.boardId,
      design_board_id: canvas.boardId, scene_slug: "kit-on-a-bench", style: "editorial", aspect: "match",
    });

    expect(refused.error).not.toBeNull();
  });
});

describe("a person's likeness, in the database", () => {
  it("refuses a shoot from a preset nobody has licensed", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const refused = await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId, {
      p_model_source: "preset",
      p_model_preset_key: MODEL_PRESET_CATALOGUE[0]!.key,
    });

    expect(refused.error?.hint).toBe("model_preset_has_no_licence");
  });

  it("refuses an upload with no recorded consent", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const refused = await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId, {
      p_model_source: "upload",
      p_consent_ref: null,
    });

    expect(refused.error).not.toBeNull();
  });

  it("refuses a consent written with no upload behind it", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const refused = await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId, {
      p_consent_ref: "Release 4",
      p_consent_statement: CONSENT_STATEMENT,
      p_consent_given_at: new Date().toISOString(),
    });

    expect(refused.error).not.toBeNull();
  });
});

describe("the money, in the database", () => {
  it("records what a shoot was charged", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const jobId = must(await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId)) as string;
    must(await finishShoot(ann, annBrand, jobId));
    const row = must(await ann.client.from("shoot_jobs").select("status, credits, refunded_credits, attempts").eq("id", jobId).single());

    expect(row).toEqual({ status: "ready", credits: 1, refunded_credits: 0, attempts: 1 });
  });

  it("gives the credits back on a shoot the checker turned away twice", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const jobId = must(await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId)) as string;
    must(await finishShoot(ann, annBrand, jobId, {
      p_status: "failed", p_attempts: 2, p_checker_verdict: "turned_away", p_checker_failed: ["colour"],
      p_credits: 2, p_refunded_credits: 2, p_message: "Couldn't keep your garment accurate, try another pose.",
    }));
    const row = must(await ann.client.from("shoot_jobs").select("status, attempts, checker_verdict, refunded_credits, message").eq("id", jobId).single());

    expect(row).toMatchObject({ status: "failed", attempts: 2, checker_verdict: "turned_away", refunded_credits: 2 });
  });

  it("refuses a refund on a shoot that worked, and one larger than the charge", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const jobId = must(await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId)) as string;
    expect((await finishShoot(ann, annBrand, jobId, { p_credits: 1, p_refunded_credits: 1 })).error).not.toBeNull();
    expect((await finishShoot(ann, annBrand, jobId, { p_status: "failed", p_checker_verdict: "turned_away", p_credits: 1, p_refunded_credits: 4 })).error).not.toBeNull();
  });

  it("refuses a ready shoot the checker never kept", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const jobId = must(await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId)) as string;
    const refused = await finishShoot(ann, annBrand, jobId, { p_checker_verdict: "turned_away" });

    expect(refused.error).not.toBeNull();
  });
});

describe("whose shoot it is", () => {
  it("is read by its own brand and by nobody else", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const jobId = must(await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId)) as string;

    expect(await loadShootJobs(ann.client, canvas.boardId)).toHaveLength(1);
    expect((await ben.client.from("shoot_jobs").select("id").eq("id", jobId)).data).toEqual([]);
  });

  it("cannot be started by somebody who is not a member of the brand", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const refused = await startShoot(ben, annBrand, canvas.canvasId, canvas.boardId, canvas.designId);

    expect(refused.error).not.toBeNull();
  });

  it("cannot be written or changed from a browser at all", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const jobId = must(await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId)) as string;

    expect((await ann.client.from("shoot_jobs").update({ status: "ready" }).eq("id", jobId)).error).not.toBeNull();
    expect((await ann.client.from("shoot_jobs").insert({ brand_id: annBrand, launch_project_id: canvas.canvasId, board_id: canvas.boardId, design_board_id: canvas.designId, scene_slug: "x", style: "editorial", aspect: "match" })).error).not.toBeNull();
    expect((await ann.client.from("shoot_jobs").delete().eq("id", jobId)).error).not.toBeNull();
  });

  it("is not another brand's to finish", async () => {
    const canvas = await shootCanvas(ann, annBrand);
    const jobId = must(await startShoot(ann, annBrand, canvas.canvasId, canvas.boardId, canvas.designId)) as string;
    const refused = await finishShoot(ben, benBrand, jobId);

    expect(refused.error).not.toBeNull();
  });
});
