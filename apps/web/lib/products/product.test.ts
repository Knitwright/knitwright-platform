import { describe, expect, it, vi } from "vitest";
import { NOT_YET_SAMPLED } from "@/lib/catalogue/vocabulary";
import { withSample } from "@/lib/editor/fixtures/article";
import { sizeChart } from "@/lib/home/article-view";
import { OPTION_CODE_MAP_SEED } from "@/lib/option-codes/seed/rows";
import { AppError } from "@/lib/server/core/errors";
import { checkChoices, configuratorGroups, defaultChoices, registryChoicesFor, shortLabel } from "./configurator";
import { designFromBase, NO_GARMENT_YET, type DesignPorts } from "./design";
import { bullets, decorations, fabricCards, fulfilmentFacts, leadTimeFact, optionsAvailable, rulesSummary, sameSports, swatchesOf } from "./detail";
import { article, capability, colours, fabrics, factory, summaries } from "./fixtures/data";
import { fromMm, sizeGuide } from "./size-guide";

/** Plan v6 P4 (decision 0142): the product page, the configurator and "Design this". */

const jersey = article("JSY-SS-01");
const shorts = article("SHO-TR-01");

describe("the configurator", () => {
  it("offers fit, the option groups and the length ranges, with every unsampled choice locked", () => {
    const groups = configuratorGroups(jersey);
    expect(groups.map((group) => group.label)).toEqual(["Fit", "Collar", "Sleeve finish", "Pattern fill", "Body length", "Sleeve length", "Back drop tail"]);
    const collar = groups.find((group) => group.id === "collar")!;
    expect(collar.chips.map((chip) => [chip.label, chip.locked])).toEqual([
      ["Crew neck", null],
      ["V-neck", NOT_YET_SAMPLED],
      ["Crew neck", NOT_YET_SAMPLED],
    ]);
    const body = groups.find((group) => group.id === "body_length_offset")!;
    expect(body.chips.map((chip) => chip.label)).toEqual(["−30 mm", "−20 mm", "−10 mm", "Standard", "+10 mm", "+20 mm", "+30 mm", "+40 mm"]);
    expect(body.chips.filter((chip) => chip.locked === null).map((chip) => chip.label)).toEqual(["Standard"]);
  });

  it("opens a sampled choice, and keeps a sampled length for the editor", () => {
    const groups = configuratorGroups(withSample(jersey, "C02", "body_length_offset"));
    expect(groups.find((group) => group.id === "collar")!.chips[1]!.locked).toBeNull();
    expect(groups.find((group) => group.id === "body_length_offset")!.chips[0]!.locked).toBe("Set in the editor's Options once sampled");
  });

  it("starts on each group's default and offers nothing for a bare draft", () => {
    expect(defaultChoices(configuratorGroups(jersey))).toEqual({ collar: "C01", sleeve_finish: "K01", pattern_fill: "P00" });
    expect(configuratorGroups(shorts)).toEqual([]);
    expect(shortLabel("Crew neck, 1x1 rib")).toBe("Crew neck");
  });

  it("checks the choices again: an unknown or unsampled one is refused", () => {
    expect(checkChoices(jersey, { collar: "C01" })).toEqual({ ok: true });
    expect(checkChoices(jersey, { collar: "C09" })).toEqual({ ok: false, reason: `${jersey.name} has no collar option C09.` });
    expect(checkChoices(jersey, { collar: "C02" })).toEqual({ ok: false, reason: "V-neck is not sampled yet, so it cannot be chosen." });
    expect(checkChoices(withSample(jersey, "C02", "x"), { collar: "C02" })).toEqual({ ok: true });
  });

  it("turns codes into the registry's choices through the option code map", () => {
    expect(registryChoicesFor(OPTION_CODE_MAP_SEED, { collar: "C02", sleeve_finish: "K01", pattern_fill: "P00" })).toEqual([
      { optionId: "neckline", choiceId: "v-neck" },
      { optionId: "cuffs", choiceId: "none" },
    ]);
  });
});

const ports = (overrides: Partial<DesignPorts> = {}): DesignPorts => ({
  article: async (code) => (code === "JSY-SS-01" ? jersey : code === "FSH-MM-01" ? article("FSH-MM-01") : null),
  optionMap: async () => OPTION_CODE_MAP_SEED,
  create: async () => "project-1",
  applyOptions: async () => null,
  warn: () => undefined,
  ...overrides,
});

