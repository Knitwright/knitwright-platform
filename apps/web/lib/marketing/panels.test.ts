import { describe, expect, it } from "vitest";
import { LAUNCH_PANELS, PANEL_OF_KIND, panelPlaceholder } from "@/lib/launch";
import { RULE_ID } from "@/lib/rulebook/constants";
import { MARKETING_PANELS, PANEL_WORDS, isMarketingPanel, marketingPanelIds } from "./panels";

describe("the panels this workstream fills", () => {
  it("are six, and every one is a panel the shell knows about", () => {
    expect(MARKETING_PANELS).toHaveLength(6);
    for (const id of marketingPanelIds) expect(LAUNCH_PANELS, id).toContain(id);
  });

  it("are the five rail panels and the one inspector the brief names", () => {
    expect([...MARKETING_PANELS]).toEqual(["text", "elements", "pattern-fills", "assistant", "layers", "board-marketing"]);
    expect(PANEL_OF_KIND.marketing).toBe("board-marketing");
  });

  it("knows which panels are not its own", () => {
    expect(isMarketingPanel("text")).toBe(true);
    expect(isMarketingPanel("mockups")).toBe(false);
    expect(isMarketingPanel("board-ai-video")).toBe(false);
  });

  it("says what the shell's placeholder said it would, so nothing is promised that is not here", () => {
    for (const id of MARKETING_PANELS) {
      expect(panelPlaceholder(id).note, id).toContain("L4");
    }
  });

  it("gives every panel a title, a lead, a real empty state and the one action that fills it", () => {
    for (const id of MARKETING_PANELS) {
      const words = PANEL_WORDS[id];
      expect(words.title.length, id).toBeGreaterThan(2);
      expect(words.lead.length, id).toBeGreaterThan(20);
      expect(words.empty.length, id).toBeGreaterThan(20);
      expect(words.action.length, id).toBeGreaterThan(4);
      expect(words.ruleId).toMatch(RULE_ID);
    }
  });

  it("says nothing that would read as settled", () => {
    const settled = /\b(approved|verified|final|production[- ]ready|certified)\b/i;
    for (const words of Object.values(PANEL_WORDS)) {
      expect(`${words.title} ${words.lead} ${words.empty} ${words.action}`, words.id).not.toMatch(settled);
    }
  });
});
