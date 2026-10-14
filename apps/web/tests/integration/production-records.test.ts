import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Team orders, frozen releases, strike-offs and sign-offs (plan W4, decision 0032). Members read their
 * own brand's rows and nobody else's; no browser role writes; a release and a sign-off can never be
 * changed or removed; a strike-off is locked once a named person has decided it; and deleting a design
 * takes every one of them with it.
 */

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const project = async (brandId: string, owner: Person): Promise<string> =>
  must(
    await adminClient().rpc("create_project", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_name: "Polka jersey",
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { made: "for the test" },
      p_schema_version: 1,
    }),
  ) as string;

const rows = (...numbers: string[]) =>
  numbers.map((number) => ({ name: `PLAYER ${number}`, number, size_label: "M", cut: "mens", quantity: 1 }));

const order = async (projectId: string, brandId: string, owner: Person, list = rows("7", "10")): Promise<string> =>
  must(
    await adminClient().rpc("save_team_order", {
      p_order_id: null,
      p_project_id: projectId,
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_name: "Round 1",
      p_rows: list,
    }),
  ) as string;

const release = async (projectId: string, brandId: string, owner: Person, orderId: string | null = null) => {
  const created = must(
    await adminClient().rpc("create_release", {
      p_project_id: projectId,
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_label: "Round 1 jerseys",
      p_snapshot: { specVersion: 1, files: [] },
      p_file_specs: [],
      p_order_id: orderId,
    }),
  ) as { id: string; number: number }[];
  return created[0];
};

const strikeOff = async (releaseId: string, brandId: string, owner: Person): Promise<string> =>
  must(await adminClient().rpc("request_strike_off", { p_release_id: releaseId, p_brand_id: brandId, p_user_id: owner.userId, p_note: "" })) as string;

const receive = (id: string, brandId: string, owner: Person, shrink = 2.0) =>
  adminClient().rpc("receive_strike_off", {
    p_strike_off_id: id,
    p_brand_id: brandId,
    p_user_id: owner.userId,
    p_shrink_length: shrink,
    p_shrink_width: 1.5,
    p_colour_notes: [{ colour: "C1", note: "close" }],
    p_photo_file_ids: [],
  });

const decide = (id: string, brandId: string, owner: Person, accept = true) =>
  adminClient().rpc("decide_strike_off", {
    p_strike_off_id: id,
    p_brand_id: brandId,
    p_user_id: owner.userId,
    p_accept: accept,
    p_name: "Ana Print",
    p_role: "Print lead",
    p_on: "2026-10-17",
    p_note: "",
  });

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("prod-alice"), person("prod-bob")]);
  aliceBrand = await brandOf(alice, "Alice FC");
  bobBrand = await brandOf(bob, "Bob FC");
});

