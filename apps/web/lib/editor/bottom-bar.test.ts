import { describe, expect, it } from "vitest";
import { addColourwayAction, newColourwayId, nextColourwayName, shownSize, sizeChoices } from "./index";

const choice = (id: string, name: string) => ({ id, name, selected: false });

describe("the next colourway", () => {
  it("takes the kit names of the spec in order", () => {
    expect(nextColourwayName([])).toBe("Home");
    expect(nextColourwayName(["Home"])).toBe("Away");
    expect(nextColourwayName(["Home", "away"])).toBe("GK");
  });

  it("numbers them once the kit names are used", () => {
    expect(nextColourwayName(["Home", "Away", "GK"])).toBe("Colourway 4");
  });

  it("keeps the name a design made before already has", () => {
    expect(nextColourwayName(["Main colourway"])).toBe("Home");
  });
});

describe("the id of a new colourway", () => {
  it("is the name as a plain id", () => {
    expect(newColourwayId([], "Away")).toBe("away");
    expect(newColourwayId([], "Colourway 4")).toBe("colourway-4");
  });

  it("is never one the design already uses", () => {
    expect(newColourwayId(["away"], "Away")).toBe("away-2");
    expect(newColourwayId(["away", "away-2"], "Away")).toBe("away-3");
  });

  it("falls back to a plain word for a name with nothing an id may hold", () => {
    expect(newColourwayId([], "—")).toBe("colourway");
  });
});

describe("addColourwayAction", () => {
  it("adds a colourway with the next kit name and no colours of its own", () => {
    expect(addColourwayAction([choice("main", "Main colourway")])).toEqual({
      type: "add-colourway",
      colourway: { id: "home", name: "Home", colours: [] },
    });
  });
});

describe("the size the canvas shows", () => {
  it("offers the design's own size run, and the article's only when the design has none", () => {
    expect(sizeChoices(["S", "M"], ["XS", "S", "M", "L"])).toEqual(["S", "M"]);
    expect(sizeChoices([], ["XS", "S"])).toEqual(["XS", "S"]);
  });

  it("is the one asked for when the run has it", () => {
    expect(shownSize("L", ["S", "M", "L"], "M")).toBe("L");
  });

  it("falls back to the base size, then to the first of the run", () => {
    expect(shownSize("4XL", ["S", "M", "L"], "M")).toBe("M");
    expect(shownSize(null, ["S", "M"], "L")).toBe("S");
    expect(shownSize(null, [], "M")).toBe("M");
  });
});
