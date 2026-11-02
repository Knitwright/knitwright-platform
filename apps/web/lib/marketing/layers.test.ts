import { describe, expect, it } from "vitest";
import { EMPTY_SETTINGS } from "./board";
import { drawnSlots, hiddenSlots, layerRows, setHidden, setLocked, setOpacity } from "./layers";
import { buildLayouts } from "./templates/plans";

const slots = () => buildLayouts().find((one) => one.key === "new-kit-reveal")!.slots;
const slotOf = (id: string) => slots().find((one) => one.id === id)!;

describe("the layers of an artboard", () => {
  it("lists them top of the stack first, which is the drawing's order reversed", () => {
    const rows = layerRows(slots(), EMPTY_SETTINGS);
    expect(rows.map((row) => row.slot.id)).toEqual(["subheadline", "headline", "mockup", "logo", "backdrop"]);
    expect(rows.map((row) => row.depth)).toEqual([5, 4, 3, 2, 1]);
  });

  it("starts every layer shown, unlocked and solid", () => {
    for (const row of layerRows(slots(), EMPTY_SETTINGS)) {
      expect(row.hidden).toBe(false);
      expect(row.opacity).toBe(100);
    }
  });

  it("says of a mockup that its lock is the garment's and not a person's", () => {
    const rows = layerRows(slots(), EMPTY_SETTINGS);
    const mockup = rows.find((row) => row.slot.id === "mockup")!;
    const headline = rows.find((row) => row.slot.id === "headline")!;

    expect(mockup).toMatchObject({ locked: true, lockedByTheGarment: true });
    expect(mockup.note).toBe("A picture the platform drew. It is never moved, recoloured or redrawn.");
    expect(headline).toMatchObject({ locked: false, lockedByTheGarment: false });
    expect(headline.note).toBe("Text in your headline style.");
  });

  it("says what a hidden layer means for the export", () => {
    const hidden = setHidden(EMPTY_SETTINGS, slotOf("headline"), true);
    const rows = layerRows(slots(), hidden.ok ? hidden.settings : EMPTY_SETTINGS);
    expect(rows.find((row) => row.slot.id === "headline")!.note).toBe("Hidden; it is left out of the export.");
  });

  it("says what fills a shape", () => {
    expect(layerRows(slots(), EMPTY_SETTINGS).find((row) => row.slot.id === "backdrop")!.note).toBe("Filled with your background colour.");
  });

  it("carries a rule id on every row", () => {
    for (const row of layerRows(slots(), EMPTY_SETTINGS)) expect(row.ruleId).toBe("R-GAP-000");
  });
});

describe("changing a layer", () => {
  it("hides and shows one, and leaves it out of the drawing while it is hidden", () => {
    const hidden = setHidden(EMPTY_SETTINGS, slotOf("subheadline"), true);
    expect(hidden.ok).toBe(true);
    const settings = hidden.ok ? hidden.settings : EMPTY_SETTINGS;

    expect(hiddenSlots(slots(), settings)).toEqual(["subheadline"]);
    expect(drawnSlots(slots(), settings).map((one) => one.id)).toEqual(["backdrop", "logo", "mockup", "headline"]);

    const shown = setHidden(settings, slotOf("subheadline"), false);
    expect(shown.ok && hiddenSlots(slots(), shown.settings)).toEqual([]);
  });

  it("locks and unlocks a person's own layer", () => {
    const locked = setLocked(EMPTY_SETTINGS, slotOf("headline"), true);
    expect(locked.ok && layerRows(slots(), locked.settings).find((row) => row.slot.id === "headline")!.locked).toBe(true);

    const unlocked = locked.ok ? setLocked(locked.settings, slotOf("headline"), false) : locked;
    expect(unlocked.ok && layerRows(slots(), unlocked.settings).find((row) => row.slot.id === "headline")!.locked).toBe(false);
  });

  it("will not let the garment's own lock be taken off, and says why", () => {
    const verdict = setLocked(EMPTY_SETTINGS, slotOf("mockup"), false);
    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? "" : verdict.reason).toBe("Mockup holds a picture the platform drew. That lock is not yours to take off.");
  });

  it("lets a mockup be locked harder, which changes nothing but is not a refusal", () => {
    expect(setLocked(EMPTY_SETTINGS, slotOf("mockup"), true).ok).toBe(true);
  });

  it("sets opacity from 0 to 100 and refuses anything else with the bounds", () => {
    const half = setOpacity(EMPTY_SETTINGS, slotOf("backdrop"), 50.4);
    expect(half.ok && layerRows(slots(), half.settings).find((row) => row.slot.id === "backdrop")!.opacity).toBe(50);

    for (const value of [-1, 101, Number.NaN]) {
      const verdict = setOpacity(EMPTY_SETTINGS, slotOf("backdrop"), value);
      expect(verdict.ok, String(value)).toBe(false);
      expect(verdict.ok ? "" : verdict.reason).toBe("Opacity goes from 0 to 100.");
    }
  });

  it("keeps one state per layer, however many times it is changed", () => {
    const once = setHidden(EMPTY_SETTINGS, slotOf("headline"), true);
    const twice = once.ok ? setOpacity(once.settings, slotOf("headline"), 20) : once;
    expect(twice.ok && twice.settings.layers).toHaveLength(1);
    expect(twice.ok && twice.settings.layers[0]).toEqual({ slotId: "headline", hidden: true, locked: false, opacity: 20 });
  });
});
