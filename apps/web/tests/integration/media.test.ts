import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { cleanPath } from "@/lib/media/paths";
import { mediaFiles, mediaStore } from "@/lib/media/service";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * Migration 20261027010000: media sets. A member reads their brand's sets and items and nothing else; no browser writes;
 * the history is append-only; a version has one set; the clean pictures sit where no member can read them.
 */

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;
let projectId: string;

const png = async (): Promise<Uint8Array> =>
  new Uint8Array(await sharp({ create: { width: 32, height: 32, channels: 3, background: "#336699" } }).png().toBuffer());

const project = async (brand: string, owner: Person): Promise<string> =>
  must(
    await adminClient().rpc("create_project", {
      p_brand_id: brand,
      p_user_id: owner.userId,
      p_name: "Media design",
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { seeded: true },
      p_schema_version: 1,
    }),
  ) as string;

const startSet = async (brand: string, owner: Person, version = 1) =>
  must(
    await adminClient().rpc("media_set_start", {
      p_brand_id: brand,
      p_project_id: projectId,
      p_user_id: owner.userId,
      p_version: version,
      p_version_hash: `hash-${projectId}-${version}`,
    }),
  ) as { id: string; created: boolean };

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("media-alice"), person("media-bob")]);
  [aliceBrand, bobBrand] = await Promise.all([brandOf(alice, "Alice Media"), brandOf(bob, "Bob Media")]);
  projectId = await project(aliceBrand, alice);
});

describe("media sets", () => {
  it("makes one set for a version and returns it the second time", async () => {
    const first = await startSet(aliceBrand, alice, 1);
    const second = await startSet(aliceBrand, alice, 1);
    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, created: false });
  });

  it("lets a member read their brand's set and nobody else's", async () => {
    const { id } = await startSet(aliceBrand, alice, 2);
    expect(must(await alice.client.from("media_sets").select("id").eq("id", id))).toHaveLength(1);
    expect(must(await bob.client.from("media_sets").select("id").eq("id", id))).toHaveLength(0);
    const { data } = await anonClient().from("media_sets").select("id").eq("id", id);
    expect(data ?? []).toHaveLength(0);
  });

  it("gives a browser no way to write a set, an item or a history line", async () => {
    const { id } = await startSet(aliceBrand, alice, 3);
    for (const table of ["media_sets", "media_items", "media_set_history"]) {
      const { error } = await alice.client.from(table).insert({ brand_id: aliceBrand, set_id: id });
      expect(error, table).not.toBeNull();
    }
    await alice.client.from("media_sets").update({ unlocked_at: new Date().toISOString() }).eq("id", id);
    expect(must(await adminClient().from("media_sets").select("unlocked_at").eq("id", id).single()).unlocked_at).toBeNull();
    for (const fn of ["media_set_start", "media_set_unlock"]) {
      const { error } = await alice.client.rpc(fn, { p_set_id: id, p_user_id: alice.userId });
      expect(error, fn).not.toBeNull();
    }
  });

  it("keeps an append-only history that shows the states in order", async () => {
    const { id } = await startSet(aliceBrand, alice, 4);
    const admin = adminClient();
    must(await admin.rpc("media_set_move", { p_set_id: id, p_from: ["queued"], p_to: "running" }));
    must(await admin.rpc("media_set_move", { p_set_id: id, p_from: ["running"], p_to: "succeeded" }));
    must(await admin.rpc("media_set_unlock", { p_set_id: id, p_user_id: alice.userId }));
    const history = must(await alice.client.from("media_set_history").select("status, seq").eq("set_id", id).order("seq"));
    expect(history.map((line) => line.status)).toEqual(["queued", "running", "succeeded", "unlocked"]);
    // The server's key holds only SELECT on the table, so a direct change answers "permission denied".
    const update = await admin.from("media_set_history").update({ note: "changed" }).eq("set_id", id);
    const remove = await admin.from("media_set_history").delete().eq("set_id", id);
    expect(update.error).not.toBeNull();
    expect(remove.error).not.toBeNull();
    expect(must(await admin.from("media_set_history").select("id").eq("set_id", id))).toHaveLength(4);
  });

  it("takes an item only while the set is running, and unlocks only a finished set, once", async () => {
    const { id } = await startSet(aliceBrand, alice, 5);
    const admin = adminClient();
    const put = () =>
      admin.rpc("media_item_put", { p_set_id: id, p_kind: "studio_render", p_view: "front", p_file_id: null, p_clean_path: cleanPath(aliceBrand, id, "studio_render", "front"), p_width: 32, p_height: 32, p_provider: "knitwright-flat", p_cost_microdollars: 0, p_verdict: "not_checked" });
    expect((await put()).error).not.toBeNull();
    must(await admin.rpc("media_set_move", { p_set_id: id, p_from: ["queued"], p_to: "running" }));
    must(await put());
    must(await put());
    expect(must(await alice.client.from("media_items").select("id").eq("set_id", id))).toHaveLength(1);
    expect(must(await admin.rpc("media_set_unlock", { p_set_id: id, p_user_id: alice.userId }))).toBe(false);
    must(await admin.rpc("media_set_move", { p_set_id: id, p_from: ["running"], p_to: "succeeded" }));
    expect(must(await admin.rpc("media_set_unlock", { p_set_id: id, p_user_id: alice.userId }))).toBe(true);
    expect(must(await admin.rpc("media_set_unlock", { p_set_id: id, p_user_id: alice.userId }))).toBe(false);
  });

  it("refuses a clean path inside a brand's own folder", async () => {
    const { id } = await startSet(aliceBrand, alice, 6);
    const admin = adminClient();
    must(await admin.rpc("media_set_move", { p_set_id: id, p_from: ["queued"], p_to: "running" }));
    const { error } = await admin.rpc("media_item_put", { p_set_id: id, p_kind: "studio_render", p_view: "front", p_file_id: null, p_clean_path: `${aliceBrand}/render/x.png`, p_width: 32, p_height: 32, p_provider: "p", p_cost_microdollars: 0, p_verdict: "not_checked" });
    expect(error).not.toBeNull();
  });

  it("starts a failed set again", async () => {
    const { id } = await startSet(aliceBrand, alice, 7);
    must(await adminClient().rpc("media_set_move", { p_set_id: id, p_from: ["queued"], p_to: "failed", p_error: "Could not." }));
    expect(await startSet(aliceBrand, alice, 7)).toEqual({ id, created: true });
  });
});

