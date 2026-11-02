import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_SHOOT_CONCEPTS } from "./concepts";
import { MODEL_PRESET_CATALOGUE } from "./models";
import { ALL_SHOOT_POSES } from "./poses";
import { MAX_IMAGE_COUNT, POSE_KINDS, PRESET_SOURCES, SHOOT_ASPECTS, SHOOT_JOB_STATUSES, SHOOT_STYLES } from "./types";

/**
 * The shoot studio's vocabulary exists twice on purpose: once in TypeScript, where it gives a person
 * a sentence they can read, and once in SQL, where it refuses the row whatever wrote it. Two copies
 * of one list is a cost, and this is what pays it: a value added or renamed on one side fails here
 * before it can disagree with the other.
 *
 * It also reads the constraints by name, because they are the three promises of this workstream: the
 * garment is locked, a likeness needs consent, and money comes back on a failure.
 */

const MIGRATION = join(__dirname, "..", "..", "..", "..", "supabase", "migrations", "20261201020000_shoots.sql");
const sql = readFileSync(MIGRATION, "utf8");

/** The quoted values of a `check (col in (...))` on a column. */
function allowed(column: string): readonly string[] {
  const found = new RegExp(`${column} text not null[^\\n]*check \\(${column} in \\(([^)]+)\\)\\)`).exec(sql);
  if (!found) return [];
  return [...found[1]!.matchAll(/'([^']+)'/g)].map((one) => one[1] as string);
}

describe("the lists in the database and the lists in TypeScript", () => {
  it("name the same five styles", () => {
    expect(allowed("style")).toEqual([...SHOOT_STYLES]);
  });

  it("name the same five aspects", () => {
    expect(allowed("aspect")).toEqual([...SHOOT_ASPECTS]);
  });

  it("name the same job statuses, and the same pose kinds and preset sources", () => {
    expect(allowed("status")).toEqual([...SHOOT_JOB_STATUSES]);
    expect(allowed("kind")).toEqual([...POSE_KINDS]);
    expect(allowed("source")).toEqual([...PRESET_SOURCES]);
  });

  it("hold the image count to F-L1's one to four, in both tables", () => {
    expect(sql).toContain(`outputs_count integer not null check (outputs_count between 1 and ${MAX_IMAGE_COUNT})`);
    expect(sql).toContain(`image_count integer not null default 1 check (image_count between 1 and ${MAX_IMAGE_COUNT})`);
  });

  it("holds a concept's poses to the three to six 07 asks for", () => {
    expect(sql).toContain("pose_keys text[] not null check (cardinality(pose_keys) between 1 and 6)");
    expect(ALL_SHOOT_CONCEPTS.every((concept) => concept.poseKeys.length <= 6)).toBe(true);
  });

  it("holds a concept's scenes to the eleven garment slots 07 allows", () => {
    expect(sql).toContain("scene_slugs text[] not null check (cardinality(scene_slugs) between 1 and 11)");
    expect(ALL_SHOOT_CONCEPTS.every((concept) => concept.sceneSlugs.length <= 11)).toBe(true);
  });

  it("names the three tables of the plan, and the fourth this workstream owns", () => {
    for (const table of ["shoot_concepts", "shoot_poses", "model_presets", "shoot_jobs"]) {
      expect(sql).toContain(`create table public.${table} (`);
    }
  });
});

describe("the garment lock, in the database", () => {
  it("makes a job name the Design board its garment came from, and never lets it be null", () => {
    expect(sql).toMatch(/design_board_id uuid not null references public\.boards \(id\)/);
  });

  it("refuses a job whose board is not an AI image board, or whose other board is not a design", () => {
    expect(sql).toContain("A shoot fills an AI image board, not a % board.");
    expect(sql).toContain("A shoot keeps the garment the platform drew, so it starts from a Design board.");
    expect(sql).toContain("create trigger shoot_jobs_the_garment_is_locked");
  });

  it("asks L1's own question rather than a second one of its own", () => {
    expect(sql).toContain("private.launch_board_has_design(p_board_id)");
    const theirs = readFileSync(join(__dirname, "..", "..", "..", "..", "supabase", "migrations", "20261201010000_launch_projects.sql"), "utf8");
    expect(theirs).toContain("create function private.launch_board_has_design(p_board_id uuid)");
  });

  it("writes no output of its own: a picture reaches a board through L1's one writer", () => {
    expect(sql).not.toMatch(/update public\.boards/);
    expect(sql).not.toMatch(/insert into public\.boards/);
  });
});

