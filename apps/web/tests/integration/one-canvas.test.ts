import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * The one canvas (plan v6 E1, decision 0145; migration 20261224010000), against local Supabase.
 * Needs `pnpm db:start`; CI runs it.
 *
 * What the database must hold:
 *   * every studio project opens on a canvas: one is made with it, with one Garment board naming it,
 *     and it is named as the design is named, however the design is renamed;
 *   * a launch project keeps every board and connector it had, and its Design board points at its
 *     design;
 *   * a Garment board feeds a mockup and a tech pack, and the garment lock takes it as a design;
 *   * a garment board always names a design of its own brand; a design's canvas cannot be removed on
 *     its own; and another brand reads none of it.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);
const unique = (label: string) => `${label} ${randomUUID().slice(0, 8)}`;

const newDesign = async (owner: Person, brand: string, name = unique("Home shirt")): Promise<string> =>
  must(await rpc("create_project", {
    p_brand_id: brand, p_user_id: owner.userId, p_name: name, p_style_number: "", p_season: "",
    p_garment_type: "crew-tee", p_spec: { schemaVersion: 3 }, p_schema_version: 3,
  })) as string;

const board = async (owner: Person, brand: string, canvas: string, kind: string, settings: Record<string, unknown> = {}): Promise<string> =>
  must(await rpc("save_launch_board", {
    p_brand_id: brand, p_user_id: owner.userId, p_launch_project_id: canvas, p_board_id: null, p_kind: kind,
    p_name: kind, p_x: 400, p_y: 0, p_width: 1080, p_height: 1080, p_settings: settings, p_input_version: 1,
  })) as string;

const connect = (owner: Person, brand: string, from: string, to: string, index = 1) =>
  rpc("connect_launch_boards", { p_brand_id: brand, p_user_id: owner.userId, p_from_board_id: from, p_to_board_id: to, p_input_index: index });

type Canvas = { id: string; name: string; studio_project_id: string | null; boards: { id: string; kind: string; design_project_id: string | null; settings: Record<string, unknown> }[]; board_edges: { id: string }[] };

/** The canvas an address opens: by its own id, or by the design's. As `lib/canvas/server.ts` reads it. */
const open = async (who: Person, brand: string, id: string): Promise<Canvas | null> =>
  (must(
    await who.client
      .from("launch_projects")
      .select("id, name, studio_project_id, boards(id, kind, design_project_id, settings), board_edges(id)")
      .eq("brand_id", brand)
      .or(`id.eq.${id},studio_project_id.eq.${id}`)
      .maybeSingle(),
  ) as Canvas | null);

let ann: Person;
let ben: Person;
let annBrand: string;
let benBrand: string;

beforeAll(async () => {
  [ann, ben] = await Promise.all([person("canvas-ann"), person("canvas-ben")]);
  annBrand = await brandOf(ann, "Ann Canvas");
  benBrand = await brandOf(ben, "Ben Canvas");
});

