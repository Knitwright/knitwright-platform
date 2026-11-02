import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Make: golden samples and the one door a make order goes through (plan v5 Y7, F-S7; decision 0080), against
 * local Supabase. Needs `pnpm db:start`.
 *
 * The acceptance test of F-S7 is here: a run cannot be placed without a golden sample signed off for the
 * version being made, or one carried forward from a parent version that differs only on the surface.
 *
 * Every order gives itself its own fabric key, because ops batches group by factory, fabric, article and
 * cut-off and hand back a batch they have already cut (plan v5, lesson 11).
 */

const rpc = (name: string, args: Record<string, unknown>) => adminClient().rpc(name, args);
const fabric = () => `make-${randomUUID().slice(0, 8)}`;

const SNAPSHOT = (specVersion: number) => ({
  specVersion,
  patternBlockId: "crew-tee",
  patternBlockVersion: 1,
  fabricTestIds: [],
  printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" },
  rosterHash: null,
  files: [],
});

const join = async (owner: Person, brandId: string, member: Person, role: string): Promise<void> => {
  must(await rpc("invite_member", { p_brand_id: brandId, p_user_id: owner.userId, p_email: member.email, p_role: role }));
  const invitations = must(await member.client.rpc("my_club_invitations")) as { id: string; brand_id: string }[];
  const mine = invitations.find((i) => i.brand_id === brandId);
  must(await rpc("accept_invitation", { p_user_id: member.userId, p_invitation_id: mine?.id }));
};

const makeProject = async (owner: Person, brandId: string, garmentType = "crew-tee"): Promise<string> =>
  must(await rpc("create_project", {
    p_brand_id: brandId, p_user_id: owner.userId, p_name: "Make tee", p_style_number: "", p_season: "",
    p_garment_type: garmentType, p_spec: { made: "for the test" }, p_schema_version: 1,
  })) as string;

const makeRelease = async (owner: Person, brandId: string, projectId: string, specVersion = 1): Promise<string> => {
  const created = must(await rpc("create_release", {
    p_project_id: projectId, p_brand_id: brandId, p_user_id: owner.userId, p_label: `v${specVersion}`,
    p_snapshot: SNAPSHOT(specVersion), p_file_specs: [], p_order_id: null,
  })) as { id: string }[];
  return created[0]!.id;
};

const listProduct = async (owner: Person, brandId: string, projectId: string): Promise<string> =>
  must(await rpc("create_brand_product", { p_brand_id: brandId, p_user_id: owner.userId, p_project_id: projectId, p_name: "Make tee" })) as string;

const order = (who: Person, brandId: string, productId: string, releaseId: string, over: Record<string, unknown> = {}) =>
  rpc("submit_make_order", {
    p_brand_id: brandId, p_user_id: who.userId, p_product_id: productId, p_kind: "sample", p_release_id: releaseId,
    p_factory_profile_id: "knitwright-default", p_fabric_key: fabric(), p_sizes: { S: 1, M: 1 }, p_flags: [],
    p_request_key: randomUUID(), ...over,
  });

const pictureOf = async (brandId: string, ownerId: string): Promise<string> => {
  const id = randomUUID();
  must(await adminClient().from("files").insert({
    id, brand_id: brandId, bucket: "uploads", path: `${brandId}/golden-sample/${randomUUID()}.png`,
    kind: "photo", content_type: "image/png", bytes: 10, created_by: ownerId,
  }));
  return id;
};

/** A product with a sample already sent, ready to be judged. */
const sampled = async (owner: Person, brandId: string, garmentType = "crew-tee") => {
  const projectId = await makeProject(owner, brandId, garmentType);
  const releaseId = await makeRelease(owner, brandId, projectId);
  const productId = await listProduct(owner, brandId, projectId);
  const [sent] = must(await order(owner, brandId, productId, releaseId)) as { run_id: string; golden_sample_id: string | null }[];
  return { projectId, releaseId, productId, runId: sent!.run_id };
};

