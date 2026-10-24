import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import type { PrintFileBuilder, PrintFileSpec } from "@/lib/production/contract";
import { ROSTER_3 } from "./fixtures";
import { printZip, type ReleaseFiles } from "./print-zip";

const PROFILE = { bleedMm: 5, dpi: 150, maxPrintWidthMm: 1500, iccFileId: null, source: "default", minDpi: 100 } as unknown as PrintFileSpec["profile"];
const spec = (over: Partial<PrintFileSpec> = {}): PrintFileSpec => ({ pieceId: "front", size: "M", format: "pdf", bleedMm: 5, scaleX: 1, scaleY: 1, dpi: 150, profile: PROFILE, ...over });
const sha = (c: string) => c.repeat(64);

const builder = (bytes = "x", warnings: string[] = []): PrintFileBuilder => ({
  build: async (s) => ({ bytes: new TextEncoder().encode(`${bytes}-${s.pieceId}-${s.playerNumber ?? ""}`), sha256: sha("a"), pageWidthMm: 500, pageHeightMm: 700, warnings }),
});

const release = (ref: string, over: Partial<ReleaseFiles> = {}): ReleaseFiles => ({
  orderRef: ref,
  specs: [spec(), spec({ pieceId: "back", playerNumber: "10" })],
  frozen: new Map([["print/front-M.pdf", sha("a")], ["print/back-M-player-10.pdf", sha("a")]]),
  roster: ROSTER_3,
  builder: builder(),
  ...over,
});

describe("printZip", () => {
  it("puts each order's files in its own folder with a manifest and a README", async () => {
    const files = unzipSync(await printZip([release("STORE-1002"), release("STORE-1001")]));
    expect(Object.keys(files).sort()).toEqual(["README.txt", "STORE-1001/print/back-M-player-10.pdf", "STORE-1001/print/front-M.pdf", "STORE-1002/print/back-M-player-10.pdf", "STORE-1002/print/front-M.pdf", "manifest.csv"]);
    const manifest = strFromU8(files["manifest.csv"]!);
    expect(manifest).toContain("STORE-1001/print/back-M-player-10.pdf,back,M,10,OKAFOR");
    expect(manifest).not.toContain("differs from the release");
  });

  it("says in the manifest when a rebuilt file differs from the one frozen with the release, or was never in it", async () => {
    const odd = release("STORE-1001", { frozen: new Map([["print/front-M.pdf", sha("b")]]) });
    const manifest = strFromU8(unzipSync(await printZip([odd]))["manifest.csv"]!);
    expect(manifest).toContain("differs from the release");
    expect(manifest).toContain("not in the release");
  });

  it("keeps the player number but no name when the order has no team list", async () => {
    const manifest = strFromU8(unzipSync(await printZip([release("STORE-1001", { roster: null })]))["manifest.csv"]!);
    expect(manifest).toContain("STORE-1001/print/back-M-player-10.pdf,back,M,10,,pdf");
  });

  it("makes a folder name safe", async () => {
    const files = unzipSync(await printZip([release("../Evil Order/1")]));
    expect(Object.keys(files).some((p) => p.includes(".."))).toBe(false);
    expect(Object.keys(files).some((p) => p.startsWith("__Evil_Order_1/"))).toBe(true);
  });

  it("gives the same zip twice", async () => {
    const [a, b] = [await printZip([release("A"), release("B")]), await printZip([release("B"), release("A")])];
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
