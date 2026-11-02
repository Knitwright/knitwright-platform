import { describe, expect, it } from "vitest";
import { board } from "@/lib/launch/fixtures/canvas";
import { context, marketingBoard } from "./fixtures/context";
import { marketingBoards, pictureSlots, selectedMarketing, shapeSlots, writableSlots } from "./selection";
import { buildLayouts } from "./templates/plans";

describe("what a panel is looking at", () => {
  it("finds the layout of the selected marketing board", () => {
    const selected = selectedMarketing(context(marketingBoard()));
    expect(selected?.layout?.key).toBe("new-kit-reveal");
    expect(selected?.slots.map((one) => one.id)).toEqual(["backdrop", "logo", "mockup", "headline", "subheadline"]);
    expect(selected?.settings.templateSlug).toContain("new-kit-reveal");
  });

  it("answers nothing for anything that is not a marketing board", () => {
    expect(selectedMarketing(context(null))).toBeNull();
    expect(selectedMarketing(context(board("d1", "design")))).toBeNull();
    expect(selectedMarketing(context(board("m1", "mockup")))).toBeNull();
  });

  it("says a board has no layout when its settings name none, rather than guessing one", () => {
    const selected = selectedMarketing(context(marketingBoard("board-1", null)));
    expect(selected).not.toBeNull();
    expect(selected?.layout).toBeNull();
    expect(selected?.slots).toEqual([]);
  });

  it("says a board has no layout when its key names one the library does not hold", () => {
    const selected = selectedMarketing(context(marketingBoard()), buildLayouts().filter((one) => one.key !== "new-kit-reveal"));
    expect(selected?.layout).toBeNull();
  });

  it("knows when the board's picture is selected rather than the board", () => {
    const one = marketingBoard();
    const picked = context(one, [one], { selection: { board: one, image: true } });
    expect(selectedMarketing(picked)?.image).toBe(true);
  });

  it("lists the marketing boards on the canvas, and nothing else", () => {
    const boards = [marketingBoard("m1"), board("d1", "design"), marketingBoard("m2")];
    expect(marketingBoards(context(null, boards)).map((one) => one.id)).toEqual(["m1", "m2"]);
  });
});

describe("which slots a panel offers", () => {
  const slots = buildLayouts().find((one) => one.key === "noticeboard-qr-poster")!.slots;

  it("offers the fields a person writes in: the text and the QR chip", () => {
    expect(writableSlots(slots).map((one) => one.id)).toEqual(["headline", "subheadline", "qr"]);
  });

  it("offers the slots a picture goes in", () => {
    expect(pictureSlots(slots).map((one) => one.id)).toEqual(["logo", "mockup"]);
  });

  it("offers the shapes a fill or a colour goes in", () => {
    expect(shapeSlots(slots).map((one) => one.id)).toEqual(["backdrop"]);
  });
});
