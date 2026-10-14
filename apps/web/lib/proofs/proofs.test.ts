import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { shrinkTestFrom } from "./fabric-test";
import { proofReadiness } from "./readiness";
import { decideStrikeOffBody, receiveStrikeOffBody, signOffBody, today } from "./schemas";
import { signOffLines, signOffSentence, strikeOffSentence } from "./sentences";
import { addSignOff, decideStrikeOff, listSignOffs, listStrikeOffs, receiveStrikeOff, requestStrikeOff } from "./service";
import type { SignOff, StrikeOff } from "./types";

const ID = "33333333-3333-4333-8333-333333333333";
const REL = "44444444-4444-4444-8444-444444444444";
const WHO = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };

const strike = (over: Partial<StrikeOff> = {}): StrikeOff => ({
  id: ID, releaseId: REL, status: "requested", requestedNote: "", requestedAt: "2026-10-15T00:00:00Z", receivedAt: null,
  shrinkLengthPct: null, shrinkWidthPct: null, colourNotes: [], photoFileIds: [], decidedByName: null, decidedRole: null, decidedOn: null, decisionNote: "", ...over,
});
const accepted = (over: Partial<StrikeOff> = {}) => strike({ status: "accepted", decidedByName: "Ana Print", decidedRole: "Print lead", decidedOn: "2026-10-17", ...over });
const rejected = (over: Partial<StrikeOff> = {}) => strike({ status: "rejected", decidedByName: "Bo", decidedRole: "Club", decidedOn: "2026-10-17", ...over });

describe("proofReadiness", () => {
  it("is open with nothing asked for, and says who acts", () => {
    expect(proofReadiness([])).toMatchObject({ id: "strike-off", met: false, whoActs: "owner", sentence: "No strike-off has been asked for." });
  });
  it("waits on the print house while a strike-off has not arrived", () => {
    expect(proofReadiness([strike()])).toMatchObject({ met: false, whoActs: "print-house" });
  });
  it("waits on the owner when it has arrived", () => {
    expect(proofReadiness([strike({ status: "received" })])).toMatchObject({ met: false, whoActs: "owner" });
  });
  it("is met when the newest decided strike-off was accepted, and names who", () => {
    const item = proofReadiness([accepted()]);
    expect(item.met).toBe(true);
    expect(item.sentence).toContain("Ana Print");
  });
  it("is blocked by a rejected strike-off", () => {
    expect(proofReadiness([rejected()])).toMatchObject({ met: false, whoActs: "print-house" });
  });
  it("is blocked when the newest decision is a rejection, even after an earlier acceptance", () => {
    expect(proofReadiness([accepted({ requestedAt: "2026-10-15T00:00:00Z" }), rejected({ id: "x", requestedAt: "2026-10-16T00:00:00Z" })]).met).toBe(false);
  });
  it("is met when a later strike-off was accepted after a rejection", () => {
    expect(proofReadiness([rejected({ requestedAt: "2026-10-15T00:00:00Z" }), accepted({ id: "x", requestedAt: "2026-10-16T00:00:00Z" })]).met).toBe(true);
  });
  it("is not changed by a new request nobody has decided", () => {
    expect(proofReadiness([accepted(), strike({ id: "y", requestedAt: "2026-10-18T00:00:00Z" })]).met).toBe(true);
  });
  it("says a named person when a record has no name", () => {
    expect(proofReadiness([accepted({ decidedByName: null, decidedOn: null })]).sentence).toBe("The strike-off was accepted by a named person on a recorded date.");
    expect(proofReadiness([rejected({ decidedByName: null })]).sentence).toContain("a named person");
  });
});

