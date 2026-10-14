import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { EMPTY_PROFILE } from "@/lib/fabrics";
import { fakeDeps, projectOf } from "./test-deps";
import { servePrintFiles } from "./serve";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { NO_PATTERN_SENTENCE } from "./pattern-source";

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const expectApp = async (promise: Promise<unknown>, code: string, message?: RegExp) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  if (message) expect((error as AppError).message).toMatch(message);
};

describe("serving the print zip", () => {
  it("sends one zip of the pieces with a manifest and a note, named after the style", async () => {
    const response = await servePrintFiles(fakeDeps(), { query: { sizes: "48", view: "back,collar" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain('filename="KW-001-v3-print-files.zip"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual([
      "KW-001-v3-print-files/README.txt",
      "KW-001-v3-print-files/manifest.csv",
      "KW-001-v3-print-files/manifest.json",
      "KW-001-v3-print-files/pieces/back_48.pdf",
      "KW-001-v3-print-files/pieces/collar_48.pdf",
    ]);
    const readme = text(files["KW-001-v3-print-files/README.txt"]);
    expect(readme).toContain("Draft pattern, not reviewed.");
    expect(readme).toContain("Knitwright default, not from your print house");
    expect(text(files["KW-001-v3-print-files/manifest.csv"]).split("\r\n").length).toBe(4);
  }, 60_000);

  it("makes SVG and TIFF when asked, and none is an SVG sent on its own", async () => {
    const response = await servePrintFiles(fakeDeps(), { query: { sizes: "48", view: "collar", format: "pdf,svg,tiff" } });
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(Object.keys(files).filter((n) => n.includes("pieces/")).sort()).toEqual(["KW-001-v3-print-files/pieces/collar_48.pdf", "KW-001-v3-print-files/pieces/collar_48.svg", "KW-001-v3-print-files/pieces/collar_48.tif"]);
    expect(response.headers.get("content-type")).not.toMatch(/svg/);
  }, 60_000);

  it("scales from a fabric's tested shrink and says so in the note", async () => {
    const profile = { ...EMPTY_PROFILE, shrinkLengthPct: { value: 2, source: "fabric-test" as const, testId: "t" }, shrinkWidthPct: { value: 1.5, source: "fabric-test" as const, testId: "t" } };
    const deps = fakeDeps({ fabric: async () => ({ name: "Interlock", profile }) });
    const response = await servePrintFiles(deps, { query: { sizes: "48", view: "collar", fabric: "22222222-2222-4222-8222-222222222222" } });
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(text(files["KW-001-v3-print-files/README.txt"])).toContain("Scale applied: 1.0204 along the length and 1.0152 across (fabric Interlock).");
  }, 60_000);

  it("makes a set for each player from a roster, and lists the rows it could not make", async () => {
    const rows = [...ROSTER_22.rows.slice(0, 2), { ...ROSTER_22.rows[2], sizeLabel: "9XL" }];
    const response = await servePrintFiles(fakeDeps(), { query: { sizes: "48" }, roster: { rows, name: "Test" } }).catch((e: unknown) => e);
    // The pattern has one size (48): M is cut from 48, L from 50, which this pattern does not have.
    expect(response instanceof Response).toBe(true);
    const files = unzipSync(new Uint8Array(await (response as Response).arrayBuffer()));
    const names = Object.keys(files);
    expect(names.some((n) => n.includes("players/01-7-OKAFOR/back_48.pdf"))).toBe(true);
    const readme = text(files["KW-001-v3-print-files/README.txt"]);
    expect(readme).toContain("Not made");
    expect(readme).toMatch(/9XL/);
  }, 120_000);

  it("turns the cut and bleed lines off when asked", async () => {
    const response = await servePrintFiles(fakeDeps(), { query: { sizes: "48", view: "collar", format: "svg", guides: "off" } });
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(text(files["KW-001-v3-print-files/pieces/collar_48.svg"])).not.toContain('id="guides"');
  }, 60_000);

  it("refuses what it cannot make, in plain words", async () => {
    await expectApp(servePrintFiles(fakeDeps(), { query: { sizes: "99" } }), "invalid_input", /no size 99. It has 48/);
    await expectApp(servePrintFiles(fakeDeps(), { query: { colourway: "nope" } }), "not_found", /no colourway/);
    await expectApp(servePrintFiles(fakeDeps(), { query: { format: "exe" } }), "invalid_input");
    await expectApp(servePrintFiles(fakeDeps({ fabric: async () => null }), { query: { fabric: "22222222-2222-4222-8222-222222222222" } }), "not_found", /not in your library/);
    await expectApp(servePrintFiles(fakeDeps({}, [], projectOf(jersey(), { garmentType: "hoodie" })), { query: {} }), "invalid_input", new RegExp(NO_PATTERN_SENTENCE));
    await expectApp(servePrintFiles(fakeDeps(), { query: {}, roster: { rows: [{ ...ROSTER_22.rows[0], sizeLabel: "9XL" }] } }), "invalid_input", /9XL/);
  });
});
