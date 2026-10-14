import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { buildSnapshot } from "./build";
import { fakeBuilder, PROFILE, specFor } from "./fixtures/fake-builder";
import { createRelease, getRelease, listReleases } from "./service";

const BRAND = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";

const specs = [specFor("front")];
const snapshot = () => buildSnapshot({ specVersion: 1, patternBlockId: "b", patternBlockVersion: 1, fabricTestIds: [], printProfile: PROFILE, roster: null, files: specs }, fakeBuilder());

describe("listReleases", () => {
  it("lists releases newest first", async () => {
    const { client } = fakeClient({ production_releases: { data: [{ id: ID, number: 2, label: "Round 2", created_at: "t" }] } });
    expect(await listReleases(client, BRAND, PROJECT)).toEqual([{ id: ID, number: 2, label: "Round 2", createdAt: "t" }]);
  });
  it("gives an empty list for no data and fails when the database refuses", async () => {
    expect(await listReleases(fakeClient({}).client, BRAND, PROJECT)).toEqual([]);
    await expect(listReleases(fakeClient({ production_releases: { error: { code: "XX", message: "m" } } }).client, BRAND, PROJECT)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("getRelease", () => {
  it("reads the snapshot and the file settings back through the contract's schemas", async () => {
    const { client } = fakeClient({ production_releases: { data: { id: ID, number: 1, label: "R", created_at: "t", snapshot: await snapshot(), file_specs: specs, order_id: null } } });
    const release = await getRelease(client, BRAND, PROJECT, ID);
    expect(release.snapshot.files).toHaveLength(1);
    expect(release.fileSpecs).toEqual(specs);
    expect(release.orderId).toBeNull();
  });
  it("is not found when there is no such release or the database says so", async () => {
    await expect(getRelease(fakeClient({}).client, BRAND, PROJECT, ID)).rejects.toMatchObject({ code: "not_found" });
    await expect(getRelease(fakeClient({ production_releases: { error: { code: "22P02", message: "m" } } }).client, BRAND, PROJECT, ID)).rejects.toMatchObject({ code: "not_found" });
  });
  it("refuses a stored snapshot that no longer fits the contract", async () => {
    const { client } = fakeClient({ production_releases: { data: { id: ID, number: 1, label: "R", created_at: "t", snapshot: { nope: 1 }, file_specs: [], order_id: null } } });
    await expect(getRelease(client, BRAND, PROJECT, ID)).rejects.toThrow();
  });
});

describe("createRelease", () => {
  it("sends the snapshot and the file settings and returns the number", async () => {
    const { client, calls } = fakeClient({ create_release: { data: [{ id: ID, number: 3 }] } });
    const result = await createRelease(client, { projectId: PROJECT, brandId: BRAND, userId: BRAND, label: "R", snapshot: await snapshot(), fileSpecs: specs, orderId: null });
    expect(result).toEqual({ id: ID, number: 3 });
    expect((calls[0]?.steps[0]?.[1][0] as { p_file_specs: unknown }).p_file_specs).toEqual(specs);
  });
  it("turns a database refusal into a sentence", async () => {
    const { client } = fakeClient({ create_release: { error: { code: "P0001", hint: "too_many_releases", message: "m" } } });
    await expect(createRelease(client, { projectId: PROJECT, brandId: BRAND, userId: BRAND, label: "R", snapshot: await snapshot(), fileSpecs: specs, orderId: null })).rejects.toMatchObject({ code: "conflict" });
  });
});