describe("sentences", () => {
  const signed = (role: SignOff["role"], createdAt = "2026-10-16T00:00:00Z", signerName = "Ana"): SignOff => ({ id: role + createdAt, releaseId: REL, role, signerName, signedOn: "2026-10-16", note: "", createdAt });
  it("writes a sign-off as signed by, with a name and a date", () => {
    expect(signOffSentence(signed("print"))).toBe("Print signed by Ana on 2026-10-16.");
  });
  it("lists every role and shows who is missing", () => {
    const lines = signOffLines([signed("print", "2026-10-16T00:00:00Z", "Old"), signed("print", "2026-10-17T00:00:00Z", "New")]);
    expect(lines.map((l) => l.role)).toEqual(["pattern", "print", "production", "club"]);
    expect(lines[1]?.sentence).toContain("New");
    expect(lines[0]?.sentence).toBe("Pattern: not signed yet.");
  });
  it("describes each state of a strike-off", () => {
    expect(strikeOffSentence(strike())).toContain("Waiting");
    expect(strikeOffSentence(strike({ status: "received" }))).toContain("arrived");
    expect(strikeOffSentence(accepted())).toBe("Accepted by Ana Print (Print lead) on 2026-10-17.");
    expect(strikeOffSentence(rejected())).toBe("Rejected by Bo (Club) on 2026-10-17.");
    expect(strikeOffSentence(rejected({ decidedByName: null, decidedRole: null, decidedOn: null }))).toBe("Rejected by no name (no role) on no date.");
    expect(strikeOffSentence(accepted({ decidedByName: null, decidedRole: null, decidedOn: null }))).toBe("Accepted by no name (no role) on no date.");
  });
});

describe("shrinkTestFrom", () => {
  it("gives fabric-test values that name the strike-off", () => {
    expect(shrinkTestFrom(strike({ shrinkLengthPct: 2, shrinkWidthPct: 1.5 }))).toEqual({
      testId: `strike-off-${ID}`,
      shrinkLengthPct: { value: 2, source: "fabric-test", testId: `strike-off-${ID}` },
      shrinkWidthPct: { value: 1.5, source: "fabric-test", testId: `strike-off-${ID}` },
    });
  });
  it("gives nothing for half a measurement", () => {
    expect(shrinkTestFrom(strike({ shrinkLengthPct: 2 }))).toBeNull();
    expect(shrinkTestFrom(strike({ shrinkWidthPct: 2 }))).toBeNull();
  });
});

describe("schemas", () => {
  it("cleans a name and refuses one with a formula in it", () => {
    expect(signOffBody.parse({ role: "print", name: "  Ana   Print ", note: "" }).name).toBe("Ana Print");
    expect(signOffBody.safeParse({ role: "print", name: "=1+1" }).success).toBe(false);
    expect(signOffBody.safeParse({ role: "print", name: "   " }).success).toBe(false);
    expect(signOffBody.safeParse({ role: "boss", name: "Ana" }).success).toBe(false);
  });
  it("refuses a date in the future", () => {
    expect(signOffBody.safeParse({ role: "club", name: "Ana", signedOn: "2999-01-01" }).success).toBe(false);
    expect(signOffBody.safeParse({ role: "club", name: "Ana", signedOn: today(new Date()) }).success).toBe(true);
  });
  it("needs a name and a role to decide", () => {
    expect(decideStrikeOffBody.safeParse({ accept: true, name: "Ana", role: "" }).success).toBe(false);
    expect(decideStrikeOffBody.parse({ accept: false, name: "Ana", role: "Club" })).toMatchObject({ accept: false, note: "" });
  });
  it("bounds shrink and photos", () => {
    const base = { shrinkLengthPct: 2, shrinkWidthPct: 1.5, colourNotes: [], photoFileIds: [] };
    expect(receiveStrikeOffBody.safeParse(base).success).toBe(true);
    expect(receiveStrikeOffBody.safeParse({ ...base, shrinkLengthPct: 31 }).success).toBe(false);
    expect(receiveStrikeOffBody.safeParse({ ...base, shrinkWidthPct: -1 }).success).toBe(false);
    expect(receiveStrikeOffBody.safeParse({ ...base, photoFileIds: Array(7).fill(ID) }).success).toBe(false);
  });
  it("gives today's date in UTC", () => {
    expect(today(new Date("2026-10-16T23:59:59Z"))).toBe("2026-10-16");
  });
});

