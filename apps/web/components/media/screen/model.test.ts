import { describe, expect, it } from "vitest";
import { item, lifestyle, setOf, studio, unlocked } from "./fixtures";
import { clipPlan, progressOf, tilesOf } from "./model";

describe("tilesOf", () => {
  it("shows three waiting tiles for a set that is still being made, and none for lifestyle", () => {
    const tiles = tilesOf(setOf({ status: "running", items: [] }));
    expect(tiles.map((tile) => [tile.label, tile.state])).toEqual([
      ["Front", "waiting"],
      ["Back", "waiting"],
      ["Flat lay", "waiting"],
    ]);
  });

  it("fills each tile as its picture arrives, one by one", () => {
    const [front] = studio();
    const tiles = tilesOf(setOf({ status: "running", items: front ? [front] : [] }));
    expect(tiles.map((tile) => tile.state)).toEqual(["ready", "waiting", "waiting"]);
  });

  it("marks every tile of a locked set as a watermarked preview with nothing to download", () => {
    const tiles = tilesOf(setOf());
    expect(tiles.every((tile) => tile.watermarked && tile.download === null)).toBe(true);
    expect(tiles.every((tile) => tile.imageHref !== null)).toBe(true);
  });

  it("offers a download for each picture of an unlocked set, named after its label", () => {
    const tiles = tilesOf(unlocked(setOf()));
    expect(tiles.every((tile) => !tile.watermarked)).toBe(true);
    expect(tiles.map((tile) => tile.download?.filename)).toEqual(["knitwright-front.png", "knitwright-back.png", "knitwright-flat-lay.png"]);
  });

  it("names the four lifestyle scenes and shows a missing one as dropped, with the reason in words", () => {
    const set = setOf({ items: [...studio(), ...lifestyle(["scene", "front", "on_model"])] });
    const tiles = tilesOf(set).filter((tile) => tile.group === "lifestyle");
    expect(tiles.map((tile) => [tile.label, tile.state])).toEqual([
      ["On the pitch", "ready"],
      ["In the changing room", "missing"],
      ["On the street", "ready"],
      ["On a model", "ready"],
    ]);
    const missing = tiles.find((tile) => tile.state === "missing");
    expect(missing?.explanation).toMatch(/did not match your design/i);
    expect(missing?.canRerun).toBe(true);
    expect(missing?.imageHref).toBeNull();
  });

  it("says nothing is missing while the set is still running", () => {
    const set = setOf({ status: "running", items: [...studio(), ...lifestyle(["scene"])] });
    const states = tilesOf(set).filter((tile) => tile.group === "lifestyle").map((tile) => tile.state);
    expect(states).toEqual(["ready", "waiting", "waiting", "waiting"]);
  });

  it("makes no lifestyle tiles when the set has no lifestyle picture at all", () => {
    expect(tilesOf(setOf()).some((tile) => tile.group === "lifestyle")).toBe(false);
  });

  it("explains a stored rejected picture, hides its image and lets it be run again", () => {
    const rejected = item({ kind: "lifestyle", view: "scene", checker: "rejected", provider: "stub" });
    const tile = tilesOf(setOf({ items: [...studio(), rejected] })).find((entry) => entry.label === "On the pitch");
    expect(tile).toMatchObject({ state: "rejected", imageHref: null, canRerun: true });
    expect(tile?.explanation).toMatch(/did not match your design/i);
  });

  it("labels the checker's verdict in plain words and never uses a settled word", () => {
    const verdicts = (["pending", "passed", "rejected", "not_checked"] as const).map((checker) => {
      const tile = tilesOf(setOf({ items: [...studio(), item({ kind: "lifestyle", view: "scene", checker, provider: "stub" })] })).find((entry) => entry.group === "lifestyle");
      return tile?.verdict.text ?? "";
    });
    expect(verdicts).toEqual(["Being compared with your design", "Matches your design", "Did not match your design", "Not compared with your design"]);
    for (const text of verdicts) expect(text).not.toMatch(/\b(checked|verified|approved|confirmed|final|passed|validated|certified)\b/i);
  });

  it("gives a turntable a video address at once, and a clip one only after the spend", () => {
    const turntable = item({ kind: "turntable", view: "three_quarter" });
    const clip = item({ kind: "clip", view: "scene", provider: "stub" });
    const locked = tilesOf(setOf({ items: [...studio(), turntable, clip] }));
    expect(locked.find((tile) => tile.group === "turntable")?.videoHref).toBe(`${turntable.href}/video`);
    const lockedClip = locked.find((tile) => tile.group === "clip");
    expect(lockedClip).toMatchObject({ videoHref: null, aiGenerated: true, download: null });
    expect(lockedClip?.explanation).toMatch(/credits/i);
    const open = tilesOf(unlocked(setOf({ items: [...studio(), turntable, clip] })));
    expect(open.find((tile) => tile.group === "clip")?.videoHref).toBe(`${clip.href}/video`);
  });

  it("lets the free turntable video be downloaded before the spend, but not its still", () => {
    const turntable = item({ kind: "turntable", view: "three_quarter" });
    const tile = tilesOf(setOf({ items: [...studio(), turntable] })).find((entry) => entry.group === "turntable");
    expect(tile?.download).toEqual({ href: `${turntable.href}/video`, filename: null });
    expect(tile?.watermarked).toBe(true);
  });

  it("labels AI generated pictures", () => {
    const tiles = tilesOf(unlocked(setOf({ items: [...studio(), ...lifestyle(["scene"])] })));
    expect(tiles.filter((tile) => tile.aiGenerated).map((tile) => tile.label)).toEqual(["On the pitch"]);
  });

  it("is empty for no set", () => {
    expect(tilesOf(null)).toEqual([]);
  });
});

