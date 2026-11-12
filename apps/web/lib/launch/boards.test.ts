import { describe, expect, it } from "vitest";
import {
  ADD_MENU_KINDS,
  BOARD_KINDS,
  BOARDS,
  boardKind,
  canBeArtwork,
  DETERMINISTIC_KINDS,
  GENERATED_KINDS,
  isGarmentKind,
  isGeneratedKind,
  isLinkedKind,
  kindsAddableAfter,
  type BoardKind,
} from "./index";

describe("the ten board kinds", () => {
  it("is the spec's own list of board types (F-L4), and the one canvas's three (decision 0145)", () => {
    expect(BOARD_KINDS).toEqual(["design", "artboard", "mockup", "ai_image", "ai_video", "marketing", "info_card", "garment", "tech_pack", "order"]);
  });

  it("treats a launch-era design board and a garment board as the garment, and nothing else", () => {
    expect(BOARD_KINDS.filter(isGarmentKind)).toEqual(["design", "garment"]);
    expect(BOARD_KINDS.filter(isLinkedKind)).toEqual(["tech_pack", "order"]);
    expect(BOARDS.tech_pack.accepts).toEqual(["garment"]);
    expect(BOARDS.order.accepts).toEqual(["garment"]);
  });

  it("splits every kind into one the platform draws and one a model draws, with nothing in both", () => {
    expect([...DETERMINISTIC_KINDS, ...GENERATED_KINDS].toSorted()).toEqual([...BOARD_KINDS].toSorted());
    expect(DETERMINISTIC_KINDS.filter((kind) => (GENERATED_KINDS as readonly string[]).includes(kind))).toEqual([]);
  });

  it("gives every kind a label, a sentence and a rule id", () => {
    for (const kind of BOARD_KINDS) {
      expect(BOARDS[kind].label.length).toBeGreaterThan(0);
      expect(BOARDS[kind].lead.length).toBeGreaterThan(20);
      expect(BOARDS[kind].ruleId).toMatch(/^R-[A-Z]+-\d{3}$/);
    }
  });

  it("charges credits for the two kinds a model draws and for nothing else", () => {
    expect(BOARD_KINDS.filter((kind) => BOARDS[kind].paid)).toEqual(["ai_image", "ai_video"]);
  });
});

describe("the garment lock, as a property of the kind", () => {
  it("never lets a generated board's output be artwork, and always lets a drawn one", () => {
    for (const kind of GENERATED_KINDS) {
      expect(isGeneratedKind(kind)).toBe(true);
      expect(canBeArtwork(kind)).toBe(false);
    }
    for (const kind of DETERMINISTIC_KINDS) {
      expect(isGeneratedKind(kind)).toBe(false);
      expect(canBeArtwork(kind)).toBe(true);
    }
  });

  it("gives the two boards nothing may feed no inputs, so a canvas cannot start anywhere else", () => {
    expect(BOARD_KINDS.filter((kind) => BOARDS[kind].maxInputs === 0)).toEqual(["design", "artboard", "garment"]);
  });

  it("lets every other kind start from a design board, directly or through one that can", () => {
    for (const kind of BOARD_KINDS) {
      if (BOARDS[kind].maxInputs === 0) continue;
      const accepts = BOARDS[kind].accepts;
      expect(accepts.length).toBeGreaterThan(0);
      const garment = (from: BoardKind): boolean => isGarmentKind(from);
      expect(accepts.some(garment) || accepts.some((from) => BOARDS[from].accepts.some(garment))).toBe(true);
    }
  });
});

describe("the Add… menu of a connector dot", () => {
  it("offers the five kinds the spec's menu lists, and the garment's tech pack and order", () => {
    expect(ADD_MENU_KINDS).toEqual(["mockup", "ai_image", "ai_video", "marketing", "info_card", "tech_pack", "order"]);
  });

  it("offers after a design board only what a design board may feed", () => {
    expect(kindsAddableAfter("design")).toEqual(["mockup", "ai_image", "marketing", "info_card"]);
    expect(kindsAddableAfter("garment")).toEqual(["mockup", "ai_image", "marketing", "info_card", "tech_pack", "order"]);
    expect(kindsAddableAfter("ai_video")).toEqual(["marketing"]);
  });

  it("offers nothing after a marketing board, which is the end of a chain", () => {
    expect(kindsAddableAfter("marketing")).toEqual([]);
  });
});

describe("reading a kind from input", () => {
  it("takes a name it knows and refuses everything else", () => {
    expect(boardKind("ai_video")).toBe("ai_video");
    expect(boardKind("garment")).toBe("garment");
    expect(boardKind("sticker")).toBeNull();
    expect(boardKind(null)).toBeNull();
    expect(boardKind("")).toBeNull();
  });
});
