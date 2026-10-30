import { describe, expect, it } from "vitest";
import { articleBook, jersey } from "./fixtures/kit";
import { chooseOption, partOf, settle, settleEverywhere, startingKit, withPart} from "./kit";
import {
  COLOURS_ROW,
  ELEMENTS_ROW,
  ELEMENT_NOTE,
  MODEL_ROW,
  NAMES_ROW,
  NO_ARTICLE_NOTE,
  PARAMETERS_ROW,
  optionRowId,
  panelRows,
  partDone,
  requiredRows,
} from "./rows";
import { sportById } from "./vocabulary";

const football = sportById("football");
const shirt = partOf(football, "shirt")!;
const socks = partOf(football, "socks")!;

const rowsOf = (partId: "shirt" | "socks", kit = startingKit("football", articleBook())) => {
  const part = partId === "shirt" ? shirt : socks;
  return panelRows(kit, part, partId === "shirt" ? jersey() : null, kit.parts[partId]!);
};

describe("the accordion rows of a part", () => {
  it("lists one row per option group of the base article, in catalogue order", () => {
    expect(rowsOf("shirt").map((row) => row.id)).toEqual([
      MODEL_ROW,
      COLOURS_ROW,
      optionRowId("collar"),
      optionRowId("sleeve_finish"),
      optionRowId("pattern_fill"),
          PARAMETERS_ROW,
      ELEMENTS_ROW,
      NAMES_ROW,
    ]);
  });

  it("shows each option's value as its catalogue code, so the club and the factory use one reference", () => {
    const collar = rowsOf("shirt").find((row) => row.id === optionRowId("collar"))!;
    expect(collar.label).toBe("Collar");
    expect(collar.value).toBe("C01 · Crew neck, 1x1 rib, 20 mm finished");
    expect(collar.ruleId).toBe("R-CON-004");
  });

  it("shows the code the person chose once they choose another", () => {
    const kit = withPart(startingKit("football", articleBook()), "shirt", (choice) =>
      chooseOption(choice, jersey(), "collar", "C02", optionRowId("collar")),
    );
    const collar = rowsOf("shirt", kit).find((row) => row.id === optionRowId("collar"))!;
    expect(collar.value).toMatch(/^C02 · V-neck/);
    expect(collar.ruleId).toBe("R-CON-005");
    expect(collar.settled).toBe(true);
  });

  it("shows the article code, the fit and who it is for on the model row, with the article's own data label", () => {
    const row = rowsOf("shirt").find((entry) => entry.id === MODEL_ROW)!;
    expect(row.value).toBe("JSY-SS-01 · regular · Men");
    expect(row.kind === "model" && row.note).toMatch(/not reviewed by a factory/);
    expect(row.kind === "model" && row.wearers).toEqual(["men", "women", "youth"]);
  });

  it("gives a part with no base article the model row and the colour row only, and says why", () => {
    const rows = rowsOf("socks");
    expect(rows.map((row) => row.id)).toEqual([MODEL_ROW, COLOURS_ROW]);
    expect(rows[0]!.kind === "model" && rows[0]!.note).toBe(NO_ARTICLE_NOTE);
  });

  it("shows the socks colour on the socks row and the club's colours on the shirt's", () => {
    const kit = startingKit("football", articleBook());
    const socksRow = rowsOf("socks", kit).find((row) => row.id === COLOURS_ROW)!;
    const shirtRow = rowsOf("shirt", kit).find((row) => row.id === COLOURS_ROW)!;
    expect(socksRow.kind === "colours" && socksRow.swatches).toEqual([kit.socksColour]);
    expect(shirtRow.kind === "colours" && shirtRow.swatches).toEqual([kit.colours.main, kit.colours.second]);
  });

  it("adds the third colour to the swatches once a club has one", () => {
    const kit = { ...startingKit("football", articleBook()), colours: { main: "#111111", second: "#222222", third: "#333333" } };
    const row = rowsOf("shirt", kit).find((entry) => entry.id === COLOURS_ROW)!;
    expect(row.kind === "colours" && row.swatches).toEqual(["#111111", "#222222", "#333333"]);
  });

  it("counts the element slots used and never promises a placement the catalogue does not carry", () => {
    const kit = { ...startingKit("football", articleBook()), elements: ["crest", "sponsor-1"] as const };
    const row = rowsOf("shirt", kit).find((entry) => entry.id === ELEMENTS_ROW)!;
    expect(row.value).toBe("2 of 5 slots used");
    expect(row.kind === "elements" && row.note).toBe(ELEMENT_NOTE);
    expect(row.ruleId).toBe("R-SUB-004");
  });

  it("reads the names and numbers row off the kit, with the rule that says how they are made", () => {
    const off = rowsOf("shirt").find((row) => row.id === NAMES_ROW)!;
    expect(off.value).toBe("Off");
    const on = rowsOf("shirt", { ...startingKit("football", articleBook()), namesNumbers: true }).find((row) => row.id === NAMES_ROW)!;
    expect(on.value).toBe("On");
    expect(on.ruleId).toBe("R-PER-004");
  });

  it("shows the parameters as the article's own sliders, with the range the factory approved", () => {
    const row = rowsOf("shirt").find((entry) => entry.id === PARAMETERS_ROW)!;
    expect(row.kind === "parameters" && row.sliders.map((slider) => [slider.key, slider.min, slider.max, slider.step])).toEqual([
      ["body_length_offset", -30, 40, 10],
      ["sleeve_length_offset", -20, 40, 10],
      ["back_drop_tail", 0, 40, 10],
    ]);
    expect(row.ruleId).toBe("R-PAT-003");
  });

});

describe("whether a part is done", () => {
  it("needs who it is for, the colours and every option group", () => {
    expect(requiredRows(rowsOf("shirt"))).toEqual([MODEL_ROW, COLOURS_ROW, optionRowId("collar"), optionRowId("sleeve_finish"), optionRowId("pattern_fill")]);
    expect(partDone(rowsOf("shirt"))).toBe(false);
  });

  it("is done for a part with no article once the colour and the wearer are answered", () => {
    let kit = settleEverywhere(startingKit("football", articleBook()), MODEL_ROW);
    kit = settleEverywhere(kit, COLOURS_ROW);
    expect(partDone(rowsOf("socks", kit))).toBe(true);
  });

  it("is done for the shirt once every option group has been answered too", () => {
    let kit = settleEverywhere(startingKit("football", articleBook()), MODEL_ROW);
    kit = settleEverywhere(kit, COLOURS_ROW);
    for (const group of ["collar", "sleeve_finish", "pattern_fill"]) {
      kit = withPart(kit, "shirt", (choice) => settle(choice, optionRowId(group)));
    }
    expect(partDone(rowsOf("shirt", kit))).toBe(true);
  });
});
