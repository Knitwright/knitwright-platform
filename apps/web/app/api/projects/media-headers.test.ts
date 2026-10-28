import { describe, expect, it, vi } from "vitest";
import { createDefineRoute } from "@/lib/server/core/create-define-route";
import { makeDeps } from "@/lib/server/core/test-deps";

vi.mock("@/lib/server/define-route", () => ({ defineRoute: createDefineRoute(makeDeps().deps) }));
vi.mock("@/lib/server/deps", () => ({ adminClient: () => ({}), sessionClient: async () => ({}) }));
vi.mock("@/lib/media/service", () => ({ mediaStore: () => ({}), mediaFiles: () => ({}) }));
vi.mock("@/lib/media/video/files", () => ({ videoFiles: () => ({}) }));
vi.mock("@/lib/media/serve", () => ({ serveItem: async () => ({ bytes: new Uint8Array([1]), contentType: "image/png", watermarked: true }) }));
vi.mock("@/lib/media/video/serve", () => ({
  CLIP_LOCKED_MESSAGE: "locked",
  serveVideo: async () => ({ state: "ok", bytes: new Uint8Array([1]), contentType: "video/mp4", aiGenerated: false }),
}));

const ID = "11111111-1111-4111-8111-111111111111";
const params = { params: Promise.resolve({ projectId: ID, setId: ID, itemId: ID }) };

describe("media file responses (security review L4)", () => {
  it("are marked nosniff, picture and video alike", async () => {
    const picture = await import("./[projectId]/media/[setId]/items/[itemId]/route");
    const video = await import("./[projectId]/media/[setId]/items/[itemId]/video/route");
    for (const handler of [picture.GET, video.GET]) {
      const response = await handler(new Request("http://localhost/x"), params);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });
});
