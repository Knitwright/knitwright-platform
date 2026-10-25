import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Brand workspace (plan W4-C, decision 0062): the product list, samples and runs, against local Supabase. Needs `pnpm db:start`.
 * Two brands are used throughout to show nothing leaks between them. A run reaches ops through submit_order_for_production.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

const join = async (owner: Person, brandId: string, member: Person, role: string): Promise<void> => {
  must(await rpc("invite_member", { p_brand_id: brandId, p_user_id: owner.userId, p_email: member.email, p_role: role }));
  const invitations = must(await member.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((i) => i.brand_id === brandId);
  expect(mine).toBeDefined();
  must(await rpc("accept_invitation", { p_user_id: member.userId, p_invitation_id: mine?.id }));
};

const SNAPSHOT = { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] };

const makeProject = async (owner: Person, brandId: string): Promise<string> =>
  must(await rpc("create_project", { p_brand_id: brandId, p_user_id: owner.userId, p_name: "Hoodie", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 })) as string;

const makeRelease = async (owner: Person, brandId: string, projectId: string, label = "Round 1"): Promise<string> => {
  const created = must(await rpc("create_release", { p_project_id: projectId, p_brand_id: brandId, p_user_id: owner.userId, p_label: label, p_snapshot: SNAPSHOT, p_file_specs: [], p_order_id: null })) as { id: string }[];
  return created[0]!.id;
};

const listProduct = async (owner: Person, brandId: string, projectId: string, name = "Hoodie"): Promise<string> =>
  must(await rpc("create_brand_product", { p_brand_id: brandId, p_user_id: owner.userId, p_project_id: projectId, p_name: name })) as string;

const send = (who: Person, brandId: string, productId: string, releaseId: string, over: Record<string, unknown> = {}) =>
  rpc("submit_brand_run", { p_brand_id: brandId, p_user_id: who.userId, p_product_id: productId, p_kind: "sample", p_release_id: releaseId, p_factory_profile_id: "knitwright-default", p_fabric_key: "mesh", p_sizes: { S: 1, M: 1 }, p_flags: [], p_request_key: randomUUID(), ...over });

let ann: Person;
let ben: Person;
let manager: Person;
let viewer: Person;
let annBrand: string;
let benBrand: string;

beforeAll(async () => {
  [ann, ben, manager, viewer] = await Promise.all([person("br-ann"), person("br-ben"), person("br-manager"), person("br-viewer")]);
  annBrand = await brandOf(ann, "Ann Apparel");
  benBrand = await brandOf(ben, "Ben Brand");
  await join(ann, annBrand, manager, "kit_manager");
  await join(ann, annBrand, viewer, "viewer");
});

describe("the product list", () => {
  it("lists a design of the brand as an idea, with a history line", async () => {
    const projectId = await makeProject(ann, annBrand);
    const productId = await listProduct(manager, annBrand, projectId);
    const row = must(await ann.client.from("brand_products").select("*").eq("id", productId).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ brand_id: annBrand, project_id: projectId, name: "Hoodie", stage: "idea", design_version: 1 });
    const events = must(await ann.client.from("brand_product_events").select("kind, to_stage").eq("product_id", productId)) as { kind: string }[];
    expect(events.map((e) => e.kind)).toEqual(["listed"]);
  });

  it("refuses a viewer, a stranger's design, and listing a design twice", async () => {
    const projectId = await makeProject(ann, annBrand);
    expect((await rpc("create_brand_product", { p_brand_id: annBrand, p_user_id: viewer.userId, p_project_id: projectId, p_name: "X" })).error?.code).toBe("42501");
    const bensProject = await makeProject(ben, benBrand);
    expect((await rpc("create_brand_product", { p_brand_id: annBrand, p_user_id: ann.userId, p_project_id: bensProject, p_name: "X" })).error?.code).toBe("P0002");
    expect((await rpc("create_brand_product", { p_brand_id: annBrand, p_user_id: ben.userId, p_project_id: projectId, p_name: "X" })).error?.code).toBe("42501");
    await listProduct(ann, annBrand, projectId);
    expect((await rpc("create_brand_product", { p_brand_id: annBrand, p_user_id: ann.userId, p_project_id: projectId, p_name: "Again" })).error?.code).toBe("23505");
  });

  it("is invisible to another brand and cannot be written or run by a browser", async () => {
    const projectId = await makeProject(ann, annBrand);
    const productId = await listProduct(ann, annBrand, projectId, "Private");
    expect(must(await ben.client.from("brand_products").select("id").eq("id", productId))).toEqual([]);
    expect(must(await viewer.client.from("brand_products").select("id").eq("id", productId))).toHaveLength(1);
    expect((await ann.client.from("brand_products").insert({ brand_id: annBrand, project_id: projectId, name: "X", design_version: 1 })).error?.code).toBe("42501");
    expect((await ann.client.rpc("create_brand_product", { p_brand_id: annBrand, p_user_id: ann.userId, p_project_id: projectId, p_name: "X" })).error?.code).toBe("42501");
    expect((await ann.client.rpc("submit_brand_run", {})).error).not.toBeNull();
  });
});

