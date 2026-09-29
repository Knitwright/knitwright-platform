import { describe, expect, it } from "vitest";
import type { SpecAction } from "@/lib/garment";
import { PROPOSAL_TTL_SECONDS, proposalKey, signProposal, verifyProposal, type Proposal } from "./proposal-token";

const KEY = proposalKey("server-secret");
const NOW = 1_800_000_000;
const ACTIONS: SpecAction[] = [{ type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" }];
const PROPOSAL: Proposal = { projectId: "p-1", brandId: "b-1", userId: "u-1", version: 4, actions: ACTIONS, source: "assistant", explanations: ["Fit changed from Regular to Slim."] };
const WHO = { projectId: "p-1", brandId: "b-1", userId: "u-1" };

describe("proposal tokens", () => {
  it("carries a proposal made on the server back to it unchanged", () => {
    const token = signProposal(PROPOSAL, KEY, NOW);
    expect(verifyProposal(token, KEY, WHO, NOW + 10)).toEqual({ ok: true, proposal: PROPOSAL });
  });

  it("refuses a token for another design, brand or person", () => {
    const token = signProposal(PROPOSAL, KEY, NOW);
    for (const who of [{ ...WHO, projectId: "p-2" }, { ...WHO, brandId: "b-2" }, { ...WHO, userId: "u-2" }]) {
      expect(verifyProposal(token, KEY, who, NOW).ok).toBe(false);
    }
  });

  it("refuses a token that has run out", () => {
    const token = signProposal(PROPOSAL, KEY, NOW);
    expect(verifyProposal(token, KEY, WHO, NOW + PROPOSAL_TTL_SECONDS + 1)).toMatchObject({ ok: false, reason: expect.stringMatching(/expired|again/i) });
  });

  it("refuses a token whose changes were edited in the browser", () => {
    const token = signProposal(PROPOSAL, KEY, NOW);
    const [payload, mac] = token.split(".");
    const edited = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { actions: SpecAction[] };
    edited.actions = [{ type: "set-measurement", pointId: "chest", value: 9999, provenance: "brand-supplied" }];
    const forged = `${Buffer.from(JSON.stringify(edited)).toString("base64url")}.${mac}`;
    expect(verifyProposal(forged, KEY, WHO, NOW).ok).toBe(false);
  });

  it("refuses a token signed with another key, and anything that is not a token", () => {
    const token = signProposal(PROPOSAL, proposalKey("other"), NOW);
    expect(verifyProposal(token, KEY, WHO, NOW).ok).toBe(false);
    for (const junk of ["", "abc", "a.b.c", ".", `${Buffer.from("{}").toString("base64url")}.xx`]) {
      expect(verifyProposal(junk, KEY, WHO, NOW).ok).toBe(false);
    }
  });

  it("refuses a correctly signed payload that is not a proposal", () => {
    const token = signProposal({ ...PROPOSAL, actions: [{ type: "explode" } as unknown as SpecAction] }, KEY, NOW);
    expect(verifyProposal(token, KEY, WHO, NOW).ok).toBe(false);
  });
});