/** A golden sample with a photo and a measurement on it: everything a sign-off needs. */
const judged = async (owner: Person, brandId: string, productId: string, runId: string): Promise<string> => {
  const id = must(await rpc("start_golden_sample", { p_brand_id: brandId, p_user_id: owner.userId, p_product_id: productId, p_run_id: runId })) as string;
  must(await rpc("add_golden_sample_photo", {
    p_brand_id: brandId, p_user_id: owner.userId, p_golden_sample_id: id, p_file_id: await pictureOf(brandId, owner.userId), p_angle: "front", p_caption: "As it arrived",
  }));
  must(await rpc("add_golden_sample_pom", {
    p_brand_id: brandId, p_user_id: owner.userId, p_golden_sample_id: id, p_size_label: "M", p_letter: "A", p_code: "chest_1cm_below_armhole",
    p_measured_mm: 532, p_target_mm: 530, p_tol_minus_mm: 10, p_tol_plus_mm: 10, p_rule_id: "R-GAP-000",
  }));
  return id;
};

const signOff = (owner: Person, brandId: string, goldenSampleId: string) =>
  rpc("sign_off_golden_sample", { p_brand_id: brandId, p_user_id: owner.userId, p_golden_sample_id: goldenSampleId, p_fit_rating: 4, p_colour_rating: 5, p_notes: "Good" });

let ann: Person;
let ben: Person;
let viewer: Person;
let annBrand: string;
let benBrand: string;

beforeAll(async () => {
  [ann, ben, viewer] = await Promise.all([person("gs-ann"), person("gs-ben"), person("gs-viewer")]);
  annBrand = await brandOf(ann, "Ann Make");
  benBrand = await brandOf(ben, "Ben Make");
  await join(ann, annBrand, viewer, "viewer");
});

describe("judging a sample", () => {
  it("starts a golden sample from the sample run, with the version the release froze", async () => {
    const { productId, runId } = await sampled(ann, annBrand);
    const id = must(await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_run_id: runId })) as string;
    const row = must(await ann.client.from("golden_samples").select("*").eq("id", id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ brand_id: annBrand, product_id: productId, run_id: runId, design_version: 1, version: 1, state: "draft", factory_profile_id: "knitwright-default" });
    expect(row.approved_at).toBeNull();
  });

  it("refuses a second one while the first is still being judged", async () => {
    const { productId, runId } = await sampled(ann, annBrand);
    must(await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_run_id: runId }));
    expect((await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_run_id: runId })).error?.code).toBe("23505");
  });

  it("refuses a viewer, another brand's member and a run that is not a sample", async () => {
    const { productId, runId, releaseId } = await sampled(ann, annBrand);
    expect((await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: viewer.userId, p_product_id: productId, p_run_id: runId })).error?.code).toBe("42501");
    expect((await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: ben.userId, p_product_id: productId, p_run_id: runId })).error?.code).toBe("42501");
    const id = await judged(ann, annBrand, productId, runId);
    must(await signOff(ann, annBrand, id));
    const [run] = must(await order(ann, annBrand, productId, releaseId, { p_kind: "run", p_sizes: { M: 60 } })) as { run_id: string }[];
    expect((await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_run_id: run!.run_id })).error?.hint).toBe("not_a_sample");
  });

  it("needs a photo, a measurement and both marks before it is signed off", async () => {
    const { productId, runId } = await sampled(ann, annBrand);
    const id = must(await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_run_id: runId })) as string;
    expect((await signOff(ann, annBrand, id)).error?.hint).toBe("needs_photo");
    must(await rpc("add_golden_sample_photo", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_file_id: await pictureOf(annBrand, ann.userId), p_angle: "front", p_caption: "" }));
    expect((await signOff(ann, annBrand, id)).error?.hint).toBe("needs_measurement");
    must(await rpc("add_golden_sample_pom", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_size_label: "M", p_letter: "A", p_code: "chest", p_measured_mm: 530 }));
    expect((await rpc("sign_off_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_fit_rating: 9, p_colour_rating: 5 })).error?.hint).toBe("invalid_rating");
    expect(must(await signOff(ann, annBrand, id))).toBe("approved");
    const row = must(await ann.client.from("golden_samples").select("state, fit_rating, colour_rating, approved_by, approved_at").eq("id", id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ state: "approved", fit_rating: 4, colour_rating: 5, approved_by: ann.userId });
    expect(row.approved_at).not.toBeNull();
    // Signing off is also the brand's word that the sample is good, so the product reaches the run stage.
    expect(must(await ann.client.from("brand_products").select("stage").eq("id", productId).single())).toEqual({ stage: "run" });
  });

  it("refuses a picture of another brand", async () => {
    const { productId, runId } = await sampled(ann, annBrand);
    const id = must(await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_run_id: runId })) as string;
    const theirs = await pictureOf(benBrand, ben.userId);
    expect((await rpc("add_golden_sample_photo", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_file_id: theirs, p_angle: "front", p_caption: "" })).error?.hint).toBe("file_not_found");
  });
});

