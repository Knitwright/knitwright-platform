import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261030010000: the database findings of the v4 security review (docs/reviews/security-v4.md).
 * M5 brand details, M6 kit files, M8 media columns, L10 actors of history, L11 brand deletion and invitation expiry,
 * L12 designer use, L13 delays. Migration 20261030020000: L8 what members and designers read.
 * Needs `pnpm db:start`.
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);

const createProject = async (brandId: string, owner: Person): Promise<string> =>
  must(
    await rpc("create_project", { p_brand_id: brandId, p_user_id: owner.userId, p_name: "Design", p_style_number: "", p_season: "", p_garment_type: "crew-tee", p_spec: { made: "for the test" }, p_schema_version: 1 }),
  ) as string;

const makeRelease = async (owner: Person, brandId: string): Promise<string> => {
  const project = await createProject(brandId, owner);
  const created = must(
    await rpc("create_release", { p_project_id: project, p_brand_id: brandId, p_user_id: owner.userId, p_label: "Round 1", p_snapshot: { specVersion: 1, patternBlockId: "crew-tee", patternBlockVersion: 1, fabricTestIds: [], printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" }, rosterHash: null, files: [] }, p_file_specs: [], p_order_id: null }),
  ) as { id: string }[];
  return created[0]!.id;
};

const submitOrder = async (releaseId: string): Promise<string> => {
  const submitted = must(
    await rpc("submit_order_for_production", { p_release_id: releaseId, p_external_ref: `store-${randomUUID()}`, p_factory_profile_id: "f1", p_fabric_key: "m", p_article_id: "crew-tee", p_sizes: { M: 2 } }),
  ) as { order_id: string }[];
  return submitted[0]!.order_id;
};

/** A file row of the brand, as the server stores one. */
const fileOf = async (brandId: string, owner: Person): Promise<string> => {
  const id = randomUUID();
  must(await adminClient().from("files").insert({ id, brand_id: brandId, bucket: "exports", path: `${brandId}/pattern-source/${id}.dxf`, kind: "pattern-source", content_type: "application/dxf", bytes: 10, created_by: owner.userId }).select("id"));
  return id;
};

/** Invites someone and has them accept, so they hold a role in the brand. */
const join = async (owner: Person, brandId: string, member: Person, role: string): Promise<void> => {
  must(await rpc("invite_member", { p_brand_id: brandId, p_user_id: owner.userId, p_email: member.email, p_role: role }));
  const invitations = must(await member.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((i) => i.brand_id === brandId);
  expect(mine).toBeDefined();
  must(await rpc("accept_invitation", { p_user_id: member.userId, p_invitation_id: mine?.id }));
};

const platformAdmin = async (label: string): Promise<Person> => {
  const admin = await person(label);
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
  return admin;
};

const designerTemplate = async (designerId: string): Promise<string> => {
  must(await rpc("designer_enrol", { p_user_id: designerId, p_display_name: "Fix Designer" }));
  const templateId = randomUUID();
  must(
    await adminClient().from("templates").insert({
      id: templateId, slug: `designer-${templateId}`.slice(0, 40), title: "Fix", sport: "football", article_id: "crew-tee", wearer: "men",
      style_tags: ["plain"], colour_family: "blue", snapshot: { seeded: true }, source: "designer", designer_id: designerId, attribution: "Fix Designer",
    }).select("id"),
  );
  return templateId;
};

// The owner of the table, reached through the database container, as append-only-owner.test.ts does.
const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_knitwright-platform";
const psql = (sql: string): boolean => {
  try {
    execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], { stdio: ["ignore", "pipe", "pipe"], timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
};
const dockerReachable = psql("select 1");

describe("M5: brand details need a member manager", () => {
  let owner: Person;
  let manager: Person;
  let viewer: Person;
  let helper: Person;
  let brand: string;

  beforeAll(async () => {
    [owner, manager, viewer, helper] = await Promise.all([person("fix-owner"), person("fix-kit"), person("fix-viewer"), person("fix-admin")]);
    brand = await brandOf(owner, "Fix Details FC");
    await join(owner, brand, manager, "kit_manager");
    await join(owner, brand, viewer, "viewer");
    await join(owner, brand, helper, "admin");
  });

  const details = (who: Person, country: string) =>
    who.client.rpc("set_brand_details", { p_brand_id: brand, p_organisation_type: "club", p_country: country, p_region: "" });

  it("refuses a kit manager and a viewer, with the answer a stranger gets", async () => {
    expect((await details(manager, "NZ")).error?.code).toBe("P0002");
    expect((await details(viewer, "NZ")).error?.code).toBe("P0002");
    expect(must(await adminClient().from("brands").select("country").eq("id", brand).single()).country).toBeNull();
  });

  it("lets the owner and an admin change them", async () => {
    must(await details(owner, "NZ"));
    expect(must(await adminClient().from("brands").select("country").eq("id", brand).single()).country).toBe("NZ");
    must(await details(helper, "AU"));
    expect(must(await adminClient().from("brands").select("country").eq("id", brand).single()).country).toBe("AU");
  });
});

describe("M6: the kit names only the brand's own files", () => {
  it("refuses a crest or a sponsor logo that belongs to another brand", async () => {
    const [a, b] = await Promise.all([person("kit-a"), person("kit-b")]);
    const [brandA, brandB] = [await brandOf(a, "Kit A FC"), await brandOf(b, "Kit B FC")];
    const mine = await fileOf(brandA, a);
    const theirs = await fileOf(brandB, b);

    const crest = await rpc("save_club_kit", { p_brand_id: brandA, p_user_id: a.userId, p_kit: { crestFileId: theirs } });
    const logo = await rpc("save_club_kit", { p_brand_id: brandA, p_user_id: a.userId, p_kit: { sponsors: [{ name: "Acme", logoFileId: theirs }] } });
    expect(crest.error?.code).toBe("22023");
    expect(crest.error?.hint).toBe("foreign_file");
    expect(logo.error?.code).toBe("22023");
    expect(must(await adminClient().from("club_kits").select("brand_id").eq("brand_id", brandA))).toEqual([]);

    must(await rpc("save_club_kit", { p_brand_id: brandA, p_user_id: a.userId, p_kit: { crestFileId: mine, sponsors: [{ name: "Acme", logoFileId: mine }, { name: "No logo", logoFileId: null }] } }));
    expect(must(await adminClient().from("club_kits").select("crest_file_id").eq("brand_id", brandA).single()).crest_file_id).toBe(mine);
  });
});

describe("M8: members do not read what a media item cost or where its clean file is", () => {
  it("answers a member's read of those columns with a refusal, and the other columns with their rows", async () => {
    const owner = await person("media-fix");
    const brand = await brandOf(owner, "Media Fix FC");
    const project = await createProject(brand, owner);
    const set = must(await rpc("media_set_start", { p_brand_id: brand, p_project_id: project, p_user_id: owner.userId, p_version: 1, p_version_hash: `fix-${randomUUID()}` })) as { id: string };
    must(await rpc("media_set_move", { p_set_id: set.id, p_from: ["queued"], p_to: "running" }));
    must(await rpc("media_item_put", { p_set_id: set.id, p_kind: "studio_render", p_view: "front", p_file_id: null, p_clean_path: `_private/${brand}/${set.id}/studio_render-front.png`, p_width: 10, p_height: 10, p_provider: "knitwright-flat", p_cost_microdollars: 5, p_verdict: "not_checked" }));

    for (const column of ["cost_microdollars", "provider", "clean_path"]) {
      expect((await owner.client.from("media_items").select(column).eq("set_id", set.id)).error, column).not.toBeNull();
    }
    expect((await owner.client.from("media_items").select("*").eq("set_id", set.id)).error).not.toBeNull();
    expect(must(await owner.client.from("media_items").select("id, kind, view, width, checker_verdict").eq("set_id", set.id))).toHaveLength(1);
    const asServer = must(await adminClient().from("media_items").select("clean_path, provider, cost_microdollars").eq("set_id", set.id));
    expect(asServer[0]).toMatchObject({ provider: "knitwright-flat", cost_microdollars: 5 });
  });
});

describe("L10: deleting a sign-in record that history names", () => {
  it("clears the actor of ops history, settings history and payout notes, and keeps the lines", async () => {
    const owner = await person("actor-owner");
    const brand = await brandOf(owner, "Actor FC");
    const admin = await platformAdmin("actor-admin");
    const designer = await person("actor-designer");
    must(await rpc("designer_enrol", { p_user_id: designer.userId, p_display_name: "Actor Designer" }));

    const orderId = await submitOrder(await makeRelease(owner, brand));
    must(await rpc("ops_set_hold", { p_actor: admin.userId, p_order_id: orderId, p_hold: true, p_note: "check" }));
    const key = "securityfix.actor";
    must(await rpc("platform_setting_set", { p_actor: admin.userId, p_key: key, p_value: 3 }));
    must(await rpc("designer_set_payout_state", { p_actor: admin.userId, p_designer_id: designer.userId, p_state: "on_hold", p_note: "check" }));

    const removed = await adminClient().auth.admin.deleteUser(admin.userId);
    expect(removed.error).toBeNull();

    const events = must(await adminClient().from("ops_order_events").select("kind, actor").eq("order_id", orderId)) as { kind: string; actor: string | null }[];
    expect(events.find((e) => e.kind === "held")).toEqual({ kind: "held", actor: null });
    const history = must(await adminClient().from("platform_settings_history").select("set_by").eq("key", key)) as { set_by: string | null }[];
    expect(history).toEqual([{ set_by: null }]);
    const payouts = must(await adminClient().from("designer_payout_events").select("set_by").eq("designer_id", designer.userId)) as { set_by: string | null }[];
    expect(payouts).toEqual([{ set_by: null }]);
  });
});

describe("L11: brand deletion and invitation expiry", () => {
  it("removes the brand's orders, their history and the uses of designer templates with it", async () => {
    const [owner, designer] = await Promise.all([person("gone-owner"), person("gone-designer")]);
    const brand = await brandOf(owner, "Gone Orders FC");
    const templateId = await designerTemplate(designer.userId);
    const project = await createProject(brand, owner);
    expect(must(await rpc("designer_record_use", { p_template_id: templateId, p_brand_id: brand, p_project_id: project }))).toBe(true);
    const orderId = await submitOrder(await makeRelease(owner, brand));
    expect(must(await adminClient().from("ops_order_events").select("id").eq("order_id", orderId)).length).toBeGreaterThan(0);

    must(await adminClient().from("brands").delete().eq("id", brand).select("id"));

    expect(must(await adminClient().from("ops_orders").select("id").eq("brand_id", brand))).toEqual([]);
    expect(must(await adminClient().from("ops_order_events").select("id").eq("brand_id", brand))).toEqual([]);
    expect(must(await adminClient().from("designer_template_uses").select("id").eq("brand_id", brand))).toEqual([]);
  });

  it("gives a new invitation 14 days", async () => {
    const owner = await person("expiry-owner");
    const brand = await brandOf(owner, "Expiry FC");
    must(await rpc("invite_member", { p_brand_id: brand, p_user_id: owner.userId, p_email: "later@example.com", p_role: "viewer" }));
    const row = must(await adminClient().from("club_invitations").select("expires_at").eq("brand_id", brand).single()) as { expires_at: string };
    const days = (Date.parse(row.expires_at) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThan(14.1);
  });

  it.skipIf(!dockerReachable)("hides an expired invitation and refuses to accept it, until it is sent again", async () => {
    const owner = await person("expired-owner");
    const guest = await person("expired-guest");
    const brand = await brandOf(owner, "Expired FC");
    must(await rpc("invite_member", { p_brand_id: brand, p_user_id: owner.userId, p_email: guest.email, p_role: "viewer" }));
    const mine = (must(await guest.client.rpc("my_club_invitations")) as { id: string }[])[0]!;

    expect(psql(`update public.club_invitations set expires_at = now() - interval '1 day' where id = '${mine.id}'`)).toBe(true);

    expect(must(await guest.client.rpc("my_club_invitations"))).toEqual([]);
    const refused = await rpc("accept_invitation", { p_user_id: guest.userId, p_invitation_id: mine.id });
    expect(refused.error?.hint).toBe("invitation_expired");

    must(await rpc("invite_member", { p_brand_id: brand, p_user_id: owner.userId, p_email: guest.email, p_role: "viewer" }));
    must(await rpc("accept_invitation", { p_user_id: guest.userId, p_invitation_id: mine.id }));
  });
});

describe("L12: a designer template is used by a brand's own design, not by its designer", () => {
  it("refuses a design of another brand, records a buyer's use, and ignores the designer's own", async () => {
    const [designer, buyer, other] = await Promise.all([person("use-designer"), person("use-buyer"), person("use-other")]);
    const [buyerBrand, otherBrand, designerBrand] = [await brandOf(buyer, "Use Buyer FC"), await brandOf(other, "Use Other FC"), await brandOf(designer, "Use Designer FC")];
    const templateId = await designerTemplate(designer.userId);

    const foreign = await createProject(otherBrand, other);
    const refused = await rpc("designer_record_use", { p_template_id: templateId, p_brand_id: buyerBrand, p_project_id: foreign });
    expect(refused.error?.code).toBe("P0002");

    const bought = await createProject(buyerBrand, buyer);
    expect(must(await rpc("designer_record_use", { p_template_id: templateId, p_brand_id: buyerBrand, p_project_id: bought }))).toBe(true);

    const own = await createProject(designerBrand, designer);
    expect(must(await rpc("designer_record_use", { p_template_id: templateId, p_brand_id: designerBrand, p_project_id: own }))).toBe(false);
    expect(must(await adminClient().from("designer_template_uses").select("id").eq("project_id", own))).toEqual([]);
  });
});

describe("L13: a delay needs a date", () => {
  it("refuses a null date and still accepts a later one", async () => {
    const owner = await person("delay-owner");
    const admin = await platformAdmin("delay-admin");
    const brand = await brandOf(owner, "Delay FC");
    const orderId = await submitOrder(await makeRelease(owner, brand));
    const cutoff = (must(await adminClient().from("ops_orders").select("cutoff_at").eq("id", orderId).single()) as { cutoff_at: string }).cutoff_at;
    must(await rpc("ops_cut_batches", { p_actor: admin.userId, p_now: new Date(Date.parse(cutoff) + 1000).toISOString() }));

    const missing = await rpc("ops_delay_order", { p_actor: admin.userId, p_order_id: orderId, p_new_date: null, p_reason: "Yarn late" });
    expect(missing.error?.hint).toBe("date_needed");
    must(await rpc("ops_delay_order", { p_actor: admin.userId, p_order_id: orderId, p_new_date: "2099-01-01", p_reason: "Yarn late" }));
  });
});

describe("L8: members and designers read only what is theirs to read", () => {
  it("shows member emails to owners and admins only; other members get a profile name or nothing", async () => {
    const [owner, admin, kitManager, viewer, named] = await Promise.all([
      person("l8-owner"), person("l8-admin"), person("l8-kit"), person("l8-viewer"), person("l8-named"),
    ]);
    const brand = await brandOf(owner, "Members Fix FC");
    for (const [member, role] of [[admin, "admin"], [kitManager, "kit_manager"], [viewer, "viewer"], [named, "viewer"]] as const) {
      await join(owner, brand, member, role);
    }
    const updated = await adminClient().auth.admin.updateUserById(named.userId, { user_metadata: { display_name: "Named Member" } });
    expect(updated.error).toBeNull();
    const emails = [owner, admin, kitManager, viewer, named].map((p) => p.email);

    for (const who of [kitManager, viewer]) {
      const seen = must(await who.client.rpc("club_members", { p_brand_id: brand })) as { user_id: string; role: string; name: string | null }[];
      expect(seen).toHaveLength(5);
      expect(seen.filter((m) => m.name !== null && emails.includes(m.name))).toEqual([]);
      expect(seen.find((m) => m.user_id === named.userId)?.name).toBe("Named Member");
      expect(seen.find((m) => m.user_id === owner.userId)?.name).toBeNull();
    }
    for (const who of [owner, admin]) {
      const seen = must(await who.client.rpc("club_members", { p_brand_id: brand })) as { user_id: string; name: string | null }[];
      expect(seen.find((m) => m.user_id === viewer.userId)?.name).toBe(viewer.email);
      expect(seen.find((m) => m.user_id === named.userId)?.name).toBe("Named Member");
    }
  });

  it("does not show a template's designer to a signed-in reader, and the server still has it", async () => {
    const [designer, reader] = await Promise.all([person("l8-template-designer"), person("l8-template-reader")]);
    const templateId = await designerTemplate(designer.userId);

    for (const who of [reader, designer]) {
      expect((await who.client.from("templates").select("designer_id").eq("id", templateId)).error).not.toBeNull();
      expect((await who.client.from("templates").select("*").eq("id", templateId)).error).not.toBeNull();
      const row = must(await who.client.from("templates").select("id, title, source, attribution, snapshot").eq("id", templateId).single());
      expect(row).toMatchObject({ source: "designer", attribution: "Fix Designer" });
    }
    const asServer = must(await adminClient().from("templates").select("designer_id").eq("id", templateId).single());
    expect(asServer).toEqual({ designer_id: designer.userId });
  });

  it("shows a designer the units of a ledger line, never the buying brand's order, design or release", async () => {
    const [designer, buyer] = await Promise.all([person("l8-ledger-designer"), person("l8-ledger-buyer")]);
    const brand = await brandOf(buyer, "Ledger Buyer FC");
    const templateId = await designerTemplate(designer.userId);
    const project = await createProject(brand, buyer);
    expect(must(await rpc("designer_record_use", { p_template_id: templateId, p_brand_id: brand, p_project_id: project }))).toBe(true);
    const release = must(
      await rpc("create_release", { p_project_id: project, p_brand_id: brand, p_user_id: buyer.userId, p_label: "Round 1", p_snapshot: {}, p_file_specs: [], p_order_id: null }),
    ) as { id: string }[];
    const orderId = await submitOrder(release[0]!.id);
    const line = must(await adminClient().from("royalty_accruals").select("id, order_id, project_id, release_id").eq("order_id", orderId).single()) as { id: string };
    expect(line).toMatchObject({ project_id: project, release_id: release[0]!.id });

    for (const column of ["order_id", "project_id", "release_id"]) {
      expect((await designer.client.from("royalty_accruals").select(column).eq("id", line.id)).error, column).not.toBeNull();
    }
    expect((await designer.client.from("royalty_accruals").select("*").eq("id", line.id)).error).not.toBeNull();
    const seen = must(await designer.client.from("royalty_accruals").select("id, template_id, units").eq("id", line.id));
    expect(seen).toEqual([{ id: line.id, template_id: templateId, units: 2 }]);
  });
});
