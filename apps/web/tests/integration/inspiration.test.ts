import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * The inspiration board's tables (plan v5 Z1, decision 0082) against local Supabase. Needs `pnpm db:start`.
 *
 * What is proved here: a moodboard item can only ever be an https address, a preview address and attribution words;
 * `data:`, `blob:` and `file:` addresses are refused by the database itself, not only by the code; the three write
 * functions check the membership and the design; and nothing of one brand reaches another.
 *
 * Two brands are used throughout. A person may belong to at most 3 brands, so each brand has its own people.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

const newDesign = async (brandId: string, ownerId: string): Promise<string> =>
  must(
    await rpc("create_project", {
      p_brand_id: brandId, p_user_id: ownerId, p_name: "Inspiration test", p_style_number: "", p_season: "",
      p_garment_type: "crew-tee", p_spec: { seeded: true }, p_schema_version: 1,
    }),
  ) as string;

const ATTRIBUTION = { creator: "Ada", creatorUrl: null, provider: "Unsplash", providerUrl: null, notice: "Photo by Ada on Unsplash" };

type SaveParts = Partial<{ source: string; title: string; openUrl: string; previewUrl: string; attribution: unknown }>;

const save = (brandId: string, who: Person, projectId: string, parts: SaveParts = {}) =>
  rpc("save_moodboard_item", {
    p_brand_id: brandId,
    p_user_id: who.userId,
    p_project_id: projectId,
    p_source: parts.source ?? "unsplash",
    p_title: parts.title ?? "A rugby player in navy",
    p_open_url: parts.openUrl ?? `https://unsplash.test/photos/${randomUUID()}`,
    p_preview_url: parts.previewUrl ?? "https://images.unsplash.test/abc.jpg",
    p_attribution: parts.attribution ?? ATTRIBUTION,
  });

const steer = (brandId: string, who: Person, projectId: string, tag: string, state: string | null) =>
  rpc("set_inspiration_tag", { p_brand_id: brandId, p_user_id: who.userId, p_project_id: projectId, p_tag: tag, p_state: state });

let ann: Person;
let ben: Person;
let viewer: Person;
let outsider: Person;
let annBrand: string;
let benBrand: string;
let annDesign: string;
let benDesign: string;