describe("the evidence on a golden sample", () => {
  it("keeps the colour reading with the values it came from, and nothing it was not told", async () => {
    const { productId, runId } = await sampled(ann, annBrand);
    const id = must(await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_run_id: runId })) as string;
    must(await rpc("add_golden_sample_colour_reading", {
      p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_colour_name: "Club navy", p_delta_e: 1.24,
      p_target_hex: "#0B1F4B", p_target_lab: [13, 10.7, -29.6], p_measured_lab: [13.4, 10.2, -29.1], p_instrument: "Colour house report",
    }));
    const row = must(await ann.client.from("golden_sample_colour_readings").select("*").eq("golden_sample_id", id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ colour_name: "Club navy", target_hex: "#0B1F4B", instrument: "Colour house report", rule_id: "R-GAP-000" });
    expect(Number(row.delta_e)).toBeCloseTo(1.24, 3);
    expect(Number(row.target_b)).toBeCloseTo(-29.6, 2);
    // Nobody stated a white point or an observer, so neither is filled in for them (owner decision 15).
    expect(row.white_point).toBeNull();
    expect(row.observer).toBeNull();
    expect((await rpc("add_golden_sample_colour_reading", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_colour_name: "X", p_delta_e: null })).error?.hint).toBe("invalid_reading");
    expect((await rpc("add_golden_sample_colour_reading", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_colour_name: "X", p_delta_e: 1, p_target_lab: [1, 2] })).error?.hint).toBe("invalid_lab");
  });

  it("can never be added to once the golden sample is signed off", async () => {
    const { productId, runId } = await sampled(ann, annBrand);
    const id = await judged(ann, annBrand, productId, runId);
    must(await signOff(ann, annBrand, id));
    const picture = await pictureOf(annBrand, ann.userId);
    expect((await rpc("add_golden_sample_pom", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_size_label: "M", p_letter: "B", p_code: "waist", p_measured_mm: 500 })).error?.hint).toBe("golden_sample_settled");
    expect((await rpc("add_golden_sample_photo", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_file_id: picture, p_angle: "back", p_caption: "" })).error?.hint).toBe("golden_sample_settled");
    expect((await rpc("add_golden_sample_colour_reading", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_colour_name: "Late", p_delta_e: 2 })).error?.hint).toBe("golden_sample_settled");
    expect((await signOff(ann, annBrand, id)).error?.hint).toBe("golden_sample_settled");
  });

  it("can never be changed or removed, even by the server's own key", async () => {
    const { productId, runId } = await sampled(ann, annBrand);
    const id = await judged(ann, annBrand, productId, runId);
    for (const table of ["golden_sample_photos", "golden_sample_poms"]) {
      expect((await adminClient().from(table).update({ brand_id: benBrand }).eq("golden_sample_id", id)).error?.code).toBe("42501");
      expect((await adminClient().from(table).delete().eq("golden_sample_id", id)).error?.code).toBe("42501");
    }
    expect((await adminClient().from("golden_samples").update({ state: "approved" }).eq("id", id)).error?.code).toBe("42501");
    expect((await adminClient().from("golden_samples").insert({ brand_id: annBrand, product_id: productId, run_id: runId, design_version: 1, factory_profile_id: "x", version: 9 })).error?.code).toBe("42501");
  });

  it("goes with its design: deleting the design removes the golden sample and its evidence", async () => {
    const { projectId, productId, runId } = await sampled(ann, annBrand);
    const id = await judged(ann, annBrand, productId, runId);
    must(await rpc("delete_project", { p_project_id: projectId, p_brand_id: annBrand, p_user_id: ann.userId }));
    expect(must(await adminClient().from("golden_samples").select("id").eq("id", id))).toEqual([]);
    expect(must(await adminClient().from("golden_sample_poms").select("id").eq("golden_sample_id", id))).toEqual([]);
    expect(must(await adminClient().from("golden_sample_photos").select("id").eq("golden_sample_id", id))).toEqual([]);
  });
});

