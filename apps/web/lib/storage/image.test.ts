import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { checkImage, IMAGE_LIMITS } from "./image";

type Solid = Readonly<{
  width?: number;
  height?: number;
  alpha?: number;
  channels?: 3 | 4;
}>;

const solid = ({ width = 40, height = 20, alpha = 1, channels = 3 }: Solid = {}) =>
  sharp({
    create: {
      width,
      height,
      channels,
      background: channels === 4 ? { r: 200, g: 30, b: 30, alpha } : { r: 200, g: 30, b: 30 },
    },
  });

const png = (options?: Solid) => solid(options).png().toBuffer();
const jpeg = (options?: Solid) => solid(options).jpeg().toBuffer();

const failureOf = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the image to be refused.");
};

describe("checkImage, what it accepts", () => {
  it("accepts a PNG, a JPEG and a WebP image", async () => {
    const webp = await solid().webp().toBuffer();

    await expect(checkImage(await png(), "image/png")).resolves.toBeDefined();
    await expect(checkImage(await jpeg(), "image/jpeg")).resolves.toBeDefined();
    await expect(checkImage(webp, "image/webp")).resolves.toBeDefined();
  });

  it("reports the size of the stored image", async () => {
    const image = await checkImage(await png({ width: 40, height: 20 }), "image/png");

    expect(image).toMatchObject({ width: 40, height: 20 });
    expect(image.bytes.byteLength).toBeGreaterThan(0);
  });

  it("stores a JPEG as JPEG", async () => {
    const image = await checkImage(await jpeg(), "image/jpeg");

    expect(image.contentType).toBe("image/jpeg");
    expect(image.extension).toBe("jpg");
    expect((await sharp(image.bytes).metadata()).format).toBe("jpeg");
  });

  it("stores a PNG as PNG, so the flat colours of a logo stay exact", async () => {
    const image = await checkImage(await png(), "image/png");

    expect(image.contentType).toBe("image/png");
    expect(image.extension).toBe("png");
    const { data } = await sharp(image.bytes).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([200, 30, 30]);
  });

  it("keeps the transparency of a PNG", async () => {
    const image = await checkImage(await png({ channels: 4, alpha: 0.5 }), "image/png");

    const stored = await sharp(image.bytes).metadata();
    expect(stored.format).toBe("png");
    expect(stored.hasAlpha).toBe(true);
  });

  it("stores a WebP image in a format the PDF export can draw", async () => {
    const opaque = await solid().webp().toBuffer();
    const seeThrough = await solid({ channels: 4, alpha: 0.5 }).webp().toBuffer();

    expect((await checkImage(opaque, "image/webp")).contentType).toBe("image/jpeg");
    expect((await checkImage(seeThrough, "image/webp")).contentType).toBe("image/png");
  });

  it("goes by the content, not by the type the browser stated", async () => {
    const image = await checkImage(await png({ channels: 4, alpha: 0.5 }), "image/jpeg");

    expect(image.contentType).toBe("image/png");
  });
});

describe("checkImage, what it removes", () => {
  it("removes camera and location details", async () => {
    const withDetails = await solid()
      .jpeg()
      .withExif({ IFD0: { Make: "SecretCam", Copyright: "Someone" } })
      .toBuffer();
    expect((await sharp(withDetails).metadata()).exif).toBeDefined();

    const image = await checkImage(withDetails, "image/jpeg");

    expect((await sharp(image.bytes).metadata()).exif).toBeUndefined();
    expect(image.bytes.includes(Buffer.from("SecretCam"))).toBe(false);
  });

  it("drops anything appended after the image", async () => {
    const payload = Buffer.from("<script>alert('x')</script>");
    const polyglot = Buffer.concat([await png(), payload]);

    const image = await checkImage(polyglot, "image/png");

    expect(image.bytes.includes(payload)).toBe(false);
  });

  it("turns the image the way the camera meant, then forgets the instruction", async () => {
    // Orientation 6 means "rotate a quarter turn to show": 40 by 20 becomes 20 by 40.
    const sideways = await solid({ width: 40, height: 20 })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const image = await checkImage(sideways, "image/jpeg");

    expect(image).toMatchObject({ width: 20, height: 40 });
    expect((await sharp(image.bytes).metadata()).orientation).toBeUndefined();
  });

  it("makes a large image smaller and keeps its proportions", async () => {
    const large = await png({ width: 4000, height: 1000 });

    const image = await checkImage(large, "image/png");

    expect(image.width).toBe(IMAGE_LIMITS.maxEdge);
    expect(image.height).toBe(IMAGE_LIMITS.maxEdge / 4);
  });

  it("does not enlarge a small image", async () => {
    const image = await checkImage(await png({ width: 10, height: 10 }), "image/png");

    expect(image).toMatchObject({ width: 10, height: 10 });
  });
});

describe("checkImage, what it refuses", () => {
  it("refuses an SVG drawing, which can carry scripts", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );

    const failure = await failureOf(checkImage(svg, "image/svg+xml"));

    expect(failure.code).toBe("invalid_input");
    expect(failure.message).toBe("Upload a PNG, JPEG or WebP image.");
  });

  it("refuses an SVG drawing that claims to be a PNG", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    expect((await failureOf(checkImage(svg, "image/png"))).code).toBe("invalid_input");
  });

  it("refuses a real image sent under a type that is not allowed", async () => {
    expect((await failureOf(checkImage(await png(), "image/svg+xml"))).code).toBe(
      "invalid_input",
    );
    expect((await failureOf(checkImage(await png(), "text/html"))).code).toBe("invalid_input");
  });

  it("refuses a GIF, an HTML page and a PDF", async () => {
    const gif = await solid().gif().toBuffer();

    expect((await failureOf(checkImage(gif, "image/gif"))).code).toBe("invalid_input");
    expect(
      (await failureOf(checkImage(Buffer.from("<html></html>"), "image/png"))).code,
    ).toBe("invalid_input");
    expect(
      (await failureOf(checkImage(Buffer.from("%PDF-1.7 ..."), "image/png"))).code,
    ).toBe("invalid_input");
  });

  it("refuses a file that starts like a PNG but is not one", async () => {
    const fake = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("not really an image"),
    ]);

    const failure = await failureOf(checkImage(fake, "image/png"));

    expect(failure.code).toBe("invalid_input");
    expect(failure.message).toBe("That file could not be read as an image.");
  });

  it("refuses an empty file", async () => {
    expect((await failureOf(checkImage(Buffer.alloc(0), "image/png"))).code).toBe(
      "invalid_input",
    );
  });

  it("refuses a file over the size limit before trying to read it", async () => {
    const tooBig = Buffer.alloc(IMAGE_LIMITS.maxBytes + 1, 1);

    const failure = await failureOf(checkImage(tooBig, "image/png"));

    expect(failure.code).toBe("too_large");
    expect(failure.message).toBe("Images can be 8 MB at most.");
  });

  it("refuses an image with more pixels than the limit, however small the file", async () => {
    // A solid colour compresses to almost nothing, so the file is small.
    const bomb = await png({ width: 8000, height: 6000 });
    expect(bomb.byteLength).toBeLessThan(IMAGE_LIMITS.maxBytes);

    const failure = await failureOf(checkImage(bomb, "image/png"));

    expect(failure.code).toBe("too_large");
  });

  it("does not show the image library's own message", async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("garbage")]);

    const failure = await failureOf(checkImage(fake, "image/jpeg"));

    expect(failure.message).not.toMatch(/vips|sharp|jpeg/i);
  });
});
