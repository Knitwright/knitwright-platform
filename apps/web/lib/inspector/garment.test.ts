import { describe, expect, it } from "vitest";
import { catalogue } from "@/lib/catalogue/fixtures/source";
import { appTier } from "@/lib/factory/fixtures/rows";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import type { ValidationCheck } from "@/lib/validation/check";
import { garmentChecks, garmentInspector, garmentNamesNumbers, garmentPrice, inspectorForm, PRICE_QUANTITIES } from "./garment";
import { productInfo, templateHref } from "./product-info";

const ARTICLE = catalogue().find((one) => one.code === "JSY-SS-01")!;
const TYPE = ARTICLE.registryTypeId ?? "crew-tee";
const LADDER = [appTier(1, 19, 3900), appTier(20, 49, 2500), appTier(50, 99, 2200), appTier(100, null, 2000)];
const DESIGN = "00000000-0000-4000-8000-0000000000d1";

const failed = (code: string, severity: "blocker" | "warning", message: string, ruleId = "R-GAP-000"): ValidationCheck => ({
  code,
  severity,
  message,
  target: { article: null, panel: null },
  ruleId,
  passed: false,
});
const passed = (code: string): ValidationCheck => ({ code, severity: null, message: "Nothing found.", target: { article: null, panel: null }, ruleId: "R-GAP-000", passed: true });

const input = (spec: GarmentSpec = start(TYPE), checks: readonly ValidationCheck[] = []) =>
  garmentInspector({
    designId: DESIGN,
    name: "Home kit v7",
    version: 7,
    spec,
    article: ARTICLE,
    checks,
    price: { ladder: LADDER, moq: 1 },
    currency: "GBP",
    factory: { name: "Sialkot partner", leadTimeDays: 8 },
  });

describe("the garment inspector's product and options", () => {
  it("names the base article, its class and its fabric", () => {
    const view = input();
    expect(view.product.hasArticle).toBe(true);
    expect(view.product.line).toContain("JSY-SS-01");
    expect(view.product.line).toContain(`Class ${ARTICLE.productionClass}`);
  });

  it("shows the article's option tiles and range sliders as the editor's Form toolbar builds them", () => {
    const view = input();
    const groups = new Set(ARTICLE.options.map((option) => option.group));
    expect(view.options.groups.map((group) => group.group)).toEqual([...groups]);
    for (const group of view.options.groups) expect(group.options.filter((option) => option.chosen)).toHaveLength(1);
    const ranges = ARTICLE.parameters.filter((def) => def.type === "range" && def.min !== null && def.max !== null);
    expect(view.options.sliders.map((slider) => slider.key)).toEqual(ranges.map((def) => def.key));
    for (const slider of view.options.sliders) expect(slider.rangeText).toMatch(/^Range /);
  });

  it("starts the sliders from the parameters stored on the design, and the tiles from the address", () => {
    const range = ARTICLE.parameters.find((def) => def.type === "range" && def.min !== null && def.max !== null && def.max > (def.defaultValue as number))!;
    const value = range.max!;
    const applied = applyAction(start(TYPE), { type: "set-article", article: { baseArticleCode: ARTICLE.code, productionClass: ARTICLE.productionClass, parameters: { [range.key]: value } } });
    expect(applied.ok).toBe(true);
    const spec = applied.ok ? applied.spec : start(TYPE);
    const group = ARTICLE.options[0].group;
    const other = ARTICLE.options.filter((option) => option.group === group).find((option) => !option.isDefault);
    const form = inspectorForm(ARTICLE, spec, other ? { [group]: other.code } : {});
    expect(form.parameters[range.key]).toBe(value);
    if (other) expect(form.options[group]).toBe(other.code);
  });

  it("says so when a design is not on a base article", () => {
    const view = garmentInspector({ designId: DESIGN, name: "x", version: 1, spec: start(TYPE), article: null, checks: [], price: { ladder: [], moq: null }, currency: "GBP", factory: { name: null, leadTimeDays: null } });
    expect(view.options.empty).toMatch(/not on a base article/);
    expect(view.article).toBeNull();
    expect(view.product.hasArticle).toBe(false);
  });
});

