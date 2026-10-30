import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Collection plans and the drop payload (plan v5 Z4, spec F-S10; decision 0085), against local
 * Supabase. Needs `pnpm db:start`.
 *
 * What the database itself must hold:
 *   * only the five write functions change a plan, and each refuses a role that may not;
 *   * a plan can only be landed in a market that is open for selling;
 *   * an exported drop payload is append-only, and its version counts up per plan;
 *   * a member reads their own brand's plans and nobody else's (the isolation suite holds the rest).
 *
 * Every plan here takes its own name, because a brand may hold only one plan of a given name.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);
const planName = (label: string) => `${label} ${randomUUID().slice(0, 8)}`;

const join = async (owner: Person, brandId: string, member: Person, role: string): Promise<void> => {
  must(await rpc("invite_member", { p_brand_id: brandId, p_user_id: owner.userId, p_email: member.email, p_role: role }));
  const invitations = must(await member.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((i) => i.brand_id === brandId);
  must(await rpc("accept_invitation", { p_user_id: member.userId, p_invitation_id: mine?.id }));
};

const makeCollection = async (who: Person, brandId: string, label = "Spring"): Promise<string> =>
  must(await rpc("create_collection", {
    p_brand_id: brandId, p_user_id: who.userId, p_name: planName(label), p_destination: "GB", p_currency: "GBP",
  })) as string;

const makeFrame = async (who: Person, brandId: string, collectionId: string, name = "Core"): Promise<string> =>
  must(await rpc("save_collection_frame", {
    p_brand_id: brandId, p_user_id: who.userId, p_collection_id: collectionId, p_frame_id: null, p_name: name, p_x: 0, p_y: 0,
  })) as string;

const style = (over: Record<string, unknown> = {}) => ({
  p_style_id: null,
  p_frame_id: null,
  p_product_id: null,
  p_name: "Matchday jersey",
  p_status: "draft",
  p_colourway: "Navy",
  p_article_code: "JSY-SS-01",
  p_fabric_code: "F-POLY-INT",
  p_production_class: "A",
  p_wholesale_minor: 4200,
  p_rrp_minor: 8000,
  p_wholesale_split_bp: 6000,
  p_sizes: { S: 10, M: 20 },
  p_x: 0,
  p_y: 0,
  ...over,
});

const makeStyle = async (who: Person, brandId: string, collectionId: string, over: Record<string, unknown> = {}): Promise<string> =>
  must(await rpc("save_collection_style", { p_brand_id: brandId, p_user_id: who.userId, p_collection_id: collectionId, ...style(over) })) as string;

const PAYLOAD = { kind: "collection-drop", payloadVersion: 1, styles: [] };

let ann: Person;
let ben: Person;
let viewer: Person;
let annBrand: string;
let benBrand: string;

beforeAll(async () => {
  [ann, ben, viewer] = await Promise.all([person("col-ann"), person("col-ben"), person("col-viewer")]);
  annBrand = await brandOf(ann, "Ann Collections");
  benBrand = await brandOf(ben, "Ben Collections");
  await join(ann, annBrand, viewer, "viewer");
});

describe("a collection plan", () => {
  it("is created with its destination and its currency", async () => {
    const id = await makeCollection(ann, annBrand);
    const row = must(await ann.client.from("collections").select("*").eq("id", id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ brand_id: annBrand, destination_country: "GB", currency: "GBP", notes: "" });
    expect(row.created_by).toBe(ann.userId);
  });

  it("cannot be landed in a market Knitwright does not sell to", async () => {
    const refused = await rpc("create_collection", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_name: planName("Closed"), p_destination: "US", p_currency: "GBP",
    });
    expect(refused.error?.hint).toBe("destination_closed");
  });

  it("holds one plan of a name per brand, and two brands may use the same name", async () => {
    const name = planName("Shared");
    must(await rpc("create_collection", { p_brand_id: annBrand, p_user_id: ann.userId, p_name: name, p_destination: "GB", p_currency: "GBP" }));
    must(await rpc("create_collection", { p_brand_id: benBrand, p_user_id: ben.userId, p_name: name, p_destination: "GB", p_currency: "GBP" }));
    const again = await rpc("create_collection", { p_brand_id: annBrand, p_user_id: ann.userId, p_name: name, p_destination: "GB", p_currency: "GBP" });
    expect(again.error?.code).toBe("23505");
  });

  it("refuses a member whose role may not plan one", async () => {
    const refused = await rpc("create_collection", {
      p_brand_id: annBrand, p_user_id: viewer.userId, p_name: planName("Viewer"), p_destination: "GB", p_currency: "GBP",
    });
    expect(refused.error?.code).toBe("42501");
  });

  it("refuses a stranger, even one who may plan for their own brand", async () => {
    const refused = await rpc("create_collection", {
      p_brand_id: annBrand, p_user_id: ben.userId, p_name: planName("Stranger"), p_destination: "GB", p_currency: "GBP",
    });
    expect(refused.error?.code).toBe("42501");
  });
});

