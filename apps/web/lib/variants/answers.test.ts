import { describe, expect, it } from "vitest";
import { appliedSentence, parseApplied, parseList, UNREADABLE } from "./answers";

const tile = { id: "v-00000001", kind: "colourway", label: "L", summary: "S", src: null, alt: "A", warnings: [] };

describe("reading the route's answers", () => {
  it("reads a list", () => {
    expect(parseList({ success: true, data: { version: 2, tiles: [tile] } })).toEqual({ ok: true, version: 2, tiles: [tile] });
  });
  it("shows the server's sentence for a refusal and a plain one for nonsense", () => {
    expect(parseList({ success: false, error: { code: "x", message: "Nope." } })).toEqual({ ok: false, message: "Nope." });
    expect(parseList({ hello: 1 })).toEqual({ ok: false, message: UNREADABLE });
    expect(parseList(null)).toEqual({ ok: false, message: UNREADABLE });
  });
  it("reads an applied answer", () => {
    expect(parseApplied({ success: true, data: { version: 3, created: true } })).toEqual({ ok: true, version: 3, created: true });
    expect(parseApplied({ success: false, error: { message: "Changed." } })).toEqual({ ok: false, message: "Changed." });
    expect(parseApplied("x")).toEqual({ ok: false, message: UNREADABLE });
  });
  it("says whether a version was made", () => {
    expect(appliedSentence(true, 3)).toContain("version 3");
    expect(appliedSentence(false, 3)).toContain("nothing new was saved");
  });
});

describe("badly shaped answers", () => {
  it("refuses a tile with a wrong kind, a missing field or a bad warning", () => {
    expect(parseList({ success: true, data: { version: 1, tiles: [{ ...tile, kind: "x" }] } }).ok).toBe(false);
    expect(parseList({ success: true, data: { version: 1, tiles: [{ ...tile, alt: 3 }] } }).ok).toBe(false);
    expect(parseList({ success: true, data: { version: 1, tiles: [{ ...tile, warnings: [{ code: "c" }] }] } }).ok).toBe(false);
    expect(parseList({ success: true, data: { version: 1.5, tiles: [] } }).ok).toBe(false);
    expect(parseApplied({ success: true, data: { version: 2, created: "yes" } }).ok).toBe(false);
  });
  it("accepts a tile with a drawing and a warning", () => {
    const full = { ...tile, src: "data:image/svg+xml,x", warnings: [{ code: "c", severity: "warning", panel: null, message: "m" }] };
    expect(parseList({ success: true, data: { version: 1, tiles: [full] } }).ok).toBe(true);
  });
});
