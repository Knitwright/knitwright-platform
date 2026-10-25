import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Design comments (plan W4-D, decision 0063) against local Supabase. Needs `pnpm db:start`.
 * Two brands are used throughout to show nothing leaks between them. A person may belong to at most
 * 3 brands, so every brand here has its own people.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

/** Invites someone and has them accept, so they hold a role in the brand. */
const join = async (owner: Person, brandId: string, member: Person, role: string): Promise<void> => {
  must(await rpc("invite_member", { p_brand_id: brandId, p_user_id: owner.userId, p_email: member.email, p_role: role }));
  const invitations = must(await member.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((i) => i.brand_id === brandId);
  expect(mine).toBeDefined();
  must(await rpc("accept_invitation", { p_user_id: member.userId, p_invitation_id: mine?.id }));
};

const newDesign = async (brandId: string, ownerId: string): Promise<string> =>
  must(
    await rpc("create_project", {
      p_brand_id: brandId, p_user_id: ownerId, p_name: "Comment test", p_style_number: "", p_season: "",
      p_garment_type: "crew-tee", p_spec: { seeded: true }, p_schema_version: 1,
    }),
  ) as string;

type Add = Partial<{ parent: string | null; version: number; panel: string | null; x: number | null; y: number | null; body: string; mentions: string[] }>;

const add = (brandId: string, who: Person, projectId: string, a: Add = {}) =>
  rpc("design_comment_add", {
    p_brand_id: brandId, p_user_id: who.userId, p_project_id: projectId, p_parent_id: a.parent ?? null, p_version: a.version ?? 1,
    p_panel_id: a.panel ?? null, p_x_mm: a.x ?? null, p_y_mm: a.y ?? null, p_body: a.body ?? "Move the crest up", p_mentions: a.mentions ?? [],
  });

let ann: Person;
let ben: Person;
let manager: Person;
let viewer: Person;
let outsider: Person;
let annBrand: string;
let benBrand: string;
let annDesign: string;
let benDesign: string;

beforeAll(async () => {
  [ann, ben, manager, viewer, outsider] = await Promise.all([person("ann"), person("ben"), person("manager"), person("viewer"), person("outsider")]);
  annBrand = await brandOf(ann, "Ann FC");
  benBrand = await brandOf(ben, "Ben FC");
  await join(ann, annBrand, manager, "kit_manager");
  await join(ann, annBrand, viewer, "viewer");
  annDesign = await newDesign(annBrand, ann.userId);
  benDesign = await newDesign(benBrand, ben.userId);
});

describe("writing", () => {
  it("lets every member comment, viewers included, and stores the words and the anchor", async () => {
    const id = must(await add(annBrand, viewer, annDesign, { panel: "front", x: 120.5, y: 40, body: "Crest looks low" })) as string;
    const row = must(await ann.client.from("design_comments").select("*").eq("id", id).single());
    expect(row).toMatchObject({ brand_id: annBrand, project_id: annDesign, author_id: viewer.userId, version: 1, panel_id: "front", body: "Crest looks low", parent_id: null, resolved_at: null });
    expect(Number(row.x_mm)).toBe(120.5);
  });

  it("refuses a version the design has not reached, a design of another brand, and a non-member", async () => {
    expect((await add(annBrand, ann, annDesign, { version: 99 })).error?.code).toBe("22023");
    expect((await add(annBrand, ann, benDesign)).error?.code).toBe("P0002");
    expect((await add(annBrand, outsider, annDesign)).error?.code).toBe("P0002");
  });

  it("refuses an empty comment, a long one, and a point without a panel", async () => {
    expect((await add(annBrand, ann, annDesign, { body: "   " })).error?.code).toBe("22023");
    expect((await add(annBrand, ann, annDesign, { body: "x".repeat(2001) })).error?.code).toBe("22023");
    expect((await add(annBrand, ann, annDesign, { x: 1, y: 2 })).error?.code).toBe("23514");
  });

  it("makes replies that take their thread's version and have no anchor, and do not nest", async () => {
    const root = must(await add(annBrand, ann, annDesign, { panel: "back", body: "Back panel?" })) as string;
    const reply = must(await add(annBrand, manager, annDesign, { parent: root, version: 1, panel: "front", body: "Fine" })) as string;
    const row = must(await ann.client.from("design_comments").select("*").eq("id", reply).single());
    expect(row).toMatchObject({ parent_id: root, version: 1, panel_id: null, x_mm: null });
    expect((await add(annBrand, ann, annDesign, { parent: reply })).error?.code).toBe("P0002");
  });

  it("limits one person to 30 comments in ten minutes", async () => {
    const [chatty, owner] = [await person("chatty"), await person("chatty-owner")];
    const brand = await brandOf(owner, "Chatty FC");
    await join(owner, brand, chatty, "viewer");
    const design = await newDesign(brand, owner.userId);
    for (let i = 0; i < 30; i += 1) must(await add(brand, chatty, design, { body: `Note ${i}` }));
    expect((await add(brand, chatty, design, { body: "One too many" })).error?.hint).toBe("rate_limited");
  });
});

describe("who can read", () => {
  it("shows members their own brand's comments and nothing of another brand", async () => {
    must(await add(benBrand, ben, benDesign, { body: "Ben's secret" }));
    const mine = must(await viewer.client.from("design_comments").select("body, brand_id"));
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((r) => r.brand_id === annBrand)).toBe(true);
    expect(must(await outsider.client.from("design_comments").select("id"))).toEqual([]);
    expect(must(await ben.client.from("design_comments").select("id").eq("project_id", annDesign))).toEqual([]);
  });

  it("shows a visitor who is not signed in nothing, and lets no browser write or call a function", async () => {
    const { data, error } = await anonClient().from("design_comments").select("id");
    expect(error !== null || data?.length === 0).toBe(true);
    for (const client of [anonClient(), viewer.client]) {
      expect((await client.from("design_comments").insert({ brand_id: annBrand, project_id: annDesign, version: 1, body: "direct" })).error).not.toBeNull();
      const args = { p_brand_id: annBrand, p_user_id: viewer.userId, p_project_id: annDesign, p_parent_id: null, p_version: 1, p_panel_id: null, p_x_mm: null, p_y_mm: null, p_body: "x", p_mentions: [] };
      expect((await client.rpc("design_comment_add", args)).error).not.toBeNull();
    }
  });
});