describe("groups and style cards", () => {
  it("adds a group, then renames and moves it", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    const frameId = await makeFrame(ann, annBrand, collectionId);
    must(await rpc("save_collection_frame", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, p_frame_id: frameId, p_name: "Matchday", p_x: 120, p_y: 40,
    }));
    const row = must(await ann.client.from("collection_frames").select("name, x, y").eq("id", frameId).single());
    expect(row).toEqual({ name: "Matchday", x: 120, y: 40 });
  });

  it("refuses a group for a plan that is not this brand's", async () => {
    const collectionId = await makeCollection(ben, benBrand);
    const refused = await rpc("save_collection_frame", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, p_frame_id: null, p_name: "Core", p_x: 0, p_y: 0,
    });
    expect(refused.error?.hint).toBe("collection_not_found");
  });

  it("adds a style card with its planned sizes", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    const frameId = await makeFrame(ann, annBrand, collectionId);
    const styleId = await makeStyle(ann, annBrand, collectionId, { p_frame_id: frameId });
    const row = must(await ann.client.from("collection_styles").select("*").eq("id", styleId).single()) as Record<string, unknown>;
    expect(row).toMatchObject({
      brand_id: annBrand, collection_id: collectionId, frame_id: frameId, name: "Matchday jersey", status: "draft",
      colourway: "Navy", article_code: "JSY-SS-01", wholesale_minor: 4200, rrp_minor: 8000, wholesale_split_bp: 6000,
    });
    const sizes = must(await ann.client.from("collection_style_sizes").select("size_label, qty").eq("style_id", styleId));
    expect([...(sizes as { size_label: string; qty: number }[])].sort((a, b) => a.size_label.localeCompare(b.size_label))).toEqual([
      { size_label: "M", qty: 20 },
      { size_label: "S", qty: 10 },
    ]);
  });

  it("replaces the planned sizes when they are sent again, and leaves them alone when they are not", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    const styleId = await makeStyle(ann, annBrand, collectionId);
    must(await rpc("save_collection_style", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, ...style({ p_style_id: styleId, p_sizes: { L: 7 }, p_status: "approved" }),
    }));
    expect(must(await ann.client.from("collection_style_sizes").select("size_label, qty").eq("style_id", styleId))).toEqual([{ size_label: "L", qty: 7 }]);
    must(await rpc("save_collection_style", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, ...style({ p_style_id: styleId, p_sizes: null }),
    }));
    expect(must(await ann.client.from("collection_style_sizes").select("size_label, qty").eq("style_id", styleId))).toEqual([{ size_label: "L", qty: 7 }]);
  });

  it("refuses a status, a split or a price the plan may not hold", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    const bad = (over: Record<string, unknown>) =>
      rpc("save_collection_style", { p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, ...style(over) });
    expect((await bad({ p_status: "shipped" })).error?.code).toBe("23514");
    expect((await bad({ p_wholesale_split_bp: 10_001 })).error?.code).toBe("23514");
    expect((await bad({ p_rrp_minor: -1 })).error?.code).toBe("23514");
    expect((await bad({ p_article_code: "jersey" })).error?.code).toBe("23514");
    expect((await bad({ p_sizes: [1, 2] })).error?.hint).toBe("sizes_not_an_object");
  });

  it("refuses a group or a product that is not this brand's", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    const elsewhere = await makeCollection(ben, benBrand);
    const theirFrame = await makeFrame(ben, benBrand, elsewhere);
    const wrongFrame = await rpc("save_collection_style", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, ...style({ p_frame_id: theirFrame }),
    });
    expect(wrongFrame.error?.hint).toBe("frame_not_found");
    const wrongProduct = await rpc("save_collection_style", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, ...style({ p_product_id: randomUUID() }),
    });
    expect(wrongProduct.error?.hint).toBe("product_not_found");
  });

  it("removes a style card with its sizes, and removing another brand's does nothing", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    const styleId = await makeStyle(ann, annBrand, collectionId);
    must(await rpc("remove_collection_style", { p_brand_id: benBrand, p_user_id: ben.userId, p_style_id: styleId }));
    expect(must(await adminClient().from("collection_styles").select("id").eq("id", styleId))).toHaveLength(1);
    must(await rpc("remove_collection_style", { p_brand_id: annBrand, p_user_id: ann.userId, p_style_id: styleId }));
    expect(must(await adminClient().from("collection_styles").select("id").eq("id", styleId))).toEqual([]);
    expect(must(await adminClient().from("collection_style_sizes").select("id").eq("style_id", styleId))).toEqual([]);
  });

  it("refuses a viewer who may not change the plan", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    const refused = await rpc("save_collection_style", {
      p_brand_id: annBrand, p_user_id: viewer.userId, p_collection_id: collectionId, ...style(),
    });
    expect(refused.error?.code).toBe("42501");
  });
});

