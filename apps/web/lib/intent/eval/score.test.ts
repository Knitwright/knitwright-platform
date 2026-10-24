import { describe, expect, it } from "vitest";
import { scoreCase, summarise } from "./score";
import type { EvalCase, Observation } from "./schema";

const base = { latencyMs: 10, costMicrodollars: 5 };
const article = (id: string, extra: Partial<EvalCase> = {}): EvalCase => ({ id: "t", category: "direct", prompt: "p", expected: { kind: "article", articleId: id }, ...extra });
const seen = (o: Partial<Observation>): Observation => ({ prediction: { kind: "decline" }, colours: [], ...base, ...o });

describe("scoreCase", () => {
  it("marks the right article correct and a wrong one incorrect", () => {
    expect(scoreCase(article("shorts"), seen({ prediction: { kind: "article", articleId: "shorts" } })).correct).toBe(true);
    expect(scoreCase(article("shorts"), seen({ prediction: { kind: "article", articleId: "polo" } })).correct).toBe(false);
  });

  it("flags an article outside the registry as invented and always wrong", () => {
    const s = scoreCase(article("shorts"), seen({ prediction: { kind: "article", articleId: "wetsuit" } }));
    expect(s.invented).toBe(true);
    expect(s.correct).toBe(false);
  });

  it("flags an invented id inside a list of candidates", () => {
    const c: EvalCase = { id: "a", category: "ambiguous", prompt: "p", expected: { kind: "ambiguous", candidates: ["polo", "crew-tee"] } };
    const s = scoreCase(c, seen({ prediction: { kind: "ambiguous", candidates: ["polo", "tuxedo"] } }));
    expect(s.invented).toBe(true);
    expect(s.correct).toBe(false);
  });

  it("flags an article the beta does not offer", () => {
    const s = scoreCase(article("leggings"), seen({ prediction: { kind: "article", articleId: "leggings" } }));
    expect(s.correct).toBe(true);
    expect(s.outsideLaunch).toBe(true);
  });

  const outside: EvalCase = {
    id: "o",
    category: "out-of-catalogue",
    prompt: "wetsuit",
    expected: { kind: "out-of-catalogue", nearest: { articleId: "compression-top", difference: "Thicker." } },
  };

  it("counts a decline as correct and scores the nearest block and the sentence separately", () => {
    const good = scoreCase(outside, seen({ prediction: { kind: "decline", nearest: { articleId: "compression-top", difference: "It is thicker." } } }));
    expect(good).toMatchObject({ correct: true, nearestCorrect: true, differenceGiven: true });
    const bare = scoreCase(outside, seen({ prediction: { kind: "decline" } }));
    expect(bare).toMatchObject({ correct: true, nearestCorrect: false, differenceGiven: false });
  });

  it("treats creating an article for an out-of-catalogue prompt as wrong", () => {
    expect(scoreCase(outside, seen({ prediction: { kind: "article", articleId: "compression-top" } })).correct).toBe(false);
  });

  it("accepts no nearest block when none is expected", () => {
    const c: EvalCase = { ...outside, expected: { kind: "out-of-catalogue", nearest: { articleId: null, difference: "Equipment." } } };
    expect(scoreCase(c, seen({ prediction: { kind: "decline", nearest: { articleId: null, difference: "Not clothing." } } })).nearestCorrect).toBe(true);
  });

  it("scores an ambiguous case by asking with candidates all from the expected list", () => {
    const c: EvalCase = { id: "a", category: "ambiguous", prompt: "p", expected: { kind: "ambiguous", candidates: ["pullover-hoodie", "zip-hoodie"] } };
    expect(scoreCase(c, seen({ prediction: { kind: "ambiguous", candidates: ["zip-hoodie", "pullover-hoodie"] } })).correct).toBe(true);
    expect(scoreCase(c, seen({ prediction: { kind: "ambiguous", candidates: ["zip-hoodie", "polo"] } })).correct).toBe(false);
    expect(scoreCase(c, seen({ prediction: { kind: "article", articleId: "zip-hoodie" } })).correct).toBe(false);
  });

  it("puts pending-catalogue cases in their own bucket", () => {
    const c: EvalCase = { ...outside, category: "teamwear", pending_catalogue: { articleId: "cricket-cap" } };
    expect(scoreCase(c, seen({})).bucket).toBe("pending");
    expect(scoreCase(outside, seen({})).bucket).toBe("headline");
  });

  it("scores colours by recall and exact set", () => {
    const c = article("shorts", { colours: ["#ffffff", "#111111"] });
    const half = scoreCase(c, seen({ prediction: { kind: "article", articleId: "shorts" }, colours: ["#ffffff"] }));
    expect(half.colour).toEqual({ expected: 2, matched: 1, extra: 0, exact: false });
    const all = scoreCase(c, seen({ prediction: { kind: "article", articleId: "shorts" }, colours: ["#111111", "#ffffff"] }));
    expect(all.colour?.exact).toBe(true);
    expect(scoreCase(article("shorts"), seen({})).colour).toBeNull();
  });

  it("scores a failed call as wrong and keeps the reason", () => {
    const s = scoreCase(article("shorts"), seen({ failed: "timeout" }));
    expect(s.correct).toBe(false);
    expect(s.failed).toBe("timeout");
  });
});

