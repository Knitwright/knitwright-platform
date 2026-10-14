import { describe, expect, it } from "vitest";
import { manifestCsv, type ManifestLine } from "./manifest";

const line = (name: string): ManifestLine => ({
  path: "players/01/back_48.pdf", kind: "player", pieceId: "back", view: "back", size: "48", sizeLabel: "M", player: { name, number: "7" }, playerIndex: 1,
  format: "pdf", sha256: "a".repeat(64), pageWidthMm: 1, pageHeightMm: 2, lowestDpi: null, flattened: false, warnings: [], byteLength: 10,
});

describe("manifest csv", () => {
  it("does not let a name run as a spreadsheet formula", () => {
    for (const name of ["=1+1", "+SUM(A1)", "-2", "@cmd", "\tTAB"]) {
      const row = manifestCsv([line(name)]).split("\r\n")[1];
      expect(row, name).toContain(`'${name}`);
      expect(row, name).not.toMatch(/,[=+\-@\t]/);
    }
  });
  it("leaves a plain name and the numbers alone", () => {
    const row = manifestCsv([line("OKAFOR")]).split("\r\n")[1];
    expect(row).toContain(",7,OKAFOR,pdf,1,2,");
  });
});