describe("team orders", () => {
  it("saves a list in one step and replaces it whole, keeping the order in the rows", async () => {
    const design = await project(aliceBrand, alice);
    const id = await order(design, aliceBrand, alice, rows("7", "10", "9"));
    await adminClient().rpc("save_team_order", {
      p_order_id: id, p_project_id: design, p_brand_id: aliceBrand, p_user_id: alice.userId, p_name: "Round 1b", p_rows: rows("3"),
    });
    const saved = must(await adminClient().from("team_order_rows").select("number, position").eq("order_id", id)) as { number: string; position: number }[];
    expect(saved).toEqual([{ number: "3", position: 1 }]);
  });

  it("keeps the old list when a row is refused, so a list is never half saved", async () => {
    const design = await project(aliceBrand, alice);
    const id = await order(design, aliceBrand, alice, rows("7", "10"));
    const bad = await adminClient().rpc("save_team_order", {
      p_order_id: id, p_project_id: design, p_brand_id: aliceBrand, p_user_id: alice.userId, p_name: "x", p_rows: [...rows("5"), { name: "A", number: "abc", size_label: "M", cut: "mens", quantity: 1 }],
    });
    expect(bad.error).not.toBeNull();
    const kept = must(await adminClient().from("team_order_rows").select("number").eq("order_id", id)) as { number: string }[];
    expect(kept.map((r) => r.number).sort()).toEqual(["10", "7"]);
  });

  it("refuses a user who is not a member and another brand's design, with one answer", async () => {
    const theirs = await project(bobBrand, bob);
    const attempt = (patch: Record<string, unknown>) =>
      adminClient().rpc("save_team_order", { p_order_id: null, p_project_id: theirs, p_brand_id: bobBrand, p_user_id: bob.userId, p_name: "x", p_rows: rows("1"), ...patch });
    expect((await attempt({ p_user_id: alice.userId })).error?.message).toBe("That design does not exist.");
    expect((await attempt({ p_brand_id: aliceBrand })).error?.message).toBe("That design does not exist.");
    expect((await attempt({ p_project_id: crypto.randomUUID() })).error?.message).toBe("That design does not exist.");
  });

  it("is read by members of the brand only, and written by no browser role", async () => {
    const design = await project(aliceBrand, alice);
    const id = await order(design, aliceBrand, alice);
    expect(must(await alice.client.from("team_order_rows").select("name").eq("order_id", id))).toHaveLength(2);
    expect(must(await bob.client.from("team_order_rows").select("name").eq("order_id", id))).toHaveLength(0);
    expect(must(await bob.client.from("team_orders").select("id").eq("id", id))).toHaveLength(0);
    expect(must(await anonClient().from("team_orders").select("id"))).toHaveLength(0);
    expect((await alice.client.from("team_orders").insert({ brand_id: aliceBrand, project_id: design, name: "x" })).error).not.toBeNull();
    expect((await alice.client.from("team_order_rows").update({ name: "X" }).eq("order_id", id)).error).not.toBeNull();
    expect((await alice.client.from("team_orders").delete().eq("id", id)).error).not.toBeNull();
    expect((await alice.client.rpc("save_team_order", { p_order_id: null, p_project_id: design, p_brand_id: aliceBrand, p_user_id: alice.userId, p_name: "x", p_rows: rows("1") })).error).not.toBeNull();
  });

  it("erases every name with the order", async () => {
    const design = await project(aliceBrand, alice);
    const id = await order(design, aliceBrand, alice);
    must(await adminClient().from("team_orders").delete().eq("id", id).select("id"));
    expect(must(await adminClient().from("team_order_rows").select("id").eq("order_id", id))).toHaveLength(0);
  });
});

describe("releases", () => {
  it("are numbered in order within a design and read by their brand only", async () => {
    const design = await project(aliceBrand, alice);
    expect((await release(design, aliceBrand, alice))?.number).toBe(1);
    const second = await release(design, aliceBrand, alice);
    expect(second?.number).toBe(2);
    expect(must(await alice.client.from("production_releases").select("id").eq("project_id", design))).toHaveLength(2);
    expect(must(await bob.client.from("production_releases").select("id").eq("project_id", design))).toHaveLength(0);
  });

  it("cannot be changed or removed by any role the API can use", async () => {
    const design = await project(aliceBrand, alice);
    const made = await release(design, aliceBrand, alice);
    expect((await adminClient().from("production_releases").update({ label: "x" }).eq("id", made?.id)).error).not.toBeNull();
    expect((await adminClient().from("production_releases").delete().eq("id", made?.id)).error).not.toBeNull();
    expect((await alice.client.from("production_releases").update({ label: "x" }).eq("id", made?.id)).error).not.toBeNull();
    expect((await alice.client.rpc("create_release", { p_project_id: design, p_brand_id: aliceBrand, p_user_id: alice.userId, p_label: "x", p_snapshot: {}, p_file_specs: [], p_order_id: null })).error).not.toBeNull();
  });

  it("refuse a user who is not a member of the brand", async () => {
    const design = await project(aliceBrand, alice);
    const result = await adminClient().rpc("create_release", { p_project_id: design, p_brand_id: aliceBrand, p_user_id: bob.userId, p_label: "x", p_snapshot: {}, p_file_specs: [], p_order_id: null });
    expect(result.error?.message).toBe("That design does not exist.");
  });
});

describe("sign-offs", () => {
  it("record a role, a name and a date, and are never changed", async () => {
    const design = await project(aliceBrand, alice);
    const made = await release(design, aliceBrand, alice);
    const args = { p_release_id: made?.id, p_brand_id: aliceBrand, p_user_id: alice.userId, p_role: "print", p_signer_name: "Ana Print", p_signed_on: "2026-10-16", p_note: "" };
    must(await adminClient().rpc("add_sign_off", args));
    const [row] = must(await alice.client.from("sign_offs").select("role, signer_name, signed_on").eq("release_id", made?.id)) as Record<string, string>[];
    expect(row).toEqual({ role: "print", signer_name: "Ana Print", signed_on: "2026-10-16" });
    expect((await adminClient().from("sign_offs").update({ signer_name: "x" }).eq("release_id", made?.id)).error).not.toBeNull();
    expect((await adminClient().rpc("add_sign_off", { ...args, p_role: "boss" })).error).not.toBeNull();
    expect((await adminClient().rpc("add_sign_off", { ...args, p_user_id: bob.userId })).error?.message).toBe("That release does not exist.");
    expect(must(await bob.client.from("sign_offs").select("id").eq("release_id", made?.id))).toHaveLength(0);
  });
});

