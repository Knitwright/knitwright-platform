import { describe, expect, it } from "vitest";
import { labelFrom } from "./label";

describe("labelFrom", () => {
  it("keeps a readable name and drops the extension", () => {
    expect(labelFrom("Club crest (final).png")).toBe("Club crest (final)");
    expect(labelFrom("Ünïcode Crëst.svg")).toBe("Ünïcode Crëst");
  });

  it("never returns a path, a dot-file or markup", () => {
    expect(labelFrom("../../etc/passwd")).toBe("passwd");
    expect(labelFrom("C:\\Users\\me\\logo.tiff")).toBe("logo");
    expect(labelFrom(".htaccess")).toBe("htaccess");
    expect(labelFrom("<script>alert(1)</script>.svg")).toBe("script");
    expect(labelFrom("a\u0000b\nc.png")).toBe("a b c");
  });

  it("falls back to a plain word and limits the length", () => {
    expect(labelFrom("")).toBe("Artwork");
    expect(labelFrom("%%%.png")).toBe("Artwork");
    expect(labelFrom(`${"x".repeat(200)}.png`)).toHaveLength(80);
  });
});
