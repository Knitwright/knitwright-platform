import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { LOGO_RIGHTS } from "@/lib/consent/wording";
import { logoRightsFor } from "@/lib/storage/rights";
import { storeImage } from "@/lib/storage/store";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * Logo rights (decision 0025; guide p.14): artwork is stored with who confirmed they may use
 * it, when, and the version of the words they saw. The upload route refuses artwork without it
 * (lib/storage/rights.ts); the database keeps the record consistent.
 */

const logo = () => sharp({ create: { width: 16, height: 16, channels: 4, background: "#123456" } }).png().toBuffer();

let owner: Person;
let brand: string;

beforeAll(async () => {
  owner = await person("logo-rights");
  brand = await brandOf(owner, "Rights FC");
});

const row = (overrides: Record<string, unknown>) => ({
  brand_id: brand,
  bucket: "uploads",
  path: `${brand}/artwork/${randomUUID()}.png`,
  kind: "artwork",
  content_type: "image/png",
  bytes: 10,
  created_by: owner.userId,
  ...overrides,
});

describe("logo rights on a stored file", () => {
  it("are kept with artwork: who, when and which words", async () => {
    const check = logoRightsFor({ kind: "artwork", confirmed: true, userId: owner.userId, now: new Date("2026-10-11T09:00:00Z") });
    if (!check.ok) throw new Error("expected rights");

    const file = await storeImage({ admin: adminClient(), brandId: brand, userId: owner.userId, kind: "artwork", bytes: await logo(), statedType: "image/png", rights: check.rights });

    const [stored] = must(await adminClient().from("files").select("rights_confirmed_by, rights_confirmed_at, rights_wording_version").eq("id", file.id));
    expect(stored).toEqual({
      rights_confirmed_by: owner.userId,
      rights_confirmed_at: "2026-10-11T09:00:00+00:00",
      rights_wording_version: LOGO_RIGHTS.version,
    });
  });

  it("are not asked of a sketch, and a sketch cannot carry them", async () => {
    const file = await storeImage({ admin: adminClient(), brandId: brand, userId: owner.userId, kind: "sketch", bytes: await logo(), statedType: "image/png" });
    const [stored] = must(await adminClient().from("files").select("rights_confirmed_at").eq("id", file.id));
    expect(stored).toEqual({ rights_confirmed_at: null });

    const refused = await adminClient()
      .from("files")
      .insert(row({ kind: "sketch", path: `${brand}/sketch/${randomUUID()}.png`, rights_confirmed_at: new Date().toISOString(), rights_wording_version: LOGO_RIGHTS.version }));
    expect(refused.error).not.toBeNull();
  });

  it("must name the words with the time, and only logo-rights words", async () => {
    const now = new Date().toISOString();
    expect((await adminClient().from("files").insert(row({ rights_confirmed_at: now }))).error).not.toBeNull();
    expect((await adminClient().from("files").insert(row({ rights_wording_version: LOGO_RIGHTS.version }))).error).not.toBeNull();
    expect((await adminClient().from("files").insert(row({ rights_confirmed_at: now, rights_wording_version: "marketing-email-v1" }))).error).not.toBeNull();
    expect((await adminClient().from("files").insert(row({ rights_confirmed_at: now, rights_wording_version: "logo-rights-v999" }))).error).not.toBeNull();
  });

  it("cannot be written by a browser", async () => {
    const { error } = await owner.client.from("files").insert(row({ rights_confirmed_at: new Date().toISOString(), rights_wording_version: LOGO_RIGHTS.version }));
    expect(error).not.toBeNull();
  });
});
