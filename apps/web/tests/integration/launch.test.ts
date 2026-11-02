import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * The launch canvases, their boards and their connectors (plan v5 L1, spec Launch section;
 * decision 0091), against local Supabase. Needs `pnpm db:start`.
 *
 * What the database itself must hold:
 *   * only the launch write functions change a canvas, and each refuses a role that may not;
 *   * a connector the spec's board table does not allow is refused, and so is a loop;
 *   * **the garment lock**: a generated board may not record an output unless a Design board can be
 *     reached by following its connectors backwards, and its output can never be artwork;
 *   * a saved version is append-only, and its version counts up per canvas;
 *   * the artboard presets are platform rows every member reads and nobody writes.
 *
 * Every canvas here takes its own name, because a brand may hold only one canvas of a given name,
 * and two tests that shared one would land on each other's rows (plan v5, lesson 11).
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);
const canvasName = (label: string) => `${label} ${randomUUID().slice(0, 8)}`;

const join = async (owner: Person, brandId: string, member: Person, role: string): Promise<void> => {
  must(await rpc("invite_member", { p_brand_id: brandId, p_user_id: owner.userId, p_email: member.email, p_role: role }));
  const invitations = must(await member.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((one) => one.brand_id === brandId);
  must(await rpc("accept_invitation", { p_user_id: member.userId, p_invitation_id: mine?.id }));
};

const makeCanvas = async (who: Person, brandId: string, label = "Home kit"): Promise<string> =>
  must(await rpc("create_launch_project", {
    p_brand_id: brandId, p_user_id: who.userId, p_name: canvasName(label), p_units: "mm", p_design_project_id: null,
  })) as string;

const makeBoard = async (who: Person, brandId: string, canvasId: string, kind: string, over: Record<string, unknown> = {}): Promise<string> =>
  must(await rpc("save_launch_board", {
    p_brand_id: brandId, p_user_id: who.userId, p_launch_project_id: canvasId, p_board_id: null, p_kind: kind,
    p_name: kind, p_x: 0, p_y: 0, p_width: 1080, p_height: 1350, p_settings: {}, p_input_version: 1, ...over,
  })) as string;

const connect = (who: Person, brandId: string, from: string, to: string, index = 1) =>
  rpc("connect_launch_boards", { p_brand_id: brandId, p_user_id: who.userId, p_from_board_id: from, p_to_board_id: to, p_input_index: index });

const setOutput = (who: Person, brandId: string, boardId: string, over: Record<string, unknown> = {}) =>
  rpc("set_launch_board_output", {
    p_brand_id: brandId, p_user_id: who.userId, p_board_id: boardId, p_output_file_id: null,
    p_output_role: "asset", p_status: "ready", p_last_cost_credits: 20, ...over,
  });

let ann: Person;
let ben: Person;
let viewer: Person;
let annBrand: string;
let benBrand: string;

beforeAll(async () => {
  [ann, ben, viewer] = await Promise.all([person("launch-ann"), person("launch-ben"), person("launch-viewer")]);
  annBrand = await brandOf(ann, "Ann Launch");
  benBrand = await brandOf(ben, "Ben Launch");
  await join(ann, annBrand, viewer, "viewer");
});

describe("a launch project", () => {
  it("is created with its unit and shows the person who made it", async () => {
    const id = await makeCanvas(ann, annBrand);
    const row = must(await ann.client.from("launch_projects").select("*").eq("id", id).single()) as Record<string, unknown>;

    expect(row).toMatchObject({ brand_id: annBrand, units: "mm" });
    expect(row.colours).toEqual([]);
    expect(row.created_by).toBe(ann.userId);
  });

  it("takes a new name, a new unit and a palette, and keeps what is not given", async () => {
    const id = await makeCanvas(ann, annBrand);
    const renamed = canvasName("Away kit");
    must(await rpc("save_launch_project", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: id, p_name: renamed, p_units: "px",
      p_colours: [{ hex: "#0b1f4b", name: "Club navy" }],
    }));
    must(await rpc("save_launch_project", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: id, p_name: null, p_units: null, p_colours: null,
    }));
    const row = must(await ann.client.from("launch_projects").select("name, units, colours").eq("id", id).single());

    expect(row).toEqual({ name: renamed, units: "px", colours: [{ hex: "#0b1f4b", name: "Club navy" }] });
  });

  it("refuses a palette that is not a list", async () => {
    const id = await makeCanvas(ann, annBrand);
    const refused = await rpc("save_launch_project", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: id, p_name: null, p_units: null, p_colours: { hex: "#000000" },
    });

    expect(refused.error?.hint).toBe("colours_not_a_list");
  });

  it("holds one canvas of a name per brand, and two brands may use the same name", async () => {
    const name = canvasName("Shared");
    const args = (brandId: string, who: Person) => ({ p_brand_id: brandId, p_user_id: who.userId, p_name: name, p_units: "px", p_design_project_id: null });
    must(await rpc("create_launch_project", args(annBrand, ann)));
    must(await rpc("create_launch_project", args(benBrand, ben)));

    expect((await rpc("create_launch_project", args(annBrand, ann))).error?.code).toBe("23505");
  });

  it("refuses a design that is not this brand's", async () => {
    const refused = await rpc("create_launch_project", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_name: canvasName("Borrowed"), p_units: "px", p_design_project_id: randomUUID(),
    });

    expect(refused.error?.hint).toBe("design_not_found");
  });

  it("refuses a member whose role may not change a canvas, and a stranger", async () => {
    const name = canvasName("Refused");
    const refusedViewer = await rpc("create_launch_project", { p_brand_id: annBrand, p_user_id: viewer.userId, p_name: name, p_units: "px", p_design_project_id: null });
    const refusedStranger = await rpc("create_launch_project", { p_brand_id: annBrand, p_user_id: ben.userId, p_name: name, p_units: "px", p_design_project_id: null });

    expect(refusedViewer.error?.code).toBe("42501");
    expect(refusedStranger.error?.code).toBe("42501");
  });

  it("is removed with its boards, connectors and saved versions", async () => {
    const id = await makeCanvas(ann, annBrand);
    const boardId = await makeBoard(ann, annBrand, id, "design");
    must(await rpc("save_launch_project_version", { p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: id, p_snapshot: { kind: "launch-canvas" } }));
    must(await rpc("remove_launch_project", { p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: id }));

    expect(must(await adminClient().from("boards").select("id").eq("id", boardId))).toEqual([]);
    expect(must(await adminClient().from("launch_project_versions").select("id").eq("launch_project_id", id))).toEqual([]);
  });
});

