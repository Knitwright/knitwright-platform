import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import type { AssetOffer } from "./assets";
import { board, designBoard, link, project } from "./fixtures/canvas";
import {
  connectBoards,
  createLaunchProject,
  disconnectBoards,
  listArtboardPresets,
  listLaunchProjects,
  listLaunchVersions,
  loadLaunchProject,
  recordOutput,
  removeBoard,
  removeLaunchProject,
  saveBoard,
  saveLaunchProject,
  saveLaunchVersion,
  snapshotOf,
} from "./service";

/**
 * Decision 0091: the launch tables. Reads go through the client the caller passes; every write goes
 * through one of the migration's functions, with the brand and the person from the session.
 */

const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const CANVAS = "33333333-3333-4333-8333-333333333333";
const BOARD = "44444444-4444-4444-8444-444444444444";
const OTHER = "55555555-5555-4555-8555-555555555555";
const EDGE = "66666666-6666-4666-8666-666666666666";
const FILE = "77777777-7777-4777-8777-777777777777";
const who = { brandId: BRAND, userId: USER };

const boardRow = (over: Record<string, unknown> = {}) => ({
  id: BOARD,
  kind: "design",
  name: "Home v7",
  x: 0,
  y: 0,
  width: 1080,
  height: 1350,
  settings: { designProjectId: OTHER },
  input_version: 7,
  output_file_id: null,
  output_role: "asset",
  status: "empty",
  last_cost_credits: null,
  rule_id: "R-GAP-000",
  ...over,
});

const projectRow = (over: Record<string, unknown> = {}) => ({
  id: CANVAS,
  brand_id: BRAND,
  name: "Home kit launch",
  units: "mm",
  colours: [{ hex: "#0b1f4b", name: "Club navy" }],
  design_project_id: OTHER,
  updated_at: "2026-12-01T10:00:00Z",
  boards: [boardRow({ id: OTHER, kind: "mockup", x: 400 }), boardRow()],
  board_edges: [{ id: EDGE, from_board_id: BOARD, to_board_id: OTHER, input_index: 1 }],
  ...over,
});

const failing = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
    return "nothing was thrown";
  } catch (error) {
    return (error as Error).message;
  }
};

describe("loadLaunchProject", () => {
  it("reads the canvas with its boards left to right and its connectors", async () => {
    const { client } = fakeClient({ launch_projects: { data: projectRow() } });
    const one = await loadLaunchProject(client, BRAND, CANVAS);

    expect(one).toMatchObject({ name: "Home kit launch", units: "mm", designProjectId: OTHER });
    expect(one?.boards.map((board) => board.id)).toEqual([BOARD, OTHER]);
    expect(one?.boards[0]).toMatchObject({ kind: "design", at: { x: 0, y: 0 }, size: { width: 1080, height: 1350 }, inputVersion: 7 });
    expect(one?.edges).toEqual([{ id: EDGE, fromBoardId: BOARD, toBoardId: OTHER, inputIndex: 1 }]);
  });

  it("reads the canvas for one brand and one id only", async () => {
    const { client, calls } = fakeClient({ launch_projects: { data: projectRow() } });
    await loadLaunchProject(client, BRAND, CANVAS);

    expect(calls[0]?.steps.filter(([step]) => step === "eq")).toEqual([
      ["eq", ["brand_id", BRAND]],
      ["eq", ["id", CANVAS]],
    ]);
  });

  it("gives nothing for a canvas that is not there", async () => {
    const { client } = fakeClient({ launch_projects: { data: null } });
    expect(await loadLaunchProject(client, BRAND, CANVAS)).toBeNull();
  });

  it("refuses a row it cannot read, rather than guessing at it", async () => {
    const broken = fakeClient({ launch_projects: { data: projectRow({ units: "furlongs" }) } });
    const failed = fakeClient({ launch_projects: { error: { message: "down" } } });

    expect(await failing(loadLaunchProject(broken.client, BRAND, CANVAS))).toMatch(/something went wrong|could not/i);
    expect(await failing(loadLaunchProject(failed.client, BRAND, CANVAS))).toMatch(/something went wrong|could not/i);
  });
});

