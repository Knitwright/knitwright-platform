import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261220010000 (plan v6 D1, decision 0132; spec F-0, F-T7): the one door every order goes
 * through refuses a version whose newest check against the order's factory profile found a blocker, and
 * marks the version it lets through `ordered`. Needs local Supabase.
 *
 * Every test makes its own design, so no two share a status row or a validation result, and every
 * order has its own reference, so a retry of this file never meets its own leftovers (v5 Lesson 11).
 */

const PROFILE = "knitwright-default";
const SIZES = { M: 2, L: 1 };
const SNAPSHOT = (specVersion: unknown) => ({
  specVersion,
  patternBlockId: "crew-tee",
  patternBlockVersion: 1,
  fabricTestIds: [],
  printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" },
  rosterHash: null,
  files: [],
});

const BLOCKER = { code: "article-not-made", severity: "blocker", message: "Not made.", target: { article: "crew-tee", panel: null }, ruleId: "R-GAP-000", passed: false };
const CLEAR = { code: "min-dpi", severity: null, message: "Nothing found.", target: { article: null, panel: null }, ruleId: "R-SUB-003", passed: true };

let ann: Person;
let annBrand: string;

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

const newDesign = async (): Promise<string> =>
  must(
    await rpc("create_project", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_name: "Gate tee", p_style_number: "", p_season: "",
      p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1,
    }),
  ) as string;

const releaseOf = async (projectId: string, specVersion: unknown = 1): Promise<string> => {
  const created = must(
    await rpc("create_release", {
      p_project_id: projectId, p_brand_id: annBrand, p_user_id: ann.userId, p_label: `Gate ${randomUUID().slice(0, 8)}`,
      p_snapshot: SNAPSHOT(specVersion), p_file_specs: [], p_order_id: null,
    }),
  ) as { id: string }[];
  return created[0]!.id;
};

const record = async (projectId: string, passed: boolean, over: Partial<{ scope: string; profile: string; version: number }> = {}) =>
  must(
    await rpc("record_validation_result", {
      p_project_id: projectId, p_brand_id: annBrand, p_user_id: ann.userId, p_version: over.version ?? 1,
      p_profile_id: over.profile ?? PROFILE, p_scope: over.scope ?? "save", p_checks: passed ? [CLEAR] : [BLOCKER], p_passed: passed,
    }),
  );

const setStatus = async (projectId: string, status: string) =>
  must(
    await rpc("set_design_status", {
      p_project_id: projectId, p_brand_id: annBrand, p_user_id: ann.userId, p_version: 1, p_status: status,
      p_profile_id: status === "draft" ? null : PROFILE, p_findings_hash: status === "draft" ? null : "c".repeat(64),
    }),
  );

const order = (releaseId: string, ref = `d1-${randomUUID()}`) =>
  rpc("submit_order_for_production", {
    p_release_id: releaseId, p_external_ref: ref, p_factory_profile_id: PROFILE, p_fabric_key: "mesh", p_article_id: "crew-tee", p_sizes: SIZES,
  });

const statusOf = async (projectId: string, version = 1): Promise<string | null> => {
  const { data, error } = await adminClient().from("design_statuses").select("status").eq("project_id", projectId).eq("version", version).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { status: string } | null)?.status ?? null;
};

const ordersOf = async (releaseId: string): Promise<number> =>
  (must(await adminClient().from("ops_orders").select("id").eq("release_id", releaseId)) as unknown[]).length;

beforeAll(async () => {
  ann = await person("d1-gate-ann");
  annBrand = await brandOf(ann, "D1 Gate FC");
});

