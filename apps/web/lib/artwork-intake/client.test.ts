import { describe, expect, it, vi } from "vitest";
import { artworkDetail, changeArtwork, deleteArtwork, listArtwork, screenLink, tileReport, uploadArtwork } from "./client";

const reply = (body: unknown) => vi.fn(async () => Response.json(body));

describe("the artwork client", () => {
  it("sends a file with the rights box, and returns the data", async () => {
    const fetcher = reply({ success: true, data: { id: "a" } });
    const result = await uploadArtwork(fetcher, new File(["x"], "crest.png"), true);
    expect(result).toEqual({ ok: true, data: { id: "a" } });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/artwork");
    expect((init.body as FormData).get("rights")).toBe("yes");
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("leaves the rights out when the box is not ticked", async () => {
    const fetcher = reply({ success: false, error: { message: "Tick the box." } });
    expect(await uploadArtwork(fetcher, new File(["x"], "a.png"), false)).toEqual({ ok: false, reason: "Tick the box." });
    const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.body as FormData).has("rights")).toBe(false);
  });

  it("asks the routes for the list, detail, tile check, deletion and changes", async () => {
    const fetcher = reply({ success: true, data: {} });
    await listArtwork(fetcher);
    await artworkDetail(fetcher, "id1", 400);
    await artworkDetail(fetcher, "id1");
    await tileReport(fetcher, "id1");
    await deleteArtwork(fetcher, "id1");
    await changeArtwork(fetcher, "id1", { action: "make-seamless", method: "blend" }, true);
    expect(fetcher.mock.calls.map((call) => (call as unknown as [string])[0])).toEqual([
      "/api/artwork", "/api/artwork/id1?widthMm=400", "/api/artwork/id1", "/api/artwork/id1/tile", "/api/artwork/id1", "/api/artwork/id1/change",
    ]);
    const post = fetcher.mock.calls[5] as unknown as [string, RequestInit];
    expect(JSON.parse(post[1].body as string)).toEqual({ change: { action: "make-seamless", method: "blend" }, accept: true });
  });

  it("gives a plain sentence when the network or the answer fails", async () => {
    const down = vi.fn(async () => Promise.reject(new Error("offline")));
    expect(await listArtwork(down)).toEqual({ ok: false, reason: "Something went wrong. Try again." });
    const odd = reply({ success: false });
    expect(await tileReport(odd, "x")).toEqual({ ok: false, reason: "Something went wrong. Try again." });
  });

  it("makes a link for the screen copy", async () => {
    expect(await screenLink(reply({ success: true, data: { url: "https://files.example/a" } }), "f1")).toEqual({ ok: true, data: "https://files.example/a" });
    expect(await screenLink(reply({ success: false, error: { message: "That file does not exist." } }), "f1")).toEqual({ ok: false, reason: "That file does not exist." });
  });
});
