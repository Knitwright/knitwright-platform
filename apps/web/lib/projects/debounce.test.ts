import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSettler, CHOICE_SETTLE_MS } from "./debounce";

describe("createSettler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const make = () => {
    const sent: [string, string, boolean][] = [];
    const settler = createSettler<string>((key, value, viaKeyboardEnter) => sent.push([key, value, viaKeyboardEnter]));
    return { sent, settler };
  };

  it("has a short wait, named", () => {
    expect(CHOICE_SETTLE_MS).toBeGreaterThan(100);
    expect(CHOICE_SETTLE_MS).toBeLessThan(1000);
  });

  it("sends nothing until the person has stopped changing the choice", () => {
    const { sent, settler } = make();

    settler.change("fit", "slim");
    vi.advanceTimersByTime(CHOICE_SETTLE_MS - 1);

    expect(sent).toEqual([]);
    expect(settler.pending()).toBe(true);
  });

  it("sends only the choice the person settles on when arrow keys step through several", () => {
    const { sent, settler } = make();

    settler.change("fit", "slim");
    vi.advanceTimersByTime(100);
    settler.change("fit", "relaxed");
    vi.advanceTimersByTime(100);
    settler.change("fit", "regular");
    vi.advanceTimersByTime(CHOICE_SETTLE_MS);

    expect(sent).toEqual([["fit", "regular", false]]);
    expect(settler.pending()).toBe(false);
  });

  it("sends at once when the person presses Enter", () => {
    const { sent, settler } = make();

    settler.change("fit", "slim");
    settler.flush("fit", true);
    vi.advanceTimersByTime(CHOICE_SETTLE_MS * 2);

    expect(sent).toEqual([["fit", "slim", true]]);
  });

  it("sends at once on blur", () => {
    const { sent, settler } = make();

    settler.change("fit", "slim");
    settler.flush("fit", false);

    expect(sent).toEqual([["fit", "slim", false]]);
    expect(settler.pending()).toBe(false);
  });

  it("keeps each control on its own clock", () => {
    const { sent, settler } = make();

    settler.change("fit", "slim");
    settler.change("hem", "curved");
    settler.flush("fit", false);
    expect(settler.pending()).toBe(true);
    vi.advanceTimersByTime(CHOICE_SETTLE_MS);

    expect(sent).toEqual([["fit", "slim", false], ["hem", "curved", false]]);
  });

  it("does nothing when there is nothing to flush", () => {
    const { sent, settler } = make();

    settler.flush("fit", true);
    settler.flushAll();

    expect(sent).toEqual([]);
  });

  it("sends everything waiting when asked, for example before undo", () => {
    const { sent, settler } = make();

    settler.change("fit", "slim");
    settler.change("hem", "curved");
    settler.flushAll();

    expect(sent).toHaveLength(2);
    expect(settler.pending()).toBe(false);
  });

  it("can be cancelled without sending", () => {
    const { sent, settler } = make();

    settler.change("fit", "slim");
    settler.cancel();
    vi.advanceTimersByTime(CHOICE_SETTLE_MS * 2);

    expect(sent).toEqual([]);
    expect(settler.pending()).toBe(false);
  });
});
