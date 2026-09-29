import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { createSpec } from "@/lib/garment";
import {
  createProject,
  currentVersion,
  getProject,
  restoreVersion,
  saveAction,
  saveTrustedAction,
} from "@/lib/projects/service";
import { storeImage, type ImageKind } from "@/lib/storage/store";
import { adminClient, brandOf, must, person, type Person } from "./support";

const NO_FILE = "That file does not exist.";

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const picture = () => sharp({ create: { width: 16, height: 8, channels: 3, background: "#2b46f0" } }).png().toBuffer();

const file = async (owner: Person, brandId: string, kind: ImageKind = "artwork"): Promise<string> =>
  (await storeImage({ admin: adminClient(), brandId, userId: owner.userId, kind, bytes: await picture(), statedType: "image/png" })).id;

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("art-alice"), person("art-bob")]);
  aliceBrand = await brandOf(alice, "Alice Art");
  bobBrand = await brandOf(bob, "Bob Art");
});

const design = (): Promise<string> =>
  createProject(adminClient(), {
    brandId: aliceBrand,
    userId: alice.userId,
    name: "Artwork test",
    styleNumber: "",
    season: "",
    typeId: "crew-tee",
    wearer: "women",
  });

const artwork = (fileId: string, id = "logo-1") => ({
  id,
  name: "Club badge",
  source: { kind: "file" as const, fileId },
  panelId: "body-front",
  anchor: "centre-chest",
  offsetX: 0,
  offsetY: 0,
  width: 800,
  height: 400,
  rotationDegrees: 0,
  technique: "screen-print" as const,
});

const send = (projectId: string, expectedVersion: number, action: unknown) =>
  saveAction(adminClient(), alice.client, { brandId: aliceBrand, userId: alice.userId, projectId, expectedVersion, action });

describe("artwork that refers to a file", () => {
  it("is stored when the file is an artwork file of the active brand", async () => {
    const id = await design();
    const own = await file(alice, aliceBrand);
    const outcome = await send(id, 1, { type: "add-artwork", artwork: artwork(own) });
    expect(outcome.ok).toBe(true);
    expect(await currentVersion(alice.client, aliceBrand, id)).toBe(2);
  });

  it("is refused, and nothing is stored, when the file belongs to another brand", async () => {
    const id = await design();
    const theirs = await file(bob, bobBrand);
    const outcome = await send(id, 1, { type: "add-artwork", artwork: artwork(theirs) });
    expect(outcome).toEqual({ ok: false, reason: NO_FILE });
    expect(await currentVersion(alice.client, aliceBrand, id)).toBe(1);
    expect((await getProject(alice.client, aliceBrand, id)).spec.artwork).toEqual([]);
  });

  it("is refused for a file that does not exist, and for a file of the wrong kind", async () => {
    const id = await design();
    expect(await send(id, 1, { type: "add-artwork", artwork: artwork(randomUUID()) })).toEqual({ ok: false, reason: NO_FILE });
    const sketch = await file(alice, aliceBrand, "sketch");
    expect(await send(id, 1, { type: "add-artwork", artwork: artwork(sketch) })).toEqual({ ok: false, reason: NO_FILE });
    expect(await currentVersion(alice.client, aliceBrand, id)).toBe(1);
  });

  it("is refused when an update points existing artwork at another brand's file", async () => {
    const id = await design();
    const own = await file(alice, aliceBrand);
    await send(id, 1, { type: "add-artwork", artwork: artwork(own) });
    const theirs = await file(bob, bobBrand);
    const outcome = await send(id, 2, { type: "update-artwork", artwork: artwork(theirs) });
    expect(outcome).toEqual({ ok: false, reason: NO_FILE });
    expect(await currentVersion(alice.client, aliceBrand, id)).toBe(2);
  });

  it("is checked on the trusted path as well, which every writer of a design shares", async () => {
    const id = await design();
    const theirs = await file(bob, bobBrand);
    const outcome = await saveTrustedAction(adminClient(), alice.client, {
      brandId: aliceBrand,
      userId: alice.userId,
      projectId: id,
      expectedVersion: 1,
      action: { type: "add-artwork", artwork: { ...artwork(theirs), provenance: "user-edited" } },
    });
    expect(outcome).toEqual({ ok: false, reason: NO_FILE });
  });

  it("leaves text artwork and a change to something else alone", async () => {
    const id = await design();
    const text = { ...artwork("x"), source: { kind: "text", text: "HOME" } };
    expect((await send(id, 1, { type: "add-artwork", artwork: text })).ok).toBe(true);
    expect((await send(id, 2, { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "user-edited" })).ok).toBe(true);
  });
});

describe("a design that already holds artwork whose file the brand cannot read", () => {
  const withForeignFile = async (): Promise<{ id: string; ownFile: string }> => {
    const id = await design();
    const ownFile = await file(alice, aliceBrand);
    const theirs = await file(bob, bobBrand);
    const made = createSpec("crew-tee", "women");
    if (!made.ok) throw new Error(made.reason);
    const spec = {
      ...made.spec,
      artwork: [
        { ...artwork(ownFile, "kept"), provenance: "user-edited" },
        { ...artwork(theirs, "foreign"), name: "Their logo", provenance: "user-edited" },
      ],
    };
    must(
      await adminClient().rpc("append_spec_version", {
        p_project_id: id,
        p_user_id: alice.userId,
        p_expected_version: 1,
        p_spec: spec,
        p_schema_version: spec.schemaVersion,
        p_note: "Saved before the check existed.",
        p_restored_from: null,
      }),
    );
    return { id, ownFile };
  };

  it("drops that artwork when the design is opened, keeps the rest, and says so", async () => {
    const { id, ownFile } = await withForeignFile();
    const project = await getProject(alice.client, aliceBrand, id);
    expect(project.spec.artwork.map((item) => item.id)).toEqual(["kept"]);
    expect(project.spec.artwork[0]?.source).toEqual({ kind: "file", fileId: ownFile });
    expect(project.dropped).toEqual([
      { kind: "artwork", id: "foreign", message: "Their logo was removed, because its picture could not be found." },
    ]);
  });

  it("does not store it again when the next change is saved, or when this version is restored", async () => {
    const { id } = await withForeignFile();
    const outcome = await send(id, 2, { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "user-edited" });
    if (!outcome.ok) throw new Error(outcome.reason);
    expect(outcome.spec.artwork.map((item) => item.id)).toEqual(["kept"]);
    expect(outcome.dropped.map((item) => item.id)).toEqual(["foreign"]);
    const restored = await restoreVersion(adminClient(), alice.client, { brandId: aliceBrand, userId: alice.userId, projectId: id, expectedVersion: 3, version: 2 });
    if (!restored.ok) throw new Error(restored.reason);
    expect(restored.spec.artwork.map((item) => item.id)).toEqual(["kept"]);
  });
});
