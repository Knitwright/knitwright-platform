import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/guardrails";
import { typicalInput } from "@/lib/guardrails/fixtures";
import { defaultFactoryProfile } from "../profile";
import type { ModerationStatus } from "../ports";
import type { DesignInput } from "../registry";
import { ALL_RULES, RULE_ID_PATTERN } from "../rules";
import { GUARDRAIL_CHECKS } from "./guardrails";
import { moderationClear, UNSCREENED_BLOCKS_HANDOFF } from "./moderation";

/** The guardrails as check modules (decision 0045) and the moderation gate (F-G1, F-G2). */

const profile = defaultFactoryProfile();
const EMPTY = { panels: [], items: [], colours: [], settings: DEFAULT_SETTINGS };
const design = (extra: Partial<DesignInput> = {}): DesignInput => ({ typeId: "team-jersey", readiness: null, ...extra });

const status = (result: ModerationStatus["result"], id = "crest"): ModerationStatus => ({
  target: { kind: "asset", id, label: "Club crest" },
  result,
});

describe("the five guardrails as check modules", () => {
  it("are the five of decision 0045, each with a rule the rulebook holds", () => {
    expect(GUARDRAIL_CHECKS.map((check) => check.id)).toEqual(["seam-crossing", "dpi", "bleed", "safe-zone", "gamut"]);
    for (const check of GUARDRAIL_CHECKS) {
      expect(check.ruleId, check.id).toMatch(RULE_ID_PATTERN);
      expect(check.ruleId, check.id).not.toBe("R-GAP-000");
    }
  });

  it("find nothing for a design whose guardrail input was not built", () => {
    for (const check of GUARDRAIL_CHECKS) expect(check.run(design(), profile)).toEqual([]);
  });

  it("find nothing on an empty input", () => {
    for (const check of GUARDRAIL_CHECKS) expect(check.run(design({ guardrails: EMPTY }), profile)).toEqual([]);
  });

  it("report what the guardrails report, as findings the owner can act on, each naming its rule", () => {
    const input = design({ guardrails: typicalInput() });
    const found = GUARDRAIL_CHECKS.flatMap((check) => check.run(input, profile));
    expect(found.length).toBeGreaterThan(0);
    for (const one of found) {
      expect(one.article).toBe("team-jersey");
      expect(one.fix.whoActs).toBe("owner");
      expect(one.fix.action.length).toBeGreaterThan(0);
      expect(one.ruleId, one.code).toBe(ALL_RULES[one.code]);
    }
  });

  it("give the same findings twice for the same input", () => {
    const input = design({ guardrails: typicalInput() });
    const once = GUARDRAIL_CHECKS.flatMap((check) => check.run(input, profile));
    expect(GUARDRAIL_CHECKS.flatMap((check) => check.run(input, profile))).toEqual(once);
  });
});

describe("moderation clear", () => {
  it("finds nothing when nothing has been screened yet, and nothing when everything is clear", () => {
    expect(moderationClear.run(design(), profile)).toEqual([]);
    expect(moderationClear.run(design({ moderation: [] }), profile)).toEqual([]);
    expect(moderationClear.run(design({ moderation: [status("clear")] }), profile)).toEqual([]);
  });

  /**
   * H3 of the v5 security review (decision 0116). An unscreened picture holds "Ready for the
   * factory" shut and names itself, because shipping unmoderated artwork to a factory is the risk
   * X8 exists to prevent. `UNSCREENED_BLOCKS_HANDOFF` is the one setting that softens it; this
   * test holds the strict answer, and the one below holds the soft one.
   */
  it("blocks the hand-off for a picture nobody has screened, and names which picture", () => {
    const [found] = moderationClear.run(design({ moderation: [status("pending")] }), profile);
    expect(found).toMatchObject({ code: "moderation-pending", severity: "blocker" });
    expect(found?.message).toBe("Club crest has not been through the content review, so nobody has looked at it yet.");
    expect(found?.ruleId).toBeTruthy();
  });

  it("is the one setting away from warning instead, which is the whole of the softer launch policy", () => {
    // Read here rather than asserted on a second code path: flipping the constant changes the
    // severity of this one finding and nothing else about the check.
    expect(UNSCREENED_BLOCKS_HANDOFF).toBe(true);
    const [found] = moderationClear.run(design({ moderation: [status("pending")] }), profile);
    expect(found?.severity).toBe(UNSCREENED_BLOCKS_HANDOFF ? "blocker" : "warning");
    expect(moderationClear.run(design({ moderation: [status("flagged")] }), profile)[0]?.severity).toBe("blocker");
  });

  it("blocks a flagged and a blocked picture, and names each in plain words", () => {
    const found = moderationClear.run(design({ moderation: [status("flagged", "a"), status("blocked", "b")] }), profile);
    expect(found.map((one) => one.code)).toEqual(["moderation-flagged", "moderation-blocked"]);
    expect(found.every((one) => one.severity === "blocker")).toBe(true);
    expect(found[1]?.fix.action).toContain("rights");
  });
});
