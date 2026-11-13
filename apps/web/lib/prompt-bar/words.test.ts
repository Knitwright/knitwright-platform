import { describe, expect, it } from "vitest";
import { board } from "@/lib/launch/fixtures/canvas";
import { BUILDER_CATEGORIES, enhance, picksIn, surprise, togglePick, withPicks } from "./builder";
import { cardOf, imageModelCards, searchCards, videoModelCards } from "./models";
import { aspectShort, countLabel, IMAGE_ASPECTS, imageAspectLabel, isPromptMode, MODES, orientationOf, PROMPT_MODES } from "./modes";
import { FAILED_TITLE, moneyLine, refusedToast, runToast, unreachedToast } from "./outcome";
import { historyOf, matching, presetsFor } from "./prompts";

describe("modes and choices", () => {
  it("has the four modes, with Ask never paid and Agentic in beta", () => {
    expect(PROMPT_MODES).toEqual(["agentic", "image", "video", "ask"]);
    expect(MODES.ask.paid).toBe(false);
    expect(MODES.agentic.beta).toBe(true);
    expect(isPromptMode("image")).toBe(true);
    expect(isPromptMode("edit")).toBe(false);
  });

  it("offers only the shapes the AI image board makes, Match last", () => {
    expect(IMAGE_ASPECTS).toEqual(["1:1", "4:5", "9:16", "16:9", "match"]);
    expect(aspectShort("match")).toBe("Match");
    expect(aspectShort("4:5")).toBe("4:5");
    expect(imageAspectLabel("9:16")).toBe("Story 9:16");
    expect(countLabel(1)).toBe("1 Image");
    expect(countLabel(3)).toBe("3 Images");
  });

  it("reads an orientation from a shape", () => {
    expect(orientationOf("9:16")).toBe("portrait");
    expect(orientationOf("16:9")).toBe("landscape");
    expect(orientationOf("1:1")).toBe("square");
    expect(orientationOf("match")).toBe("match");
  });
});

describe("the prompt builder and the wand", () => {
  it("keeps one pick a category, and a second press removes it", () => {
    const [first, second] = picksIn("lighting");
    let chosen = togglePick([], first!);
    chosen = togglePick(chosen, second!);
    expect(chosen.map((one) => one.id)).toEqual([second!.id]);
    expect(togglePick(chosen, second!)).toEqual([]);
  });

  it("surprises with one pick in every category", () => {
    const picks = surprise(() => 0.999);
    expect(picks.map((one) => one.category)).toEqual([...BUILDER_CATEGORIES]);
    expect(picks[0]).toEqual(picksIn("style").at(-1));
  });

  it("adds the picks after the person's own words", () => {
    const picks = [picksIn("environment")[0]!, picksIn("lighting")[0]!];
    expect(withPicks("Kit on a player.", picks)).toBe("Kit on a player, floodlit stadium, floodlights at night");
    expect(withPicks("", picks)).toBe("floodlit stadium, floodlights at night");
    expect(withPicks("Same", [])).toBe("Same");
  });

  it("enhances with the style's own words, once", () => {
    const once = enhance("Kit on a pitch", "clean-ecom");
    expect(once).toBe("Kit on a pitch, Even softbox light, plain seamless backdrop, no cast shadow");
    expect(enhance(once, "clean-ecom")).toBe(once);
  });
});

describe("the model cards", () => {
  it("offers one image model, priced from the platform's credit figure", () => {
    const cards = imageModelCards({ perGeneratedBoard: 1, note: "", ruleId: "R-GAP-000" });
    expect(cards.map((one) => one.label)).toEqual(["Standard"]);
    expect(cards[0]?.price).toBe("1 credit a picture");
  });

  it("offers the video board's own models with a price a second", () => {
    const cards = videoModelCards();
    expect(cards.length).toBeGreaterThan(1);
    expect(cards[0]?.price).toBe("1 credit a second");
    const unpriced = videoModelCards([{ key: "x", label: "X", lead: "", estimatedWaitPerSecond: 3, creditsPerSecond: null, commercialLicence: false, audio: false, ruleId: "R-GAP-000", note: "" }]);
    expect(unpriced[0]).toMatchObject({ price: "No price set yet", priced: false, wait: "≈ 3 s a second" });
  });

  it("finds a card by key, else shows the first, and searches", () => {
    const cards = videoModelCards();
    expect(cardOf(cards, "veo-3")?.label).toBe("Veo 3");
    expect(cardOf(cards, null)?.key).toBe(cards[0]?.key);
    expect(cardOf([], null)).toBeNull();
    expect(searchCards(cards, "soundtrack").map((one) => one.key)).toEqual(["veo-3"]);
    expect(searchCards(cards, " ")).toBe(cards);
  });
});

