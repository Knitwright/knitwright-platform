import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { fakeClient } from "./fixtures/fake-client";
import { SHARED_BRAND_MESSAGE, deleteAccount, deleteDesign } from "./service";

const BRAND = "0b5c7f0e-8a53-4a6f-9d3e-2f7f1c1f0a11";
const SECOND = "1c6d8a1f-9b64-4b7a-8e4f-3a8a2d2a1b22";
const USER = "5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d";
const PROJECT = "7e6d5c4b-3a2f-4e1d-9c0b-8a7f6e5d4c3b";

const ok = (data: unknown) => ({ data, error: null });
const refused = (code: string, hint: string | null = null) => ({
  data: null,
  error: { code, hint, message: "refused" },
});

const failureOf = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

const design = { brandId: BRAND, userId: USER, projectId: PROJECT };

describe("deleteDesign", () => {
  it("removes the design's own files from storage before the rows, then anything added in between", async () => {
    const planned = { bucket: "uploads", path: `${BRAND}/artwork/a.png` };
    const late = { bucket: "uploads", path: `${BRAND}/artwork/late.png` };
    const fake = fakeClient({
      rpc: { project_deletion_files: ok([planned]), delete_project: ok([planned, late]) },
      objects: { uploads: [planned.path, late.path, `${BRAND}/artwork/kept.png`] },
    });

    expect(await deleteDesign(fake.client, design)).toEqual({ removedFiles: 2 });

    const args = { p_project_id: PROJECT, p_brand_id: BRAND, p_user_id: USER };
    expect(fake.calls).toEqual([
      { kind: "rpc", name: "project_deletion_files", args },
      { kind: "remove", bucket: "uploads", paths: [planned.path] },
      { kind: "rpc", name: "delete_project", args },
      { kind: "remove", bucket: "uploads", paths: [late.path] },
    ]);
    expect(fake.objects("uploads")).toEqual([`${BRAND}/artwork/kept.png`]);
  });

  it("deletes a design with no files of its own without touching storage", async () => {
    const fake = fakeClient({ rpc: { project_deletion_files: ok([]), delete_project: ok([]) } });
    expect(await deleteDesign(fake.client, design)).toEqual({ removedFiles: 0 });
    expect(fake.calls.map((call) => call.kind)).toEqual(["rpc", "rpc"]);
  });

  it("gives one answer for a missing design and another brand's design", async () => {
    const fake = fakeClient({ rpc: { project_deletion_files: refused("P0002") } });
    const failure = await failureOf(deleteDesign(fake.client, design));
    expect([failure.code, failure.message]).toEqual(["not_found", "That design does not exist."]);
    expect(fake.calls.map((call) => call.kind)).toEqual(["rpc"]);
  });

  it("keeps the design when storage refuses, so it can be tried again", async () => {
    const planned = { bucket: "uploads", path: `${BRAND}/artwork/a.png` };
    const fake = fakeClient({
      rpc: { project_deletion_files: ok([planned]), delete_project: ok([planned]) },
      failRemove: ["uploads"],
    });
    await expect(deleteDesign(fake.client, design)).rejects.toThrow("could not be removed");
    expect(fake.calls.some((call) => call.kind === "rpc" && call.name === "delete_project")).toBe(false);
  });

  it("reports a failed database delete as a database failure", async () => {
    const fake = fakeClient({
      rpc: { project_deletion_files: ok([]), delete_project: refused("P0002") },
    });
    expect((await failureOf(deleteDesign(fake.client, design))).code).toBe("not_found");
  });

  it("refuses a file list that is not what the database promises", async () => {
    const fake = fakeClient({ rpc: { project_deletion_files: ok([{ bucket: 3 }]) } });
    await expect(deleteDesign(fake.client, design)).rejects.toThrow("unexpected answer");
  });
});

describe("deleteAccount", () => {
  it("empties every brand folder, deletes the rows, empties again, then deletes the user", async () => {
    const fake = fakeClient({
      rpc: { account_deletion_brands: ok([BRAND, SECOND]), delete_account_data: ok([BRAND, SECOND]) },
      objects: { uploads: [`${BRAND}/artwork/a.png`, `${SECOND}/sketch/b.png`] },
    });

    expect(await deleteAccount(fake.client, { userId: USER })).toEqual({ deletedBrands: 2 });

    const order = fake.calls
      .filter((call) => call.kind !== "list")
      .map((call) => (call.kind === "rpc" ? call.name : call.kind));
    expect(order).toEqual([
      "account_deletion_brands",
      "remove",
      "remove",
      "delete_account_data",
      "deleteUser",
    ]);
    expect(fake.calls.at(-1)).toEqual({ kind: "deleteUser", id: USER });
    expect(fake.objects("uploads")).toEqual([]);
  });

  it("deletes an account with no brands", async () => {
    const fake = fakeClient({
      rpc: { account_deletion_brands: ok([]), delete_account_data: ok([]) },
    });
    expect(await deleteAccount(fake.client, { userId: USER })).toEqual({ deletedBrands: 0 });
    expect(fake.calls.at(-1)).toEqual({ kind: "deleteUser", id: USER });
  });

  it("refuses while a brand has other members, and deletes nothing", async () => {
    const fake = fakeClient({ rpc: { account_deletion_brands: refused("P0001", "shared_brand") } });
    const failure = await failureOf(deleteAccount(fake.client, { userId: USER }));
    expect([failure.code, failure.message]).toEqual(["conflict", SHARED_BRAND_MESSAGE]);
    expect(fake.calls).toHaveLength(1);
  });

  it("stops before the rows go when a folder cannot be emptied", async () => {
    const fake = fakeClient({
      rpc: { account_deletion_brands: ok([BRAND]), delete_account_data: ok([BRAND]) },
      failList: ["uploads"],
    });
    await expect(deleteAccount(fake.client, { userId: USER })).rejects.toThrow();
    expect(fake.calls.some((call) => call.kind === "rpc" && call.name === "delete_account_data")).toBe(false);
    expect(fake.calls.some((call) => call.kind === "deleteUser")).toBe(false);
  });

  it("throws when the sign-in record cannot be deleted, so the failure is seen and retried", async () => {
    const fake = fakeClient({
      rpc: { account_deletion_brands: ok([]), delete_account_data: ok([]) },
      deleteUserError: { message: "auth down" },
    });
    await expect(deleteAccount(fake.client, { userId: USER })).rejects.toThrow(
      "The account could not be deleted.",
    );
  });

  it("treats an unknown account as not found", async () => {
    const fake = fakeClient({ rpc: { account_deletion_brands: refused("P0002") } });
    expect((await failureOf(deleteAccount(fake.client, { userId: USER }))).code).toBe("not_found");
  });

  it("treats any other database refusal as unexpected", async () => {
    const fake = fakeClient({ rpc: { account_deletion_brands: refused("XX000") } });
    expect((await failureOf(deleteAccount(fake.client, { userId: USER }))).code).toBe("internal");
  });

  it("refuses a brand list that is not a list of ids", async () => {
    const fake = fakeClient({ rpc: { account_deletion_brands: ok([42]) } });
    await expect(deleteAccount(fake.client, { userId: USER })).rejects.toThrow("unexpected answer");
  });
});