describe("a sample and then a run", () => {
  it("sends a sample to ops through the contract and keeps the product an idea until the brand moves it", async () => {
    const projectId = await makeProject(ann, annBrand);
    const releaseId = await makeRelease(ann, annBrand, projectId);
    const productId = await listProduct(ann, annBrand, projectId);
    const [sent] = must(await send(manager, annBrand, productId, releaseId)) as { run_id: string; order_id: string; status: string; created: boolean }[];
    expect(sent).toMatchObject({ status: "submitted", created: true });
    const order = must(await ann.client.from("ops_orders").select("brand_id, article_id, pieces, sizes, factory_profile_id").eq("id", sent!.order_id).single());
    expect(order).toMatchObject({ brand_id: annBrand, article_id: "crew-tee", pieces: 2, sizes: { S: 1, M: 1 }, factory_profile_id: "knitwright-default" });
    expect(must(await ann.client.from("brand_products").select("stage").eq("id", productId).single())).toEqual({ stage: "idea" });
    expect(must(await ben.client.from("ops_orders").select("id").eq("id", sent!.order_id))).toEqual([]);
  });

  it("answers a retry with the same key by the order already sent", async () => {
    const projectId = await makeProject(ann, annBrand);
    const releaseId = await makeRelease(ann, annBrand, projectId);
    const productId = await listProduct(ann, annBrand, projectId);
    const key = randomUUID();
    const [first] = must(await send(ann, annBrand, productId, releaseId, { p_request_key: key })) as { order_id: string }[];
    const [again] = must(await send(ann, annBrand, productId, releaseId, { p_request_key: key })) as { order_id: string; created: boolean }[];
    expect(again).toMatchObject({ order_id: first!.order_id, created: false });
    expect(must(await ann.client.from("brand_runs").select("id").eq("product_id", productId))).toHaveLength(1);
  });

  it("refuses a sample of more than one piece, bad sizes, another design's release and a viewer", async () => {
    const projectId = await makeProject(ann, annBrand);
    const releaseId = await makeRelease(ann, annBrand, projectId);
    const otherRelease = await makeRelease(ann, annBrand, await makeProject(ann, annBrand));
    const productId = await listProduct(ann, annBrand, projectId);
    expect((await send(ann, annBrand, productId, releaseId, { p_sizes: { S: 2 } })).error?.hint).toBe("invalid_sizes");
    expect((await send(ann, annBrand, productId, releaseId, { p_sizes: { S: 0 } })).error?.hint).toBe("invalid_sizes");
    expect((await send(ann, annBrand, productId, releaseId, { p_sizes: {} })).error?.hint).toBe("invalid_sizes");
    expect((await send(ann, annBrand, productId, otherRelease)).error?.hint).toBe("release_not_found");
    expect((await send(viewer, annBrand, productId, releaseId)).error?.code).toBe("42501");
    expect((await send(ben, benBrand, productId, releaseId)).error?.code).toBe("P0002");
    expect(must(await ann.client.from("brand_runs").select("id").eq("product_id", productId))).toEqual([]);
  });

  it("moves forward one step at a time, needs a sample order for the first step, and allows a run only at the run stage", async () => {
    const projectId = await makeProject(ann, annBrand);
    const releaseId = await makeRelease(ann, annBrand, projectId);
    const productId = await listProduct(ann, annBrand, projectId);
    const confirm = (who: Person, to: string) => rpc("confirm_brand_product_stage", { p_brand_id: annBrand, p_user_id: who.userId, p_product_id: productId, p_to: to });

    expect((await send(ann, annBrand, productId, releaseId, { p_kind: "run", p_sizes: { M: 60 } })).error?.hint).toBe("stage_blocks");
    expect((await confirm(ann, "sample")).error?.hint).toBe("need_sample_order");
    expect((await confirm(ann, "run")).error?.hint).toBe("stage_move");
    must(await send(ann, annBrand, productId, releaseId));
    expect((await confirm(viewer, "sample")).error?.code).toBe("42501");
    expect(must(await confirm(manager, "sample"))).toBe("sample");
    expect((await confirm(ann, "sample")).error?.hint).toBe("stage_move");
    expect(must(await confirm(ann, "run"))).toBe("run");
    expect((await confirm(ann, "idea")).error?.hint).toBe("stage_move");

    expect((await send(ann, annBrand, productId, releaseId)).error?.hint).toBe("stage_blocks");
    const [run] = must(await send(ann, annBrand, productId, releaseId, { p_kind: "run", p_sizes: { S: 20, M: 40 }, p_flags: [{ code: "under_moq", text: "Under the minimum." }] })) as { order_id: string }[];
    const order = must(await ann.client.from("ops_orders").select("pieces, status").eq("id", run!.order_id).single());
    expect(order).toEqual({ pieces: 60, status: "submitted" });

    const events = must(await ann.client.from("brand_product_events").select("kind").eq("product_id", productId).order("at").order("id")) as { kind: string }[];
    expect(events.map((e) => e.kind)).toEqual(["listed", "sample_ordered", "sample_confirmed", "run_confirmed", "run_ordered"]);
  });

  it("records the release version in use on the product", async () => {
    const projectId = await makeProject(ann, annBrand);
    const created = must(await rpc("create_release", { p_project_id: projectId, p_brand_id: annBrand, p_user_id: ann.userId, p_label: "v4", p_snapshot: { ...SNAPSHOT, specVersion: 4 }, p_file_specs: [], p_order_id: null })) as { id: string }[];
    const productId = await listProduct(ann, annBrand, projectId);
    must(await send(ann, annBrand, productId, created[0]!.id));
    expect(must(await ann.client.from("brand_products").select("design_version").eq("id", productId).single())).toEqual({ design_version: 4 });
  });
});

