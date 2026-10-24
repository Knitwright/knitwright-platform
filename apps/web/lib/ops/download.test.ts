import { describe, expect, it } from "vitest";
import { fileResponse, sheetFileName } from "./download";

describe("downloads", () => {
  it("names a file from the article, the cut-off date and the kind", () => {
    expect(sheetFileName({ articleId: "team-jersey", cutoffAt: "2026-10-23T17:00:00.000Z" }, "factory-sheet.pdf")).toBe("team-jersey-2026-10-23-factory-sheet.pdf");
    expect(sheetFileName({ articleId: '../"x y', cutoffAt: "2026-10-23T17:00:00.000Z" }, "a.zip")).toBe("____x_y-2026-10-23-a.zip");
    expect(sheetFileName({ articleId: "", cutoffAt: "2026-10-23T17:00:00.000Z" }, "a.zip")).toBe("batch-2026-10-23-a.zip");
  });

  it("sends the bytes as an attachment that is never stored or sniffed", async () => {
    const res = fileResponse(new Uint8Array([1, 2, 3]), "application/pdf", "a.pdf");
    expect(Object.fromEntries(res.headers)).toMatchObject({ "content-type": "application/pdf", "content-disposition": 'attachment; filename="a.pdf"', "cache-control": "no-store", "x-content-type-options": "nosniff", "content-length": "3" });
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3]);
  });
});
