import { beforeEach, describe, expect, it } from "vitest";
import { createFakeAdmin, type FakeAdmin } from "@/lib/artwork-intake/fixtures/fake-admin";
import { logoOnWhite } from "@/lib/artwork-intake/fixtures/pictures";
import { uploadArtwork } from "@/lib/artwork-intake/service";
import { createMemoryStore } from "./fixtures/memory-store";
import { madeUpMark } from "./fixtures/pictures";
import type { UploadGate } from "./gate";
import { screenUpload } from "./hooks";
import { imageHash } from "./image-hash";
import { DEFAULT_SETTINGS } from "./settings";
import type { Mark } from "./types";
import { createStubVisionCheck } from "./vision";

/**
 * The one place moderation is wired into existing code (plan v5 X8, task 4): the artwork upload. The gate runs before the file
 * is stored, so a blocked upload leaves nothing behind, and the result is kept against the asset once it has an id.
 */
const BRAND = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const actor = { brandId: BRAND, userId: USER };
const NOW = new Date("2026-11-01T10:00:00Z");

let fake: FakeAdmin;
beforeEach(() => {
  fake = createFakeAdmin();
});

const gateOf = (marks: readonly Mark[] = []) => {
  const memory = createMemoryStore(marks);
  const deps = { store: memory.store, vision: createStubVisionCheck(), settings: DEFAULT_SETTINGS };
  const gate: UploadGate = (input) => screenUpload(deps, input);
  return { ...memory, gate };
};

const upload = (bytes: Uint8Array, fileName: string, gate?: UploadGate) =>
  uploadArtwork(fake.admin, actor, { bytes, fileName, rightsConfirmed: true, now: NOW }, gate);

describe("the artwork upload path", () => {
  it("keeps a clear result against the stored artwork, with the source file's checksum", async () => {
    const { gate, checks } = gateOf();
    const record = await upload(await logoOnWhite(), "club-crest.png", gate);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ brandId: BRAND, userId: USER, targetKind: "asset", targetId: record.id, hook: "upload", label: "club-crest" });
    expect(checks[0]!.subjectSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(checks[0]!.verdict.result).toBe("clear");
  });

  it("refuses a picture of a registered mark and stores nothing at all", async () => {
    const registered = await imageHash(await madeUpMark());
    const { gate, checks } = gateOf([{ id: "m", holder: "Made Up Ltd", markText: null, imageHash: registered }]);
    await expect(upload(await madeUpMark(160), "crest.png", gate)).rejects.toMatchObject({ code: "invalid_input" });
    expect(fake.objects.size).toBe(0);
    expect(fake.tables.files).toHaveLength(0);
    expect(fake.tables.user_artworks).toHaveLength(0);
    // The refusal is still on the record, with no asset to point at.
    expect(checks[0]).toMatchObject({ targetId: null, verdict: { result: "blocked" } });
  });

  it("stores a flagged upload and leaves it for the review queue", async () => {
    const { gate, checks } = gateOf([{ id: "n", holder: "Nike, Inc.", markText: "Nike", imageHash: null }]);
    const record = await upload(await logoOnWhite(), "nike swoosh.png", gate);
    expect(fake.tables.user_artworks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ targetId: record.id, verdict: { result: "flagged" } });
  });

  it("still uploads where no gate is passed, so the rest of the app is unchanged until it is wired", async () => {
    const record = await upload(await logoOnWhite(), "crest.png");
    expect(record.id).toBeTruthy();
  });
});
