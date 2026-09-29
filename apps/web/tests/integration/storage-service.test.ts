import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { createDownloadLink, LINK_LIFETIME_SECONDS } from "@/lib/storage/links";
import { storeImage } from "@/lib/storage/store";
import { adminClient, brandOf, must, person, type Person } from "./support";

const failureOf = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

const logo = () =>
  sharp({ create: { width: 64, height: 32, channels: 4, background: "#2b46f0" } })
    .png()
    .withExif({ IFD0: { Copyright: "SecretOwner" } })
    .toBuffer();

let alice: Person;
let bob: Person;
let aliceBrand: string;
let bobBrand: string;

const store = async (owner: Person, brandId: string, bytes: Uint8Array, type = "image/png") =>
  storeImage({
    admin: adminClient(),
    brandId,
    userId: owner.userId,
    kind: "artwork",
    bytes,
    statedType: type,
  });

beforeAll(async () => {
  [alice, bob] = await Promise.all([person("alice"), person("bob")]);
  aliceBrand = await brandOf(alice, "Alice Athletic");
  bobBrand = await brandOf(bob, "Bob's Boots");
});

describe("storeImage", () => {
  it("stores the checked image in the brand's own folder and records it", async () => {
    const file = await store(alice, aliceBrand, await logo());

    expect(file).toMatchObject({
      brandId: aliceBrand,
      kind: "artwork",
      contentType: "image/png",
      width: 64,
      height: 32,
    });
    const [row] = must(await adminClient().from("files").select("*").eq("id", file.id));
    expect(row).toMatchObject({
      brand_id: aliceBrand,
      bucket: "uploads",
      created_by: alice.userId,
      path: `${aliceBrand}/artwork/${file.id}.png`,
    });
  });

  it("stores what the check produced, not what was sent", async () => {
    const sent = await logo();

    const file = await store(alice, aliceBrand, sent);

    const [row] = must(await adminClient().from("files").select("path").eq("id", file.id));
    const stored = must(await adminClient().storage.from("uploads").download(row.path));
    const bytes = Buffer.from(await stored.arrayBuffer());
    expect(bytes.includes(Buffer.from("SecretOwner"))).toBe(false);
    expect((await sharp(bytes).metadata()).exif).toBeUndefined();
  });

  it("refuses a file that is not an image, and stores nothing", async () => {
    const before = must(await adminClient().from("files").select("id").eq("brand_id", bobBrand));

    const failure = await failureOf(
      store(bob, bobBrand, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/png"),
    );

    expect(failure.code).toBe("invalid_input");
    expect(must(await adminClient().from("files").select("id").eq("brand_id", bobBrand))).toEqual(
      before,
    );
  });

  it("leaves no file behind when the record cannot be written", async () => {
    const missingBrand = "00000000-0000-4000-8000-000000000000";

    await expect(store(alice, missingBrand, await logo())).rejects.toThrow();

    const { data } = await adminClient().storage.from("uploads").list(`${missingBrand}/artwork`);
    expect(data ?? []).toEqual([]);
  });
});

describe("createDownloadLink", () => {
  it("gives a member a link that works", async () => {
    const file = await store(alice, aliceBrand, await logo());

    const link = await createDownloadLink(alice.client, aliceBrand, file.id);

    expect(link.expiresInSeconds).toBe(LINK_LIFETIME_SECONDS);
    const response = await fetch(link.url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("gives a link that lives 60 seconds", async () => {
    const file = await store(alice, aliceBrand, await logo());

    const { url } = await createDownloadLink(alice.client, aliceBrand, file.id);

    const token = new URL(url).searchParams.get("token") ?? "";
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    expect(LINK_LIFETIME_SECONDS).toBe(60);
    expect(claims.exp - claims.iat).toBe(60);
  });

  it("gives no link to a member of another brand", async () => {
    const file = await store(alice, aliceBrand, await logo());

    const asOwnBrand = await failureOf(createDownloadLink(bob.client, bobBrand, file.id));
    const claimingTheirs = await failureOf(createDownloadLink(bob.client, aliceBrand, file.id));

    expect(asOwnBrand.code).toBe("not_found");
    expect(claimingTheirs.code).toBe("not_found");
  });

  it("gives no link for a file of another of the user's own brands", async () => {
    // The link is for the brand the user is working in, not for any brand they belong to.
    const second = await brandOf(alice, "Alice Second");
    const file = await store(alice, second, await logo());

    const failure = await failureOf(createDownloadLink(alice.client, aliceBrand, file.id));

    expect(failure.code).toBe("not_found");
  });

  it("answers the same for a file that does not exist and an id that is not an id", async () => {
    const missing = await failureOf(
      createDownloadLink(alice.client, aliceBrand, "00000000-0000-4000-8000-000000000000"),
    );
    const malformed = await failureOf(createDownloadLink(alice.client, aliceBrand, "../etc"));

    expect(missing.code).toBe("not_found");
    expect(malformed.message).toBe(missing.message);
  });
});
