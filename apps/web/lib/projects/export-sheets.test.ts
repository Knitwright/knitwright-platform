import { describe, expect, it } from "vitest";
import { jersey } from "@/lib/editor/fixtures/article";
import { DEFAULT_CHART_SET } from "@/lib/sizing";
import { readWorkbook } from "@/lib/techpack/exports/fixtures/xlsx-read";
import { fullDesign } from "@/lib/techpack/fixtures/designs";
import { serveExport, type DownloadEntry, type ExportDeps } from "./export-download";
import type { TechPackSource } from "./tech-pack-load";

/**
 * The eight-sheet workbook of the sheets preview (spec screen 31, decision 0151), served by the
 * tech pack's own export route as `xlsx?layout=sheets`: recorded and named like any Excel export.
 */

const PROJECT_ID = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

const source = (): TechPackSource => ({
  project: {
    id: PROJECT_ID,
    name: "Club shirt",
    styleNumber: "KW-001",
    season: "SS27",
    garmentType: "team-jersey",
    garmentLabel: "Team jersey",
    currentVersion: 3,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-29T10:00:00.000Z",
    versionSavedAt: "2026-09-29T10:00:00.000Z",
    spec: fullDesign("team-jersey"),
    dropped: [],
  },
  history: { hasMore: false, versions: [] },
  pictures: { images: new Map(), skipped: 0 },
  charts: DEFAULT_CHART_SET,
  illustrations: null,
  memberNames: new Map(),
});

const deps = (entries: DownloadEntry[], patch: Partial<ExportDeps> = {}): ExportDeps => ({
  brandName: "Test Brand",
  now: () => new Date("2026-11-13T12:00:00.000Z"),
  load: async () => source(),
  record: async (entry) => {
    entries.push(entry);
  },
  ...patch,
});

const ask = (patch: Partial<ExportDeps> = {}, entries: DownloadEntry[] = []) =>
  serveExport(deps(entries, patch), { projectId: PROJECT_ID, format: "xlsx", query: { layout: "sheets" } });

describe("the eight-sheet workbook", () => {
  it("sends eight named sheets with the shared header, recorded as an Excel download", async () => {
    const entries: DownloadEntry[] = [];
    const sent = await ask({ article: async () => jersey(), openIn: (id) => `https://kw.test/studio/${id}/tech-pack` }, entries);
    expect(sent.headers.get("content-disposition")).toBe('attachment; filename="KW-001-v3-tech-pack.xlsx"');
    const book = await readWorkbook(new Uint8Array(await sent.arrayBuffer()));
    expect(book.map((sheet) => sheet.sheet)).toEqual(["Overview", "Colourways", "Measurements", "Size chart", "Callouts", "Materials", "Artworks", "Labels"]);
    const cells = book.flatMap((sheet) => sheet.data.flat());
    expect(cells).toContain("Test Brand");
    expect(cells).toContain(`https://kw.test/studio/${PROJECT_ID}/tech-pack`);
    expect(cells).toContain("JSY-SS-01 (Class A)");
    expect(entries).toEqual([{ projectId: PROJECT_ID, version: 3, format: "xlsx", view: null }]);
  });

  it("still sends the sheets when the article cannot be read, saying what is missing", async () => {
    const sent = await ask({ article: async () => Promise.reject(new Error("down")) });
    const book = await readWorkbook(new Uint8Array(await sent.arrayBuffer()));
    const cells = book.flatMap((sheet) => sheet.data.flat());
    expect(cells).toContain("Needs your input");
    expect(cells).toContain(`/studio/${PROJECT_ID}/tech-pack`);
  });

  it("works with no article reader at all", async () => {
    const sent = await ask();
    expect(sent.status).toBe(200);
  });

  it("refuses a layout it does not know", async () => {
    await expect(serveExport(deps([]), { projectId: PROJECT_ID, format: "xlsx", query: { layout: "other" } })).rejects.toThrow();
  });
});
