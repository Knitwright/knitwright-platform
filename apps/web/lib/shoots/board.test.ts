import { describe, expect, it } from "vitest";
import { sceneBySlug } from "@/lib/mockups";
import {
  BACKGROUND_SOURCES,
  DEFAULT_SETTINGS,
  MAX_PROMPT,
  cropOf,
  idempotencyKeyOf,
  readBoardSettings,
  sceneSlugOf,
  settingsOfConcept,
  writeBoardSettings,
} from "./board";
import { conceptBySlug } from "./concepts";
import { CONSENT_STATEMENT, MAX_EXTRA_PRODUCTS } from "./types";

/**
 * A board's settings as the shell really hands them back: a record nobody checked. Every test here
 * is a value of the wrong shape, because that is what a saved board from an older release looks
 * like, and a board a person saved is still a board.
 */

const CONSENT = { ref: "Release 4", statement: CONSENT_STATEMENT, givenAt: "2026-11-02T09:00:00.000Z" };

describe("reading a board's settings", () => {
  it("gives the defaults for a board nobody has touched", () => {
    expect(readBoardSettings()).toEqual(DEFAULT_SETTINGS);
    expect(readBoardSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips everything a panel can set", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      conceptSlug: "team-line-up",
      sceneSlug: "team-line-up-five",
      style: "retro-film" as const,
      aspect: "4:5" as const,
      count: 3,
      poseKey: "arms-crossed",
      cameraKey: "eye-level-straight-on",
      modelSource: "upload" as const,
      modelFileId: "file-1",
      consent: CONSENT,
      backgroundSource: "text" as const,
      backgroundText: "A wet car park at dusk",
      extraProductIds: ["a", "b"],
      prompt: "Steam rising off the pitch",
    };
    expect(readBoardSettings(writeBoardSettings(settings))).toEqual(settings);
  });

  it("falls back rather than refusing, for every value of the wrong shape", () => {
    const read = readBoardSettings({
      conceptSlug: 7,
      sceneSlug: "   ",
      style: "not-a-style",
      aspect: "3:2",
      count: "three",
      poseKey: null,
      modelSource: "whoever",
      backgroundSource: "elsewhere",
      backgroundText: 12,
      extraProductIds: "a,b",
      prompt: { text: "no" },
    });
    expect(read).toEqual(DEFAULT_SETTINGS);
  });

  it("holds the count to F-L1's one to four", () => {
    expect(readBoardSettings({ count: 0 }).count).toBe(1);
    expect(readBoardSettings({ count: 4 }).count).toBe(4);
    expect(readBoardSettings({ count: 9 }).count).toBe(4);
    expect(readBoardSettings({ count: 2.4 }).count).toBe(2);
  });

  it("holds the extra products to two, dropping repeats and blanks", () => {
    const read = readBoardSettings({ extraProductIds: ["a", "a", " b ", "", "c", 4] });
    expect(read.extraProductIds).toEqual(["a", "b"]);
    expect(read.extraProductIds.length).toBeLessThanOrEqual(MAX_EXTRA_PRODUCTS);
  });

  it("cuts a very long prompt rather than carrying it", () => {
    expect(readBoardSettings({ prompt: "x".repeat(1000) }).prompt.length).toBe(MAX_PROMPT);
  });

  it("drops half a consent, so an upload with no record cannot look consented", () => {
    const read = readBoardSettings({ modelSource: "upload", modelFileId: "file-1", consent: { ref: "Release 4" } });
    expect(read.modelFileId).toBe("file-1");
    expect(read.consent).toBeNull();
  });

  it("knows which scene a stored board names", () => {
    expect(sceneSlugOf({ sceneSlug: "floodlit-pitch" })).toBe("floodlit-pitch");
    expect(sceneSlugOf({})).toBeNull();
  });

  it("offers the four background sources F-L1 names, and the scene's own as the default", () => {
    expect([...BACKGROUND_SOURCES]).toEqual(["scene", "preset", "upload", "text"]);
    expect(DEFAULT_SETTINGS.backgroundSource).toBe("scene");
  });
});

describe("a board started from a shoot idea", () => {
  it("takes the idea's scene, style, pose, camera and output set", () => {
    const concept = conceptBySlug("floodlit-pitch")!;
    const settings = settingsOfConcept(concept);
    expect(settings.conceptSlug).toBe("floodlit-pitch");
    expect(settings.sceneSlug).toBe("floodlit-pitch");
    expect(settings.style).toBe(concept.style);
    expect(settings.count).toBe(concept.outputs.count);
    expect(settings.poseKey).toBe(concept.poseKeys[0]);
    expect(settings.cameraKey).toBe(concept.cameraKeys[0]);
    expect(settings.modelSource).toBe("preset");
  });

  it("asks for nobody in the picture when the idea's scenes have nobody in them", () => {
    expect(settingsOfConcept(conceptBySlug("kit-in-the-changing-room")!).modelSource).toBe("none");
  });
});

describe("the shape a board is rendered at", () => {
  it("matches the scene's own first crop when the aspect is Match", () => {
    const eleven = sceneBySlug("team-line-up-eleven")!;
    expect(eleven.crops[0]).toBe("16:9");
    expect(cropOf("match", eleven.crops)).toBe("16:9");
  });

  it("is the aspect itself when one is chosen", () => {
    expect(cropOf("9:16", ["1:1"])).toBe("9:16");
  });

  it("is a square when a scene somehow has no crops at all", () => {
    expect(cropOf("match", [])).toBe("1:1");
  });
});

describe("the credit key of a run", () => {
  it("is the same for the same board and settings, so Regenerate of an unchanged board is free", () => {
    const settings = readBoardSettings({ sceneSlug: "floodlit-pitch", count: 2 });
    expect(idempotencyKeyOf("board-1", settings)).toBe(idempotencyKeyOf("board-1", settings));
  });

  it("changes when any setting changes, so a different shoot is charged for", () => {
    const one = readBoardSettings({ sceneSlug: "floodlit-pitch", count: 2 });
    const two = readBoardSettings({ sceneSlug: "floodlit-pitch", count: 3 });
    expect(idempotencyKeyOf("board-1", one)).not.toBe(idempotencyKeyOf("board-1", two));
    expect(idempotencyKeyOf("board-1", one)).not.toBe(idempotencyKeyOf("board-2", one));
  });

  it("does not change between the first attempt and the automatic second one", () => {
    // The retry F-L1 asks for is part of the same run: the person asked for one picture and pays
    // for one, so there is nothing in the key that could tell the ledger otherwise.
    const settings = readBoardSettings({ sceneSlug: "floodlit-pitch" });
    expect(idempotencyKeyOf("board-1", settings)).not.toMatch(/attempt/);
  });

  it("is bounded, because the ledger's column is", () => {
    const settings = readBoardSettings({ prompt: "x".repeat(400), backgroundText: "y".repeat(400) });
    expect(idempotencyKeyOf("board-1", settings).length).toBeLessThanOrEqual(200);
  });
});
