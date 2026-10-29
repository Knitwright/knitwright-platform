import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/** Migration 20261101030000: the approved status and validation_results. Needs local Supabase. */

const SPEC = { schemaVersion: 3 };
const HASH = "b".repeat(64);
const PROFILE = "knitwright-default";

const CHECKS = [
  { code: "seam-cross", severity: "warning", message: "Crosses a seam.", target: { article: "crew-tee", panel: "body-front" }, ruleId: "R-SUB-004", passed: false },
  { code: "dpi", severity: null, message: "Nothing found.", target: { article: null, panel: null }, ruleId: "R-SUB-003", passed: true },
];

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const newProject = async (owner: Person, brand: string): Promise<string> =>
  must(
    await adminClient().rpc("create_project", {
      p_brand_id: brand, p_user_id: owner.userId, p_name: "Home shirt", p_style_number: "", p_season: "",
      p_garment_type: "crew-tee", p_spec: SPEC, p_schema_version: 3,
    }),
  );

const setStatus = (projectId: string, owner: Person, brand: string, status: string, version = 1) =>
  adminClient().rpc("set_design_status", {
    p_project_id: projectId, p_brand_id: brand, p_user_id: owner.userId, p_version: version, p_status: status,
    p_profile_id: status === "draft" ? null : PROFILE, p_findings_hash: status === "draft" ? null : HASH,
  });

const record = (
  projectId: string,
  owner: Person,
  brand: string,
  over: Partial<{ scope: string; checks: unknown; passed: boolean; version: number; profile: string }> = {},
) =>
  adminClient().rpc("record_validation_result", {
    p_project_id: projectId,
    p_brand_id: brand,
    p_user_id: owner.userId,
    p_version: over.version ?? 1,
    p_profile_id: over.profile ?? PROFILE,
    p_scope: over.scope ?? "save",
    p_checks: over.checks ?? CHECKS,
    p_passed: over.passed ?? true,
  });

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("val2-alice"), person("val2-bob")]);
  [aliceBrand, bobBrand] = await Promise.all([brandOf(alice, "Val2 Alice FC"), brandOf(bob, "Val2 Bob FC")]);
});

describe("the approved status", () => {
  it("moves draft to validated to approved to ordered", async () => {
    const project = await newProject(alice, aliceBrand);
    expect((await setStatus(project, alice, aliceBrand, "validated")).error).toBeNull();
    expect((await setStatus(project, alice, aliceBrand, "approved")).error).toBeNull();
    expect((await setStatus(project, alice, aliceBrand, "ordered")).error).toBeNull();
    const { data } = await alice.client.from("design_statuses").select("status").eq("project_id", project).single();
    expect(data?.status).toBe("ordered");
  });

  it("refuses to accept a version that has no status yet", async () => {
    const project = await newProject(alice, aliceBrand);
    expect((await setStatus(project, alice, aliceBrand, "approved")).error?.hint).toBe("status_move");
  });

  it("refuses to accept a draft", async () => {
    const project = await newProject(alice, aliceBrand);
    await setStatus(project, alice, aliceBrand, "draft");
    expect((await setStatus(project, alice, aliceBrand, "approved")).error?.hint).toBe("status_move");
  });

  it("lets an accepted version only be ordered, never go back to draft or validated", async () => {
    const project = await newProject(alice, aliceBrand);
    await setStatus(project, alice, aliceBrand, "validated");
    await setStatus(project, alice, aliceBrand, "approved");
    expect((await setStatus(project, alice, aliceBrand, "draft")).error?.hint).toBe("status_approved");
    expect((await setStatus(project, alice, aliceBrand, "validated")).error?.hint).toBe("status_approved");
    expect((await setStatus(project, alice, aliceBrand, "ordered")).error).toBeNull();
  });

  it("keeps the profile and the findings hash for an accepted version", async () => {
    const project = await newProject(alice, aliceBrand);
    await setStatus(project, alice, aliceBrand, "validated");
    await setStatus(project, alice, aliceBrand, "approved");
    const { data } = await alice.client.from("design_statuses").select("status, profile_id, findings_hash").eq("project_id", project).single();
    expect(data).toEqual({ status: "approved", profile_id: PROFILE, findings_hash: HASH });
  });

  it("refuses a status nobody has heard of", async () => {
    const project = await newProject(alice, aliceBrand);
    expect((await setStatus(project, alice, aliceBrand, "verified")).error).not.toBeNull();
  });
});

describe("validation results", () => {
  it("stores the checks of a version and shows them to a member of the brand", async () => {
    const project = await newProject(alice, aliceBrand);
    expect((await record(project, alice, aliceBrand)).error).toBeNull();
    const { data } = await alice.client
      .from("validation_results")
      .select("version, profile_id, scope, checks, passed")
      .eq("project_id", project)
      .single();
    expect(data).toEqual({ version: 1, profile_id: PROFILE, scope: "save", checks: CHECKS, passed: true });
  });

  it("keeps one row per version, profile and scope, and a later run of the same scope replaces it", async () => {
    const project = await newProject(alice, aliceBrand);
    await record(project, alice, aliceBrand, { scope: "save", passed: true });
    await record(project, alice, aliceBrand, { scope: "save", passed: false, checks: [] });
    await record(project, alice, aliceBrand, { scope: "full", passed: true });
    const { data } = await alice.client.from("validation_results").select("scope, passed, checks").eq("project_id", project).order("scope");
    expect(data).toEqual([
      { scope: "full", passed: true, checks: CHECKS },
      { scope: "save", passed: false, checks: [] },
    ]);
  });

  it("refuses a scope and a shape the app does not write", async () => {
    const project = await newProject(alice, aliceBrand);
    expect((await record(project, alice, aliceBrand, { scope: "partial" })).error).not.toBeNull();
    expect((await record(project, alice, aliceBrand, { checks: { not: "an array" } })).error).not.toBeNull();
  });

  it("refuses a version of a design that does not exist", async () => {
    const project = await newProject(alice, aliceBrand);
    expect((await record(project, alice, aliceBrand, { version: 99 })).error).not.toBeNull();
  });

  it("refuses a user who does not belong to the brand", async () => {
    const project = await newProject(alice, aliceBrand);
    const result = await record(project, bob, aliceBrand);
    expect(result.error?.code).toBe("P0002");
    expect(bobBrand).not.toBe(aliceBrand);
  });

  it("does not show a brand's results to another brand's member", async () => {
    const project = await newProject(alice, aliceBrand);
    await record(project, alice, aliceBrand);
    const { data } = await bob.client.from("validation_results").select("project_id").eq("project_id", project);
    expect(data).toEqual([]);
  });

  it("lets no browser session write, change or remove a result", async () => {
    const project = await newProject(alice, aliceBrand);
    await record(project, alice, aliceBrand, { passed: true });
    expect(
      (await alice.client.from("validation_results").insert({ project_id: project, brand_id: aliceBrand, version: 1, profile_id: PROFILE, scope: "full", checks: [], passed: true })).error,
    ).not.toBeNull();
    await alice.client.from("validation_results").update({ passed: false }).eq("project_id", project);
    await alice.client.from("validation_results").delete().eq("project_id", project);
    const { data } = await adminClient().from("validation_results").select("passed").eq("project_id", project).single();
    expect(data?.passed).toBe(true);
  });

  it("goes when the design goes", async () => {
    const project = await newProject(alice, aliceBrand);
    await record(project, alice, aliceBrand);
    await adminClient().from("projects").delete().eq("id", project);
    const { data } = await adminClient().from("validation_results").select("project_id").eq("project_id", project);
    expect(data).toEqual([]);
  });
});
