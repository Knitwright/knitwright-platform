import { describe, expect, it } from "vitest";
import { guidedStartSchema, planGuidedStart } from "./start";

const parse = (input: Record<string, unknown>) => guidedStartSchema.safeParse(input);

describe("starting the guided flow", () => {
  it("starts from a sentence: the garment it names, and the sentence sent on to the assistant", () => {
    const input = parse({ method: "text", sentence: "  A slim polo for women  " });
    expect(input.success).toBe(true);
    if (!input.success) return;
    expect(planGuidedStart(input.data)).toEqual({
      typeId: "polo",
      wearer: "women",
      name: "New polo shirt",
      next: { from: "text", say: "A slim polo for women" },
    });
  });

  it("refuses an empty sentence, with a reason", () => {
    const input = parse({ method: "text", sentence: "   " });
    expect(input.success).toBe(false);
    expect(input.error?.issues[0]?.message).toBe("Say in a few words what you want to make.");
  });

  it("starts from a sketch on a crew neck tee, which the sketch then changes", () => {
    const input = parse({ method: "sketch" });
    expect(input.success && planGuidedStart(input.data)).toEqual({
      typeId: "crew-tee",
      wearer: "men",
      name: "New crew neck tee",
      next: { from: "sketch" },
    });
  });

  it("starts from the garment and wearer picked, and refuses a garment that does not exist", () => {
    const input = parse({ method: "picker", typeId: "joggers", wearer: "youth" });
    expect(input.success && planGuidedStart(input.data)).toMatchObject({ typeId: "joggers", wearer: "youth", next: { from: "picker" } });
    expect(parse({ method: "picker", typeId: "kilt", wearer: "men" }).success).toBe(false);
    expect(parse({ method: "picker", wearer: "men" }).success).toBe(false);
  });

  it("refuses a way of starting it does not know", () => {
    expect(parse({ method: "voice" }).success).toBe(false);
  });
});
