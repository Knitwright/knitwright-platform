import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { contentsText, exportPaths, flowZip, foldersOf, safeName, type ExportEntry } from "./zip";

/** "Export all" (spec F-L4): a zip with a folder per format, and the labels travelling with the files. */

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

const entry = (over: Partial<ExportEntry> & Pick<ExportEntry, "boardId" | "name" | "format">): ExportEntry => ({
  bytes: bytes(`${over.boardId} bytes`),
  label: null,
  ...over,
});

const PACK: readonly ExportEntry[] = [
  entry({ boardId: "front", name: "Front render", format: "png" }),
  entry({ boardId: "turntable", name: "360° turntable", format: "mp4" }),
  entry({ boardId: "poster", name: "A4 poster", format: "pdf" }),
  entry({ boardId: "scene", name: "Team line-up (11)", format: "png", label: "AI-generated" }),
];

describe("where each output goes in the zip", () => {
  it("puts one folder per format and names a file after its board", () => {
    expect(exportPaths(PACK).map((file) => file.path)).toEqual([
      "png/front-render.png",
      "png/team-line-up-11.png",
      "mp4/360-turntable.mp4",
      "pdf/a4-poster.pdf",
    ]);
    expect(foldersOf(PACK)).toEqual(["png", "mp4", "pdf"]);
  });

  it("numbers a name used twice rather than letting one file replace the other", () => {
    const twice = [entry({ boardId: "a", name: "Front render", format: "png" }), entry({ boardId: "b", name: "Front render", format: "png" })];

    expect(exportPaths(twice).map((file) => file.path)).toEqual(["png/front-render.png", "png/front-render-2.png"]);
  });

  it("keeps a name inside its folder, whatever a person called the board", () => {
    expect(safeName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeName("  Order your kit! 9:16  ")).toBe("order-your-kit-9-16");
    expect(safeName("...")).toBe("asset");
    expect(safeName("")).toBe("asset");
  });
});

describe("the zip itself", () => {
  it("holds every output in its format's folder", () => {
    const files = unzipSync(flowZip(PACK));

    expect(Object.keys(files).sort()).toEqual([
      "contents.txt",
      "mp4/360-turntable.mp4",
      "pdf/a4-poster.pdf",
      "png/front-render.png",
      "png/team-line-up-11.png",
    ]);
    expect(strFromU8(files["png/front-render.png"] as Uint8Array)).toBe("front bytes");
  });

  it("gives the same bytes for the same outputs, because it carries no clock", () => {
    expect(flowZip(PACK)).toEqual(flowZip(PACK));
  });

  it("writes a contents list that says which pictures a model made", () => {
    const written = strFromU8(unzipSync(flowZip(PACK))["contents.txt"] as Uint8Array);

    expect(written).toContain("png/team-line-up-11.png\tTeam line-up (11)\tAI-generated");
    expect(written).toContain("png/front-render.png\tFront render");
    expect(written).not.toContain("front-render.png\tFront render\tAI");
    expect(written).toContain("An AI-made picture is never artwork");
  });

  it("is a zip with nothing but the contents list when nothing finished", () => {
    expect(Object.keys(unzipSync(flowZip([])))).toEqual(["contents.txt"]);
    expect(contentsText([])).toContain("one flow run");
  });

  it("keeps every file of a board that makes several, each with its own bytes", () => {
    const four = [1, 2, 3, 4].map((at) => ({ boardId: "scene", name: "City street", format: "png" as const, bytes: bytes(`picture ${at}`), label: "AI-generated" }));
    const files = unzipSync(flowZip(four));

    expect(Object.keys(files).sort()).toEqual([
      "contents.txt",
      "png/city-street-2.png",
      "png/city-street-3.png",
      "png/city-street-4.png",
      "png/city-street.png",
    ]);
    expect([...new Set(Object.values(files).map((one) => strFromU8(one as Uint8Array)))].length).toBe(5);
  });

  it("numbers past a name that already ends in the number it was about to use", () => {
    const clash = [
      { boardId: "a", name: "Front render", format: "png" as const, bytes: bytes("a"), label: null },
      { boardId: "b", name: "Front render", format: "png" as const, bytes: bytes("b"), label: null },
      { boardId: "c", name: "Front render 2", format: "png" as const, bytes: bytes("c"), label: null },
    ];

    expect(exportPaths(clash).map((file) => file.path).sort()).toEqual([
      "png/front-render-2-2.png",
      "png/front-render-2.png",
      "png/front-render.png",
    ]);
    expect(Object.keys(unzipSync(flowZip(clash))).length).toBe(4);
  });
});
