import { describe, expect, it } from "vitest";
import { buildSnapshot, canonicalJson, snapshotHash } from "./snapshot";

const base = { projectId: "p1", version: 3, garmentType: "shorts", name: "Home shorts", spec: { b: 1, a: { y: 2, x: [3, { d: 1, c: 0 }] } } };

describe("canonicalJson", () => {
  it("sorts keys at every depth and keeps array order", () => {
    expect(canonicalJson({ b: 1, a: [2, { z: 1, y: 2 }] })).toBe('{"a":[2,{"y":2,"z":1}],"b":1}');
  });
  it("leaves out undefined fields", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});

describe("snapshot hash", () => {
  it("is the same for the same design however its keys are ordered", () => {
    const reordered = { ...base, spec: { a: { x: [3, { c: 0, d: 1 }], y: 2 }, b: 1 } };
    expect(snapshotHash(buildSnapshot(base))).toBe(snapshotHash(buildSnapshot(reordered)));
  });
  it("changes when the design, the version or the article changes", () => {
    const hash = snapshotHash(buildSnapshot(base));
    expect(snapshotHash(buildSnapshot({ ...base, version: 4 }))).not.toBe(hash);
    expect(snapshotHash(buildSnapshot({ ...base, garmentType: "singlet" }))).not.toBe(hash);
    expect(snapshotHash(buildSnapshot({ ...base, spec: { a: 1 } }))).not.toBe(hash);
  });
  it("is a sha256 in hex and holds no date", () => {
    expect(snapshotHash(buildSnapshot(base))).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(buildSnapshot(base))).not.toMatch(/20\d\d-\d\d-\d\d/);
  });
  it("says what is sent", () => {
    expect(buildSnapshot(base).sent).toEqual(["The design as saved in this version", "The factory file (tech pack) made from it"]);
  });
});
