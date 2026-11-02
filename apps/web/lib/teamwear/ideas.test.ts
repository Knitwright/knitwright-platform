import { describe, expect, it } from "vitest";
import { DEFAULT_CLUB_COLOURS } from "@/lib/kit-styles/presets";
import {
  fixedIdeas,
  fixedQuote,
  IDEAS_UNAVAILABLE,
  QUOTE_UNAVAILABLE,
  sampleIdeas,
  unavailableIdeas,
  unavailableQuotes,
} from "./ideas";

const request = { sportId: "football", colours: DEFAULT_CLUB_COLOURS, typeId: "football-shirt", limit: 9 };

describe("the ideas seam", () => {
  it("says plainly that crest-to-kit is not switched on, rather than inventing a kit", async () => {
    await expect(unavailableIdeas.ideasFor(request)).resolves.toEqual({ status: "unavailable", reason: IDEAS_UNAVAILABLE });
  });

  it("gives the same ideas every time, so a test can assert what the rail shows", async () => {
    const source = fixedIdeas(sampleIdeas(DEFAULT_CLUB_COLOURS));
    const first = await source.ideasFor(request);
    const again = await source.ideasFor(request);
    expect(first).toEqual(again);
    expect(first.status === "ideas" && first.ideas.map((idea) => idea.id)).toEqual(["hoops", "sash"]);
  });

  it("never hands back more ideas than were asked for", async () => {
    const source = fixedIdeas(sampleIdeas(DEFAULT_CLUB_COLOURS));
    const one = await source.ideasFor({ ...request, limit: 1 });
    expect(one.status === "ideas" && one.ideas).toHaveLength(1);
    const none = await source.ideasFor({ ...request, limit: -3 });
    expect(none.status === "ideas" && none.ideas).toHaveLength(0);
  });

  it("carries only colours and a kit style: an idea is never a picture of a garment", () => {
    for (const idea of sampleIdeas(DEFAULT_CLUB_COLOURS)) {
      expect(Object.keys(idea).sort()).toEqual(["colours", "id", "label", "pattern", "ruleId"]);
      expect(idea.colours).toEqual(DEFAULT_CLUB_COLOURS);
    }
  });
});

describe("the quote seam", () => {
  const ask = { projectId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 1, lines: [{ articleCode: "JSY-SS-01", qty: 20 }], currency: "GBP" } as const;

  it("says plainly that the quote PDF is not switched on, and that the prices shown are the ones it will carry", async () => {
    await expect(unavailableQuotes.quoteFor(ask)).resolves.toEqual({ status: "unavailable", reason: QUOTE_UNAVAILABLE });
    expect(QUOTE_UNAVAILABLE).toMatch(/prices above are the ones it will carry/);
  });

  it("gives one fixed quote number, so a test can assert the footer without making a PDF", async () => {
    await expect(fixedQuote("Q-0001", "/quotes/Q-0001.pdf").quoteFor(ask)).resolves.toEqual({
      status: "quoted",
      quoteNumber: "Q-0001",
      downloadPath: "/quotes/Q-0001.pdf",
    });
  });
});