describe("a make order", () => {
  it("sends a sample of at most three sizes, one piece each", async () => {
    const { productId, releaseId } = await sampled(ann, annBrand);
    const [sent] = must(await order(ann, annBrand, productId, releaseId, { p_sizes: { S: 1, M: 1, L: 1 } })) as { order_id: string; status: string; golden_sample_id: string | null }[];
    expect(sent).toMatchObject({ status: "submitted", golden_sample_id: null });
    expect(must(await ann.client.from("ops_orders").select("pieces").eq("id", sent!.order_id).single())).toEqual({ pieces: 3 });
    expect((await order(ann, annBrand, productId, releaseId, { p_sizes: { S: 1, M: 1, L: 1, XL: 1 } })).error?.hint).toBe("sample_sizes");
    expect((await order(ann, annBrand, productId, releaseId, { p_sizes: { S: 2 } })).error?.hint).toBe("invalid_sizes");
    expect((await order(ann, annBrand, productId, releaseId, { p_sizes: {} })).error?.hint).toBe("invalid_sizes");
  });

  it("refuses a run while no golden sample has been signed off for the version", async () => {
    const { productId, releaseId, runId } = await sampled(ann, annBrand);
    expect((await order(ann, annBrand, productId, releaseId, { p_kind: "run", p_sizes: { M: 60 } })).error?.hint).toBe("golden_sample_required");
    const id = await judged(ann, annBrand, productId, runId);
    // Being judged is not being signed off.
    expect((await order(ann, annBrand, productId, releaseId, { p_kind: "run", p_sizes: { M: 60 } })).error?.hint).toBe("golden_sample_required");
    must(await signOff(ann, annBrand, id));
    const [run] = must(await order(ann, annBrand, productId, releaseId, { p_kind: "run", p_sizes: { S: 20, M: 40 } })) as { order_id: string; golden_sample_id: string }[];
    expect(run!.golden_sample_id).toBe(id);
    expect(must(await ann.client.from("ops_orders").select("pieces, status").eq("id", run!.order_id).single())).toEqual({ pieces: 60, status: "submitted" });
  });

  it("refuses a run again once changes have been asked for", async () => {
    const { productId, releaseId, runId } = await sampled(ann, annBrand);
    const id = await judged(ann, annBrand, productId, runId);
    expect((await rpc("request_golden_sample_changes", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_notes: "" })).error?.hint).toBe("needs_notes");
    expect(must(await rpc("request_golden_sample_changes", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_notes: "The hem is short." }))).toBe("changes_requested");
    const row = must(await ann.client.from("golden_samples").select("state, notes, closed_at").eq("id", id).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ state: "changes_requested", notes: "The hem is short." });
    expect(row.closed_at).not.toBeNull();
    expect((await order(ann, annBrand, productId, releaseId, { p_kind: "run", p_sizes: { M: 60 } })).error?.hint).toBe("golden_sample_required");
    // A closed golden sample leaves the way clear for the next one.
    expect(typeof must(await rpc("start_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_product_id: productId, p_run_id: runId }))).toBe("string");
  });

  it("notes a Class B run outside 50 to 300 pieces rather than refusing it, and lets a Class A run be any quantity", async () => {
    const { productId, releaseId, runId } = await sampled(ann, annBrand);
    must(await signOff(ann, annBrand, await judged(ann, annBrand, productId, runId)));

    // The range is Knitwright's own draft programme, not a quantity any factory has refused, so the
    // run goes and carries the note (orchestrator decision, plan v5 wave 2).
    for (const pieces of [20, 301]) {
      const [sent] = must(await order(ann, annBrand, productId, releaseId, { p_kind: "run", p_sizes: { M: pieces } })) as { run_id: string }[];
      const row = must(await ann.client.from("brand_runs").select("pieces, flags").eq("id", sent!.run_id).single()) as { pieces: number; flags: { code: string; text: string }[] };
      expect(row.pieces).toBe(pieces);
      expect(row.flags.map((flag) => flag.code)).toContain("class_b_quantity");
      expect(row.flags.find((flag) => flag.code === "class_b_quantity")?.text).toContain("not a quantity a factory has refused");
    }

    const classA = await sampled(ann, annBrand, "football-shirt");
    must(await signOff(ann, annBrand, await judged(ann, annBrand, classA.productId, classA.runId)));
    const [run] = must(await order(ann, annBrand, classA.productId, classA.releaseId, { p_kind: "run", p_sizes: { M: 1 } })) as { order_id: string }[];
    expect(must(await ann.client.from("ops_orders").select("pieces").eq("id", run!.order_id).single())).toEqual({ pieces: 1 });
  });

  it("refuses a viewer and another brand, and cannot be run from a browser", async () => {
    const { productId, releaseId } = await sampled(ann, annBrand);
    expect((await order(viewer, annBrand, productId, releaseId)).error?.code).toBe("42501");
    expect((await order(ben, benBrand, productId, releaseId)).error?.code).toBe("P0002");
    expect((await ann.client.rpc("submit_make_order", {})).error).not.toBeNull();
    expect((await ann.client.rpc("start_golden_sample", {})).error).not.toBeNull();
  });
});

