import { describe, expect, it } from "vitest";
import type { ArtworkRecord } from "@/lib/artwork-intake";
import { DEFAULT_PRINT_PROFILE } from "@/lib/print/profiles/schemas";
import type { SignOff, StrikeOff } from "@/lib/proofs/types";
import { IMPORT_REPORT, withStack } from "@/lib/techpack/fixtures/stacks";
import { ALL_KINDS_STACK, CREST_LAYER, PICTURE_STACK } from "@/lib/techpack/fixtures/stacks";
import { targetedJersey } from "@/lib/techpack/fixtures/production";
import { loadProduction, type AcceptedImport, type ProductionReaders } from "./tech-pack-production";

const record = (id: string, widthPx = 1200): ArtworkRecord => ({
  id, brandId: "b", kind: "raster", sourceFormat: "png", label: `Picture ${id}`, widthPx, heightPx: widthPx, dpiMeta: 300, colourSpace: "srgb",
  profileName: null, hasAlpha: true, screenFileId: "f", printFileId: "p", vectorFileId: null, warnings: [], sourceSha256: "a", printSha256: "b", createdAt: "2026-10-01T00:00:00Z",
});

const strike = (patch: Partial<StrikeOff>): StrikeOff => ({
  id: "s1", releaseId: "r2", status: "accepted", requestedNote: "", requestedAt: "2026-10-05T00:00:00Z", receivedAt: "2026-10-07T00:00:00Z", shrinkLengthPct: 2, shrinkWidthPct: 1.5,
  colourNotes: [], photoFileIds: [], decidedByName: "Sam Lee", decidedRole: "owner", decidedOn: "2026-10-09", decisionNote: "", ...patch,
});

const signOff: SignOff = { id: "g1", releaseId: "r2", role: "print", signerName: "Ana Reyes", signedOn: "2026-10-03", note: "", createdAt: "2026-10-03T10:00:00Z" };

const accepted: AcceptedImport = { report: IMPORT_REPORT, acceptedLayerIds: ["ground-body", "crest", "sponsor"], acceptedBy: "user-1", acceptedAt: "2026-10-12T09:30:00Z" };

const readers = (patch: Partial<ProductionReaders> = {}): ProductionReaders => ({
  artworks: async () => [record("crest-1"), record("tile-1", 600), record("other")],
  printProfile: async () => ({ ...DEFAULT_PRINT_PROFILE, source: "print-house", minDpi: 200 }),
  releases: async () => [{ id: "r2", number: 2, label: "Second", createdAt: "2026-10-04T00:00:00Z" }, { id: "r1", number: 1, label: "First", createdAt: "2026-10-01T00:00:00Z" }],
  releaseFiles: async () => 40,
  strikeOffs: async () => [strike({}), strike({ id: "s0", releaseId: "r1", requestedAt: "2026-10-02T00:00:00Z", decidedByName: "Old Name" })],
  signOffs: async () => [signOff, { ...signOff, id: "g0", releaseId: "r1", signerName: "Earlier" }],
  acceptedImports: async () => [accepted],
  ...patch,
});

const names = new Map([["user-1", "Mia Chen"]]);
const spec = withStack(ALL_KINDS_STACK, targetedJersey());