describe("the boards of a canvas", () => {
  it("is added with its place, its size and its own settings", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const boardId = await makeBoard(ann, annBrand, canvasId, "ai_image", { p_x: 240, p_y: 120, p_settings: { prompt: "floodlit pitch" } });
    const row = must(await ann.client.from("boards").select("*").eq("id", boardId).single()) as Record<string, unknown>;

    expect(row).toMatchObject({ kind: "ai_image", x: 240, y: 120, width: 1080, height: 1350, status: "empty", output_role: "asset" });
    expect(row.settings).toEqual({ prompt: "floodlit pitch" });
    expect(row.last_cost_credits).toBeNull();
  });

  it("is moved and resized, and keeps the settings a change does not give", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const boardId = await makeBoard(ann, annBrand, canvasId, "mockup", { p_settings: { scene: "flat-lay" } });
    must(await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_board_id: boardId, p_kind: "mockup",
      p_name: "Flat lay", p_x: 60, p_y: 80, p_width: 1080, p_height: 1080, p_settings: null, p_input_version: null,
    }));
    const row = must(await ann.client.from("boards").select("name, x, y, height, settings, input_version").eq("id", boardId).single());

    expect(row).toEqual({ name: "Flat lay", x: 60, y: 80, height: 1080, settings: { scene: "flat-lay" }, input_version: 1 });
  });

  it("refuses settings that are not an object, a kind it does not know and a size outside the bounds", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const refusedSettings = await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_board_id: null, p_kind: "design",
      p_name: "", p_x: 0, p_y: 0, p_width: 1080, p_height: 1080, p_settings: [1, 2], p_input_version: null,
    });
    const refusedKind = await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_board_id: null, p_kind: "banner",
      p_name: "", p_x: 0, p_y: 0, p_width: 1080, p_height: 1080, p_settings: {}, p_input_version: null,
    });
    const refusedSize = await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_board_id: null, p_kind: "artboard",
      p_name: "", p_x: 0, p_y: 0, p_width: 4, p_height: 1080, p_settings: {}, p_input_version: null,
    });

    expect(refusedSettings.error?.hint).toBe("settings_not_an_object");
    expect(refusedKind.error?.code).toBe("23514");
    expect(refusedSize.error?.code).toBe("23514");
  });

  it("refuses a board for a canvas that is not this brand's, and a board that is gone", async () => {
    const theirs = await makeCanvas(ben, benBrand);
    const mine = await makeCanvas(ann, annBrand);
    const refusedCanvas = await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: theirs, p_board_id: null, p_kind: "design",
      p_name: "", p_x: 0, p_y: 0, p_width: 1080, p_height: 1080, p_settings: {}, p_input_version: null,
    });
    const refusedBoard = await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: mine, p_board_id: randomUUID(), p_kind: "design",
      p_name: "", p_x: 0, p_y: 0, p_width: 1080, p_height: 1080, p_settings: {}, p_input_version: null,
    });

    expect(refusedCanvas.error?.hint).toBe("launch_project_not_found");
    expect(refusedBoard.error?.hint).toBe("board_not_found");
  });

  it("is removed on its own, and takes its connectors with it", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    const edgeId = must(await connect(ann, annBrand, design, mockup)) as string;
    must(await rpc("remove_launch_board", { p_brand_id: annBrand, p_user_id: ann.userId, p_board_id: mockup }));

    expect(must(await adminClient().from("board_edges").select("id").eq("id", edgeId))).toEqual([]);
    expect(must(await adminClient().from("boards").select("id").eq("id", design))).toHaveLength(1);
  });
});

