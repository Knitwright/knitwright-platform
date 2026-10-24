import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/** Migration 20261025010000: factory_profiles and design_statuses. Needs local Supabase. */

const SPEC = { schemaVersion: 3 };
const HASH = "a".repeat(64);

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
    p_profile_id: status === "draft" ? null : "knitwright-default", p_findings_hash: status === "draft" ? null : HASH,
  });

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("val-alice"), person("val-bob")]);
  [aliceBrand, bobBrand] = await Promise.all([brandOf(alice, "Val Alice FC"), brandOf(bob, "Val Bob FC")]);
});

describe("factory profiles", () => {
  it("shows the labelled default profile to a signed-in member", async () => {
    const { data } = await alice.client.from("factory_profiles").select("id, label");
    expect(data).toContainEqual({ id: "knitwright-default", label: "Knitwright default profile, not agreed with a factory" });
  });

  it("lets no browser session write, change or remove a profile", async () => {
    expect((await alice.client.from("factory_profiles").insert({ id: "mine", name: "Mine", label: "x", profile: {} })).error).not.toBeNull();
    await alice.client.from("factory_profiles").update({ name: "Changed" }).eq("id", "knitwright-default");
    await alice.client.from("factory_profiles").delete().eq("id", "knitwright-default");
    const { data } = await adminClient().from("factory_profiles").select("name").eq("id", "knitwright-default").single();
    expect(data?.name).toBe("Knitwright default");
  });

  it("lets the server's own key add a profile", async () => {
    const id = `mill-${Date.now()}`;
    expect((await adminClient().from("factory_profiles").insert({ id, name: "Mill", label: "Agreed with Mill, 2026", profile: {} })).error).toBeNull();
    await adminClient().from("factory_profiles").delete().eq("id", id);
  });
});

describe("design statuses", () => {
  it("moves draft to validated to ordered, and refuses any move from ordered", async () => {
    const project = await newProject(alice, aliceBrand);
    expect((await setStatus(project, alice, aliceBrand, "validated")).error).toBeNull();
    expect((await setStatus(project, alice, aliceBrand, "ordered")).error).toBeNull();
    const back = await setStatus(project, alice, aliceBrand, "draft");
    expect(back.error?.hint).toBe("status_ordered");
  });

  it("refuses to order a version that has no status yet", async () => {
    const project = await newProject(alice, aliceBrand);
    expect((await setStatus(project, alice, aliceBrand, "ordered")).error?.hint).toBe("status_move");
  });

  it("refuses to order a draft", async () => {
    const project = await newProject(alice, aliceBrand);
    await setStatus(project, alice, aliceBrand, "draft");
    expect((await setStatus(project, alice, aliceBrand, "ordered")).error?.hint).toBe("status_move");
  });

  it("keeps the profile and the findings hash for a validated version, and clears them for a draft", async () => {
    const project = await newProject(alice, aliceBrand);
    await setStatus(project, alice, aliceBrand, "validated");
    const { data } = await alice.client.from("design_statuses").select("status, profile_id, findings_hash").eq("project_id", project).single();
    expect(data).toEqual({ status: "validated", profile_id: "knitwright-default", findings_hash: HASH });
    await setStatus(project, alice, aliceBrand, "draft");
    const again = await alice.client.from("design_statuses").select("status, profile_id, findings_hash").eq("project_id", project).single();
    expect(again.data).toEqual({ status: "draft", profile_id: null, findings_hash: null });
  });

  it("does not show a brand's statuses to another brand's member", async () => {
    const project = await newProject(alice, aliceBrand);
    await setStatus(project, alice, aliceBrand, "validated");
    const { data } = await bob.client.from("design_statuses").select("project_id").eq("project_id", project);
    expect(data).toEqual([]);
  });

  it("refuses a user who does not belong to the brand", async () => {
    const project = await newProject(alice, aliceBrand);
    const result = await setStatus(project, bob, aliceBrand, "validated");
    expect(result.error?.code).toBe("P0002");
    expect(bobBrand).not.toBe(aliceBrand);
  });

  it("lets no browser session write, change or remove a status", async () => {
    const project = await newProject(alice, aliceBrand);
    await setStatus(project, alice, aliceBrand, "validated");
    expect((await alice.client.from("design_statuses").insert({ project_id: project, brand_id: aliceBrand, version: 1, status: "draft" })).error).not.toBeNull();
    await alice.client.from("design_statuses").update({ status: "draft", profile_id: null, findings_hash: null }).eq("project_id", project);
    await alice.client.from("design_statuses").delete().eq("project_id", project);
    const { data } = await adminClient().from("design_statuses").select("status").eq("project_id", project).single();
    expect(data?.status).toBe("validated");
  });

  it("refuses a profile on a draft and a missing profile on a validated version", async () => {
    const project = await newProject(alice, aliceBrand);
    await setStatus(project, alice, aliceBrand, "validated");
    const bad = await adminClient().from("design_statuses").update({ profile_id: null, findings_hash: null }).eq("project_id", project);
    expect(bad.error).not.toBeNull();
  });
});