describe("what the production services give the tech pack", () => {
  it("gives the pictures the design places, with their pixel sizes, and no others", async () => {
    const found = await loadProduction(readers(), { spec, names });
    expect(found.assets?.map((asset) => asset.id)).toEqual(["crest-1", "tile-1"]);
    expect(found.assets?.[0]).toEqual({ id: "crest-1", label: "Picture crest-1", kind: "raster", widthPx: 1200, heightPx: 1200, dpiMeta: 300 });
  });

  it("gives the print house's profile and its lowest dpi, labelled with where they came from", async () => {
    const found = await loadProduction(readers(), { spec, names });
    expect(found.printProfile).toEqual({ bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "print-house" });
    expect(found.minDpi).toEqual({ value: 200, source: "print-house" });
    const none = await loadProduction(readers({ printProfile: async () => DEFAULT_PRINT_PROFILE }), { spec, names });
    expect(none.minDpi).toEqual({ value: 150, source: "knitwright-default" });
  });

  it("gives the newest release, and the newest strike-off accepted for any release, so the tech pack can tell which release it is for", async () => {
    const found = await loadProduction(readers(), { spec, names });
    expect(found.release).toEqual({ id: "r2", files: 40, createdOn: "4 Oct 2026" });
    expect(found.strikeOff).toMatchObject({ releaseId: "r2", name: "Sam Lee", date: "9 Oct 2026", dateIso: "2026-10-09" });
    const older = await loadProduction(readers({ strikeOffs: async () => [strike({ releaseId: "r1" })] }), { spec, names });
    expect(older.strikeOff?.releaseId).toBe("r1");
    expect(older.release?.id).toBe("r2");
  });

  it("gives no strike-off that nobody accepted or that has no name", async () => {
    const waiting = await loadProduction(readers({ strikeOffs: async () => [strike({ status: "received", decidedByName: null })] }), { spec, names });
    expect(waiting.strikeOff).toBeNull();
    const unnamed = await loadProduction(readers({ strikeOffs: async () => [strike({ decidedByName: null })] }), { spec, names });
    expect(unnamed.strikeOff).toBeNull();
  });

  it("gives the sign-offs of the newest release only", async () => {
    const found = await loadProduction(readers(), { spec, names });
    expect(found.signOffs).toEqual([{ role: "print", name: "Ana Reyes", date: "3 Oct 2026", dateIso: "2026-10-03" }]);
  });

  it("gives no release when the design has none", async () => {
    const found = await loadProduction(readers({ releases: async () => [] }), { spec, names });
    expect(found.release).toBeNull();
    expect(found.signOffs).toEqual([]);
  });

  it("gives the reading a design came from, and who accepted it, by name", async () => {
    const found = await loadProduction(readers(), { spec: withStack(PICTURE_STACK, targetedJersey()), names });
    expect(found.picture).toEqual({ report: IMPORT_REPORT, acceptedLayerIds: ["ground-body", "crest", "sponsor"], acceptedBy: { name: "Mia Chen", date: "12 Oct 2026", dateIso: "2026-10-12" } });
  });

  it("gives no reading for a design none of whose layers was read from a picture", async () => {
    expect((await loadProduction(readers(), { spec, names })).picture).toBeNull();
  });

  it("gives no reading for an acceptance whose layers are not in the design", async () => {
    const other = { ...accepted, acceptedLayerIds: ["somebody-elses"] };
    const found = await loadProduction(readers({ acceptedImports: async () => [other] }), { spec: withStack(PICTURE_STACK, targetedJersey()), names });
    expect(found.picture).toBeNull();
  });

  it("does not count an acceptance by someone who has left the brand, since there is no name to show", async () => {
    const found = await loadProduction(readers(), { spec: withStack(PICTURE_STACK, targetedJersey()), names: new Map() });
    expect(found.picture).toMatchObject({ acceptedBy: null });
  });

  it("leaves out a part that cannot be read, so the document is still made and its list says what is missing", async () => {
    const boom = async () => {
      throw new Error("down");
    };
    const found = await loadProduction(readers({ artworks: boom, printProfile: boom, releases: boom, strikeOffs: boom, signOffs: boom, acceptedImports: boom }), { spec, names });
    expect(found).toEqual({});
  });

  it("reads nothing about pictures for a design with no stack", async () => {
    const found = await loadProduction(readers(), { spec: targetedJersey(), names });
    expect(found.assets).toBeUndefined();
    expect(found.picture).toBeUndefined();
    expect(CREST_LAYER.kind).toBe("graphic");
  });
});