describe("resolving", () => {
  it("lets a kit manager and the owner resolve and open a thread, and not a viewer", async () => {
    const root = must(await add(annBrand, viewer, annDesign, { body: "Needs a look" })) as string;
    const resolve = (who: Person, resolved: boolean) => rpc("design_comment_resolve", { p_brand_id: annBrand, p_user_id: who.userId, p_comment_id: root, p_resolved: resolved });
    expect((await resolve(viewer, true)).error?.code).toBe("42501");
    must(await resolve(manager, true));
    const resolved = must(await ann.client.from("design_comments").select("resolved_at, resolved_by").eq("id", root).single());
    expect(resolved.resolved_by).toBe(manager.userId);
    expect(resolved.resolved_at).not.toBeNull();
    must(await resolve(ann, false));
    expect(must(await ann.client.from("design_comments").select("resolved_at").eq("id", root).single()).resolved_at).toBeNull();
  });

  it("does not resolve a reply, or a comment of another brand", async () => {
    const root = must(await add(annBrand, ann, annDesign)) as string;
    const reply = must(await add(annBrand, ann, annDesign, { parent: root })) as string;
    const resolve = (brand: string, who: Person, id: string) => rpc("design_comment_resolve", { p_brand_id: brand, p_user_id: who.userId, p_comment_id: id, p_resolved: true });
    expect((await resolve(annBrand, ann, reply)).error?.code).toBe("P0002");
    expect((await resolve(benBrand, ben, root)).error?.code).toBe("P0002");
  });
});

describe("mentions", () => {
  it("names members of the same brand, shows them to members only, and drops the writer", async () => {
    const id = must(await add(annBrand, ann, annDesign, { body: "Over to you", mentions: [manager.userId, ann.userId] })) as string;
    const named = must(await manager.client.from("design_comment_mentions").select("user_id").eq("comment_id", id));
    expect(named).toEqual([{ user_id: manager.userId }]);
    expect(must(await ben.client.from("design_comment_mentions").select("user_id").eq("comment_id", id))).toEqual([]);
  });

  it("refuses to name someone who is not a member of the brand, and more than 10 people", async () => {
    expect((await add(annBrand, ann, annDesign, { mentions: [outsider.userId] })).error?.hint).toBe("mention_not_member");
    expect((await add(annBrand, ann, annDesign, { mentions: [ben.userId] })).error?.hint).toBe("mention_not_member");
    expect((await add(annBrand, ann, annDesign, { mentions: Array.from({ length: 11 }, () => randomUUID()) })).error?.hint).toBe("too_many_mentions");
  });
});