const row = { id: ID, release_id: REL, status: "accepted", requested_note: "", requested_at: "t", received_at: "t", shrink_length_pct: 2, shrink_width_pct: 1.5, colour_notes: [{ colour: "C1", note: "close" }], photo_file_ids: [], decided_by_name: "Ana", decided_role: "Print lead", decided_on: "2026-10-17", decision_note: "" };

describe("service", () => {
  it("reads strike-offs and sign-offs", async () => {
    const { client } = fakeClient({
      strike_offs: { data: [row] },
      sign_offs: { data: [{ id: ID, release_id: REL, role: "print", signer_name: "Ana", signed_on: "2026-10-16", note: "", created_at: "t" }] },
    });
    expect((await listStrikeOffs(client, WHO.brandId, "p"))[0]).toMatchObject({ status: "accepted", decidedByName: "Ana", colourNotes: [{ colour: "C1", note: "close" }] });
    expect((await listSignOffs(client, WHO.brandId, "p"))[0]).toMatchObject({ role: "print", signerName: "Ana" });
    expect(await listStrikeOffs(fakeClient({}).client, WHO.brandId, "p")).toEqual([]);
    expect(await listSignOffs(fakeClient({}).client, WHO.brandId, "p")).toEqual([]);
  });
  it("fails with a sentence when a read is refused", async () => {
    const { client } = fakeClient({ strike_offs: { error: { code: "XX", message: "m" } }, sign_offs: { error: { code: "XX", message: "m" } } });
    await expect(listStrikeOffs(client, WHO.brandId, "p")).rejects.toMatchObject({ code: "internal" });
    await expect(listSignOffs(client, WHO.brandId, "p")).rejects.toMatchObject({ code: "internal" });
  });
  it("writes through the functions and returns ids", async () => {
    const { client, calls } = fakeClient({ request_strike_off: { data: ID }, add_sign_off: { data: ID }, receive_strike_off: {}, decide_strike_off: {} });
    expect(await requestStrikeOff(client, WHO, { releaseId: REL, note: "n" })).toBe(ID);
    expect(await addSignOff(client, WHO, { releaseId: REL, role: "club", name: "Ana", signedOn: "2026-10-16", note: "" })).toBe(ID);
    await receiveStrikeOff(client, WHO, { strikeOffId: ID, shrinkLengthPct: 2, shrinkWidthPct: 1.5, colourNotes: [], photoFileIds: [] });
    await decideStrikeOff(client, WHO, { strikeOffId: ID, accept: true, name: "Ana", role: "Club", on: "2026-10-17", note: "" });
    expect(calls.map((c) => c.name)).toEqual(["request_strike_off", "add_sign_off", "receive_strike_off", "decide_strike_off"]);
    expect((calls[3]?.steps[0]?.[1][0] as { p_brand_id: string }).p_brand_id).toBe(WHO.brandId);
  });
  it("turns each database refusal into a sentence", async () => {
    const refuse = (hint: string) => fakeClient({ request_strike_off: { error: { code: "P0001", hint, message: "m" } }, add_sign_off: { error: { code: "P0002", message: "m" } }, receive_strike_off: { error: { code: "P0001", hint: "append_only", message: "m" } }, decide_strike_off: { error: { code: "P0001", hint: "not_received", message: "m" } } }).client;
    await expect(requestStrikeOff(refuse("too_many_strike_offs"), WHO, { releaseId: REL, note: "" })).rejects.toMatchObject({ code: "conflict" });
    await expect(addSignOff(refuse("x"), WHO, { releaseId: REL, role: "club", name: "A", signedOn: "d", note: "" })).rejects.toMatchObject({ code: "not_found" });
    await expect(receiveStrikeOff(refuse("x"), WHO, { strikeOffId: ID, shrinkLengthPct: null, shrinkWidthPct: null, colourNotes: [], photoFileIds: [] })).rejects.toMatchObject({ code: "conflict" });
    await expect(decideStrikeOff(refuse("x"), WHO, { strikeOffId: ID, accept: false, name: "A", role: "B", on: "d", note: "" })).rejects.toMatchObject({ code: "conflict" });
  });
});
