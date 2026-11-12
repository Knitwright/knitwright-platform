import { describe, expect, it } from "vitest";
import { fakeClient } from "./fixtures/fake-client";
import { loadCreations, loadFolders, loadProjectItems, loadShared } from "./load";

const ID = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`;
const BRAND = ID(9);

describe("the reads", () => {
  it("lists designs and launch projects with their folders and the Trash", async () => {
    const { client } = fakeClient({
      tables: {
        projects: [{ id: ID(1), name: "Home kit", garment_type: "crew-tee", created_at: "a", updated_at: "b" }],
        launch_projects: [{ id: ID(2), name: "Launch", created_at: "a", updated_at: "c", boards: [] }],
        project_folder_items: [{ folder_id: ID(3), project_id: ID(1), launch_project_id: null }],
        project_trash: [{ project_id: null, launch_project_id: ID(2), trashed_at: "d" }],
      },
    });
    const items = await loadProjectItems(client, BRAND);
    expect(items.map((item) => [item.kind, item.folderId, item.trashedAt])).toEqual([
      ["design", ID(3), null],
      ["launch", null, "d"],
    ]);
    const folders = await loadFolders(
      fakeClient({ tables: { project_folders: [{ id: ID(3), name: "Kits", created_at: "a" }] } }).client,
      BRAND,
      items,
    );
    expect(folders).toEqual([{ id: ID(3), name: "Kits", createdAt: "a", count: 1 }]);
  });

  it("says which read failed, and refuses rows of the wrong shape", async () => {
    await expect(loadProjectItems(fakeClient({ tables: { projects: { __fail: "down" } } }).client, BRAND)).rejects.toThrow("The designs could not be read.");
    await expect(loadProjectItems(fakeClient({ tables: { projects: [{ id: "not an id" }] } }).client, BRAND)).rejects.toThrow("unexpected shape");
  });

  it("reads what was shared with the person", async () => {
    const row = { invite_id: ID(4), brand_name: "Other FC", project_name: "Kit", access: "view", invited_at: "a", expires_at: "b", opened_at: "c" };
    const { client } = fakeClient({ rpc: { shared_with_me: { data: [row], error: null } } });
    expect(await loadShared(client)).toEqual([
      { inviteId: ID(4), brandName: "Other FC", projectName: "Kit", access: "view", invitedAt: "a", expiresAt: "b", opened: true },
    ]);
  });

  it("draws each AI picture with a short-lived link, and none where storage gave none", async () => {
    const { client } = fakeClient({
      tables: {
        shoot_jobs: [{ id: ID(1), launch_project_id: ID(2), aspect: "1:1", output_file_id: ID(3), finished_at: "2026-11-02" }],
        media_items: [{ id: ID(4), file_id: ID(5), width: null, height: null, created_at: "2026-11-01", media_sets: { project_id: ID(6) } }],
        files: [
          { id: ID(3), bucket: "images", path: "a.png" },
          { id: ID(5), bucket: "broken", path: "b.png" },
        ],
      },
      unsignable: ["broken"],
    });
    const creations = await loadCreations(client, BRAND);
    expect(creations.map((creation) => [creation.id, creation.url])).toEqual([
      [ID(1), "https://files.test/images/a.png"],
      [ID(4), null],
    ]);
  });

  it("asks storage for nothing when there are no pictures", async () => {
    expect(await loadCreations(fakeClient().client, BRAND)).toEqual([]);
  });
});
