import sharp from "sharp";
import { ProviderError, type ImageProvider, type ImageRequest } from "./image-provider";

/**
 * Stand-ins for tests and for local work without a key. `stubImageProvider` answers every
 * request with a small grey PNG and remembers what it was asked. `failingImageProvider`
 * always fails, to prove the cost is given back.
 */

type StubImageProvider = ImageProvider & Readonly<{ requests: readonly ImageRequest[] }>;

const SIDE = 64;

export function stubImageProvider(): StubImageProvider {
  const requests: ImageRequest[] = [];
  return {
    name: "stub",
    requests,
    async generate(request) {
      requests.push(request);
      const bytes = await sharp({
        create: { width: SIDE, height: SIDE, channels: 3, background: { r: 200, g: 200, b: 200 } },
      })
        .png()
        .toBuffer();
      return { bytes: new Uint8Array(bytes), contentType: "image/png" };
    },
  };
}

export function failingImageProvider(refused = false): ImageProvider {
  return {
    name: "failing-stub",
    async generate() {
      throw new ProviderError("The stub image model always fails.", refused);
    },
  };
}