describe("a studio project on the one canvas", () => {
  it("opens at its own id on a canvas holding one garment board that names it", async () => {
    const name = unique("Home kit");
    const design = await newDesign(ann, annBrand, name);
    const canvas = await open(ann, annBrand, design);

    expect(canvas).not.toBeNull();
    expect(canvas?.studio_project_id).toBe(design);
    expect(canvas?.name).toBe(name);
    expect(canvas?.boards).toHaveLength(1);
    expect(canvas?.boards[0]).toMatchObject({ kind: "garment", design_project_id: design, settings: { designProjectId: design } });
    // The canvas's own id opens the same canvas.
    expect((await open(ann, annBrand, canvas!.id))?.id).toBe(canvas!.id);
  });

  it("is named as the design is named, after a rename", async () => {
    const design = await newDesign(ann, annBrand);
    const renamed = unique("Away kit");
    must(await rpc("rename_project", { p_project_id: design, p_user_id: ann.userId, p_name: renamed, p_style_number: "", p_season: "" }));
    expect((await open(ann, annBrand, design))?.name).toBe(renamed);
  });

  it("feeds a mockup and a tech pack from its garment board, and an order from the garment only", async () => {
    const design = await newDesign(ann, annBrand);
    const canvas = (await open(ann, annBrand, design))!;
    const garment = canvas.boards[0]!.id;
    const mockup = await board(ann, annBrand, canvas.id, "mockup");
    const pack = await board(ann, annBrand, canvas.id, "tech_pack");
    const order = await board(ann, annBrand, canvas.id, "order");

    must(await connect(ann, annBrand, garment, mockup));
    must(await connect(ann, annBrand, garment, pack));
    const refused = await connect(ann, annBrand, mockup, order);
    expect(refused.error?.hint).toBe("input_not_allowed");
    must(await connect(ann, annBrand, garment, order));
    expect((await open(ann, annBrand, design))?.board_edges).toHaveLength(3);
  });

  it("will not hold a garment board with no design, or with another brand's", async () => {
    const design = await newDesign(ann, annBrand);
    const canvas = (await open(ann, annBrand, design))!;
    const none = await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvas.id, p_board_id: null, p_kind: "garment",
      p_name: "", p_x: 0, p_y: 0, p_width: 320, p_height: 380, p_settings: {}, p_input_version: null,
    });
    expect(none.error?.hint).toBe("garment_without_design");
    const theirs = await newDesign(ben, benBrand);
    const foreign = await rpc("save_launch_board", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvas.id, p_board_id: null, p_kind: "garment",
      p_name: "", p_x: 0, p_y: 0, p_width: 320, p_height: 380, p_settings: { designProjectId: theirs }, p_input_version: null,
    });
    expect(foreign.error?.hint).toBe("garment_without_design");
  });

  it("keeps its canvas until the design itself goes", async () => {
    const design = await newDesign(ann, annBrand);
    const canvas = (await open(ann, annBrand, design))!;
    const refused = await rpc("remove_launch_project", { p_brand_id: annBrand, p_user_id: ann.userId, p_launch_project_id: canvas.id });
    expect(refused.error?.hint).toBe("home_canvas");
    expect(await open(ann, annBrand, design)).not.toBeNull();
  });

  it("is read by nobody outside the brand", async () => {
    const design = await newDesign(ann, annBrand);
    expect(await open(ben, annBrand, design)).toBeNull();
    expect(await open(ben, benBrand, design)).toBeNull();
  });
});

describe("a launch project on the one canvas", () => {
  it("opens at its own id with every board and connector it had, its design board pointing at its design", async () => {
    const design = await newDesign(ann, annBrand);
    const launch = must(await rpc("create_launch_project", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_name: unique("Launch"), p_units: "px", p_design_project_id: design,
    })) as string;
    const designBoard = await board(ann, annBrand, launch, "design", { designProjectId: design });
    const mockup = await board(ann, annBrand, launch, "mockup");
    const scene = await board(ann, annBrand, launch, "ai_image");
    must(await connect(ann, annBrand, designBoard, mockup));
    must(await connect(ann, annBrand, mockup, scene));

    const canvas = await open(ann, annBrand, launch);
    expect(canvas?.studio_project_id).toBeNull();
    expect(canvas?.boards.map((one) => one.kind).toSorted()).toEqual(["ai_image", "design", "mockup"]);
    expect(canvas?.board_edges).toHaveLength(2);
    expect(canvas?.boards.find((one) => one.id === designBoard)?.design_project_id).toBe(design);
    // The design keeps a canvas of its own besides: the launch canvas did not become it.
    expect((await open(ann, annBrand, design))?.id).not.toBe(launch);
  });

  it("lets two launch canvases of a brand never share a name, while two designs' canvases may", async () => {
    const name = unique("Same");
    must(await rpc("create_launch_project", { p_brand_id: annBrand, p_user_id: ann.userId, p_name: name, p_units: "px", p_design_project_id: null }));
    const twice = await rpc("create_launch_project", { p_brand_id: annBrand, p_user_id: ann.userId, p_name: name, p_units: "px", p_design_project_id: null });
    expect(twice.error?.code).toBe("23505");
    const [one, two] = await Promise.all([newDesign(ann, annBrand, name), newDesign(ann, annBrand, name)]);
    expect((await open(ann, annBrand, one))?.name).toBe(name);
    expect((await open(ann, annBrand, two))?.name).toBe(name);
  });
});
