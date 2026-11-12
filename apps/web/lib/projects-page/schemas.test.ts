import { describe, expect, it } from "vitest";
import { folderPath, viewHref } from "./paths";
import { createFolderBody, deleteForGoodBody, FOLDER_NAME_MESSAGE, placeItemBody } from "./schemas";

const ID = "11111111-1111-4111-8111-111111111111";

describe("the bodies", () => {
  it("trims a folder's name and refuses an empty or long one", () => {
    expect(createFolderBody.parse({ name: "  Home kits " })).toEqual({ name: "Home kits" });
    for (const name of ["   ", "x".repeat(61)]) {
      const result = createFolderBody.safeParse({ name });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(FOLDER_NAME_MESSAGE);
    }
  });

  it("reads an empty folder as out of every folder", () => {
    expect(placeItemBody.parse({ kind: "design", id: ID, folderId: "" })).toEqual({ kind: "design", id: ID, folderId: null });
    expect(placeItemBody.parse({ kind: "launch", id: ID, folderId: ID }).folderId).toBe(ID);
    expect(placeItemBody.safeParse({ kind: "moodboard", id: ID, folderId: null }).success).toBe(false);
  });

  it("deletes for good only with the typed word", () => {
    expect(deleteForGoodBody.safeParse({ kind: "design", id: ID, confirm: "Delete " }).success).toBe(true);
    expect(deleteForGoodBody.safeParse({ kind: "design", id: ID, confirm: "yes" }).success).toBe(false);
  });
});

describe("the addresses", () => {
  it("keep a view's sort and search, leaving out the default", () => {
    expect(viewHref("/projects", {})).toBe("/projects");
    expect(viewHref("/projects", { sort: "recent", search: "" })).toBe("/projects");
    expect(viewHref("/projects/trash", { sort: "name", search: "kit" })).toBe("/projects/trash?sort=name&q=kit");
    expect(folderPath(ID)).toBe(`/projects/folders/${ID}`);
  });
});
