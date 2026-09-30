import { beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { AppError } from "@/lib/server/core/errors";
import { DEFAULT_CHART_SET, withBrandCharts } from "@/lib/sizing";
import { madeUpChart } from "@/lib/sizing/fixtures/made-up-charts";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { readWorkbook } from "@/lib/techpack/exports/fixtures/xlsx-read";
import { PICTURE_LEFT_OUT } from "@/lib/techpack/exports/limits";
import { fullDesign } from "@/lib/techpack/fixtures/designs";
import { serveExport, type DownloadEntry, type ExportDeps } from "./export-download";
import type { OpenProject, VersionsPage } from "./service";
import type { TechPackSource } from "./tech-pack-load";

/** Counts the last check before a file is made, and what the PDF is asked to say. */
const seen = vi.hoisted(() => ({ guards: 0, pdfOptions: [] as unknown[] }));

vi.mock("@/lib/techpack/exports/guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/techpack/exports/guard")>();
  return {
    ...actual,
    assertEverySetCellHasSource: (...args: Parameters<typeof actual.assertEverySetCellHasSource>) => {
      seen.guards += 1;
      actual.assertEverySetCellHasSource(...args);
    },
  };
});

vi.mock("@/lib/techpack/exports/pdf/document", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/techpack/exports/pdf/document")>();
  return {
    ...actual,
    buildPdf: (...args: Parameters<typeof actual.buildPdf>) => {
      seen.pdfOptions.push(args[2]);
      return actual.buildPdf(...args);
    },
  };
});

beforeEach(() => {
  seen.guards = 0;
  seen.pdfOptions = [];
});

const PROJECT_ID = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

const openProject = (patch: Partial<OpenProject> = {}): OpenProject => ({
  id: PROJECT_ID,
  name: "Club shirt",
  styleNumber: "KW-001",
  season: "SS27",
  garmentType: "crew-tee",
  garmentLabel: "Crew neck tee",
  currentVersion: 3,
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-29T10:00:00.000Z",
  versionSavedAt: "2026-09-29T10:00:00.000Z",
  spec: fullDesign("crew-tee"),
  dropped: [],
  ...patch,
});

const history: VersionsPage = {
  hasMore: false,
  versions: [3, 2, 1].map((version) => ({ version, note: `Change ${version}.`, restoredFrom: null, createdAt: `2026-09-0${version}T10:00:00.000Z` })),
};

const source = (patch: Partial<TechPackSource> = {}): TechPackSource => ({
  project: openProject(),
  history,
  pictures: { images: new Map(), skipped: 0 },
  charts: DEFAULT_CHART_SET,
  illustrations: null,
  memberNames: new Map(),
  ...patch,
});

interface Log {
  readonly calls: string[];
  readonly entries: DownloadEntry[];
  readonly loads: { version?: number }[];
}

const deps = (overrides: Partial<ExportDeps> = {}): { deps: ExportDeps; log: Log } => {
  const log: Log = { calls: [], entries: [], loads: [] };
  return {
    log,
    deps: {
      brandName: "Test Brand",
      now: () => new Date("2026-09-30T12:00:00.000Z"),
      load: async (options) => {
        log.calls.push("load");
        log.loads.push(options);
        return source();
      },
      record: async (entry) => {
        log.calls.push("record");
        log.entries.push(entry);
      },
      ...overrides,
    },
  };
};

const ask = (format: "pdf" | "xlsx" | "svg", query: unknown = {}, override: Partial<ExportDeps> = {}) => {
  const made = deps(override);
  return { ...made, response: serveExport(made.deps, { projectId: PROJECT_ID, format, query }) };
};

const failure = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