describe("the drop payload", () => {
  it("is recorded with the next version number for that plan", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    await makeStyle(ann, annBrand, collectionId);
    const [first] = must(await rpc("export_collection_drop", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, p_payload: PAYLOAD,
    })) as { id: string; version: number }[];
    const [second] = must(await rpc("export_collection_drop", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, p_payload: PAYLOAD,
    })) as { id: string; version: number }[];
    expect([first!.version, second!.version]).toEqual([1, 2]);
    const row = must(await ann.client.from("collection_drops").select("payload, version, created_by").eq("id", second!.id).single());
    expect(row).toMatchObject({ version: 2, created_by: ann.userId, payload: PAYLOAD });
  });

  it("needs at least one style in the plan", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    const refused = await rpc("export_collection_drop", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, p_payload: PAYLOAD,
    });
    expect(refused.error?.hint).toBe("no_styles");
  });

  it("can never be changed or removed, not even by the server's key", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    await makeStyle(ann, annBrand, collectionId);
    const [sent] = must(await rpc("export_collection_drop", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, p_payload: PAYLOAD,
    })) as { id: string }[];

    // The server's key holds SELECT only, so these answer "permission denied" before the trigger runs.
    const changed = await adminClient().from("collection_drops").update({ payload: { kind: "changed" } }).eq("id", sent!.id);
    const removed = await adminClient().from("collection_drops").delete().eq("id", sent!.id);

    expect(changed.error).not.toBeNull();
    expect(removed.error).not.toBeNull();
    expect(must(await adminClient().from("collection_drops").select("payload").eq("id", sent!.id).single())).toEqual({ payload: PAYLOAD });
  });

  it("goes with the plan when the plan is removed", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    const styleId = await makeStyle(ann, annBrand, collectionId);
    must(await rpc("export_collection_drop", { p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId, p_payload: PAYLOAD }));
    must(await rpc("remove_collection", { p_brand_id: annBrand, p_user_id: ann.userId, p_collection_id: collectionId }));
    expect(must(await adminClient().from("collection_drops").select("id").eq("collection_id", collectionId))).toEqual([]);
    expect(must(await adminClient().from("collection_styles").select("id").eq("id", styleId))).toEqual([]);
    expect(must(await adminClient().from("collections").select("id").eq("id", collectionId))).toEqual([]);
  });

  it("stays where a role that may not remove the plan tries to", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    const refused = await rpc("remove_collection", { p_brand_id: annBrand, p_user_id: viewer.userId, p_collection_id: collectionId });
    expect(refused.error?.code).toBe("42501");
    expect(must(await adminClient().from("collections").select("id").eq("id", collectionId))).toHaveLength(1);
  });

  it("refuses a role that may not create a drop", async () => {
    const collectionId = await makeCollection(ann, annBrand);
    await makeStyle(ann, annBrand, collectionId);
    const refused = await rpc("export_collection_drop", {
      p_brand_id: annBrand, p_user_id: viewer.userId, p_collection_id: collectionId, p_payload: PAYLOAD,
    });
    expect(refused.error?.code).toBe("42501");
  });
});

describe("what a member may read", () => {
  it("shows a member their own brand's plans and none of another brand's", async () => {
    const mine = await makeCollection(ann, annBrand, "Mine");
    const theirs = await makeCollection(ben, benBrand, "Theirs");
    const seen = must(await ann.client.from("collections").select("id")) as { id: string }[];
    expect(seen.map((row) => row.id)).toContain(mine);
    expect(seen.map((row) => row.id)).not.toContain(theirs);
  });

  it("shows a viewer the plan they may not change", async () => {
    const collectionId = await makeCollection(ann, annBrand, "Readable");
    expect(must(await viewer.client.from("collections").select("id").eq("id", collectionId))).toHaveLength(1);
  });

  it("lets every signed-in member read the freight rows, and no member write one", async () => {
    const rows = must(await ann.client.from("collection_freight_rates").select("country, per_piece_minor, currency, duty_basis, label")) as Record<string, unknown>[];
    expect(rows.map((row) => row.country).sort()).toEqual(["AU", "GB"]);
    for (const row of rows) {
      expect(row.label).toMatch(/Placeholder/);
      expect(row.duty_basis).toBe("goods_and_freight");
    }
    const refused = await ann.client.from("collection_freight_rates").insert({ country: "ZZ", per_piece_minor: 1, currency: "GBP", label: "Mine" });
    expect(refused.error).not.toBeNull();
  });

  it("gives a browser no way to write a plan directly", async () => {
    const insert = await ann.client.from("collections").insert({ brand_id: annBrand, name: planName("Direct"), destination_country: "GB", currency: "GBP" });
    expect(insert.error).not.toBeNull();
  });
});
