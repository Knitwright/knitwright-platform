import { describe, expect, it } from "vitest";
import { needsYou, NEEDS_YOU_SHOWN, type DesignFacts, type OpenVote, type QuoteFact } from "./needs-you";

const design = (over: Partial<DesignFacts> = {}): DesignFacts => ({
  id: "d1",
  name: "Home jersey",
  updatedAt: "2026-10-13T10:00:00.000Z",
  toConfirm: null,
  shared: false,
  quoted: false,
  ...over,
});

const vote = (over: Partial<OpenVote> = {}): OpenVote => ({
  projectId: "d1",
  projectName: "Home jersey",
  yes: 0,
  notYet: 0,
  answers: 0,
  latestAt: "2026-10-13T09:00:00.000Z",
  ...over,
});

const quote = (over: Partial<QuoteFact> = {}): QuoteFact => ({
  id: "q1",
  projectId: "d1",
  projectName: "Home jersey",
  quantity: 25,
  status: "new",
  updatedAt: "2026-10-12T09:00:00.000Z",
  ...over,
});

const nothing = { designs: [], votes: [], quotes: [] };

describe("needsYou", () => {
  it("is empty when nothing is waiting", () => {
    expect(needsYou(nothing)).toEqual({ items: [], more: 0 });
  });

  it("asks to finish a design whose factory file has empty fields", () => {
    const { items } = needsYou({ ...nothing, designs: [design({ toConfirm: 6 })] });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "confirm",
        text: "Home jersey: 6 things to confirm for the factory",
        action: "Finish",
        href: "/studio/d1/tech-pack",
      }),
    ]);
  });

  it("says one thing, not one things", () => {
    const { items } = needsYou({ ...nothing, designs: [design({ toConfirm: 1 })] });
    expect(items[0]?.text).toBe("Home jersey: 1 thing to confirm for the factory");
  });

  it("says nothing of a design whose count is not known", () => {
    expect(needsYou({ ...nothing, designs: [design({ toConfirm: null })] }).items).toEqual([]);
  });

  it("offers to share a factory file with no empty fields that nobody has seen yet", () => {
    const { items } = needsYou({ ...nothing, designs: [design({ toConfirm: 0 })] });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "share",
        text: "Home jersey: the factory file has no empty fields. Show it to your committee",
        action: "Share",
        href: "/studio/d1?tool=share#share-heading",
      }),
    ]);
  });

  it("does not offer to share a design already shared or quoted", () => {
    const designs = [design({ id: "a", toConfirm: 0, shared: true }), design({ id: "b", toConfirm: 0, quoted: true })];
    expect(needsYou({ ...nothing, designs }).items).toEqual([]);
  });

  it("gives the tally of an open committee vote", () => {
    const { items } = needsYou({ ...nothing, votes: [vote({ yes: 7, notYet: 1, answers: 8 })] });
    expect(items).toEqual([
      expect.objectContaining({
        kind: "vote",
        text: "Home jersey: committee vote open, 7 yes, 1 not yet",
        action: "See votes",
        href: "/studio/d1?tool=share#share-heading",
      }),
    ]);
  });

  it("says when an open vote has no votes yet", () => {
    expect(needsYou({ ...nothing, votes: [vote()] }).items[0]?.text).toBe("Home jersey: committee vote open, no votes yet");
  });

  it("names a quote that was sent, and one still waiting for a reply", () => {
    const { items } = needsYou({
      ...nothing,
      quotes: [quote({ id: "a", status: "new", quantity: 1200 }), quote({ id: "b", status: "quoted" })],
    });
    expect(items.map((item) => [item.kind, item.text, item.action, item.href])).toEqual([
      ["quote-sent", "Quote for 25 of Home jersey sent. Look in your email", "Open", "/studio/d1?tool=quote#quote-request"],
      ["quote-waiting", "Quote for 1,200 of Home jersey asked for. We reply by email", "Open", "/studio/d1?tool=quote#quote-request"],
    ]);
  });

  it("leaves out closed quotes", () => {
    expect(needsYou({ ...nothing, quotes: [quote({ status: "closed" })] }).items).toEqual([]);
  });

  it("puts what the person must act on first: replies, votes, empty fields, sharing, then waiting quotes", () => {
    const { items } = needsYou({
      designs: [design({ id: "c", toConfirm: 2 }), design({ id: "s", toConfirm: 0 })],
      votes: [vote({ projectId: "v" })],
      quotes: [quote({ id: "w", status: "new" }), quote({ id: "q", status: "quoted" })],
    });
    expect(items.map((item) => item.kind)).toEqual(["quote-sent", "vote", "confirm", "share", "quote-waiting"]);
  });

  it("lists the newest first within a kind", () => {
    const { items } = needsYou({
      ...nothing,
      designs: [
        design({ id: "old", name: "Old", toConfirm: 2, updatedAt: "2026-10-01T00:00:00.000Z" }),
        design({ id: "new", name: "New", toConfirm: 2, updatedAt: "2026-10-13T00:00:00.000Z" }),
      ],
    });
    expect(items.map((item) => item.id)).toEqual(["confirm:new", "confirm:old"]);
  });

  it("shows a few and counts the rest", () => {
    const designs = Array.from({ length: NEEDS_YOU_SHOWN + 3 }, (_, index) => design({ id: `d${index}`, toConfirm: 1 }));
    const result = needsYou({ ...nothing, designs });
    expect(result.items).toHaveLength(NEEDS_YOU_SHOWN);
    expect(result.more).toBe(3);
  });

  it("keeps the design id out of the address unescaped", () => {
    const { items } = needsYou({ ...nothing, designs: [design({ id: "a/b", toConfirm: 1 })] });
    expect(items[0]?.href).toBe("/studio/a%2Fb/tech-pack");
  });
});