describe("the lists", () => {
  it("counts the boards of each canvas, newest change first", async () => {
    const { client, calls } = fakeClient({
      launch_projects: { data: [{ id: CANVAS, name: "Home kit launch", units: "px", updated_at: "2026-12-01T10:00:00Z", boards: [{ id: BOARD }, { id: OTHER }] }] },
    });
    const rows = await listLaunchProjects(client, BRAND);

    expect(rows).toEqual([{ id: CANVAS, name: "Home kit launch", units: "px", boards: 2, updatedAt: "2026-12-01T10:00:00Z" }]);
    expect(calls[0]?.steps).toContainEqual(["order", ["updated_at", { ascending: false }]]);
  });

  it("reads the artboard presets in their own order", async () => {
    const { client, calls } = fakeClient({
      launch_artboard_presets: {
        data: [{ key: "a4-print", label: "A4 print", width: "210.000", height: "297.000", unit: "mm", dpi: 300, rule_id: "R-GAP-000", note: "ISO 216 A4" }],
      },
    });
    const rows = await listArtboardPresets(client);

    expect(rows).toEqual([{ key: "a4-print", label: "A4 print", width: 210, height: 297, unit: "mm", dpi: 300, ruleId: "R-GAP-000", note: "ISO 216 A4" }]);
    expect(calls[0]?.steps).toContainEqual(["order", ["sort"]]);
  });

  it("reads the saved versions newest first, with how many boards each held", async () => {
    const { client } = fakeClient({
      launch_project_versions: {
        data: [
          { id: EDGE, version: 2, created_at: "2026-12-01T12:00:00Z", snapshot: { boards: [1, 2, 3] } },
          { id: FILE, version: 1, created_at: "2026-12-01T10:00:00Z", snapshot: {} },
        ],
      },
    });
    const rows = await listLaunchVersions(client, BRAND, CANVAS);

    expect(rows.map((row) => [row.version, row.boards])).toEqual([
      [2, 3],
      [1, 0],
    ]);
  });

  it("refuses a list it cannot read", async () => {
    for (const table of ["launch_projects", "launch_artboard_presets", "launch_project_versions"]) {
      const { client } = fakeClient({ [table]: { error: { message: "down" } } });
      const read =
        table === "launch_projects"
          ? listLaunchProjects(client, BRAND)
          : table === "launch_artboard_presets"
            ? listArtboardPresets(client)
            : listLaunchVersions(client, BRAND, CANVAS);
      expect(await failing(read)).toMatch(/something went wrong|could not/i);
    }
  });

  it("refuses a list whose rows it cannot read", async () => {
    const bad = [
      ["launch_projects", listLaunchProjects, [{ id: CANVAS }]],
      ["launch_artboard_presets", listArtboardPresets, [{ key: "x" }]],
      ["launch_project_versions", listLaunchVersions, [{ id: EDGE }]],
    ] as const;
    for (const [table, read, data] of bad) {
      const { client } = fakeClient({ [table]: { data } });
      expect(await failing((read as (c: unknown, b: string, p: string) => Promise<unknown>)(client, BRAND, CANVAS))).toMatch(/something went wrong|could not/i);
    }
  });
});