describe("changing and removing", () => {
  const edit = (who: Person, id: string, body: string, mentions: string[] = []) =>
    rpc("design_comment_edit", { p_brand_id: annBrand, p_user_id: who.userId, p_comment_id: id, p_body: body, p_mentions: mentions });
  const remove = (who: Person, id: string) => rpc("design_comment_delete", { p_brand_id: annBrand, p_user_id: who.userId, p_comment_id: id });

  it("lets only the author change the words, keeps the earlier words, and replaces the names", async () => {
    const id = must(await add(annBrand, viewer, annDesign, { body: "First words", mentions: [manager.userId] })) as string;
    expect((await edit(ann, id, "Owner rewrites")).error?.code).toBe("42501");
    must(await edit(viewer, id, "Second words", []));
    const row = must(await ann.client.from("design_comments").select("body, edited_at").eq("id", id).single());
    expect(row.body).toBe("Second words");
    expect(row.edited_at).not.toBeNull();
    expect(must(await ann.client.from("design_comment_edits").select("body, edited_by").eq("comment_id", id))).toEqual([{ body: "First words", edited_by: viewer.userId }]);
    expect(must(await ann.client.from("design_comment_mentions").select("user_id").eq("comment_id", id))).toEqual([]);
  });

  it("never changes or removes an earlier version of the words, even for the server's key", async () => {
    const id = must(await add(annBrand, ann, annDesign, { body: "Before" })) as string;
    must(await edit(ann, id, "After"));
    const admin = adminClient();
    expect((await admin.from("design_comment_edits").update({ body: "Rewritten" }).eq("comment_id", id)).error).not.toBeNull();
    expect((await admin.from("design_comment_edits").delete().eq("comment_id", id)).error).not.toBeNull();
    expect(must(await admin.from("design_comment_edits").select("body").eq("comment_id", id))).toEqual([{ body: "Before" }]);
  });

  it("removes a comment nobody replied to altogether", async () => {
    const id = must(await add(annBrand, ann, annDesign, { body: "Oops" })) as string;
    expect(must(await remove(ann, id))).toBe("removed");
    expect(must(await ann.client.from("design_comments").select("id").eq("id", id))).toEqual([]);
  });

  it("empties a comment that has replies, keeps the replies, and erases its earlier words and mentions", async () => {
    const root = must(await add(annBrand, ann, annDesign, { body: "Original", mentions: [manager.userId] })) as string;
    must(await edit(ann, root, "Changed"));
    const reply = must(await add(annBrand, manager, annDesign, { parent: root, body: "Reply stays" })) as string;
    expect((await remove(manager, root)).error?.code).toBe("42501");
    expect(must(await remove(ann, root))).toBe("emptied");
    expect(must(await ann.client.from("design_comments").select("body, deleted_at").eq("id", root).single())).toMatchObject({ body: "" });
    expect(must(await ann.client.from("design_comments").select("body").eq("id", reply).single()).body).toBe("Reply stays");
    expect(must(await ann.client.from("design_comment_edits").select("id").eq("comment_id", root))).toEqual([]);
    expect(must(await ann.client.from("design_comment_mentions").select("user_id").eq("comment_id", root))).toEqual([]);
    expect((await edit(ann, root, "Back again")).error?.code).toBe("P0002");
  });

  it("does not let anyone change or remove a comment of another brand", async () => {
    const id = must(await add(benBrand, ben, benDesign)) as string;
    const args = { p_brand_id: annBrand, p_user_id: ann.userId, p_comment_id: id };
    expect((await rpc("design_comment_edit", { ...args, p_body: "Hijack", p_mentions: [] })).error?.code).toBe("P0002");
    expect((await rpc("design_comment_delete", args)).error?.code).toBe("P0002");
  });
});

describe("erasure", () => {
  it("removes a design's comments, their earlier words and their mentions with the design", async () => {
    const owner = await person("erase-owner");
    const mate = await person("erase-mate");
    const brand = await brandOf(owner, "Erase FC");
    await join(owner, brand, mate, "viewer");
    const design = await newDesign(brand, owner.userId);
    const id = must(await add(brand, owner, design, { body: "Gone soon", mentions: [mate.userId] })) as string;
    must(await rpc("design_comment_edit", { p_brand_id: brand, p_user_id: owner.userId, p_comment_id: id, p_body: "Gone sooner", p_mentions: [mate.userId] }));
    must(await rpc("delete_project", { p_project_id: design, p_brand_id: brand, p_user_id: owner.userId }));
    const admin = adminClient();
    for (const table of ["design_comments", "design_comment_edits", "design_comment_mentions"]) {
      expect(must(await admin.from(table).select("*").eq("brand_id", brand))).toEqual([]);
    }
  });
});
