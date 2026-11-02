import { describe, expect, it, vi } from "vitest";
import type { Reservation, UsageMeter } from "@/lib/usage/meter";
import { articleBook } from "@/lib/teamwear/fixtures/kit";
import { candidateKits, type KitCandidate } from "./engine";
import { crestPixels } from "./fixtures/crests";
import { crestColours } from "./palette";
import {
  ALLOWANCE_USED_UP,
  applyRanking,
  cardsOf,
  fixedRanking,
  MAX_LINE_LENGTH,
  meteredRanker,
  rankByFit,
  rankedKits,
  RANKING_UNAVAILABLE,
  safeLine,
  type KitRanker,
} from "./rank";

const articles = articleBook();

const candidates = (): readonly KitCandidate[] => {
  const outcome = candidateKits({ sportId: "football", feel: "modern", roles: "all", palette: crestColours(crestPixels(9)), articles, crest: null });
  if (outcome.status !== "kits") throw new Error("the fixture crest should yield kits");
  return outcome.candidates;
};

const ASK = { clubName: "Test Rovers", sportId: "football", feel: "modern" } as const;

describe("what a ranker is told", () => {
  it("is words and catalogue codes, and never a colour, a picture or a kit", () => {
    const cards = cardsOf(candidates());
    expect(cards).toHaveLength(candidates().length);
    for (const card of cards) {
      expect(Object.keys(card).sort()).toEqual(["codes", "familyLabel", "id", "roleLabel"]);
      expect(JSON.stringify(card)).not.toMatch(/#[0-9a-f]{6}/i);
    }
  });
});

describe("the line a ranker writes", () => {
  it("is kept when it is one plain sentence", () => {
    expect(safeLine("  Your main colour on the body, with the trim picked out. ")).toBe("Your main colour on the body, with the trim picked out.");
  });

  it("is refused when it states a colour, a measurement or a catalogue code", () => {
    expect(safeLine("Try #1b2a49 on the body")).toBeNull();
    expect(safeLine("rgb(20, 40, 70) across the chest")).toBeNull();
    expect(safeLine("The band is 90 mm wide")).toBeNull();
    expect(safeLine("Printed at 150 dpi")).toBeNull();
    expect(safeLine("Use collar C02 here")).toBeNull();
    expect(safeLine("Nearest Pantone is a warm navy")).toBeNull();
  });

  it("is refused when it is empty or longer than a card can show", () => {
    expect(safeLine("   ")).toBeNull();
    expect(safeLine("a".repeat(MAX_LINE_LENGTH + 1))).toBeNull();
    expect(safeLine("a".repeat(MAX_LINE_LENGTH))).toHaveLength(MAX_LINE_LENGTH);
  });

  it("drops control characters rather than drawing them", () => {
    expect(safeLine("Bold and\u0000 bright‏")).toBe("Bold and bright");
  });
});

describe("a ranker can only reorder and describe", () => {
  it("cannot change a colour, a code, a parameter or the crest of any kit", () => {
    const own = candidates();
    const mischief: KitRanker = {
      name: "mischief",
      rank: (request) =>
        Promise.resolve([
          // A kit of its own, an id that does not exist, and a line stating a colour.
          { id: "invented-kit", line: "A kit the model drew" },
          { id: request.cards[2]!.id, line: "Try #ff0000 on the body" },
          { id: request.cards[0]!.id, line: "Your darkest colour on the body." },
        ]),
    };
    const ordered = rankByFit(own);
    return rankedKits(own, mischief, ASK).then((outcome) => {
      expect(outcome.candidates.map((one) => one.id)).not.toContain("invented-kit");
      expect(outcome.candidates).toHaveLength(own.length);
      for (const shown of outcome.candidates) {
        const source = own.find((one) => one.id === shown.id)!;
        // Everything but the line is the engine's own value, field for field.
        expect({ ...shown, note: source.note }).toEqual(source);
        // The line is either one the ranker was allowed to write, or Knitwright's own.
        expect(shown.note === source.note || safeLine(shown.note) === shown.note, shown.id).toBe(true);
      }
      // The line that tried to state a colour was dropped: that kit kept Knitwright's own line.
      const refused = outcome.candidates.find((one) => one.id === ordered[2]!.id)!;
      expect(refused.note).toBe(ordered[2]!.note);
    });
  });

  it("puts the kits in the order it asked for, and the rest keep Knitwright's order", async () => {
    const own = rankByFit(candidates());
    const asked = [own[3]!.id, own[1]!.id];
    const outcome = await rankedKits(own, fixedRanking(asked.map((id) => ({ id, line: "A good one." }))), ASK);
    expect(outcome.candidates.slice(0, 2).map((one) => one.id)).toEqual(asked);
    expect(outcome.candidates.map((one) => one.id).sort()).toEqual(own.map((one) => one.id).sort());
  });

  it("ignores a kit the ranker names twice", () => {
    const own = candidates();
    const ranked = applyRanking(own, [
      { id: own[0]!.id, line: "First." },
      { id: own[0]!.id, line: "First again." },
    ]);
    expect(ranked.filter((one) => one.id === own[0]!.id)).toHaveLength(1);
    expect(ranked[0]!.note).toBe("First.");
  });

  it("keeps Knitwright's own line where the ranker's cannot be shown", () => {
    const own = candidates();
    const ranked = applyRanking(own, [{ id: own[0]!.id, line: "#ff0000 everywhere" }]);
    expect(ranked[0]!.note).toBe(own[0]!.note);
  });
});

describe("the order the kits are shown in", () => {
  it("is Knitwright's own when no ranker is asked, nearest the crest first", async () => {
    const outcome = await rankedKits(candidates(), null, ASK);
    expect(outcome.note).toBe(RANKING_UNAVAILABLE);
    const drifts = outcome.candidates.map((one) => one.primaryDeltaE00 ?? Number.POSITIVE_INFINITY);
    expect(drifts).toEqual([...drifts].sort((a, b) => a - b));
  });

  it("falls back to Knitwright's own order when the ranker throws or says nothing", async () => {
    const thrower: KitRanker = { name: "broken", rank: () => Promise.reject(new Error("no")) };
    expect((await rankedKits(candidates(), thrower, ASK)).note).toBe(RANKING_UNAVAILABLE);
    expect((await rankedKits(candidates(), fixedRanking([]), ASK)).note).toBe(RANKING_UNAVAILABLE);
  });
});

describe("a paid ranker", () => {
  const meter = (reservation: Reservation = { ok: true, eventId: "event-1" }) => {
    const reserve = vi.fn(async () => reservation);
    const refund = vi.fn(async () => true);
    return { meter: { reserve, refund } as unknown as UsageMeter, reserve, refund };
  };

  it("reserves its cost before the call, against the person who asked", async () => {
    const { meter: usage, reserve } = meter();
    const ranked = meteredRanker(fixedRanking([{ id: "x", line: "one" }]), usage, { brandId: "b", userId: "u" }, 1_200, "GET /kits");
    await ranked.rank({ ...ASK, cards: [] });
    expect(reserve).toHaveBeenCalledWith({ userId: "u", brandId: "b", cost: { feature: "ai", microdollars: 1_200 }, route: "GET /kits" });
  });

  it("gives the cost back when the call fails, and never when it does not", async () => {
    const { meter: usage, refund } = meter();
    const broken: KitRanker = { name: "broken", rank: () => Promise.reject(new Error("no")) };
    await expect(meteredRanker(broken, usage, { brandId: "b", userId: "u" }, 1, "r").rank({ ...ASK, cards: [] })).rejects.toThrow("no");
    expect(refund).toHaveBeenCalledWith("event-1");
    const second = meter();
    await meteredRanker(fixedRanking([]), second.meter, { brandId: "b", userId: "u" }, 1, "r").rank({ ...ASK, cards: [] });
    expect(second.refund).not.toHaveBeenCalled();
  });

  it("refuses when the allowance is used up, so the kits fall back to Knitwright's order", async () => {
    const { meter: usage } = meter({ ok: false, refused: "brand" });
    const ranked = meteredRanker(fixedRanking([]), usage, { brandId: "b", userId: "u" }, 1, "r");
    await expect(ranked.rank({ ...ASK, cards: [] })).rejects.toThrow(ALLOWANCE_USED_UP);
    expect((await rankedKits(candidates(), ranked, ASK)).note).toBe(RANKING_UNAVAILABLE);
  });
});
