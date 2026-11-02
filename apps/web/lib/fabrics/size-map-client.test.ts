import { describe, expect, it, vi } from "vitest";
import { resetPatternSize, SIZE_MAP_URL } from "./size-map-client";

/** The browser's one call to the size-map route: put a label back to the suggestion (decision 0124). */

const label = { label: "M", wearer: "men", cut: "mens" };

const answering = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response);

describe("putting a pattern size back to the suggestion", () => {
  it("names the label, the wearer and the cut, and nothing else", async () => {
    const fetcher = answering({ success: true, data: { saved: true } });
    expect(await resetPatternSize(fetcher, label)).toEqual({ ok: true });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SIZE_MAP_URL);
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(String(init.body))).toEqual(label);
  });

  it("gives back the server's own sentence when it refuses", async () => {
    const fetcher = answering({ success: false, error: { message: "You may not change this brand's fabrics." } });
    expect(await resetPatternSize(fetcher, label)).toEqual({ ok: false, reason: "You may not change this brand's fabrics." });
  });

  it("says something plain when the answer makes no sense or the server cannot be reached", async () => {
    const odd = await resetPatternSize(answering({ nothing: true }), label);
    expect(odd).toEqual({ ok: false, reason: "The suggestion could not be put back. Try again." });

    const broken = await resetPatternSize(
      vi.fn(async () => {
        throw new Error("offline");
      }),
      label,
    );
    expect(broken).toEqual({ ok: false, reason: "The suggestion could not be put back. Try again." });
  });
});