describe("Design this", () => {
  it("makes a design on the base's garment type and applies the chosen options as one version", async () => {
    const create = vi.fn(async () => "project-1");
    const applyOptions = vi.fn(async () => null);
    const id = await designFromBase({ code: "JSY-SS-01", wearer: "women", options: { collar: "C01" } }, ports({ create, applyOptions }));
    expect(id).toBe("project-1");
    expect(create).toHaveBeenCalledWith({ typeId: "football-shirt", wearer: "women", name: jersey.name });
    expect(applyOptions).toHaveBeenCalledWith("project-1", [{ type: "set-option", optionId: "neckline", choiceId: "crew", provenance: "user-edited" }]);
  });

  it("opens the design even when the options are refused, and says so in the log", async () => {
    const warn = vi.fn();
    await designFromBase({ code: "JSY-SS-01", wearer: "men", options: { collar: "C01" } }, ports({ applyOptions: async () => "No.", warn }));
    expect(warn).toHaveBeenCalledWith("The chosen options were not applied to project-1: No.");
    const applyOptions = vi.fn(async () => null);
    await designFromBase({ code: "JSY-SS-01", wearer: "men", options: {} }, ports({ applyOptions }));
    expect(applyOptions).not.toHaveBeenCalled();
  });

  it("refuses an unknown base, a locked option and a base with no garment yet", async () => {
    await expect(designFromBase({ code: "ZZZ-ZZ-99", wearer: "men", options: {} }, ports())).rejects.toBeInstanceOf(AppError);
    await expect(designFromBase({ code: "JSY-SS-01", wearer: "men", options: { collar: "C02" } }, ports())).rejects.toThrow("not sampled yet");
    await expect(designFromBase({ code: "FSH-MM-01", wearer: "men", options: {} }, ports())).rejects.toThrow(NO_GARMENT_YET);
  });
});

describe("the product page", () => {
  const cards = fabricCards(jersey, fabrics(), colours());

  it("offers sublimation where the fabric takes it, and says the other methods are not agreed", () => {
    const methods = decorations(cards, "A");
    expect(methods.map((one) => one.offered)).toEqual([true, false, false, false]);
    expect(methods[0]!.line).toBe("All-over print in any colour, dyed into the fabric.");
    expect(methods[1]!.line).toBe("Embroidery is not agreed with the factory for this base yet.");
    expect(decorations([], "A")[0]!.line).toContain("has not confirmed");
    expect(decorations([], "B")[0]).toEqual({ method: "Sublimation", line: "Not on file for this fabric.", offered: false });
  });

  it("writes the bullets from the rows", () => {
    expect(bullets(jersey, cards)).toEqual(["100% polyester, 140–160 g/m²", "Fit: regular", "Sizes: XS–3XL", "Class A: sublimated, made from one piece"]);
    expect(bullets(article("TEE-TR-01"), [])).toEqual(["Fabric not set yet", "Fit: not set yet", "Sizes: not set yet", "Class B: small runs on stock-colour fabric"]);
  });

  it("never promises a date while QC or freight days are missing", () => {
    expect(leadTimeFact(capability(), { qcDays: null, freightDays: 4 })).toMatchObject({ value: "8 working days", note: "No delivery date yet. Not set: the days for QC." });
    expect(leadTimeFact(capability(), { qcDays: 2, freightDays: 4 }).note).toBe("+ 2 days QC, 4 days freight");
    expect(leadTimeFact(undefined, { qcDays: null, freightDays: null })).toMatchObject({ value: "Not set yet", ruleId: "R-GAP-000" });
  });

  it("fills the Fulfilment box, with shipping not set", () => {
    const facts = fulfilmentFacts({ factory: factory(), capability: capability(), priceLine: "From £22.00", priceLabel: "x", priceRuleId: "R-COST-003", parts: { qcDays: null, freightDays: null } });
    expect(facts.map((fact) => [fact.label, fact.value])).toEqual([
      ["Quality", "Colour within ΔE 1.5"],
      ["Price", "From £22.00"],
      ["Shipping", "Not set yet"],
      ["Avg. production", "8 working days"],
    ]);
    expect(fulfilmentFacts({ factory: null, capability: undefined, priceLine: "-", priceLabel: null, priceRuleId: "R-GAP-000", parts: { qcDays: null, freightDays: null } })[0]).toMatchObject({ value: "Not set yet", note: null });
  });

  it("lists the options with which are sampled, and a rule for every line", () => {
    const options = optionsAvailable(jersey);
    expect(options[0]).toMatchObject({ group: "Collar", ruleId: "R-CON-004" });
    expect(options[0]!.choices.map((choice) => choice.sampled)).toEqual([true, false, false]);
    const rules = rulesSummary(jersey, "R-COST-003");
    expect(rules.at(-1)).toEqual({ text: "Price ladder", ruleId: "R-COST-003" });
    expect(rules.find((rule) => rule.ruleId === "R-PAT-003")!.text).toBe("Body length offset: -30 to 40 mm · Not yet sampled");
    expect(swatchesOf(fabricCards(article("TEE-TR-01"), fabrics(), colours()))).toEqual([{ name: "Navy", hex: "#1F2A44" }]);
  });

  it("suggests bases for the same sports, never itself", () => {
    expect(sameSports(jersey, summaries()).map((one) => one.code)).toEqual(["SHO-TR-01", "TEE-TR-01"]);
  });
});

describe("the size guide", () => {
  it("shows millimetres as centimetres or inches, to one decimal, and leaves a missing size empty", () => {
    expect(fromMm(520, "cm")).toBe("52");
    expect(fromMm(525, "cm")).toBe("52.5");
    expect(fromMm(520, "in")).toBe("20.5");
    const guide = sizeGuide(sizeChart(jersey), "cm");
    expect(guide.sizes).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);
    expect(guide.rows[0]!.cells).toHaveLength(7);
    const gappy = sizeGuide({ sizes: ["S"], sampleSize: null, rows: [{ ...sizeChart(jersey).rows[0]!, values: [null] }], empty: null }, "in");
    expect(gappy.rows[0]!.cells).toEqual([null]);
  });
});
