import { describe, expect, it } from "vitest";
import { AI_WITHOUT_PDF, COMPRESSED_SVG, NOT_ACCEPTED, sniffArtwork, WIDE_TEXT_SVG } from "./sniff";

const text = (value: string) => new TextEncoder().encode(value);

describe("sniffArtwork", () => {
  it("reads the type from the first bytes", () => {
    expect(sniffArtwork(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toEqual({ ok: true, format: "png" });
    expect(sniffArtwork(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ ok: true, format: "jpeg" });
    expect(sniffArtwork(Uint8Array.from([0x49, 0x49, 0x2a, 0x00, 8]))).toEqual({ ok: true, format: "tiff" });
    expect(sniffArtwork(Uint8Array.from([0x4d, 0x4d, 0x00, 0x2a, 0]))).toEqual({ ok: true, format: "tiff" });
    expect(sniffArtwork(Uint8Array.from([0x49, 0x49, 0x2b, 0x00, 8]))).toEqual({ ok: true, format: "tiff" });
  });

  it("takes a PDF, and an Illustrator file saved with PDF compatibility is a PDF", () => {
    expect(sniffArtwork(text("%PDF-1.7\n%âãÏÓ\n"))).toEqual({ ok: true, format: "pdf" });
    expect(sniffArtwork(text(`junk before the header ${"x".repeat(100)}%PDF-1.5`))).toEqual({ ok: true, format: "pdf" });
  });

  it("refuses a native Illustrator file with the way to save it properly", () => {
    expect(sniffArtwork(text("%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator(R) 17.0"))).toEqual({ ok: false, message: AI_WITHOUT_PDF });
    expect(AI_WITHOUT_PDF).toContain("Create PDF compatible file");
  });

  it("takes an SVG however it starts, with or without a declaration, comment or byte order mark", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    for (const start of [svg, `  \n${svg}`, `<?xml version="1.0"?>\n${svg}`, `<!-- made by hand -->${svg}`, `ï»¿${svg}`]) {
      const bytes = start.startsWith("ï") ? Uint8Array.from([0xef, 0xbb, 0xbf, ...text(svg)]) : text(start);
      expect(sniffArtwork(bytes)).toEqual({ ok: true, format: "svg" });
    }
    expect(sniffArtwork(text(`<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">${svg}`))).toEqual({ ok: true, format: "svg" });
  });

  it("tolerates a multi-byte character cut by the end of the window", () => {
    const body = `<svg xmlns="http://www.w3.org/2000/svg"><title>${"é".repeat(3000)}</title></svg>`;
    expect(sniffArtwork(text(body))).toEqual({ ok: true, format: "svg" });
  });

  it("does not trust a name: HTML and plain text are not accepted, even if they mention svg", () => {
    expect(sniffArtwork(text("<html><body><svg></svg></body></html>"))).toEqual({ ok: false, message: NOT_ACCEPTED });
    expect(sniffArtwork(text("hello"))).toEqual({ ok: false, message: NOT_ACCEPTED });
    expect(sniffArtwork(new Uint8Array(0))).toEqual({ ok: false, message: NOT_ACCEPTED });
    expect(sniffArtwork(Uint8Array.from([0xff, 0xfa, 0xfb, 0xc0]))).toEqual({ ok: false, message: NOT_ACCEPTED });
  });

  it("refuses compressed SVG and text in a wide encoding with a sentence each", () => {
    expect(sniffArtwork(Uint8Array.from([0x1f, 0x8b, 8, 0]))).toEqual({ ok: false, message: COMPRESSED_SVG });
    expect(sniffArtwork(Uint8Array.from([0xff, 0xfe, 0x3c, 0x00]))).toEqual({ ok: false, message: WIDE_TEXT_SVG });
    expect(sniffArtwork(Uint8Array.from([0xfe, 0xff, 0x00, 0x3c]))).toEqual({ ok: false, message: WIDE_TEXT_SVG });
  });
});