describe("history", () => {
  it("can never be changed or removed, even by the server's key", async () => {
    const projectId = await makeProject(ann, annBrand);
    const releaseId = await makeRelease(ann, annBrand, projectId);
    const productId = await listProduct(ann, annBrand, projectId);
    must(await send(ann, annBrand, productId, releaseId));
    // The server's key holds only SELECT on these tables, so a direct write is refused for lack of a grant.
    for (const table of ["brand_runs", "brand_product_events"]) {
      expect((await adminClient().from(table).update({ kind: "run" }).eq("product_id", productId)).error?.code).toBe("42501");
      expect((await adminClient().from(table).delete().eq("product_id", productId)).error?.code).toBe("42501");
    }
    expect((await adminClient().from("brand_products").update({ stage: "run" }).eq("id", productId)).error?.code).toBe("42501");
  });

  it("goes with the design: deleting it removes the product, its runs and its history", async () => {
    const projectId = await makeProject(ann, annBrand);
    const releaseId = await makeRelease(ann, annBrand, projectId);
    const productId = await listProduct(ann, annBrand, projectId);
    must(await send(ann, annBrand, productId, releaseId));
    must(await rpc("delete_project", { p_project_id: projectId, p_brand_id: annBrand, p_user_id: ann.userId }));
    expect(must(await adminClient().from("brand_products").select("id").eq("id", productId))).toEqual([]);
    expect(must(await adminClient().from("brand_runs").select("id").eq("product_id", productId))).toEqual([]);
    expect(must(await adminClient().from("brand_product_events").select("id").eq("product_id", productId))).toEqual([]);
  });
});
