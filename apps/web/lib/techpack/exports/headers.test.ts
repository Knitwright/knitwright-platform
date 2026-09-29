import { describe, expect, it } from "vitest";
import { exportFileName } from "./file-names";
import { CONTENT_TYPES, SVG_POLICY, downloadResponse, exportHeaders } from "./headers";

const pdfName = exportFileName({ styleNumber: "KW-001", designName: "x", version: 3, format: "pdf", view: null });
const svgName = exportFileName({ styleNumber: "KW-001", designName: "x", version: 3, format: "svg", view: "front" });

describe("export headers", () => {
  it("sets the type, the disposition, no caching, no sniffing and the length, for a PDF", () => {
    expect(exportHeaders("pdf", pdfName, 1234)).toEqual({
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="KW-001-v3-tech-pack.pdf"',
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-length": "1234",
    });
  });

  it("uses the spreadsheet type for Excel", () => {
    expect(exportHeaders("xlsx", pdfName, 1)["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("adds a policy that stops an SVG from running or loading anything, and never serves it inline", () => {
    const headers = exportHeaders("svg", svgName, 10);
    expect(headers["content-type"]).toBe("image/svg+xml; charset=utf-8");
    expect(headers["content-security-policy"]).toBe("default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
    expect(headers["content-security-policy"]).toBe(SVG_POLICY);
    expect(headers["content-disposition"].startsWith("attachment;")).toBe(true);
  });

  it("adds the policy to SVG only", () => {
    expect(exportHeaders("pdf", pdfName, 1)).not.toHaveProperty("content-security-policy");
    expect(exportHeaders("xlsx", pdfName, 1)).not.toHaveProperty("content-security-policy");
  });

  it("holds a type for every format", () => {
    expect(Object.keys(CONTENT_TYPES).sort()).toEqual(["pdf", "svg", "xlsx"]);
  });

  it("refuses a length that is not a whole number of bytes", () => {
    expect(() => exportHeaders("pdf", pdfName, -1)).toThrow();
    expect(() => exportHeaders("pdf", pdfName, 1.5)).toThrow();
    expect(() => exportHeaders("pdf", pdfName, Number.NaN)).toThrow();
  });
});

describe("the response", () => {
  it("carries the bytes and a content length that matches them", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45]);
    const response = downloadResponse("pdf", pdfName, bytes);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("5");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it("carries text as UTF-8 bytes, and the length counts bytes and not characters", async () => {
    const response = downloadResponse("svg", svgName, "<svg>é</svg>");
    expect(response.headers.get("content-length")).toBe(String(new TextEncoder().encode("<svg>é</svg>").byteLength));
    expect(await response.text()).toBe("<svg>é</svg>");
  });
});