describe("serving an export", () => {
  it("sends a PDF with every header, named from the style number and the version", async () => {
    const { response } = ask("pdf");
    const sent = await response;
    const bytes = new Uint8Array(await sent.arrayBuffer());

    expect(sent.status).toBe(200);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(sent.headers.get("content-type")).toBe("application/pdf");
    expect(sent.headers.get("content-disposition")).toBe('attachment; filename="KW-001-v3-tech-pack.pdf"');
    expect(sent.headers.get("cache-control")).toBe("no-store");
    expect(sent.headers.get("x-content-type-options")).toBe("nosniff");
    expect(sent.headers.get("content-length")).toBe(String(bytes.byteLength));
  });

  it("sends an Excel file that is a zip", async () => {
    const sent = await ask("xlsx").response;
    const bytes = new Uint8Array(await sent.arrayBuffer());

    expect(sent.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(sent.headers.get("content-disposition")).toBe('attachment; filename="KW-001-v3-tech-pack.xlsx"');
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
    expect(sent.headers.get("content-length")).toBe(String(bytes.byteLength));
  });

  it("sends an SVG for the view asked for, with a policy that sandboxes it, and never inline", async () => {
    const sent = await ask("svg", { view: "back" }).response;
    const text = await sent.text();

    expect(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sent.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(sent.headers.get("content-disposition")).toBe('attachment; filename="KW-001-v3-back.svg"');
    expect(sent.headers.get("content-security-policy")).toContain("sandbox");
    expect(sent.headers.get("content-length")).toBe(String(new TextEncoder().encode(text).byteLength));
  });

  it("records the download with the version, the format and the view, before the file is sent (T8)", async () => {
    const excel = ask("xlsx");
    await excel.response;
    expect(excel.log.entries).toEqual([{ projectId: PROJECT_ID, version: 3, format: "xlsx", view: null }]);
    expect(excel.log.calls).toEqual(["load", "record"]);

    const svg = ask("svg", { view: "front" });
    await svg.response;
    expect(svg.log.entries).toEqual([{ projectId: PROJECT_ID, version: 3, format: "svg", view: "front" }]);
  });

  it("records the version of the design that was read, not the one that was asked for by default", async () => {
    const made = ask("xlsx", { version: "2" }, { load: async () => source({ project: openProject({ currentVersion: 2 }) }) });
    const sent = await made.response;

    expect(made.log.entries[0]?.version).toBe(2);
    expect(sent.headers.get("content-disposition")).toContain("KW-001-v2-tech-pack.xlsx");
  });

  it("asks the loader for the version named in the address, and for the current one when none is named", async () => {
    const named = ask("xlsx", { version: "2" });
    await named.response;
    expect(named.log.loads).toEqual([{ version: 2 }]);

    const plain = ask("xlsx");
    await plain.response;
    expect(plain.log.loads).toEqual([{}]);
  });

  it("draws the colourway named in the address, and the first when none is named", async () => {
    const text = async (query: Record<string, string>) => (await ask("svg", { view: "front", ...query }).response).text();
    const [first, main, away] = [await text({}), await text({ colourway: "main" }), await text({ colourway: "away" })];

    expect(first).toBe(main);
    expect(away).not.toBe(main);
  });

  it("sends no file and gives an error when the download cannot be recorded (T8, R4)", async () => {
    const made = ask("xlsx", {}, {
      record: async () => {
        throw new AppError("internal", "Something went wrong on our side. Try again.");
      },
    });

    expect((await failure(made.response)).code).toBe("internal");
  });

  it("sends no file when recording fails for any reason, even one that is not an app error", async () => {
    for (const format of ["xlsx", "svg"] as const) {
      const made = ask(format, format === "svg" ? { view: "front" } : {}, {
        record: async () => {
          throw new Error("The database is down.");
        },
      });
      await expect(made.response).rejects.toThrow("The database is down.");
    }
  });

  it("records nothing when the design is not found", async () => {
    const made = ask("pdf", {}, {
      load: async () => {
        throw new AppError("not_found", "That design does not exist.");
      },
    });

    expect((await failure(made.response)).code).toBe("not_found");
    expect(made.log.entries).toEqual([]);
  });

  it("refuses a query that is not valid before it reads anything", async () => {
    for (const [format, query] of [["svg", {}], ["pdf", { view: "front" }], ["pdf", { version: "0" }], ["xlsx", { extra: "1" }]] as const) {
      const made = ask(format, query);
      const refused = await failure(made.response);
      expect(refused.code, JSON.stringify(query)).toBe("invalid_input");
      expect(made.log.calls).toEqual([]);
    }
  });

  it("says so, and records nothing, when the garment type has no drawing", async () => {
    const noDrawing = source({ project: openProject({ spec: { ...start("crew-tee"), typeId: "kilt" } }) });
    const made = ask("svg", { view: "front" }, { load: async () => noDrawing });

    const refused = await failure(made.response);

    expect(refused).toMatchObject({ code: "not_found", message: "There is no drawing for this garment type yet." });
    expect(made.log.entries).toEqual([]);
  });

  it("says in the file that a picture was left out when one was", async () => {
    const left = source({ pictures: { images: new Map(), skipped: 2 } });
    const sent = await ask("svg", { view: "front" }, { load: async () => left }).response;

    expect(await sent.text()).toContain(PICTURE_LEFT_OUT);
  });

  it("tells the PDF to say a picture was left out when one was, and not otherwise", async () => {
    const left = source({ pictures: { images: new Map(), skipped: 1 } });
    await ask("pdf", {}, { load: async () => left }).response;
    await ask("pdf").response;

    expect(seen.pdfOptions).toEqual([
      { pictureLeftOut: true, illustrations: null },
      { pictureLeftOut: false, illustrations: null },
    ]);
  });

  it.each(["pdf", "xlsx", "svg"] as const)("checks the document once before a %s is made", async (format) => {
    await ask(format, format === "svg" ? { view: "front" } : {}).response;

    expect(seen.guards).toBe(1);
  });

  it("takes the printed date from the clock it is given", async () => {
    const sent = await ask("svg", { view: "front" }).response;

    expect(await sent.text()).toContain("<svg");
    const made = deps();
    expect(made.deps.now().toISOString()).toBe("2026-09-30T12:00:00.000Z");
  });

  it("makes the file from the size charts the loader read, a brand's own chart included, as the page does", async () => {
    const brandCharts = withBrandCharts(DEFAULT_CHART_SET, [
      {
        run: { id: "brand-women-crew-tee-any", wearer: "women", sizes: ["U1", "U2", "U3", "U4"] },
        chart: { ...madeUpChart("crew-tee", "women"), sizeRunId: "brand-women-crew-tee-any", supplier: "brand" },
      },
    ]);
    const design = openProject({ spec: start("crew-tee", "women") });
    const made = ask("xlsx", {}, { load: async () => source({ project: design, charts: brandCharts }) });
    const sheets = await readWorkbook(new Uint8Array(await (await made.response).arrayBuffer()));
    const cells = sheets.flatMap((sheet) => sheet.data.flat());
    expect(cells.some((cell) => typeof cell === "string" && cell.includes("U1"))).toBe(true);
  });

  it("names who made each version in the PDF and the Excel file, from the brand's members only", async () => {
    const ADA = "11111111-1111-4111-8111-111111111111";
    const STRANGER = "33333333-3333-4333-8333-333333333333";
    const made: VersionsPage = {
      ...history,
      versions: history.versions.map((entry, index) => ({ ...entry, createdBy: [ADA, STRANGER, ADA][index] ?? null })),
    };
    const load = async () => source({ history: made, memberNames: new Map([[ADA, "Ada Lovelace"]]) });

    const workbook = await readWorkbook(new Uint8Array(await (await ask("xlsx", {}, { load }).response).arrayBuffer()));
    const cells = workbook.flatMap((sheet) => sheet.data.flat()).filter((cell): cell is string => typeof cell === "string");
    expect(cells.filter((cell) => cell === "Ada Lovelace")).toHaveLength(2);
    expect(cells).toContain("Not recorded");

    const pdf = await readPdf(new Uint8Array(await (await ask("pdf", {}, { load }).response).arrayBuffer()));
    expect(pdf.text).toContain("Ada Lovelace");
    expect(pdf.text).not.toContain(STRANGER);
  });

  it("carries the AI illustrations of the version exported, and leaves out ones made from a later version", async () => {
    const illustrations = {
      version: 3,
      illustrations: [{ view: "front" as const, label: "Front", src: "data:image/jpeg;base64,AAAA", alt: "AI illustration." }],
    };
    const sheetsOf = async (version: number) => {
      const made = ask("xlsx", {}, { load: async () => source({ project: openProject({ currentVersion: version }), illustrations }) });
      return (await readWorkbook(new Uint8Array(await (await made.response).arrayBuffer()))).map((sheet) => sheet.sheet);
    };
    expect(await sheetsOf(3)).toContain("Illustrations");
    expect(await sheetsOf(2)).not.toContain("Illustrations");
  });
});
