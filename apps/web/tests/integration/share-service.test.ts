import { beforeAll, describe, expect, it } from "vitest";
import {
  createShareLink,
  listShareLinks,
  moveShareLink,
  openShare,
  respondToShare,
  revokeShareLink,
} from "@/lib/share/service";
import { newShareToken, newVisitorKey } from "@/lib/share/token";
import { adminClient, brandOf, must, person, type Person } from "./support";

/** lib/share/service.ts against local Supabase. Decision 0026. */

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const project = async (brandId: string, owner: Person): Promise<string> =>
  must(
    await adminClient().rpc("create_project", {
      p_brand_id: brandId,
      p_user_id: owner.userId,
      p_name: "Away kit",
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { made: "for the test" },
      p_schema_version: 1,
    }),
  ) as string;

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("share-svc-alice"), person("share-svc-bob")]);
  aliceBrand = await brandOf(alice, "Alice Rugby");
  bobBrand = await brandOf(bob, "Bob Cricket");
});

describe("the share service", () => {
  it("makes a link, opens it with its token, keeps answers and lists them for the member", async () => {
    const id = await project(aliceBrand, alice);
    const link = await createShareLink(adminClient(), { projectId: id, userId: alice.userId, days: 30 });

    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(link.version).toBe(1);

    const opened = await openShare(adminClient(), link.token);
    expect(opened).toMatchObject({ linkId: link.id, brandId: aliceBrand, brandName: "Alice Rugby", projectName: "Away kit", version: 1, isCurrent: true });

    const visitor = newVisitorKey();
    await respondToShare(adminClient(), { token: link.token, visitorKey: visitor, name: "Jo", vote: "yes", comment: null });
    await respondToShare(adminClient(), { token: link.token, visitorKey: visitor, name: "Jo", vote: null, comment: "Love it" });
    await respondToShare(adminClient(), { token: link.token, visitorKey: newVisitorKey(), name: "Max", vote: "not_yet", comment: null });

    const listed = await listShareLinks(alice.client, aliceBrand, id);
    expect(listed.links).toEqual([{ id: link.id, version: 1, createdAt: expect.any(String), expiresAt: link.expiresAt, revokedAt: null }]);
    expect(listed.answers).toHaveLength(2);
    expect(listed.answers).toContainEqual(expect.objectContaining({ linkId: link.id, name: "Jo", vote: "yes", comment: "Love it" }));
  });

  it("lists nothing of another brand's design", async () => {
    const theirs = await project(bobBrand, bob);
    await createShareLink(adminClient(), { projectId: theirs, userId: bob.userId, days: 7 });

    expect(await listShareLinks(alice.client, aliceBrand, theirs)).toEqual({ links: [], answers: [] });
    expect(await listShareLinks(alice.client, bobBrand, theirs)).toEqual({ links: [], answers: [] });
  });

  it("refuses to make a link to another brand's design, with the answer for a missing one", async () => {
    const theirs = await project(bobBrand, bob);

    await expect(createShareLink(adminClient(), { projectId: theirs, userId: alice.userId, days: 30 })).rejects.toMatchObject({
      code: "not_found",
      message: "That design does not exist.",
    });
  });

  it("moves a link to the newest version, and once revoked the token opens nothing and takes no answer", async () => {
    const id = await project(aliceBrand, alice);
    const link = await createShareLink(adminClient(), { projectId: id, userId: alice.userId, days: 90 });
    must(
      await adminClient().rpc("append_spec_version", {
        p_project_id: id,
        p_user_id: alice.userId,
        p_expected_version: 1,
        p_spec: { made: "again" },
        p_schema_version: 1,
        p_note: "Changed.",
        p_restored_from: null,
      }),
    );

    expect(await moveShareLink(adminClient(), { linkId: link.id, userId: alice.userId })).toBe(2);
    await revokeShareLink(adminClient(), { linkId: link.id, userId: alice.userId });

    expect(await openShare(adminClient(), link.token)).toBeNull();
    expect(await openShare(adminClient(), newShareToken())).toBeNull();
    await expect(
      respondToShare(adminClient(), { token: link.token, visitorKey: newVisitorKey(), name: "Jo", vote: "yes", comment: null }),
    ).rejects.toMatchObject({ code: "not_found", message: "That link does not exist." });
    await expect(moveShareLink(adminClient(), { linkId: link.id, userId: alice.userId })).rejects.toMatchObject({ code: "conflict" });
    await expect(revokeShareLink(adminClient(), { linkId: link.id, userId: bob.userId })).rejects.toMatchObject({ code: "not_found" });
  });
});