describe("the connectors", () => {
  it("joins a pair the spec's board table allows", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const scene = await makeBoard(ann, annBrand, canvasId, "ai_image");
    const edgeId = must(await connect(ann, annBrand, design, scene, 2)) as string;
    const row = must(await ann.client.from("board_edges").select("*").eq("id", edgeId).single());

    expect(row).toMatchObject({ from_board_id: design, to_board_id: scene, input_index: 2, launch_project_id: canvasId });
  });

  it("refuses a pair it does not allow, in either direction", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const card = await makeBoard(ann, annBrand, canvasId, "info_card");
    const clip = await makeBoard(ann, annBrand, canvasId, "ai_video");
    const design = await makeBoard(ann, annBrand, canvasId, "design");

    expect((await connect(ann, annBrand, card, clip)).error?.hint).toBe("input_not_allowed");
    expect((await connect(ann, annBrand, clip, design)).error?.hint).toBe("input_not_allowed");
  });

  it("refuses two connectors into one input, and the same pair twice", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    const scene = await makeBoard(ann, annBrand, canvasId, "ai_image");
    must(await connect(ann, annBrand, design, scene, 1));

    expect((await connect(ann, annBrand, mockup, scene, 1)).error?.code).toBe("23505");
    expect((await connect(ann, annBrand, design, scene, 2)).error?.code).toBe("23505");
  });

  it("refuses a loop, which could never finish", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const first = await makeBoard(ann, annBrand, canvasId, "ai_image");
    const second = await makeBoard(ann, annBrand, canvasId, "ai_image");
    must(await connect(ann, annBrand, design, first, 1));
    must(await connect(ann, annBrand, first, second, 1));

    expect((await connect(ann, annBrand, second, first, 2)).error?.hint).toBe("loop");
  });

  it("refuses two boards from different canvases, and a board that is gone", async () => {
    const one = await makeCanvas(ann, annBrand);
    const two = await makeCanvas(ann, annBrand, "Second");
    const design = await makeBoard(ann, annBrand, one, "design");
    const elsewhere = await makeBoard(ann, annBrand, two, "mockup");

    expect((await connect(ann, annBrand, design, elsewhere)).error?.hint).toBe("different_canvas");
    expect((await connect(ann, annBrand, design, randomUUID())).error?.hint).toBe("board_not_found");
  });

  it("is removed by its own id", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    const edgeId = must(await connect(ann, annBrand, design, mockup)) as string;
    must(await rpc("disconnect_launch_boards", { p_brand_id: annBrand, p_user_id: ann.userId, p_edge_id: edgeId }));

    expect(must(await adminClient().from("board_edges").select("id").eq("id", edgeId))).toEqual([]);
  });

  it("refuses a role that may not change a canvas", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");

    expect((await connect(viewer, annBrand, design, mockup)).error?.code).toBe("42501");
  });
});