describe("strike-offs", () => {
  it("move from requested to received to accepted by a named person, then lock", async () => {
    const design = await project(aliceBrand, alice);
    const made = await release(design, aliceBrand, alice);
    const id = await strikeOff(made?.id ?? "", aliceBrand, alice);

    expect((await decide(id, aliceBrand, alice)).error?.message).toMatch(/has arrived/);
    must(await receive(id, aliceBrand, alice));
    must(await receive(id, aliceBrand, alice, 2.1));
    must(await decide(id, aliceBrand, alice));

    const [row] = must(await alice.client.from("strike_offs").select("*").eq("id", id)) as Record<string, unknown>[];
    expect(row).toMatchObject({ status: "accepted", decided_by_name: "Ana Print", decided_role: "Print lead", decided_on: "2026-10-17", shrink_length_pct: 2.1 });
    expect((await receive(id, aliceBrand, alice)).error?.message).toMatch(/can never be changed/);
    expect((await decide(id, aliceBrand, alice, false)).error).not.toBeNull();
    expect((await adminClient().from("strike_offs").update({ status: "requested" }).eq("id", id)).error).not.toBeNull();
  });

  it("cannot be decided without a name, a role and a date, nor measured out of range", async () => {
    const design = await project(aliceBrand, alice);
    const made = await release(design, aliceBrand, alice);
    const id = await strikeOff(made?.id ?? "", aliceBrand, alice);
    expect((await receive(id, aliceBrand, alice, 45)).error).not.toBeNull();
    must(await receive(id, aliceBrand, alice));
    const args = { p_strike_off_id: id, p_brand_id: aliceBrand, p_user_id: alice.userId, p_accept: true, p_name: " ", p_role: "Print lead", p_on: "2026-10-17", p_note: "" };
    expect((await adminClient().rpc("decide_strike_off", args)).error).not.toBeNull();
  });

  it("are not reachable by another brand", async () => {
    const design = await project(aliceBrand, alice);
    const made = await release(design, aliceBrand, alice);
    const id = await strikeOff(made?.id ?? "", aliceBrand, alice);
    expect((await receive(id, bobBrand, bob)).error?.message).toBe("That strike-off does not exist.");
    expect(must(await bob.client.from("strike_offs").select("id").eq("id", id))).toHaveLength(0);
    expect((await bob.client.from("strike_offs").update({ status: "accepted" }).eq("id", id)).error).not.toBeNull();
  });

  it("refuse a photo that is not one of the brand's proof photos", async () => {
    const design = await project(aliceBrand, alice);
    const made = await release(design, aliceBrand, alice);
    const id = await strikeOff(made?.id ?? "", aliceBrand, alice);
    const result = await adminClient().rpc("receive_strike_off", {
      p_strike_off_id: id, p_brand_id: aliceBrand, p_user_id: alice.userId, p_shrink_length: null, p_shrink_width: null, p_colour_notes: [], p_photo_file_ids: [crypto.randomUUID()],
    });
    expect(result.error).not.toBeNull();
  });
});

describe("deleting a design", () => {
  it("takes its team lists, releases, strike-offs and sign-offs with it, though they can never be removed one by one", async () => {
    const design = await project(aliceBrand, alice);
    const orderId = await order(design, aliceBrand, alice);
    const made = await release(design, aliceBrand, alice, orderId);
    const id = await strikeOff(made?.id ?? "", aliceBrand, alice);
    must(await receive(id, aliceBrand, alice));
    must(await decide(id, aliceBrand, alice));
    must(await adminClient().rpc("add_sign_off", { p_release_id: made?.id, p_brand_id: aliceBrand, p_user_id: alice.userId, p_role: "club", p_signer_name: "Bo", p_signed_on: "2026-10-16", p_note: "" }));

    must(await adminClient().rpc("delete_project", { p_project_id: design, p_brand_id: aliceBrand, p_user_id: alice.userId }));

    expect(must(await adminClient().from("production_releases").select("id").eq("project_id", design))).toHaveLength(0);
    expect(must(await adminClient().from("strike_offs").select("id").eq("project_id", design))).toHaveLength(0);
    expect(must(await adminClient().from("sign_offs").select("id").eq("project_id", design))).toHaveLength(0);
    expect(must(await adminClient().from("team_orders").select("id").eq("project_id", design))).toHaveLength(0);
  });
});
