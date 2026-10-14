import { describe, expect, it } from "vitest";
import type { StrikeOff, SignOff } from "@/lib/proofs/types";
import { buildSnapshot } from "./build";
import { fakeBuilder, PROFILE, specFor } from "./fixtures/fake-builder";
import { releaseView } from "./view";

const REL = "44444444-4444-4444-8444-444444444444";
const OTHER = "55555555-5555-4555-8555-555555555555";

const release = async (rosterHash = false) => ({
  id: REL, number: 2, label: "Round 2", createdAt: "t", orderId: null, fileSpecs: [specFor("front")],
  snapshot: await buildSnapshot({ specVersion: 4, patternBlockId: "jersey", patternBlockVersion: 1, fabricTestIds: ["t1"], printProfile: PROFILE, roster: rosterHash ? [{ name: "A", number: "1", sizeLabel: "M", cut: "mens", quantity: 1 }] : null, files: [specFor("front")] }, fakeBuilder()),
});
const strike = (releaseId: string, over: Partial<StrikeOff> = {}): StrikeOff => ({
  id: "s1", releaseId, status: "accepted", requestedNote: "", requestedAt: "2026-10-15T00:00:00Z", receivedAt: "t", shrinkLengthPct: 2, shrinkWidthPct: 1.5,
  colourNotes: [], photoFileIds: [], decidedByName: "Ana", decidedRole: "Print lead", decidedOn: "2026-10-17", decisionNote: "", ...over,
});
const signed = (releaseId: string): SignOff => ({ id: "g1", releaseId, role: "print", signerName: "Ana", signedOn: "2026-10-16", note: "", createdAt: "t" });

describe("releaseView", () => {
  it("shows the frozen inputs, every file hash, who signed and the strike-off", async () => {
    const view = releaseView(await release(true), [signed(REL), signed(OTHER)], [strike(REL), strike(OTHER, { id: "s2" })]);
    expect(view).toMatchObject({ number: 2, specVersion: 4, patternBlockId: "jersey", hasTeamList: true, fabricTestIds: ["t1"] });
    expect(view.files).toHaveLength(1);
    expect(view.files[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(view.signOffs.find((l) => l.role === "print")?.sentence).toBe("Print signed by Ana on 2026-10-16.");
    expect(view.strikeOffs).toHaveLength(1);
    expect(view.strikeOffs[0]?.sentence).toContain("Accepted by Ana");
    expect(view.strikeOffs[0]?.shrinkTest?.shrinkLengthPct.value).toBe(2);
    expect(view.proofs.met).toBe(true);
  });
  it("shows an accepted strike-off on the release and a rejected one as blocking", async () => {
    const view = releaseView(await release(), [], [strike(REL, { status: "rejected" })]);
    expect(view.proofs.met).toBe(false);
    expect(view.hasTeamList).toBe(false);
    expect(view.signOffs.every((l) => l.signOff === null)).toBe(true);
  });
});