describe("a person's likeness, in the database", () => {
  it("has a licence reference column that may be null, and a holder that may not stand alone", () => {
    expect(sql).toMatch(/licence_ref text check \(licence_ref is null/);
    expect(sql).toContain("constraint model_presets_a_holder_needs_a_reference");
  });

  it("refuses a preset run with no licence on file, in the words the panel shows", () => {
    expect(sql).toContain("No licence on file for this likeness, so it cannot be generated.");
  });

  it("refuses an upload that records no consent, all three parts of it or none", () => {
    expect(sql).toContain("constraint shoot_jobs_an_upload_records_its_consent");
    expect(sql).toContain("(model_source = 'upload') = (consent_ref is not null and consent_statement is not null and consent_given_at is not null)");
    expect(sql).toContain("constraint shoot_jobs_an_upload_has_a_picture");
  });

  it("has nowhere for a photograph of a person to live in the preset table", () => {
    const table = /create table public\.model_presets \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? "";
    expect(table).not.toMatch(/photo|image|file_id|bytes/);
  });
});

describe("the money, in the database", () => {
  it("records what was charged and what came back, and refuses a refund on a shoot that worked", () => {
    expect(sql).toContain("constraint shoot_jobs_refund_only_on_a_failure");
    expect(sql).toContain("constraint shoot_jobs_refund_is_never_more_than_the_charge");
  });

  it("adds no second way to move money: the refund is the one L6 wrote", () => {
    expect(sql).not.toMatch(/insert into public\.credit_ledger/);
    expect(sql).not.toMatch(/create function public\.credit_/);
    expect(sql).toContain("credit_refund_spend");
  });

  it("holds no price of its own: no column here is one", () => {
    expect(sql).not.toMatch(/\n\s+\w*(price|amount)\w* (integer|numeric|money|bigint)/i);
  });
});

describe("who may reach what", () => {
  it("gives the server's own key SELECT only on the jobs, so every write goes through a function", () => {
    expect(sql).toContain("grant select on public.shoot_jobs to authenticated, service_role;");
    expect(sql).toMatch(/revoke all on public\.shoot_jobs\s+from public, anon, authenticated, service_role;/);
  });

  it("lets every signed-in member read the library, and only the server seed write it", () => {
    expect(sql).toContain("grant select on public.shoot_concepts, public.shoot_poses, public.model_presets to authenticated;");
    expect(sql).toContain("grant select, insert, update on public.shoot_concepts, public.shoot_poses, public.model_presets to service_role;");
  });

  it("turns row level security on for all four tables", () => {
    for (const table of ["shoot_jobs", "shoot_concepts", "shoot_poses", "model_presets"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  it("takes away the execute every new function is given to the world", () => {
    // A function is callable by PUBLIC until that is revoked, and the isolation suite reads the list
    // of what a browser may call. All four of ours -- the two writers and the two trigger functions --
    // are the server's alone.
    for (const name of ["private.refuse_unknown_shoot_preset()", "private.refuse_unlocked_shoot_job()"]) {
      expect(sql).toContain(`revoke all on function ${name} from public, anon, authenticated;`);
    }
    for (const name of ["start_shoot_job", "finish_shoot_job"]) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`));
    }
  });

  it("lets only the service role run the two writers", () => {
    expect(sql).toMatch(/grant execute on function public\.start_shoot_job\([^)]*\) to service_role;/);
    expect(sql).toMatch(/grant execute on function public\.finish_shoot_job\([^)]*\) to service_role;/);
    expect(sql).not.toMatch(/grant execute on function public\.(start|finish)_shoot_job\([^)]*\) to authenticated/);
  });
});

describe("the seeded rows the migration expects", () => {
  it("fit the columns: every pose, preset and concept is within the lengths the table allows", () => {
    for (const pose of ALL_SHOOT_POSES) {
      expect(pose.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(pose.key.length).toBeLessThanOrEqual(64);
      expect(pose.prompt.length).toBeLessThanOrEqual(300);
      expect(pose.note.length).toBeLessThanOrEqual(300);
    }
    for (const preset of MODEL_PRESET_CATALOGUE) {
      expect(preset.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(preset.label.length).toBeLessThanOrEqual(160);
      expect(preset.note.length).toBeLessThanOrEqual(400);
    }
    for (const concept of ALL_SHOOT_CONCEPTS) {
      expect(concept.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(concept.lead.length).toBeLessThanOrEqual(300);
      expect(concept.lighting.length).toBeLessThanOrEqual(200);
      expect(concept.note.length).toBeLessThanOrEqual(500);
    }
  });

  it("obeys the constraint that ties a concept's presets to whether anybody is in the picture", () => {
    for (const concept of ALL_SHOOT_CONCEPTS) {
      expect(concept.needsModel === false, concept.slug).toBe(concept.modelPresetKeys.length === 0);
    }
  });

  it("only ever marks a pose as needing a person, never a camera", () => {
    for (const row of ALL_SHOOT_POSES) if (row.kind === "camera") expect(row.needsPerson, row.key).toBe(false);
  });
});
