import { describe, expect, it } from "vitest";
import { ACCESS_LABELS, itemsOf, sharedOf, sharedRow } from "./rows";

const DESIGN = "11111111-1111-4111-8111-111111111111";
const LAUNCH = "22222222-2222-4222-8222-222222222222";
const FOLDER = "33333333-3333-4333-8333-333333333333";

describe("the cards", () => {
  const items = itemsOf(
    [{ id: DESIGN, name: "Home kit", garment_type: "crew-tee", created_at: "2026-11-01", updated_at: "2026-11-02" }],
    [{ id: LAUNCH, name: "Launch day", created_at: "2026-11-03", updated_at: "2026-11-04", boards: [{ id: DESIGN }, { id: FOLDER }] }],
    [{ folder_id: FOLDER, project_id: null, launch_project_id: LAUNCH }],
    [{ project_id: DESIGN, launch_project_id: null, trashed_at: "2026-11-05" }],
  );

  it("lists designs and launch projects together, each with its kind", () => {
    expect(items.map((item) => [item.kind, item.id])).toEqual([
      ["design", DESIGN],
      ["launch", LAUNCH],
    ]);
  });

  it("names a design's garment and counts a launch project's boards", () => {
    expect(items[0]!.artboards).toBeNull();
    expect(items[0]!.detail.length).toBeGreaterThan(0);
    expect(items[1]!.artboards).toBe(2);
    expect(items[1]!.detail).toBe("Launch pack");
  });

  it("marks the folder and the Trash on the right item", () => {
    expect(items[0]!.trashedAt).toBe("2026-11-05");
    expect(items[0]!.folderId).toBeNull();
    expect(items[1]!.folderId).toBe(FOLDER);
    expect(items[1]!.trashedAt).toBeNull();
  });

  it("keeps an unknown garment's own key as its name", () => {
    const [unknown] = itemsOf([{ id: DESIGN, name: "X", garment_type: "no-such-type", created_at: "a", updated_at: "b" }], [], [], []);
    expect(unknown!.detail).toBe("no-such-type");
  });
});

describe("shared with me", () => {
  it("says who shared what, at what access, and whether it was opened", () => {
    const row = sharedRow.parse({
      invite_id: DESIGN,
      brand_name: "Northfield FC",
      project_name: "Away kit",
      access: "comment",
      invited_at: "2026-11-01",
      expires_at: "2026-12-01",
      opened_at: null,
    });
    const shared = sharedOf(row);
    expect(shared).toMatchObject({ brandName: "Northfield FC", projectName: "Away kit", opened: false });
    expect(ACCESS_LABELS[shared.access]).toBe("Can comment");
  });
});
