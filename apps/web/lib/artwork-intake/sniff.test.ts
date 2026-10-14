import { describe, expect, it } from "vitest";
import { sniffArtwork } from "./sniff";

const text = (value: string) => new TextEncoder().encode(value);

describe("sniffArtwork", () => {
  it("reads the type from the first bytes", () => {
    expect(sniffArtwork(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("png");
    expect(sniffArtwork(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffArtwork(Uint8Array.from([0x49, 0x49, 0x2a, 0x00, 8]))).toBe("tiff");
    expect(sniffArtwork(Uint8Array.from([0x4d, 0x4d, 0x00, 0x2a, 0]))).toBe("tiff");
    expect(sniffArtwork(text("%PDF-1.7\n1 0 obj"))).toBe("pdf");
  });

  it("allows the short run of bytes some PDF writers put before the header", () => {
    expect(sniffArtwork(text(`${"x".repeat(100)}%PDF-1.4`))).toBe("pdf");
    expect(sniffArtwork(text(`${"x".repeat(2000)}%PDF-1.4`))).toBeNull();
  });

  it("recognises an SVG by its text, with a byte order mark, a declaration or a comment before it", () => {
    expect(sniffArtwork(text("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBe("svg");
    expect(sniffArtwork(text('  \n<?xml version="1.0"?>\n<svg/>'))).toBe("svg");
    expect(sniffArtwork(Uint8Array.from([0xef, 0xbb, 0xbf, ...text("<svg/>")]))).toBe("svg");
    expect(sniffArtwork(text("<!-- made by hand --><svg/>"))).toBe("svg");
  });

  it("names a native Illustrator file so it can be refused with advice", () => {
    expect(sniffArtwork(text("%!PS-Adobe-3.0 EPSF-3.0\n%%Creator: Adobe Illustrator"))).toBe("ai-native");
  });

  it("does not trust a name: HTML and other text are not artwork", () => {
    expect(sniffArtwork(text("<html><body>hi</body></html>"))).toBeNull();
    expect(sniffArtwork(text("hello"))).toBeNull();
    expect(sniffArtwork(new Uint8Array(0))).toBeNull();
    expect(sniffArtwork(Uint8Array.from([0xff, 0xfe, 0x3c, 0x00]))).toBeNull();
  });
});