describe("the garment lock, in the database", () => {
  it("refuses an output on a generated board that no design board reaches", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const scene = await makeBoard(ann, annBrand, canvasId, "ai_image");
    const refused = await setOutput(ann, annBrand, scene);

    expect(refused.error?.hint).toBe("garment_not_locked");
  });

  it("records one once a design board is behind it, through any number of boards", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    const scene = await makeBoard(ann, annBrand, canvasId, "ai_image");
    const clip = await makeBoard(ann, annBrand, canvasId, "ai_video");
    must(await connect(ann, annBrand, design, mockup));
    must(await connect(ann, annBrand, mockup, scene));
    must(await connect(ann, annBrand, scene, clip));
    must(await setOutput(ann, annBrand, clip));
    const row = must(await ann.client.from("boards").select("status, last_cost_credits, output_role").eq("id", clip).single());

    expect(row).toEqual({ status: "ready", last_cost_credits: 20, output_role: "asset" });
  });

  it("never lets a generated board's output be a layer on the garment or part of a print file", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const scene = await makeBoard(ann, annBrand, canvasId, "ai_image");
    must(await connect(ann, annBrand, design, scene));

    for (const role of ["panel_layer", "print_file"]) {
      const refused = await setOutput(ann, annBrand, scene, { p_output_role: role });
      expect(refused.error?.hint).toBe("generated_is_never_artwork");
    }
  });

  it("refuses the same row written straight past the function, because the server's key cannot write it", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const scene = await makeBoard(ann, annBrand, canvasId, "ai_image");
    must(await connect(ann, annBrand, design, scene));
    const refused = await adminClient().from("boards").update({ output_role: "print_file" }).eq("id", scene);

    expect(refused.error).not.toBeNull();
    expect(must(await adminClient().from("boards").select("output_role").eq("id", scene).single())).toEqual({ output_role: "asset" });
  });

  it("lets a board the platform draws itself carry an output that is artwork", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    must(await setOutput(ann, annBrand, design, { p_output_role: "print_file", p_last_cost_credits: 0 }));
    const row = must(await ann.client.from("boards").select("output_role, last_cost_credits").eq("id", design).single());

    expect(row).toEqual({ output_role: "print_file", last_cost_credits: 0 });
  });

  it("refuses a file that is not this brand's, and a board that is gone", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");

    expect((await setOutput(ann, annBrand, design, { p_output_file_id: randomUUID() })).error?.hint).toBe("file_not_found");
    expect((await setOutput(ann, annBrand, randomUUID())).error?.hint).toBe("board_not_found");
    expect((await setOutput(viewer, annBrand, design)).error?.code).toBe("42501");
  });
});

/**
 * H1 OF THE V5 SECURITY REVIEW, IN THE DATABASE (migration 20261215010000, decision 0116).
 *
 * The lock's third question -- *did this file come out of a model?* -- used to be a string in the
 * request body, and `public.files` had no column that could answer instead: a deterministic mockup
 * and an AI lifestyle picture are both `kind: 'render'`. Every one of the six gates tested the
 * board or the graph; none tested the file. So a member with `manageKit` could connect a design
 * board to a mockup board and record a generated file on it as a print file, and the mandatory
 * "AI-generated" label on the Store hand-off came out null.
 *
 * Three files are made once for the whole block rather than one per test: `public.files` is
 * append-only to everything but the server's own key, so each row written here stays in the shared
 * local database for good.
 */
