import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RULE_ID } from "@/lib/rulebook/constants";
import { EMPTY_FORM, firstUnfinished, formVerdict, stepStates, stepsDone, type CampaignForm } from "./form";
import { CAMPAIGNS, CAMPAIGN_LABELS, CAMPAIGN_STEPS, DESTINATIONS, DESTINATION_LABELS, HIGHLIGHT_LIMIT, MAX_IMAGE_COUNT, STEPS, CAMPAIGN_STYLES, STYLE_LABELS } from "./steps";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const features = (): string => readFileSync(join(REPO_ROOT, "docs", "spec", "02-features.md"), "utf8");

const ready: CampaignForm = {
  product: { source: "mockup", id: "board-1", name: "Flat lay" },
  applyBrand: true,
  brandId: "brand-1",
  logoFileId: "file-1",
  highlight: "Pre-orders close Friday",
  campaign: "pre-order",
  style: "editorial",
  destination: "social-post-4-5",
  imageCount: 3,
};

describe("the seven steps against the spec", () => {
  it("are the spec's own seven, numbered as the spec numbers them", () => {
    expect(STEPS).toHaveLength(7);
    expect(STEPS.map((step) => step.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(STEPS.map((step) => step.id)).toEqual([...CAMPAIGN_STEPS]);
    const spec = features();
    for (const step of STEPS) expect(spec, step.label).toContain(step.label);
  });

  it("offers the spec's nine campaigns, six styles and six destinations", () => {
    const spec = features();
    expect(CAMPAIGNS).toHaveLength(9);
    expect(CAMPAIGN_STYLES).toHaveLength(6);
    expect(DESTINATIONS).toHaveLength(6);
    for (const label of Object.values(CAMPAIGN_LABELS)) expect(spec, label).toContain(label.replace(" or ", " / "));
    for (const label of Object.values(STYLE_LABELS)) expect(spec, label).toContain(label);
    for (const label of Object.values(DESTINATION_LABELS)) expect(spec, label).toContain(label);
  });

  it("marks only the logo optional, as the spec does", () => {
    expect(STEPS.filter((step) => !step.required).map((step) => step.id)).toEqual(["logo"]);
    expect(features()).toContain("**Logo or crest** (optional)");
  });

  it("carries a rule id on every step", () => {
    for (const step of STEPS) expect(step.ruleId).toMatch(RULE_ID);
  });
});

describe("what each step still needs", () => {
  it("names what is missing on an empty form, step by step", () => {
    const states = stepStates(EMPTY_FORM);
    expect(states.filter((step) => step.done)).toEqual([]);
    expect(states.map((step) => step.needs)).toEqual([
      "Pick the design version, the mockup or the photograph this is about.",
      "Choose which brand to apply, or turn the toggle off.",
      null,
      "Say what you want to highlight, in your own words.",
      "Choose what this is for.",
      "Choose how it should look.",
      "Choose the size it is made at.",
    ]);
  });

  it("counts the logo as done only when one was chosen, and never asks for it", () => {
    const withoutLogo = stepStates(ready).find((step) => step.id === "logo")!;
    expect(withoutLogo.done).toBe(true);

    const none = stepStates({ ...ready, logoFileId: null }).find((step) => step.id === "logo")!;
    expect(none).toMatchObject({ done: false, needs: null, required: false });
  });

  it("asks for no brand when the toggle is off", () => {
    const off = stepStates({ ...EMPTY_FORM, applyBrand: false }).find((step) => step.id === "brand")!;
    expect(off).toMatchObject({ done: true, needs: null });
  });

  it("says which step the form opens on, and how far through a person is", () => {
    expect(firstUnfinished(EMPTY_FORM)).toBe("product");
    expect(firstUnfinished({ ...EMPTY_FORM, product: ready.product, brandId: "brand-1" })).toBe("highlight");
    expect(firstUnfinished(ready)).toBeNull();
    expect(stepsDone(ready)).toBe(7);
    expect(stepsDone(EMPTY_FORM)).toBe(0);
  });
});

describe("whether Generate may be pressed", () => {
  it("lets a finished form through, with every answer kept", () => {
    const verdict = formVerdict(ready);
    expect(verdict.ok && verdict.form.campaign).toBe("pre-order");
    expect(verdict.ok && verdict.form.destination).toBe("social-post-4-5");
  });

  it("refuses a half-filled form, naming the step and what to do", () => {
    const verdict = formVerdict({ ...ready, campaign: null });
    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? "" : verdict.step).toBe("campaign");
    expect(verdict.ok ? "" : verdict.reason).toBe("Choose what this is for.");
    expect(verdict.ok ? "" : verdict.ruleId).toMatch(RULE_ID);
  });

  it("holds the highlight to its own limit", () => {
    const long = formVerdict({ ...ready, highlight: "x".repeat(HIGHLIGHT_LIMIT + 1) });
    expect(long.ok ? "" : long.step).toBe("highlight");
    expect(long.ok ? "" : long.reason).toBe(`Keep that to ${HIGHLIGHT_LIMIT} characters.`);
  });

  it("asks for between one and four images, and nothing else", () => {
    expect(formVerdict({ ...ready, imageCount: MAX_IMAGE_COUNT }).ok).toBe(true);
    for (const count of [0, 5, 1.5, Number.NaN]) {
      const verdict = formVerdict({ ...ready, imageCount: count });
      expect(verdict.ok, String(count)).toBe(false);
      expect(verdict.ok ? "" : verdict.reason).toBe("Ask for between 1 and 4 images.");
    }
  });

  it("takes a highlight that is only spaces as no highlight at all", () => {
    expect(formVerdict({ ...ready, highlight: "   " }).ok).toBe(false);
  });
});