describe("summarise", () => {
  const mk = (id: string, ok: boolean, extra: Partial<ReturnType<typeof scoreCase>> = {}) =>
    ({ id, category: "direct", bucket: "headline", correct: ok, invented: false, outsideLaunch: false, nearestCorrect: null, differenceGiven: null, colour: null, latencyMs: 1, costMicrodollars: 2, failed: null, expectedKind: "article", ...extra }) as ReturnType<typeof scoreCase>;

  it("reports the headline accuracy, leaving pending cases out", () => {
    const r = summarise([mk("a", true), mk("b", false), mk("c", true, { bucket: "pending" })]);
    expect(r.headline).toEqual({ n: 2, correct: 1, accuracy: 0.5 });
    expect(r.pending).toEqual({ n: 1, correct: 1 });
  });

  it("reports percentiles, totals and the ten second budget", () => {
    const r = summarise([1, 2, 3, 4, 12_000].map((ms, i) => mk(`x${i}`, true, { latencyMs: ms })));
    expect(r.latency.p50).toBe(3);
    expect(r.latency.max).toBe(12_000);
    expect(r.latency.over10s).toBe(1);
    expect(r.cost).toEqual({ totalMicrodollars: 10, perRequestMicrodollars: 2 });
  });

  it("reports colours and the nearest block", () => {
    const r = summarise([
      mk("c1", true, { colour: { expected: 2, matched: 1, extra: 1, exact: false } }),
      mk("c2", true, { colour: { expected: 1, matched: 1, extra: 0, exact: true } }),
      mk("o1", true, { expectedKind: "out-of-catalogue", nearestCorrect: true, differenceGiven: true }),
      mk("o2", true, { expectedKind: "out-of-catalogue", nearestCorrect: false, differenceGiven: false }),
    ]);
    expect(r.colour).toEqual({ cases: 2, recall: 2 / 3, exactSets: 1, extraColours: 1 });
    expect(r.outOfCatalogue).toEqual({ n: 2, declined: 2, nearestCorrect: 1, differenceGiven: 1 });
  });

  it("is safe on an empty list", () => {
    const r = summarise([]);
    expect(r.headline.accuracy).toBe(0);
    expect(r.latency.p50).toBe(0);
    expect(r.cost.perRequestMicrodollars).toBe(0);
  });

  it("counts invented, outside-launch and failed calls", () => {
    const r = summarise([mk("a", false, { invented: true, failed: "x" }), mk("b", true, { outsideLaunch: true })]);
    expect(r.invented).toBe(1);
    expect(r.outsideLaunch).toBe(1);
    expect(r.failed).toBe(1);
  });

  it("breaks accuracy down by category", () => {
    const r = summarise([mk("a", true), mk("b", false, { category: "typo" })]);
    expect(r.byCategory).toEqual({ direct: { n: 1, correct: 1 }, typo: { n: 1, correct: 0 } });
  });
});