beforeAll(async () => {
  [ann, ben, viewer, outsider] = await Promise.all([person("insp-ann"), person("insp-ben"), person("insp-viewer"), person("insp-outsider")]);
  annBrand = await brandOf(ann, "Inspiration Ann FC");
  benBrand = await brandOf(ben, "Inspiration Ben FC");
  must(await rpc("invite_member", { p_brand_id: annBrand, p_user_id: ann.userId, p_email: viewer.email, p_role: "viewer" }));
  const invitations = (must(await viewer.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[]).find((entry) => entry.brand_id === annBrand);
  must(await rpc("accept_invitation", { p_user_id: viewer.userId, p_invitation_id: invitations?.id }));
  annDesign = await newDesign(annBrand, ann.userId);
  benDesign = await newDesign(benBrand, ben.userId);
});

describe("saving a card", () => {
  it("makes the design's moodboard on first use and keeps the address, the preview and the attribution", async () => {
    const openUrl = `https://unsplash.test/photos/${randomUUID()}`;
    const id = must(await save(annBrand, ann, annDesign, { openUrl })) as string;
    const row = must(await ann.client.from("moodboard_items").select("*").eq("id", id).single());
    expect(row).toMatchObject({ brand_id: annBrand, source: "unsplash", title: "A rugby player in navy", open_url: openUrl, preview_url: "https://images.unsplash.test/abc.jpg" });
    expect(row.attribution).toEqual(ATTRIBUTION);
    const board = must(await ann.client.from("design_moodboards").select("project_id").eq("brand_id", annBrand).eq("project_id", annDesign).single());
    expect(board.project_id).toBe(annDesign);
  });

  it("stores nothing but words and addresses: the row has no column a picture could sit in", async () => {
    const id = must(await save(annBrand, ann, annDesign)) as string;
    const row = must(await ann.client.from("moodboard_items").select("*").eq("id", id).single());
    expect(Object.keys(row).sort()).toEqual(["added_at", "added_by", "attribution", "brand_id", "id", "moodboard_id", "open_url", "preview_url", "source", "title"]);
  });

  it("refuses a picture carried in the address, whatever the scheme, as the database's own rule", async () => {
    for (const url of ["data:image/png;base64,AAAA", "blob:https://knitwright.test/abc", "file:///etc/passwd", "http://plain.test/a.png"]) {
      const refused = await save(annBrand, ann, annDesign, { previewUrl: url });
      expect(refused.error?.hint, url).toBe("not_a_reference");
    }
    const alsoRefused = await save(annBrand, ann, annDesign, { openUrl: "data:text/html,<b>x</b>" });
    expect(alsoRefused.error?.hint).toBe("not_a_reference");
  });

  it("refuses a source it does not know and an attribution with no provider", async () => {
    expect((await save(annBrand, ann, annDesign, { source: "pinterest-scrape" })).error?.code).toBe("23514");
    expect((await save(annBrand, ann, annDesign, { attribution: { notice: "nobody" } })).error?.code).toBe("23514");
    expect((await save(annBrand, ann, annDesign, { attribution: ["not an object"] })).error?.code).toBe("23514");
  });

  it("is one item when the same address is saved twice", async () => {
    const openUrl = `https://unsplash.test/photos/${randomUUID()}`;
    const first = must(await save(annBrand, ann, annDesign, { openUrl })) as string;
    const second = must(await save(annBrand, ann, annDesign, { openUrl })) as string;
    expect(second).toBe(first);
  });

  it("lets any member save, viewers included", async () => {
    expect(must(await save(annBrand, viewer, annDesign))).toBeTruthy();
  });

  it("refuses a design of another brand and a person who is not a member", async () => {
    expect((await save(annBrand, ann, benDesign)).error?.code).toBe("P0002");
    expect((await save(annBrand, outsider, annDesign)).error?.code).toBe("P0002");
  });
});

describe("removing a saved item", () => {
  it("removes one of one's own brand and says so, and removes nothing of another brand", async () => {
    const id = must(await save(annBrand, ann, annDesign)) as string;
    expect(must(await rpc("remove_moodboard_item", { p_brand_id: annBrand, p_user_id: ann.userId, p_item_id: id }))).toBe(true);
    expect(must(await rpc("remove_moodboard_item", { p_brand_id: annBrand, p_user_id: ann.userId, p_item_id: id }))).toBe(false);

    const bensItem = must(await save(benBrand, ben, benDesign)) as string;
    expect(must(await rpc("remove_moodboard_item", { p_brand_id: annBrand, p_user_id: ann.userId, p_item_id: bensItem }))).toBe(false);
    expect(must(await ben.client.from("moodboard_items").select("id").eq("id", bensItem).single()).id).toBe(bensItem);
  });

  it("refuses a person who is not a member of the brand", async () => {
    expect((await rpc("remove_moodboard_item", { p_brand_id: annBrand, p_user_id: outsider.userId, p_item_id: randomUUID() })).error?.code).toBe("P0002");
  });
});

describe("steering the context query", () => {
  it("pins a tag, changes it to removed, and clears it", async () => {
    const tag = `navy-${randomUUID().slice(0, 8)}`;
    must(await steer(annBrand, ann, annDesign, ` ${tag.toUpperCase()} `, "pinned"));
    const pinned = must(await ann.client.from("inspiration_tag_steers").select("tag, state").eq("project_id", annDesign).eq("tag", tag).single());
    expect(pinned).toEqual({ tag, state: "pinned" });

    must(await steer(annBrand, ann, annDesign, tag, "removed"));
    expect(must(await ann.client.from("inspiration_tag_steers").select("state").eq("project_id", annDesign).eq("tag", tag).single()).state).toBe("removed");

    must(await steer(annBrand, ann, annDesign, tag, null));
    expect(must(await ann.client.from("inspiration_tag_steers").select("tag").eq("project_id", annDesign).eq("tag", tag).maybeSingle())).toBeNull();
  });

  it("refuses an empty tag, a state it does not know, a design of another brand and a non-member", async () => {
    expect((await steer(annBrand, ann, annDesign, "   ", "pinned")).error?.hint).toBe("invalid_tag");
    expect((await steer(annBrand, ann, annDesign, "navy", "starred")).error?.hint).toBe("invalid_state");
    expect((await steer(annBrand, ann, benDesign, "navy", "pinned")).error?.code).toBe("P0002");
    expect((await steer(annBrand, outsider, annDesign, "navy", "pinned")).error?.code).toBe("P0002");
  });
});

describe("what a member may read and write directly", () => {
  it("reads only its own brand's moodboard, items and steered tags", async () => {
    must(await save(benBrand, ben, benDesign));
    must(await steer(benBrand, ben, benDesign, `gold-${randomUUID().slice(0, 8)}`, "pinned"));
    for (const table of ["design_moodboards", "moodboard_items", "inspiration_tag_steers"]) {
      const mine = must(await ann.client.from(table).select("brand_id"));
      expect(mine.every((row: { brand_id: string }) => row.brand_id === annBrand), table).toBe(true);
      expect(mine.length, table).toBeGreaterThan(0);
    }
  });

  it("cannot write any of the three itself", async () => {
    const attempts = await Promise.all([
      ann.client.from("design_moodboards").insert({ brand_id: annBrand, project_id: annDesign }).select("id"),
      ann.client.from("moodboard_items").insert({ brand_id: annBrand, moodboard_id: randomUUID(), source: "unsplash", title: "Direct", open_url: "https://a.test/1", preview_url: "https://a.test/1.jpg", attribution: ATTRIBUTION }).select("id"),
      ann.client.from("inspiration_tag_steers").insert({ brand_id: annBrand, project_id: annDesign, tag: "direct", state: "pinned" }).select("tag"),
    ]);
    for (const attempt of attempts) expect(attempt.error).not.toBeNull();
  });
});