describe("the writes", () => {
  it("creates a canvas with the brand and the person from the session", async () => {
    const { client, calls } = fakeClient({ create_launch_project: { data: CANVAS } });
    const id = await createLaunchProject(client, who, { name: "Home kit launch", units: "mm", designProjectId: null });

    expect(id).toBe(CANVAS);
    expect(calls[0]?.steps[0]?.[1][0]).toMatchObject({ p_brand_id: BRAND, p_user_id: USER, p_name: "Home kit launch", p_units: "mm", p_design_project_id: null });
  });

  it("saves the project's name, unit and palette", async () => {
    const { client, calls } = fakeClient({ save_launch_project: { data: CANVAS } });
    await saveLaunchProject(client, who, { launchProjectId: CANVAS, name: null, units: "in", colours: [{ hex: "#000000", name: "Ink" }] });

    expect(calls[0]?.steps[0]?.[1][0]).toMatchObject({ p_launch_project_id: CANVAS, p_name: null, p_units: "in", p_colours: [{ hex: "#000000", name: "Ink" }] });
  });

  it("saves a board with its place, its size and its own settings", async () => {
    const { client, calls } = fakeClient({ save_launch_board: { data: BOARD } });
    await saveBoard(client, who, {
      launchProjectId: CANVAS, boardId: null, kind: "ai_image", name: "Floodlit", x: 10, y: 20, width: 1080, height: 1350,
      settings: { prompt: "floodlit pitch" }, inputVersion: 7,
    });

    expect(calls[0]?.steps[0]?.[1][0]).toMatchObject({ p_kind: "ai_image", p_x: 10, p_y: 20, p_settings: { prompt: "floodlit pitch" }, p_input_version: 7 });
  });

  it("removes a canvas, a board and a connector by id", async () => {
    const answers = { remove_launch_project: {}, remove_launch_board: {}, disconnect_launch_boards: {} };
    const { client, calls } = fakeClient(answers);
    await removeLaunchProject(client, who, CANVAS);
    await removeBoard(client, who, BOARD);
    await disconnectBoards(client, who, EDGE);

    expect(calls.map((call) => call.name)).toEqual(["remove_launch_project", "remove_launch_board", "disconnect_launch_boards"]);
  });

  it("connects two boards at a numbered input", async () => {
    const { client, calls } = fakeClient({ connect_launch_boards: { data: EDGE } });
    const id = await connectBoards(client, who, { launchProjectId: CANVAS, fromBoardId: BOARD, toBoardId: OTHER, inputIndex: 2 });

    expect(id).toBe(EDGE);
    expect(calls[0]?.steps[0]?.[1][0]).toMatchObject({ p_from_board_id: BOARD, p_to_board_id: OTHER, p_input_index: 2 });
  });

  it("turns each refusal of the database into the right kind of failure", async () => {
    const cases = [
      ["42501", "You may not change a launch project for this brand."],
      ["P0002", "That launch project does not exist."],
      ["P0001", "That would make a loop, and a loop could never finish."],
    ] as const;
    for (const [code, message] of cases) {
      const { client } = fakeClient({ create_launch_project: { error: { code, message } } });
      expect(await failing(createLaunchProject(client, who, { name: "x", units: "px", designProjectId: null }))).toBe(message);
    }
  });
});

