import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { item, lifestyle, setOf, studio, unlocked } from "./fixtures";
import { tilesOf } from "./model";
import { TileCard } from "./TileCard";

const html = (tile: ReturnType<typeof tilesOf>[number], canShare = false): string =>
  renderToStaticMarkup(createElement(TileCard, { tile, canShare, busy: false, onRerun: () => undefined, onShare: () => undefined }));

describe("TileCard", () => {
  it("shows a locked picture with a preview mark, a description and no download", () => {
    const tile = tilesOf(setOf())[0];
    const markup = html(tile!);
    expect(markup).toContain('alt="Front, preview with a Knitwright mark"');
    expect(markup).toContain("Preview");
    expect(markup).not.toContain("download");
  });

  it("shows an unlocked picture as a clean file with a download named after it", () => {
    const tile = tilesOf(unlocked(setOf()))[1];
    const markup = html(tile!);
    expect(markup).toContain('alt="Back"');
    expect(markup).toContain('download="knitwright-back.png"');
    expect(markup).toContain("Download");
    expect(markup).not.toContain("Share");
    expect(html(tile!, true)).toContain("Share");
  });

  it("says a waiting tile is being made, without a picture", () => {
    const tile = tilesOf(setOf({ status: "running", items: [] }))[0];
    const markup = html(tile!);
    expect(markup).toContain("Making…");
    expect(markup).not.toContain("<img");
  });

  it("explains a dropped lifestyle picture in words and offers to try again", () => {
    const set = setOf({ items: [...studio(), ...lifestyle(["scene"])] });
    const tile = tilesOf(set).find((entry) => entry.state === "missing");
    const markup = html(tile!);
    expect(markup).toContain("did not match your design");
    expect(markup).toContain("Try again");
    expect(markup).not.toContain("<img");
  });

  it("labels an AI generated picture", () => {
    const tile = tilesOf(unlocked(setOf({ items: [...studio(), ...lifestyle(["scene"])] }))).find((entry) => entry.group === "lifestyle");
    expect(html(tile!)).toContain("AI generated");
    expect(html(tile!)).toContain("Matches your design");
  });

  it("plays a turntable with controls, and keeps a locked clip to its still with the reason", () => {
    const turntable = tilesOf(setOf({ items: [...studio(), item({ kind: "turntable", view: "three_quarter" })] })).find((entry) => entry.group === "turntable");
    expect(html(turntable!)).toContain("<video");
    expect(html(turntable!)).toContain("controls");
    const clip = tilesOf(setOf({ items: [...studio(), item({ kind: "clip", view: "scene" })] })).find((entry) => entry.group === "clip");
    const markup = html(clip!);
    expect(markup).not.toContain("<video");
    expect(markup).toContain("<img");
    expect(markup).toContain("once you have used credits");
  });
});
