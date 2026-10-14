import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createArtworkAssetReader } from "./asset-reader";
import { createFakeSupabase } from "./fixtures/fake-supabase";
import { svgOf } from "./fixtures/svgs";
import { deleteArtworkRow, getArtworkRow, insertArtworkRow, listArtworks, type NewArtworkRow } from "./records";
import { withConversionSlot } from "./gate";
import * as library from "./index";
import { intakeVector } from "./vector";
import { REFUSALS } from "./vector/refuse";

const BRAND = "11111111-1111-4111-8111-111111111111";
const failing = (message: string) => {
  const result = { data: null, error: { message } };
  const builder: Record<string, unknown> = {};
  for (const name of ["select", "insert", "delete", "eq", "in", "order", "limit"]) builder[name] = () => builder;
  builder.maybeSingle = () => Promise.resolve(result);
  builder.single = () => Promise.resolve(result);
  builder.then = (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok);
  return { from: () => builder } as never;
};

describe("when the database fails", () => {
  it("says what could not be done, and keeps the cause", async () => {
    await expect(listArtworks(failing("down"), BRAND)).rejects.toThrow("could not be read");
    await expect(getArtworkRow(failing("down"), BRAND, "11111111-1111-4111-8111-111111111111")).rejects.toThrow("could not be read");
    await expect(insertArtworkRow(failing("down"), BRAND, {} as NewArtworkRow)).rejects.toThrow("record could not be written");
    await expect(deleteArtworkRow(failing("down"), BRAND, "x")).rejects.toThrow("could not be removed");
  });

  it("gives no asset when the lookup itself fails", async () => {
    expect(await createArtworkAssetReader(failing("down"), BRAND).getAsset("11111111-1111-4111-8111-111111111111")).toBeNull();
  });
});

describe("the conversion gate", () => {
  it("counts several at once and frees each as it ends, even when the work fails", async () => {
    const done: (() => void)[] = [];
    const hold = () => new Promise<void>((resolve) => done.push(resolve));
    const a = withConversionSlot("b1", hold, 2);
    const b = withConversionSlot("b1", hold, 2);
    await expect(withConversionSlot("b1", async () => 0, 2)).rejects.toMatchObject({ code: "rate_limited" });
    done[0]();
    await a;
    await expect(withConversionSlot("b1", async () => 5, 2)).resolves.toBe(5);
    done[1]();
    await b;
    await expect(
      withConversionSlot("b1", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(withConversionSlot("b1", async () => 6)).resolves.toBe(6);
  });
});

describe("pictures inside a vector file", () => {
  const embed = (data: string, attrs = 'width="10" height="10"') => svgOf(`<image ${attrs} href="data:image/png;base64,${data}"/><rect width="2" height="2"/>`);
  const text = (value: string) => new TextEncoder().encode(value);

  it("reads a JPEG and keeps it as PNG, fitted inside its box", async () => {
    const jpeg = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#336699" } }).jpeg().toBuffer();
    const file = svgOf(`<image x="0" y="0" width="20" height="20" href="data:image/jpeg;base64,${jpeg.toString("base64")}"/>`);
    const { doc } = await intakeVector(text(file), "svg");
    expect(doc.nodes[0]).toMatchObject({ t: "image", x: 0, y: 5, width: 20, height: 10 });
  });

  it("reads a picture of its own size when only one side is given", async () => {
    const png = await sharp({ create: { width: 30, height: 10, channels: 3, background: "#aa0000" } }).png().toBuffer();
    const { doc } = await intakeVector(text(svgOf(`<image width="30" href="data:image/png;base64,${png.toString("base64")}"/>`)), "svg");
    expect(doc.nodes[0]).toMatchObject({ t: "image", width: 30, height: 10 });
  });

  it("refuses a picture that is not one, one that is too large to open, and one that is cut short", async () => {
    await expect(intakeVector(text(embed(Buffer.from("not a picture").toString("base64"))), "svg")).rejects.toThrow("could not be read");
    const huge = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAJxAAACcQCAIAAADRwMiaAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    );
    await expect(intakeVector(text(embed(huge.toString("base64"))), "svg")).rejects.toThrow();
    const part = (await sharp({ create: { width: 50, height: 50, channels: 3, background: "#123456" } }).png().toBuffer()).subarray(0, 60);
    await expect(intakeVector(text(embed(part.toString("base64"))), "svg")).rejects.toThrow();
  });

  it("refuses a picture whose encoded text is far too long", async () => {
    await expect(intakeVector(text(embed("A".repeat(12 * 1024 * 1024))), "svg")).rejects.toThrow(/too large/);
  });
});

describe("the vector reader's limits", () => {
  it("refuses a model whose JSON would be too large", async () => {
    const rows = Array.from({ length: 20000 }, (_, i) => `<path d="M${i % 99}.123 ${i % 49}.456 L${(i * 7) % 99}.789 ${(i * 3) % 49}.321 L${(i * 5) % 99}.111 ${(i * 11) % 49}.222 Z" fill="#${(i * 40503).toString(16).padStart(6, "0").slice(-6)}"/>`).join("");
    const result = await intakeVector(new TextEncoder().encode(svgOf(rows)), "svg").catch((error: Error) => error);
    expect(result instanceof Error ? result.message : "ok").toMatch(new RegExp(`${REFUSALS.tooComplex.slice(0, 20)}|too large`));
  });
});

describe("the library's front door", () => {
  it("offers the reader, the resolution check, the tile tools and the vector model", () => {
    expect(Object.keys(library).sort()).toEqual(
      ["ARTWORK_LIMITS", "MINIMUM_DPI_LABEL", "artworkRowSchema", "checkStackImages", "createArtworkAssetReader", "dpiCheck", "effectiveDpi", "largestWidthMm", "tile", "vectorDocSchema", "vectorToSvg"].sort(),
    );
    expect(library.ARTWORK_LIMITS.minDpi).toBe(150);
  });

  it("keeps the fake database honest about what a bucket takes", async () => {
    const fake = createFakeSupabase();
    const { error } = await fake.client.storage.from("exports").upload("a.svg", new Uint8Array(1), { contentType: "image/svg+xml" });
    expect(error).not.toBeNull();
  });
});
