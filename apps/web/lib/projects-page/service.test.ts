import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { fakeClient } from "./fixtures/fake-client";
import { createFolder, deleteForGood, MESSAGES_FOR, placeItem, refusal, removeFolder, renameFolder, restoreItem, trashItem } from "./service";

const deleteDesign = vi.hoisted(() => vi.fn(async () => ({ removedFiles: 0 })));
const removeLaunchProject = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/deletion/service", () => ({ deleteDesign }));
vi.mock("@/lib/launch/service", () => ({ removeLaunchProject }));

const WHO = { brandId: "b0000000-0000-4000-8000-000000000000", userId: "u0000000-0000-4000-8000-000000000000" };
const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  deleteDesign.mockClear();
  removeLaunchProject.mockClear();
});

describe("what the database refuses", () => {
  it.each([
    [{ hint: "folder_name_taken", message: "" }, "conflict", MESSAGES_FOR.folderNameTaken],
    [{ hint: "too_many_folders", message: "" }, "conflict", MESSAGES_FOR.tooManyFolders],
    [{ hint: "ordered", message: "" }, "conflict", MESSAGES_FOR.ordered],
    [{ code: "42501", message: "" }, "forbidden", MESSAGES_FOR.notAllowed],
    [{ code: "22023", message: "Give the folder a name." }, "invalid_input", "Give the folder a name."],
    [{ code: "P0002", message: "" }, "not_found", MESSAGES_FOR.notFound],
    [{ code: "22P02", message: "" }, "not_found", MESSAGES_FOR.notFound],
  ] as const)("%o is a %s the person can read", (error, code, message) => {
    const failure = refusal(error);
    expect(failure.code).toBe(code);
    expect(failure.message).toBe(message);
  });

  it("keeps anything else as an internal fault with its cause", () => {
    const failure = refusal({ code: "XX000", message: "disk" });
    expect(failure.code).toBe("internal");
    expect(failure.cause).toEqual({ code: "XX000", message: "disk" });
  });
});

describe("the changes", () => {
  it("makes a folder and returns its id", async () => {
    const { client, calls } = fakeClient({ rpc: { create_project_folder: { data: ID, error: null } } });
    expect(await createFolder(client, WHO, "Home kits")).toBe(ID);
    expect(calls).toEqual([{ name: "create_project_folder", args: { p_brand_id: WHO.brandId, p_user_id: WHO.userId, p_name: "Home kits" } }]);
  });

  it("renames, removes, places, trashes and restores through their functions", async () => {
    const { client, calls } = fakeClient();
    await renameFolder(client, WHO, ID, "Away");
    await removeFolder(client, WHO, ID);
    await placeItem(client, WHO, { kind: "launch", id: ID }, null);
    await trashItem(client, WHO, { kind: "design", id: ID });
    await restoreItem(client, WHO, { kind: "design", id: ID });
    expect(calls.map((call) => call.name)).toEqual([
      "rename_project_folder",
      "remove_project_folder",
      "place_project_item",
      "trash_project_item",
      "restore_project_item",
    ]);
    expect(calls[2]!.args).toMatchObject({ p_kind: "launch", p_item_id: ID, p_folder_id: null });
  });

  it("passes a refusal on as the person's sentence", async () => {
    const { client } = fakeClient({ rpc: { trash_project_item: { data: null, error: { code: "P0001", hint: "ordered", message: "x" } } } });
    await expect(trashItem(client, WHO, { kind: "design", id: ID })).rejects.toThrow(MESSAGES_FOR.ordered);
  });
});

describe("deleting for good", () => {
  it("refuses an item that is not in the Trash", async () => {
    const { client } = fakeClient({ tables: { project_trash: [] } });
    const attempt = deleteForGood(client, client, WHO, { kind: "design", id: ID });
    await expect(attempt).rejects.toBeInstanceOf(AppError);
    await expect(attempt).rejects.toThrow(MESSAGES_FOR.notInTrash);
    expect(deleteDesign).not.toHaveBeenCalled();
  });

  it("deletes a design through the design deletion, with its files", async () => {
    const { client } = fakeClient({ tables: { project_trash: [{ id: ID }] } });
    await deleteForGood(client, client, WHO, { kind: "design", id: ID });
    expect(deleteDesign).toHaveBeenCalledWith(client, { brandId: WHO.brandId, userId: WHO.userId, projectId: ID });
    expect(removeLaunchProject).not.toHaveBeenCalled();
  });

  it("deletes a launch project through the launch deletion", async () => {
    const { client } = fakeClient({ tables: { project_trash: [{ id: ID }] } });
    await deleteForGood(client, client, WHO, { kind: "launch", id: ID });
    expect(removeLaunchProject).toHaveBeenCalledWith(client, WHO, ID);
  });

  it("says so when the Trash cannot be read", async () => {
    const { client } = fakeClient({ tables: { project_trash: { __fail: "down" } } });
    await expect(deleteForGood(client, client, WHO, { kind: "launch", id: ID })).rejects.toMatchObject({ code: "internal" });
  });
});
