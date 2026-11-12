import { describe, expect, it } from "vitest";
import { historyOf, QUICK_STARTS, routePrompt } from "./agent";
import { ALL_OFF, availabilityOf } from "./availability";
import { workflowById } from "./catalogue";

describe("routePrompt", () => {
  it("sends a question to Ask and a request to a new design", () => {
    expect(routePrompt("How far from a seam can a crest sit?")).toBe("ask");
    expect(routePrompt("what is the smallest text size")).toBe("ask");
    expect(routePrompt("Home and away kits for a navy-and-gold cricket club, retro 90s")).toBe("design");
    expect(routePrompt("  ")).toBe("design");
  });
});

describe("the quick-start tiles", () => {
  it("are the six of 09, each opening a real workflow page or the projects page", () => {
    expect(QUICK_STARTS.map((one) => one.label)).toEqual(["Kit design", "Product shoot", "Kit launch ad", "Team store promo", "Matchday content", "Tech pack"]);
    for (const tile of QUICK_STARTS.filter((one) => one.href.startsWith("/ai-studio/workflow/"))) {
      expect(workflowById(tile.href.split("/").pop()!), tile.id).not.toBeNull();
    }
  });
});

describe("historyOf", () => {
  const names = new Map([
    ["a", "Home kit"],
    ["b", "Away kit"],
  ]);

  it("keeps one entry per design, newest first, and cuts long words to a line", () => {
    const rows = [
      { projectId: "a", body: "x".repeat(200), createdAt: "2026-11-12" },
      { projectId: "a", body: "older", createdAt: "2026-11-11" },
      { projectId: "b", body: "Away kit please", createdAt: "2026-11-10" },
      { projectId: "gone", body: "no design", createdAt: "2026-11-09" },
    ];
    const history = historyOf(rows, names);
    expect(history.map((one) => one.projectId)).toEqual(["a", "b"]);
    expect(history[0]?.said.length).toBe(80);
    expect(history[0]?.said.endsWith("…")).toBe(true);
    expect(historyOf(rows, names, 1)).toHaveLength(1);
  });
});

describe("availabilityOf", () => {
  it("lets a free workflow run and holds a paid one while its switch is off, saying why", () => {
    expect(availabilityOf(workflowById("crest-to-kit")!, ALL_OFF)).toEqual({ available: true });
    const off = availabilityOf(workflowById("on-model-try-on")!, ALL_OFF);
    expect(off.available).toBe(false);
    if (!off.available) expect(off.body).toContain("no credits are used");
    expect(availabilityOf(workflowById("on-model-try-on")!, { ...ALL_OFF, aiImage: true }).available).toBe(true);
    expect(availabilityOf(workflowById("try-on-video")!, { ...ALL_OFF, aiImage: true }).available).toBe(false);
    expect(availabilityOf(workflowById("remove-background")!, ALL_OFF).available).toBe(false);
  });
});