describe("progressOf", () => {
  it("counts the pictures of the three studio views and the lifestyle ones that exist", () => {
    expect(progressOf(null)).toEqual({ ready: 0, total: 0, done: false, text: "No pictures yet." });
    const [front] = studio();
    expect(progressOf(setOf({ status: "running", items: front ? [front] : [] }))).toMatchObject({ ready: 1, total: 3, done: false, text: "1 of 3 pictures ready." });
    expect(progressOf(setOf())).toMatchObject({ ready: 3, total: 3, done: true, text: "3 of 3 pictures ready." });
  });

  it("reports a failed set with its own sentence", () => {
    expect(progressOf(setOf({ status: "failed", error: "The media could not be made. Nothing was charged. Try again.", items: [] })).text).toBe(
      "The media could not be made. Nothing was charged. Try again.",
    );
  });

  it("counts a dropped lifestyle picture in the total of a finished set", () => {
    const set = setOf({ items: [...studio(), ...lifestyle(["scene", "front"])] });
    expect(progressOf(set)).toMatchObject({ ready: 5, total: 7, done: true });
  });
});

describe("clipPlan", () => {
  it("is not possible without a set, or while it is running", () => {
    expect(clipPlan(null)).toMatchObject({ enabled: false });
    expect(clipPlan(setOf({ status: "running" }))).toMatchObject({ enabled: false });
  });

  it("asks for a lifestyle picture first when none matches the design", () => {
    const plan = clipPlan(setOf());
    expect(plan.enabled).toBe(false);
    expect(plan.reason).toMatch(/lifestyle picture that matches your design/i);
    expect(clipPlan(setOf({ items: [...studio(), ...lifestyle(["scene"], "rejected")] })).enabled).toBe(false);
    expect(clipPlan(setOf({ items: [...studio(), ...lifestyle(["front"])] })).enabled).toBe(false);
  });

  it("is possible from a matching on-model or pitch picture, and names it", () => {
    expect(clipPlan(setOf({ items: [...studio(), ...lifestyle(["scene"])] }))).toMatchObject({ enabled: true, view: "scene", reason: null });
    expect(clipPlan(setOf({ items: [...studio(), ...lifestyle(["on_model"])] }))).toMatchObject({ enabled: true, view: "on_model" });
  });

  it("is done when the clip for that picture exists", () => {
    const set = setOf({ items: [...studio(), ...lifestyle(["scene"]), item({ kind: "clip", view: "scene" })] });
    expect(clipPlan(set)).toMatchObject({ enabled: false, reason: "The clip is in this set." });
  });
});
