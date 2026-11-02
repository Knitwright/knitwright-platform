import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readBoardSettings } from "./board";
import { idempotencyKeyOf } from "./board-key";

/**
 * H2 of the v5 security review: the key was a 200-character prefix of the settings, so two runs
 * whose prompts differed only past the cut shared a ledger line and the second was never charged.
 */

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

  /**
   * The finding itself. The old key was `shoot:` plus the board id plus thirteen short fields and
   * then the free text, cut to 200 characters -- so the prompt was the first thing thrown away and
   * two shoots that differ only in it were one ledger line. Put `.slice(0, 200)` back on a joined
   * string and this fails.
   */
  it("differs for two runs whose prompts differ only past the 200th character, so both are charged", () => {
    const pad = "a".repeat(220);
    const one = readBoardSettings({ prompt: `${pad}one` });
    const two = readBoardSettings({ prompt: `${pad}two` });
    expect(idempotencyKeyOf("board-1", one)).not.toBe(idempotencyKeyOf("board-1", two));
  });

  it("differs when a long background text is padded and only the prompt varies, which was the whole attack", () => {
    const filler = { backgroundSource: "text", backgroundText: "b".repeat(400) };
    const one = readBoardSettings({ ...filler, prompt: "a sunny terrace" });
    const two = readBoardSettings({ ...filler, prompt: "a floodlit pitch at night, wide angle" });
    expect(idempotencyKeyOf("board-1", one)).not.toBe(idempotencyKeyOf("board-1", two));
  });

  /**
   * The key is taken from the whole settings record rather than a hand-written list of fields, so a
   * field a later release adds is in the key the day it is added. These two differ only in a field
   * the old list never named.
   */
  it("covers every setting, including the ones the old hand-written list left out", () => {
    const one = readBoardSettings({ sceneSlug: "floodlit-pitch", conceptSlug: "match-day" });
    const two = readBoardSettings({ sceneSlug: "floodlit-pitch", conceptSlug: "training-ground" });
    expect(idempotencyKeyOf("board-1", one)).not.toBe(idempotencyKeyOf("board-1", two));
  });

  /**
   * The key needs `node:crypto`, and `ShootsPanel`, `BoardSections` and `AiImageBoardPanel` are
   * client components that import `lib/shoots/index.ts`. The barrel's own header states the rule --
   * nothing that calls a model, reads the database or touches bytes is re-exported -- and this
   * holds the key module to it, next to the code that depends on it rather than only in the
   * architecture suite.
   */
  it("is not re-exported from the barrel a client component imports", () => {
    const barrel = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    expect(barrel).toContain('export * from "./board";');
    expect(barrel).not.toContain("board-key");
  });

  it("is a digest and nothing a person wrote, so no prompt can be read back out of the ledger", () => {
    const settings = readBoardSettings({ prompt: "a secret brief nobody else should read" });
    const key = idempotencyKeyOf("board-1", settings);
    expect(key).toMatch(/^shoot:[0-9a-f]{64}$/);
    expect(key).not.toContain("secret");
  });
});