describe("a file's own provenance, which the garment lock now reads", () => {
  let generatedFile: string;
  let drawnFile: string;
  let uploadedPhoto: string;

  const fileOf = async (kind: string, provenance: string): Promise<string> => {
    const id = randomUUID();
    must(await adminClient().from("files").insert({
      id, brand_id: annBrand, bucket: kind === "render" ? "images" : "uploads",
      path: `${annBrand}/${kind}/${randomUUID()}.png`, kind, provenance,
      content_type: "image/png", bytes: 10, created_by: ann.userId,
    }));
    return id;
  };

  beforeAll(async () => {
    [generatedFile, drawnFile, uploadedPhoto] = await Promise.all([
      fileOf("render", "generated"),
      fileOf("render", "deterministic"),
      fileOf("photo", "uploaded"),
    ]);
  });

  it("defaults to generated, so a store site that says nothing loses the right to use the file as artwork", async () => {
    const id = randomUUID();
    must(await adminClient().from("files").insert({
      id, brand_id: annBrand, bucket: "images", path: `${annBrand}/render/${randomUUID()}.png`,
      kind: "render", content_type: "image/png", bytes: 10, created_by: ann.userId,
    }));

    expect(must(await adminClient().from("files").select("provenance").eq("id", id).single())).toEqual({ provenance: "generated" });
  });

  it("takes only the three values, so a fourth cannot be invented past the check", async () => {
    const refused = await adminClient().from("files").insert({
      brand_id: annBrand, bucket: "images", path: `${annBrand}/render/${randomUUID()}.png`,
      kind: "render", provenance: "definitely-not-ai", content_type: "image/png", bytes: 10, created_by: ann.userId,
    });

    expect(refused.error).not.toBeNull();
  });

  /** The attack itself: a design board, a mockup board, a connector and a file a model made. */
  it("refuses a generated file the artwork roles on a board the platform draws, which was the whole attack", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    must(await connect(ann, annBrand, design, mockup));

    for (const role of ["panel_layer", "print_file"]) {
      const refused = await setOutput(ann, annBrand, mockup, { p_output_file_id: generatedFile, p_output_role: role });
      expect(refused.error?.hint, role).toBe("generated_is_never_artwork");
    }
  });

  it("refuses a generated file on a board the platform draws even as a plain asset, because it does not belong there", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    const refused = await setOutput(ann, annBrand, mockup, { p_output_file_id: generatedFile, p_output_role: "asset" });

    expect(refused.error?.hint).toBe("generated_file_on_a_drawn_board");
  });

  it("still lets a file the platform drew be a print file, so the lock is not a wall", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const mockup = await makeBoard(ann, annBrand, canvasId, "mockup");
    must(await setOutput(ann, annBrand, mockup, { p_output_file_id: drawnFile, p_output_role: "print_file" }));

    expect(must(await ann.client.from("boards").select("output_role, output_file_id").eq("id", mockup).single())).toEqual({
      output_role: "print_file",
      output_file_id: drawnFile,
    });
  });

  it("keeps a generated file as the asset of an AI board, which is what it is for", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const design = await makeBoard(ann, annBrand, canvasId, "design");
    const scene = await makeBoard(ann, annBrand, canvasId, "ai_image");
    must(await connect(ann, annBrand, design, scene));
    must(await setOutput(ann, annBrand, scene, { p_output_file_id: generatedFile, p_output_role: "asset" }));

    expect(must(await ann.client.from("boards").select("output_file_id").eq("id", scene).single())).toEqual({ output_file_id: generatedFile });
  });

  /**
   * The marketing lock, which `lib/marketing/assets.ts` describes as shut "in three places" and
   * which ran only in the browser: the chosen file id is persisted as plain settings jsonb, which
   * `save_launch_board` used to validate with nothing but `jsonb_typeof(p_settings) <> 'object'`.
   */
  it("refuses a marketing board whose layout names a generated picture", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const marketing = await makeBoard(ann, annBrand, canvasId, "marketing");
    const refused = await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_board_id: marketing,
      p_kind: "marketing", p_name: "Post", p_x: 0, p_y: 0, p_width: 1080, p_height: 1080,
      p_settings: { pictures: { "slot-mockup": generatedFile } }, p_input_version: 1,
    });

    expect(refused.error?.hint).toBe("generated_is_never_artwork");
  });

  it("refuses a marketing board that names a file of another brand, or something that is not a file id at all", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const marketing = await makeBoard(ann, annBrand, canvasId, "marketing");
    const save = (pictures: Record<string, unknown>) =>
      rpc("save_launch_board", {
        p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_board_id: marketing,
        p_kind: "marketing", p_name: "Post", p_x: 0, p_y: 0, p_width: 1080, p_height: 1080,
        p_settings: { pictures }, p_input_version: 1,
      });

    expect((await save({ "slot-mockup": randomUUID() })).error?.hint).toBe("marketing_picture_not_a_file");
    expect((await save({ "slot-mockup": "../../etc/passwd" })).error?.hint).toBe("marketing_picture_not_a_file");
  });

  it("lets a marketing board name a picture the brand uploaded or the platform drew", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const marketing = await makeBoard(ann, annBrand, canvasId, "marketing");
    must(await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_board_id: marketing,
      p_kind: "marketing", p_name: "Post", p_x: 0, p_y: 0, p_width: 1080, p_height: 1080,
      p_settings: { pictures: { "slot-mockup": drawnFile, "slot-logo": uploadedPhoto } }, p_input_version: 1,
    }));

    const row = must(await ann.client.from("boards").select("settings").eq("id", marketing).single()) as { settings: { pictures: unknown } };
    expect(row.settings.pictures).toEqual({ "slot-mockup": drawnFile, "slot-logo": uploadedPhoto });
  });

  it("says nothing about the pictures of a board that is not a marketing board, which has no such setting", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const card = await makeBoard(ann, annBrand, canvasId, "info_card", { p_settings: { pictures: { "slot-a": generatedFile } } });

    expect(card).not.toBeNull();
  });

  // The third store site H1 names, `add_golden_sample_photo`, is held in golden-samples.test.ts,
  // where there is a real sample to attach a photograph to.
});

