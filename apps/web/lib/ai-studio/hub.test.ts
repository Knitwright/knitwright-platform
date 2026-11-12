import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, COST_LABELS, WORKFLOWS, workflowById, workflowHref } from "./catalogue";
import { checkAnswers, initialAnswers, answeredSteps } from "./answers";
import { formOf, IMAGE_STYLES } from "./forms";
import { FOR_YOU, HUB_TABS, hubRows, isHubTab, viewAllOf } from "./hub";

describe("the workflow catalogue", () => {
  it("has every workflow of 09's launch table, each once", () => {
    const ids = WORKFLOWS.map((one) => one.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      "crest-to-kit",
      "retro-kit-remix",
      "on-model-try-on",
      "flat-lay-studio",
      "kit-launch-ad",
      "team-store-promo",
      "try-on-video",
      "shopify-listing-set",
      "matchday-graphic",
      "new-signing",
      "fixtures-list",
      "sponsor-thank-you",
      "club-brand-board",
      "benchmark-products",
      "change-kit-colour",
      "resize-for-all-socials",
      "remove-background",
    ]) {
      expect(workflowById(id), id).not.toBeNull();
    }
    expect(workflowById("nope")).toBeNull();
  });

  it("sends each card to its own page, and a link card to the page it names", () => {
    expect(workflowHref(workflowById("crest-to-kit")!)).toBe("/ai-studio/workflow/crest-to-kit");
    expect(workflowHref(workflowById("mockups")!)).toBe("/mockups");
  });

  it("puts a paid switch on every workflow a model makes", () => {
    for (const id of ["on-model-try-on", "flat-lay-studio", "try-on-video", "remove-background"]) expect(workflowById(id)?.gate).not.toBeNull();
    expect(COST_LABELS.free).toBe("Free");
  });
});

describe("hubRows", () => {
  it("shows For you first and then every category on Discover", () => {
    const rows = hubRows("discover");
    expect(rows[0]?.id).toBe("for-you");
    expect(rows[0]?.workflows.map((one) => one.id)).toEqual(FOR_YOU);
    expect(rows.map((one) => one.title)).toContain(CATEGORY_LABELS.tools);
  });

  it("narrows each tab to its categories", () => {
    expect(hubRows("ads").map((one) => one.id)).toEqual(["ads"]);
    expect(hubRows("for-you").map((one) => one.id)).toEqual(["for-you"]);
    expect(hubRows("product-scenes").flatMap((one) => one.workflows.map((w) => w.id))).toContain("on-model-try-on");
  });

  it("searches titles and leads, and drops a row with nothing left", () => {
    const rows = hubRows("discover", "  CREST ");
    expect(rows.flatMap((one) => one.workflows.map((w) => w.id))).toContain("crest-to-kit");
    expect(rows.some((one) => one.id === "ads")).toBe(false);
    expect(hubRows("discover", "zzzz")).toEqual([]);
  });

  it("knows its tabs and what View all opens", () => {
    for (const tab of HUB_TABS) expect(isHubTab(tab)).toBe(true);
    expect(isHubTab("nope")).toBe(false);
    expect(viewAllOf("tools")).toBe("tools");
    expect(viewAllOf("for-you")).toBeNull();
  });
});

describe("checkAnswers", () => {
  const form = formOf("kit-launch-ad")!;

  it("refuses an empty form with an error under each field that needs one", () => {
    const check = checkAnswers(form, {});
    expect(check.ok).toBe(false);
    if (!check.ok) expect(Object.keys(check.errors)).toEqual(expect.arrayContaining(["product", "highlight", "campaign"]));
  });

  it("accepts the starting choices once the product and words are given", () => {
    const check = checkAnswers(form, { ...initialAnswers(form), product: "p", highlight: "Out now" }, 2);
    expect(check.ok && check.count).toBe(2);
    expect(answeredSteps(form, { ...initialAnswers(form), product: "p", highlight: "Out now" })).toBe(6);
  });

  it("refuses a choice the page did not offer, words too long, a count out of range and a bad date", () => {
    const base = { ...initialAnswers(form), product: "p", highlight: "Out now" };
    expect(checkAnswers(form, { ...base, campaign: "made-up" }).ok).toBe(false);
    expect(checkAnswers(form, { ...base, highlight: "x".repeat(81) }).ok).toBe(false);
    expect(checkAnswers(form, base, 9).ok).toBe(false);
    const store = formOf("team-store-promo")!;
    expect(checkAnswers(store, { ...initialAnswers(store), product: "p", deadline: "soon" }).ok).toBe(false);
    expect(checkAnswers(store, { ...initialAnswers(store), product: "p", deadline: "2026-12-04" }).ok).toBe(true);
  });

  it("offers the shoots' image styles", () => {
    expect(IMAGE_STYLES.map((one) => one.label)).toContain("Editorial");
    expect(formOf("nope")).toBeNull();
  });
});