describe("clean pictures", () => {
  it("are written where no member can read them, and the server can", async () => {
    const { id } = await startSet(aliceBrand, alice, 8);
    const files = mediaFiles(adminClient(), alice.client, { brandId: aliceBrand, userId: alice.userId });
    const path = cleanPath(aliceBrand, id, "studio_render", "front");
    const bytes = await png();
    await files.saveClean(path, bytes);

    expect((await files.readClean(path))?.byteLength).toBe(bytes.byteLength);
    expect((await alice.client.storage.from("images").download(path)).error).not.toBeNull();
    expect((await bob.client.storage.from("images").download(path)).error).not.toBeNull();
    expect((await anonClient().storage.from("images").download(path)).error).not.toBeNull();
    // The reader refuses a path that is not this brand's private folder.
    const other = mediaFiles(adminClient(), bob.client, { brandId: bobBrand, userId: bob.userId });
    expect(await other.readClean(path)).toBeNull();
  });

  it("leave the watermarked picture readable by the brand's own members", async () => {
    const files = mediaFiles(adminClient(), alice.client, { brandId: aliceBrand, userId: alice.userId });
    const fileId = await files.saveWatermarked(await png());
    expect(await files.readWatermarked(fileId)).not.toBeNull();
    const theirs = mediaFiles(adminClient(), bob.client, { brandId: bobBrand, userId: bob.userId });
    expect(await theirs.readWatermarked(fileId)).toBeNull();
  });

  it("are removed with a failed set's other pictures", async () => {
    const files = mediaFiles(adminClient(), alice.client, { brandId: aliceBrand, userId: alice.userId });
    const path = `_private/${aliceBrand}/${randomUUID()}/studio_render-front.png`;
    await files.saveClean(path, await png());
    const fileId = await files.saveWatermarked(await png());
    await files.remove({ fileIds: [fileId], cleanPaths: [path] });
    expect(await files.readClean(path)).toBeNull();
    expect(await files.readWatermarked(fileId)).toBeNull();
  });
});

describe("the store", () => {
  it("reads a set with its items through the member's client and nobody else's", async () => {
    const admin = adminClient();
    const store = mediaStore(admin, alice.client);
    const started = await store.start({ brandId: aliceBrand, projectId, userId: alice.userId, version: 9, versionHash: `hash-${projectId}-9` });
    await store.move(started.id, ["queued"], "running");
    await store.putItem(started.id, { kind: "studio_render", view: "back", fileId: null, cleanPath: cleanPath(aliceBrand, started.id, "studio_render", "back"), width: 32, height: 32, checker: "not_checked", provider: "knitwright-flat", costMicrodollars: 0 });
    await store.move(started.id, ["running"], "succeeded");
    const read = await store.read(aliceBrand, projectId, started.id);
    expect(read).toMatchObject({ status: "succeeded", unlocked: false });
    expect(read?.items).toHaveLength(1);
    expect(await mediaStore(admin, bob.client).read(aliceBrand, projectId, started.id)).toBeNull();
    expect((await store.latest(aliceBrand, projectId))?.id).toBeTruthy();
    expect(await store.unlock(started.id, alice.userId)).toBe(true);
    expect((await store.read(aliceBrand, projectId, started.id))?.unlocked).toBe(true);
  });
});