describe("the gate on the one door", () => {
  it("refuses a version whose newest check found a blocker, and writes no order", async () => {
    const project = await newDesign();
    const release = await releaseOf(project);
    await record(project, false);
    const { error } = await order(release);
    expect(error?.hint).toBe("validation_blockers");
    expect(error?.code).toBe("P0001");
    expect(await ordersOf(release)).toBe(0);
    expect(await statusOf(project)).toBeNull();
  });

  it("refuses through a brand run too, because a run reaches ops through the same function", async () => {
    const project = await newDesign();
    const release = await releaseOf(project);
    await record(project, false);
    const product = must(await rpc("create_brand_product", { p_brand_id: annBrand, p_user_id: ann.userId, p_project_id: project, p_name: "Gate tee" })) as string;
    const { error } = await rpc("submit_brand_run", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: product, p_kind: "sample", p_release_id: release,
      p_factory_profile_id: PROFILE, p_fabric_key: "mesh", p_sizes: { S: 1 }, p_flags: [], p_request_key: randomUUID(),
    });
    expect(error?.hint).toBe("validation_blockers");
    expect(await ordersOf(release)).toBe(0);
  });

  it("goes by the newest check, so a version checked again after a fix can be ordered", async () => {
    const project = await newDesign();
    const release = await releaseOf(project);
    await record(project, false, { scope: "full" });
    await record(project, true, { scope: "save" });
    const { error } = await order(release);
    expect(error).toBeNull();
    expect(await ordersOf(release)).toBe(1);
  });

  it("reads only the order's own factory profile", async () => {
    const project = await newDesign();
    const release = await releaseOf(project);
    await record(project, false, { profile: "another-factory" });
    expect((await order(release)).error).toBeNull();
  });

  it("lets a version with no stored check through, as before (owner question D1-1)", async () => {
    const project = await newDesign();
    const release = await releaseOf(project);
    expect((await order(release)).error).toBeNull();
  });

  it("ignores a release whose snapshot names no saved version", async () => {
    const project = await newDesign();
    await record(project, false);
    for (const specVersion of [99, "x", null]) {
      const release = await releaseOf(project, specVersion);
      expect((await order(release)).error, String(specVersion)).toBeNull();
    }
    expect(await statusOf(project)).toBeNull();
  });
});

describe("an ordered version", () => {
  it("is marked ordered when it had no status yet", async () => {
    const project = await newDesign();
    const release = await releaseOf(project);
    await record(project, true);
    must(await order(release));
    expect(await statusOf(project)).toBe("ordered");
  });

  it("moves on from validated and from approved", async () => {
    for (const steps of [["validated"], ["validated", "approved"]]) {
      const project = await newDesign();
      for (const step of steps) await setStatus(project, step);
      must(await order(await releaseOf(project)));
      expect(await statusOf(project), steps.join(" > ")).toBe("ordered");
    }
  });

  it("is ordered from a version put back to draft, because it has just passed the gate", async () => {
    const project = await newDesign();
    await setStatus(project, "validated");
    await setStatus(project, "draft");
    must(await order(await releaseOf(project)));
    expect(await statusOf(project)).toBe("ordered");
  });

  it("takes a second order and an answered replay without moving again", async () => {
    const project = await newDesign();
    const release = await releaseOf(project);
    const ref = `d1-${randomUUID()}`;
    must(await order(release, ref));
    const replay = must(await order(release, ref)) as { created: boolean }[];
    expect(replay[0]?.created).toBe(false);
    must(await order(release));
    expect(await statusOf(project)).toBe("ordered");
  });

  it("can never be moved back, and an edit saves a new version that starts as a draft", async () => {
    const project = await newDesign();
    must(await order(await releaseOf(project)));
    const { error } = await rpc("set_design_status", {
      p_project_id: project, p_brand_id: annBrand, p_user_id: ann.userId, p_version: 1, p_status: "draft", p_profile_id: null, p_findings_hash: null,
    });
    expect(error?.hint).toBe("status_ordered");

    const next = must(
      await rpc("append_spec_version", {
        p_project_id: project, p_user_id: ann.userId, p_expected_version: 1, p_spec: { made: "edited" }, p_schema_version: 1, p_note: "edit", p_restored_from: null,
      }),
    ) as number;
    expect(next).toBe(2);
    expect(await statusOf(project, 2)).toBeNull();
    expect(await statusOf(project, 1)).toBe("ordered");
  });

  it("is not something a browser can do: the marking function is the server's alone", async () => {
    const { error } = await ann.client.rpc("mark_version_ordered", { p_project_id: randomUUID(), p_brand_id: annBrand, p_version: 1, p_profile_id: PROFILE });
    expect(error).not.toBeNull();
  });
});
