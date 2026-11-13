import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { board, designBoard } from "@/lib/launch/fixtures/canvas";
import { GARMENT_BOX } from "./boards";
import { designReference, focusTarget, homeCanvasFor } from "./mapping";

const SQL = readFileSync(join(__dirname, "..", "..", "..", "..", "supabase", "migrations", "20261224010000_one_canvas.sql"), "utf8");

describe("a studio project's home canvas", () => {
  const plan = homeCanvasFor({ id: "p1", name: "Home kit", currentVersion: 7 });

  it("carries the design's name and one garment board naming the design", () => {
    expect(plan).toEqual({
      name: "Home kit",
      studioProjectId: "p1",
      board: { kind: "garment", name: "Home kit", at: { x: 0, y: 0 }, size: GARMENT_BOX, settings: { designProjectId: "p1" }, inputVersion: 7 },
    });
  });

  it("is the board the migration makes, at the same place and size", () => {
    expect(SQL).toContain(`v_project.brand_id, v_canvas, 'garment', v_project.name, 0, 0, ${GARMENT_BOX.width}, ${GARMENT_BOX.height},`);
    expect(SQL).toContain("jsonb_build_object('designProjectId', v_project.id::text), v_project.current_version");
  });

  it("is made for every project there is, and for every project made from now on", () => {
    expect(SQL).toContain("select private.ensure_project_canvas(p.id) from public.projects p");
    expect(SQL).toMatch(/create trigger projects_have_a_canvas\s+after insert on public\.projects/);
  });
});

describe("a launch design board", () => {
  it("points at its own design first, then at the canvas's", () => {
    expect(designReference(designBoard("d", "p2"), "p9")).toBe("p2");
    expect(designReference(board("d", "design"), "p9")).toBe("p9");
    expect(designReference(board("g", "garment"), "p9")).toBeNull();
    expect(designReference(board("m", "mockup"), "p9")).toBeNull();
  });

  it("is mapped the same way by the migration, and nothing else is moved or removed", () => {
    expect(SQL).toMatch(/set design_project_id = l\.design_project_id[\s\S]*\(b\.settings ->> 'designProjectId'\) is null/);
    const rows = SQL.slice(SQL.indexOf("-- The existing rows."));
    expect(rows.length).toBeGreaterThan(100);
    expect(rows).not.toMatch(/\bdelete from public\.(boards|board_edges|launch_projects)\b/);
    expect(SQL).not.toMatch(/\bupdate public\.boards[\s\S]{0,80}set (x|y|kind) =/);
  });
});

describe("focused mode", () => {
  const boards = [
    board("g1", "garment", { settings: { designProjectId: "p1" } }),
    board("g2", "design", { settings: { designProjectId: "p2" } }),
    board("bare", "design"),
    board("m", "mockup", { settings: { designProjectId: "p1" } }),
  ];

  it("opens the home design's own garment, or a launch canvas's first", () => {
    expect(focusTarget(boards, "p2", "garment")).toEqual({ boardId: "g2", designProjectId: "p2" });
    expect(focusTarget(boards, null, "garment")).toEqual({ boardId: "g1", designProjectId: "p1" });
  });

  it("opens a garment board by id, and never a board with no design or not a garment", () => {
    expect(focusTarget(boards, null, "g2")).toEqual({ boardId: "g2", designProjectId: "p2" });
    expect(focusTarget(boards, null, "bare")).toBeNull();
    expect(focusTarget(boards, null, "m")).toBeNull();
    expect(focusTarget(boards, null, null)).toBeNull();
    expect(focusTarget([], null, "garment")).toBeNull();
  });
});