describe("the toast after send", () => {
  it("names a refund, and says when nothing was used", () => {
    expect(moneyLine(0, 20)).toBe("20 credits were refunded.");
    expect(moneyLine(0, 1)).toBe("1 credit was refunded.");
    expect(moneyLine(20, 20)).toBe("20 credits were refunded; 20 credits were used.");
    expect(moneyLine(1, 1)).toBe("1 credit was refunded; 1 credit was used.");
    expect(moneyLine(1, 0)).toBe("1 credit was used.");
    expect(moneyLine(0, 0)).toBe("No credits were used.");
  });

  it("is an error with the board's reason when the run did not finish", () => {
    const toast = runToast({ assets: 0, spent: 0, refunded: 20, reason: "AI image: the provider timed out" }, "image");
    expect(toast).toEqual({ tone: "error", title: FAILED_TITLE, body: "AI image: the provider timed out. 20 credits were refunded." });
    expect(runToast({ assets: 0, spent: 0, refunded: 0, reason: null }, "video").body).toBe("Please try again later. No credits were used.");
  });

  it("is a success that says what was spent", () => {
    expect(runToast({ assets: 1, spent: 20, refunded: 0, reason: null }, "image")).toEqual({ tone: "success", title: "Image ready", body: "Your image is on the canvas. 20 credits were used." });
    expect(runToast({ assets: 3, spent: 0, refunded: 0, reason: null }, "image").body).toBe("3 pictures are on the canvas. No credits were used.");
    expect(runToast({ assets: 1, spent: 5, refunded: 0, reason: null }, "video").title).toBe("Video ready");
  });

  it("says nothing was used when the run never started", () => {
    expect(refusedToast("This run now costs 40 credits")).toEqual({ tone: "error", title: FAILED_TITLE, body: "This run now costs 40 credits. No credits were used." });
    expect(unreachedToast().body).toBe("Please try again later. No credits were used.");
  });
});

describe("the prompts modal", () => {
  it("has image presets, the video board's own presets, and none for Ask", () => {
    expect(presetsFor("image").length).toBeGreaterThan(3);
    expect(presetsFor("video")[0]).toMatchObject({ id: "walk_out", title: "Walk-out from tunnel" });
    expect(presetsFor("ask")).toEqual([]);
    expect(presetsFor("agentic")).toEqual([]);
  });

  it("lists the canvas's own prompts, last board first, each once", () => {
    const boards = [
      board("1", "ai_image", { name: "Pitch", settings: { prompt: "pitch" } }),
      board("2", "mockup", { settings: { prompt: "not an AI board" } }),
      board("3", "ai_video", { name: "", settings: { prompt: "walk" } }),
      board("4", "ai_image", { name: "Again", settings: { prompt: "pitch" } }),
      board("5", "ai_image", { settings: { prompt: "  " } }),
      board("6", "ai_image", { name: "", settings: {} }),
    ];
    expect(historyOf(boards)).toEqual([
      { id: "4", title: "Again", prompt: "pitch" },
      { id: "3", title: "AI video", prompt: "walk" },
    ]);
    expect(historyOf([board("7", "ai_image", { name: "", settings: { prompt: "x" } })])[0]?.title).toBe("AI image");
  });

  it("searches titles and prompts", () => {
    const rows = presetsFor("image");
    expect(matching(rows, "flat").map((one) => one.id)).toEqual(["flat-lay"]);
    expect(matching(rows, "")).toBe(rows);
  });
});