describe("recordOutput, the one door to a board's output", () => {
  const asScene: AssetOffer = { role: "scene", file: { fileId: FILE, contentType: "image/png" }, showsPerson: true };
  const asPrintFile: AssetOffer = { role: "print_file", file: { fileId: FILE, contentType: "image/png" }, showsPerson: false };

  /** The file's own row, which is where the provenance comes from and the only place it can. */
  const withFile = (provenance: string, over: Record<string, unknown> = {}) =>
    fakeClient({ files: { data: { provenance } }, set_launch_board_output: { data: BOARD }, ...over });

  /** The rpc call, which is the second call: the file is read first. */
  const rpcArgs = (calls: { kind: string; steps: readonly (readonly [string, readonly unknown[]])[] }[]) =>
    calls.find((call) => call.kind === "rpc")?.steps[0]?.[1][0];

  it("records a generated picture as scenery and never as artwork", async () => {
    const { client, calls } = withFile("generated");
    await recordOutput(client, who, { boardId: BOARD, kind: "ai_image", offer: asScene, status: "ready", credits: 20 });

    expect(rpcArgs(calls)).toMatchObject({ p_output_role: "asset", p_output_file_id: FILE, p_status: "ready", p_last_cost_credits: 20 });
  });

  it("records a drawn picture in the role it was offered in", async () => {
    const { client, calls } = withFile("deterministic");
    await recordOutput(client, who, { boardId: BOARD, kind: "mockup", offer: asPrintFile, status: "ready", credits: null });

    expect(rpcArgs(calls)).toMatchObject({ p_output_role: "print_file" });
  });

  it("records a picture the brand uploaded in the role it was offered in", async () => {
    const { client, calls } = withFile("uploaded");
    await recordOutput(client, who, { boardId: BOARD, kind: "mockup", offer: asPrintFile, status: "ready", credits: null });

    expect(rpcArgs(calls)).toMatchObject({ p_output_role: "print_file" });
  });

  it("refuses a generated picture offered to a board the platform draws itself", async () => {
    const { client, calls } = withFile("generated");
    const message = await failing(recordOutput(client, who, { boardId: BOARD, kind: "mockup", offer: asScene, status: "ready", credits: 0 }));

    expect(message).toMatch(/cannot hold a generated picture/);
    expect(calls.filter((call) => call.kind === "rpc")).toEqual([]);
  });

  /**
   * H1 of the v5 security review, at this seam. The offer carries no provenance at all, so the one
   * thing left to decide the role is the file's own row -- and a file a model made is refused the
   * print-file role however the offer was worded.
   */
  it("refuses a print file whose file turns out to have come from a model", async () => {
    const { client, calls } = withFile("generated");
    const message = await failing(recordOutput(client, who, { boardId: BOARD, kind: "mockup", offer: asPrintFile, status: "ready", credits: 0 }));

    expect(message).toMatch(/cannot hold a generated picture/);
    expect(calls.filter((call) => call.kind === "rpc")).toEqual([]);
  });

  it("treats a provenance this release does not recognise as generated, which is the strict answer", async () => {
    const { client, calls } = withFile("something-new");
    const message = await failing(recordOutput(client, who, { boardId: BOARD, kind: "mockup", offer: asPrintFile, status: "ready", credits: 0 }));

    expect(message).toMatch(/cannot hold a generated picture/);
    expect(calls.filter((call) => call.kind === "rpc")).toEqual([]);
  });

  it("refuses a file that is not this brand's, because the read is scoped to the brand", async () => {
    const { client, calls } = fakeClient({ files: { data: null }, set_launch_board_output: { data: BOARD } });
    expect(await failing(recordOutput(client, who, { boardId: BOARD, kind: "mockup", offer: asPrintFile, status: "ready", credits: 0 }))).toBe(
      "That file does not exist.",
    );
    expect(calls.filter((call) => call.kind === "rpc")).toEqual([]);
  });

  it("records a failed run with no picture at all, so a refund has something to point at", async () => {
    const { client, calls } = withFile("generated");
    await recordOutput(client, who, { boardId: BOARD, kind: "ai_video", offer: null, status: "failed", credits: 0 });

    expect(rpcArgs(calls)).toMatchObject({ p_output_file_id: null, p_output_role: "asset", p_status: "failed" });
  });

  it("passes a refusal of the database on", async () => {
    const { client } = withFile("generated", {
      set_launch_board_output: { error: { code: "P0001", message: "Connect a Design board first." } },
    });
    expect(await failing(recordOutput(client, who, { boardId: BOARD, kind: "ai_image", offer: asScene, status: "ready", credits: 1 }))).toBe(
      "Connect a Design board first.",
    );
  });
});

describe("the saved version", () => {
  it("writes the canvas as a snapshot and gives back its number", async () => {
    const { client, calls } = fakeClient({ save_launch_project_version: { data: [{ id: EDGE, version: 3 }] } });
    const snapshot = snapshotOf(project([]), new Date("2026-12-01T10:00:00Z"));
    const version = await saveLaunchVersion(client, who, CANVAS, snapshot);

    expect(version).toBe(3);
    expect(calls[0]?.steps[0]?.[1][0]).toMatchObject({ p_launch_project_id: CANVAS, p_snapshot: snapshot });
  });

  it("holds the boards, the connectors, the unit and the palette, and says when it was saved", async () => {
    const canvas = project([designBoard("design-board"), board("flat-lay", "mockup")], [link("e1", "design-board", "flat-lay")]);
    const snapshot = snapshotOf(canvas, new Date("2026-12-01T10:00:00Z"));

    expect(snapshot).toMatchObject({ kind: "launch-canvas", snapshotVersion: 1, savedAt: "2026-12-01T10:00:00.000Z", units: "px" });
    expect(snapshot.colours).toEqual([{ hex: "#0b1f4b", name: "Club navy" }]);
    expect(snapshot.boards.map((one) => [one.id, one.kind, one.width])).toEqual([
      ["design-board", "design", 1080],
      ["flat-lay", "mockup", 1080],
    ]);
    expect(snapshot.boards[0]?.settings).toEqual({ designProjectId: "project-1" });
    expect(snapshot.edges).toEqual([{ fromBoardId: "design-board", toBoardId: "flat-lay", inputIndex: 1 }]);
  });

  it("gives version 1 when the database answers with no row", async () => {
    const { client } = fakeClient({ save_launch_project_version: { data: [] } });
    expect(await saveLaunchVersion(client, who, CANVAS, snapshotOf(project([]), new Date()))).toBe(1);
  });
});