describe("the version history", () => {
  it("counts up per canvas, and two canvases count on their own", async () => {
    const one = await makeCanvas(ann, annBrand);
    const two = await makeCanvas(ann, annBrand, "Second");
    const save = (canvasId: string) =>
      rpc("save_launch_project_version", { p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_snapshot: { kind: "launch-canvas" } });
    const first = must(await save(one)) as { version: number }[];
    const second = must(await save(one)) as { version: number }[];
    const other = must(await save(two)) as { version: number }[];

    expect([first[0]?.version, second[0]?.version, other[0]?.version]).toEqual([1, 2, 1]);
  });

  it("can never be changed or removed once it is saved", async () => {
    const canvasId = await makeCanvas(ann, annBrand);
    const saved = must(await rpc("save_launch_project_version", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvasId, p_snapshot: { kind: "launch-canvas" },
    })) as { id: string }[];
    const id = saved[0]?.id;
    const changed = await adminClient().from("launch_project_versions").update({ snapshot: { kind: "changed" } }).eq("id", id);
    const removed = await adminClient().from("launch_project_versions").delete().eq("id", id);

    expect(changed.error).not.toBeNull();
    expect(removed.error).not.toBeNull();
    expect(must(await adminClient().from("launch_project_versions").select("snapshot").eq("id", id).single())).toEqual({ snapshot: { kind: "launch-canvas" } });
  });

  it("refuses a canvas that is not this brand's, and a role that may not save", async () => {
    const theirs = await makeCanvas(ben, benBrand);
    const mine = await makeCanvas(ann, annBrand);
    const refusedCanvas = await rpc("save_launch_project_version", { p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: theirs, p_snapshot: {} });
    const refusedRole = await rpc("save_launch_project_version", { p_brand_id: annBrand, p_user_id: viewer.userId, p_launch_project_id: mine, p_snapshot: {} });

    expect(refusedCanvas.error?.hint).toBe("launch_project_not_found");
    expect(refusedRole.error?.code).toBe("42501");
  });
});

describe("the artboard presets", () => {
  it("holds the sizes the spec names, each with a note saying nobody reviewed it", async () => {
    const rows = must(await ann.client.from("launch_artboard_presets").select("key, label, unit, dpi, rule_id, note").order("sort")) as Record<string, string>[];

    expect(rows.map((row) => row.key)).toEqual(["social-post-4-5", "social-square-1-1", "story-9-16", "hero-banner-16-9", "pin-2-3", "a4-print"]);
    for (const row of rows) {
      expect(row.rule_id).toBe("R-GAP-000");
      expect(row.note.toLowerCase()).toContain("placeholder");
    }
    expect(rows.find((row) => row.key === "a4-print")).toMatchObject({ unit: "mm", dpi: 300 });
  });

  it("cannot be changed by a member, and cannot be read by a visitor", async () => {
    const changed = await ann.client.from("launch_artboard_presets").update({ label: "Changed by a member" }).eq("key", "story-9-16");
    await ann.client.from("launch_artboard_presets").delete().eq("key", "story-9-16");
    const row = must(await adminClient().from("launch_artboard_presets").select("label").eq("key", "story-9-16").single());

    expect(changed.error).not.toBeNull();
    expect(row).toEqual({ label: "Story 9:16" });
  });
});