describe("the garment inspector's checks", () => {
  it("is the stored validation result: problems first, blockers before warnings, then what passed", () => {
    const checks = garmentChecks([passed("artwork-dpi"), failed("seam-crossing", "warning", "Sponsor crosses side seam"), failed("print-safe", "blocker", "A colour is not print safe")], null, { options: {}, parameters: {} });
    expect(checks.checked).toBe(true);
    expect(checks.summary).toBe("1 / 3");
    expect(checks.blockers).toBe(1);
    expect(checks.lines.map((line) => line.tone)).toEqual(["bad", "warn", "ok"]);
    expect(checks.lines[0].ruleId).toBe("R-GAP-000");
    expect(checks.lines[2]).toMatchObject({ label: "Artwork dpi", ruleId: null });
  });

  it("does not show a tick a version has not earned", () => {
    const checks = garmentChecks([], null, { options: {}, parameters: {} });
    expect(checks.checked).toBe(false);
    expect(checks.summary).toBe("Not checked yet");
    expect(checks.lines).toEqual([]);
  });

  it("adds the options no golden sample has signed off, as warnings with their rule", () => {
    const unsampled = ARTICLE.options.find((option) => option.approvedBySampleId === null);
    if (!unsampled) return;
    const form = inspectorForm(ARTICLE, start(TYPE), { [unsampled.group]: unsampled.code });
    const lines = garmentChecks([], ARTICLE, form).lines;
    expect(lines.some((line) => line.tone === "warn" && line.label.includes(unsampled.code))).toBe(true);
  });
});

describe("the garment inspector's price", () => {
  it("prices 1, 50, 100 and 300 pieces from the tiers, with the tiers' own labels", () => {
    const price = garmentPrice({ ladder: LADDER, moq: 1 }, "GBP");
    expect(price.steps.map((step) => step.qty)).toEqual(PRICE_QUANTITIES);
    expect(price.steps.map((step) => step.unit)).toEqual(["£39.00", "£22.00", "£20.00", "£20.00"]);
    expect(price.priced).toBe(true);
    expect(price.labels.length).toBeGreaterThan(0);
  });

  it("never shows a missing price as a zero", () => {
    const price = garmentPrice({ ladder: [], moq: null }, "GBP");
    expect(price.priced).toBe(false);
    expect(price.steps.every((step) => step.unit === null)).toBe(true);
    expect(price.from).not.toMatch(/£0/);
  });
});

describe("the garment inspector's colours and names and numbers", () => {
  it("lists the shown colourway's parts and offers the next kit colourway", () => {
    const view = input();
    expect(view.colourways.choices.filter((choice) => choice.selected)).toHaveLength(1);
    expect(view.colourways.add).toMatchObject({ type: "add-colourway" });
    expect(view.kitColours.length).toBeGreaterThan(0);
    expect(view.colourway.id).toBe(view.colourways.choices.find((choice) => choice.selected)?.id);
  });

  it("turns names and numbers on and off with the editor's own changes", () => {
    const marks = garmentNamesNumbers(start(TYPE));
    if (!marks.available) return;
    expect(marks.on).toBe(false);
    expect(marks.turnOn).toMatchObject({ type: "set-names-numbers" });
    expect(marks.turnOff).toEqual({ type: "remove-names-numbers" });
    const on = applyAction(start(TYPE), marks.turnOn as never);
    expect(on.ok).toBe(true);
    if (on.ok) {
      const again = garmentNamesNumbers(on.spec);
      expect(again.on).toBe(true);
      expect(Object.keys(again.withStyle).length).toBe(again.styles.length);
    }
  });

  it("says a garment with no place for them has none", () => {
    const marks = garmentNamesNumbers({ ...start(TYPE), typeId: "no-such-type" });
    expect(marks).toMatchObject({ available: false, turnOn: null, turnOff: null });
  });
});

describe("the Product info modal", () => {
  it("shows the one-piece price with its label and says what is not on file", () => {
    const info = productInfo({ designId: DESIGN, spec: start(TYPE), article: ARTICLE, price: { ladder: LADDER, moq: 1 }, currency: "GBP", factory: { name: "Sialkot partner", leadTimeDays: 8 } });
    expect(info.cost.amount).toBe("£39.00");
    expect(info.cost.note).toMatch(/^Per piece at 1 piece/);
    expect(info.shipping.amount).toBe("About 8 days to make");
    expect(info.line).toContain("JSY-SS-01");
    expect(info.line).toContain("Sialkot partner");
    expect(info.templateHref).toBe(templateHref(DESIGN));
    expect(info.guidelines.length).toBe(3);
  });

  it("never makes up a cost or a lead time", () => {
    const info = productInfo({ designId: DESIGN, spec: start(TYPE), article: null, price: { ladder: [], moq: null }, currency: "GBP", factory: { name: null, leadTimeDays: null } });
    expect(info.cost.amount).toBe("Not set yet");
    expect(info.shipping.amount).toBe("Lead time not set yet");
    expect(info.line).toBe("Made by Knitwright");
  });
});
