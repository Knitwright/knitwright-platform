import { describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/fabrics/fixtures/fake-db";
import { printFileSpecSchema } from "@/lib/production/contract";
import { releasePrintBuilder } from "./release-builder";
import { projectOf } from "./test-deps";

const spec = printFileSpecSchema.parse({
  pieceId: "back",
  size: "48",
  playerNumber: "7",
  format: "pdf",
  bleedMm: 15,
  scaleX: 1,
  scaleY: 1,
  dpi: 150,
  profile: { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" },
});

describe("the release builder", () => {
  it("reads the design once, on the first file, and builds the same bytes for the same spec", async () => {
    const db = fakeDb();
    let reads = 0;
    const make = releasePrintBuilder({ client: db.client, admin: db.client, brandId: "11111111-1111-4111-8111-111111111111", load: async () => (reads += 1, projectOf()) });
    const builder = make({ projectId: "p", roster: [{ name: "OKAFOR", number: "7", sizeLabel: "M" }] });
    expect(reads).toBe(0);
    const [a, b] = [await builder.build(spec), await builder.build(spec)];
    expect(reads).toBe(1);
    expect(a.sha256).toBe(b.sha256);
    const other = make({ projectId: "p", roster: null });
    expect((await other.build({ ...spec, playerNumber: undefined })).sha256).not.toBe(a.sha256);
  }, 60_000);
});
