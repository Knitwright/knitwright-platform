import { describe, expect, it, vi } from "vitest";
import { articleBook } from "@/lib/teamwear/fixtures/kit";
import { askForKits, kitsForm, KITS_PATH } from "./client";
import { crestFileFixture, crestPixels } from "./fixtures/crests";
import { pickedColours } from "./palette";
import { runCrestToKit } from "./service";
import { kitsView, swatchView } from "./view";
import { REFUSALS } from "./words";

const articles = articleBook();

const run = (overrides: Partial<Parameters<typeof runCrestToKit>[0]> = {}) =>
  runCrestToKit({
    sportId: "football",
    feel: "modern",
    roles: "all",
    clubName: "Sialkot Rovers",
    crest: crestFileFixture(6, 256),
    pixels: crestPixels(6),
    picked: [],
    articles,
    ...overrides,
  });

describe("what the screen is sent", () => {
  it("carries a card per kit, each with its codes, its colours and two addresses", async () => {
    const view = kitsView(await run(), "Sialkot Rovers");
    expect(view.status).toBe("kits");
    expect(view.kits.length).toBeGreaterThan(0);
    for (const card of view.kits) {
      expect(card.title).toMatch(/kit · /);
      expect(card.codes).toMatch(/^[A-Z][0-9]{2}( · [A-Z][0-9]{2})*$/);
      expect(card.colours.length).toBeGreaterThanOrEqual(2);
      expect(card.href.startsWith("/teamwear?")).toBe(true);
      expect(card.quoteHref.startsWith("/api/quotes?")).toBe(true);
      expect(card.ruleIds.every((id) => /^R-[A-Z]+-[0-9]{3}$/.test(id))).toBe(true);
    }
  });

  it("asks the quote for the kit's own parts and names the socks as unpriced", async () => {
    const view = kitsView(await run(), "Sialkot Rovers");
    const href = view.kits[0]!.quoteHref;
    expect(href).toContain("line=JSY-SS-01%3A20");
    expect(href).toContain("line=SHO-TR-01%3A20");
    expect(href).toContain("unpriced=Socks");
    expect(href).toContain("crest=1");
  });

  it("carries the crest's colours with what the print estimate said, and the two basis sentences", async () => {
    const view = kitsView(await run(), null);
    expect(view.palette.length).toBeGreaterThan(1);
    expect(view.colourBasis).toHaveLength(2);
    expect(view.colourBasis[0]).toContain("no Pantone number");
    expect(view.vectorise).toContain("dots per inch");
    expect(view.sharpEnough).toBe(true);
  });

  it("shows a colour the estimate had to move with both colours and the difference", () => {
    const [vivid] = pickedColours(["#00ff40"]);
    const shown = swatchView(vivid!);
    expect(shown.inGamut).toBe(false);
    expect(shown.safeHex).not.toBe(shown.hex);
    expect(Number(shown.delta)).toBeGreaterThan(0);
    expect(shown.warning).toContain("Knitwright's own estimate");
    expect(shown.share).toBe("100%");
  });

  it("carries the reason and the palette when there are no kits, so the screen is never blank", async () => {
    const view = kitsView(await run({ sportId: "winter-code" }), null);
    expect(view.status).toBe("none");
    expect(view.kits).toEqual([]);
    expect(view.reason).toContain("No base article");
    expect(view.palette.length).toBeGreaterThan(0);
  });

  it("has no vectorise line when the club picked colours instead of a crest", async () => {
    const view = kitsView(await run({ crest: null, pixels: null, picked: ["#1b2a49", "#d4af37", "#c8102e"] }), null);
    expect(view.vectorise).toBeNull();
    expect(view.sharpEnough).toBe(true);
  });
});

describe("what the screen sends", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "crest.png", { type: "image/png" });

  it("puts the crest and every field on the form, and leaves out what it has not got", () => {
    const form = kitsForm({ crest: file, sportId: "football", roles: "all", feel: "bold", clubName: "  Rovers  ", colours: ["#1b2a49"] });
    expect(form.get("file")).toBe(file);
    expect(form.get("sportId")).toBe("football");
    expect(form.get("clubName")).toBe("Rovers");
    expect(form.getAll("colour")).toEqual(["#1b2a49"]);
    const bare = kitsForm({ crest: null, sportId: "football", roles: "home", feel: "plain", clubName: "   ", colours: [] });
    expect(bare.get("file")).toBeNull();
    expect(bare.get("clubName")).toBeNull();
  });

  it("asks for nothing at all when there is neither a crest nor a colour, and says what to do", async () => {
    const fetcher = vi.fn();
    expect(await askForKits(fetcher, { crest: null, sportId: "football", roles: "all", feel: "bold", clubName: "", colours: [] })).toEqual({
      ok: false,
      reason: REFUSALS.noFile,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("hands back the view the server built", async () => {
    const data = { status: "kits", kits: [] };
    const fetcher = vi.fn(async (input: string) => {
      expect(input).toBe(KITS_PATH);
      return new Response(JSON.stringify({ success: true, data }), { status: 200 });
    });
    const outcome = await askForKits(fetcher, { crest: file, sportId: "football", roles: "all", feel: "bold", clubName: "", colours: [] });
    expect(outcome).toEqual({ ok: true, data });
  });

  it("hands back the server's own words when it refuses, and plain words when it cannot be reached", async () => {
    const refused = vi.fn(async () => new Response(JSON.stringify({ success: false, error: { message: "That file is over 10 MB." } }), { status: 400 }));
    expect(await askForKits(refused, { crest: file, sportId: "football", roles: "all", feel: "bold", clubName: "", colours: [] })).toEqual({
      ok: false,
      reason: "That file is over 10 MB.",
    });
    const broken = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await askForKits(broken, { crest: file, sportId: "football", roles: "all", feel: "bold", clubName: "", colours: [] })).toEqual({
      ok: false,
      reason: REFUSALS.generic,
    });
    const empty = vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 500 }));
    expect(await askForKits(empty, { crest: file, sportId: "football", roles: "all", feel: "bold", clubName: "", colours: [] })).toMatchObject({ ok: false, reason: REFUSALS.generic });
  });
});