describe("carrying a sign-off forward", () => {
  it("covers a later version that differs only on the surface, and refuses one that does not", async () => {
    const { projectId, productId, runId } = await sampled(ann, annBrand);
    const id = await judged(ann, annBrand, productId, runId);
    must(await signOff(ann, annBrand, id));
    const laterRelease = await makeRelease(ann, annBrand, projectId, 2);
    expect((await order(ann, annBrand, productId, laterRelease, { p_kind: "run", p_sizes: { M: 60 } })).error?.hint).toBe("golden_sample_required");

    const carry = (fields: unknown) => rpc("carry_over_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_to_version: 2, p_changed_fields: fields, p_rule_id: "R-GAP-000" });
    expect((await carry([{ field: "fabrics", group: "structural" }])).error?.hint).toBe("not_surface_only");
    expect((await carry([{ field: "artwork", group: "surface" }, { field: "fabrics", group: "structural" }])).error?.hint).toBe("not_surface_only");
    expect((await carry([{ field: "", group: "surface" }])).error?.hint).toBe("not_surface_only");
    expect((await carry([])).error?.hint).toBe("invalid_fields");

    const carried = must(await carry([{ field: "artwork", group: "surface" }, { field: "colourways", group: "surface" }])) as string;
    expect(must(await carry([{ field: "artwork", group: "surface" }]))).toBe(carried);
    const row = must(await ann.client.from("golden_sample_carryovers").select("from_version, to_version, changed_fields").eq("id", carried).single()) as Record<string, unknown>;
    expect(row).toMatchObject({ from_version: 1, to_version: 2 });

    const [run] = must(await order(ann, annBrand, productId, laterRelease, { p_kind: "run", p_sizes: { M: 60 } })) as { golden_sample_id: string }[];
    expect(run!.golden_sample_id).toBe(id);
  });

  it("carries forward only a sign-off, and only forwards", async () => {
    const { productId, runId } = await sampled(ann, annBrand);
    const id = await judged(ann, annBrand, productId, runId);
    const carry = (toVersion: number) => rpc("carry_over_golden_sample", { p_brand_id: annBrand, p_user_id: ann.userId, p_golden_sample_id: id, p_to_version: toVersion, p_changed_fields: [{ field: "artwork", group: "surface" }], p_rule_id: "R-GAP-000" });
    expect((await carry(2)).error?.hint).toBe("not_signed_off");
    must(await signOff(ann, annBrand, id));
    expect((await carry(1)).error?.code).toBe("23514");
    expect(typeof must(await carry(3))).toBe("string");
  });

  it("is invisible to another brand", async () => {
    const { productId, runId } = await sampled(ann, annBrand);
    const id = await judged(ann, annBrand, productId, runId);
    expect(must(await ben.client.from("golden_samples").select("id").eq("id", id))).toEqual([]);
    expect(must(await ben.client.from("golden_sample_poms").select("id").eq("golden_sample_id", id))).toEqual([]);
    expect(must(await viewer.client.from("golden_samples").select("id").eq("id", id))).toHaveLength(1);
  });
});
