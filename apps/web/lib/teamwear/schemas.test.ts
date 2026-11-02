import { describe, expect, it } from "vitest";
import { saveKitSchema } from "./schemas";

/** What a form sends when a club presses Save. Every field is a string, as `FormData` carries it. */
const form = (over: Record<string, unknown> = {}) => ({
  sportId: "football",
  part: "shirt",
  wearer: "women",
  name: "Dockside Rovers shirt",
  main: "#1b2a49",
  second: "#d4af37",
  third: "",
  socksColour: "#ffffff",
  quantity: "20",
  then: "stay",
  ...over,
});

const parsed = (over: Record<string, unknown> = {}) => saveKitSchema.safeParse(form(over));

describe("what the browser may send when a kit is saved", () => {
  it("takes a sport, a part, a wearer, the colours and a quantity", () => {
    const outcome = parsed();
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;
    expect(outcome.data).toMatchObject({ sportId: "football", part: "shirt", wearer: "women", quantity: 20, third: null, then: "stay" });
  });

  it("reads the quantity out of the text a form sends", () => {
    expect(parsed({ quantity: "35" }).success && saveKitSchema.parse(form({ quantity: "35" })).quantity).toBe(35);
  });

  it("refuses a sport, a part, a wearer or a destination the configurator does not offer", () => {
    expect(parsed({ sportId: "quidditch" }).success).toBe(false);
    expect(parsed({ part: "cape" }).success).toBe(false);
    expect(parsed({ wearer: "dogs" }).success).toBe(false);
    expect(parsed({ then: "checkout" }).success).toBe(false);
  });

  it("refuses a colour that is not a colour, and a kit with no name", () => {
    expect(parsed({ main: "navy" }).success).toBe(false);
    expect(parsed({ socksColour: "#fff" }).success).toBe(false);
    expect(parsed({ name: "  " }).success).toBe(false);
  });

  it("refuses nought pieces and more than the stepper's own limit", () => {
    expect(parsed({ quantity: "0" }).success).toBe(false);
    expect(parsed({ quantity: "10001" }).success).toBe(false);
    expect(parsed({ quantity: "20.5" }).success).toBe(false);
  });

  it("keeps a third colour when the club has one", () => {
    expect(saveKitSchema.parse(form({ third: "#00843d" })).third).toBe("#00843d");
  });

  it("reads the option codes and the parameters out of the editor's own pairs", () => {
    const one = saveKitSchema.parse(form({ opt: "collar:C02", par: "body_length_offset:20" }));
    expect(one.options).toEqual({ collar: "C02" });
    expect(one.parameters).toEqual({ body_length_offset: 20 });

    const several = saveKitSchema.parse(form({ opt: ["collar:C02", "sleeve_finish:K01"], par: ["back_drop_tail:10", "sleeve_length_offset:-20"] }));
    expect(several.options).toEqual({ collar: "C02", sleeve_finish: "K01" });
    expect(several.parameters).toEqual({ back_drop_tail: 10, sleeve_length_offset: -20 });
  });

  it("has no options and no parameters when a form sends none", () => {
    const empty = saveKitSchema.parse(form());
    expect(empty.options).toEqual({});
    expect(empty.parameters).toEqual({});
  });

  it("drops a pair that is not a pair, and a parameter that is not a number", () => {
    const messy = saveKitSchema.parse(form({ opt: ["collar", ":C02", "collar:", "sleeve_finish:K02"], par: ["body_length_offset:soon", "back_drop_tail:0"] }));
    expect(messy.options).toEqual({ sleeve_finish: "K02" });
    expect(messy.parameters).toEqual({ back_drop_tail: 0 });
  });
});
