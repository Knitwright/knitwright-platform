import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildZip, crc32 } from "./zip";

const text = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
  it("round trips files through a real unzipper, keeping names and bytes", () => {
    const zip = buildZip([
      { path: "a/one.txt", bytes: text("hello") },
      { path: "two.bin", bytes: Uint8Array.from([0, 1, 2, 255]) },
      { path: "ünï.txt", bytes: text("x") },
    ]);
    const out = unzipSync(zip);
    expect(Object.keys(out)).toEqual(["a/one.txt", "two.bin", "ünï.txt"]);
    expect(Buffer.from(out["a/one.txt"]).toString()).toBe("hello");
    expect([...out["two.bin"]]).toEqual([0, 1, 2, 255]);
  });
  it("is the same bytes twice", () => {
    const entries = [{ path: "a.txt", bytes: text("same") }];
    expect(Buffer.from(buildZip(entries)).equals(Buffer.from(buildZip(entries)))).toBe(true);
  });
  it("refuses paths that could climb out of a folder, and repeated names", () => {
    expect(() => buildZip([{ path: "../x", bytes: text("") }])).toThrow(/safe path/);
    expect(() => buildZip([{ path: "/x", bytes: text("") }])).toThrow(/safe path/);
    expect(() => buildZip([{ path: "a//b", bytes: text("") }])).toThrow(/safe path/);
    expect(() => buildZip([{ path: "a", bytes: text("") }, { path: "a", bytes: text("") }])).toThrow(/Two files/);
  });
  it("makes an empty zip", () => {
    expect(Object.keys(unzipSync(buildZip([])))).toEqual([]);
  });
});
