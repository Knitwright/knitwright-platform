import { describe, expect, it } from "vitest";
import { cartonFormSchema, packBagFormSchema } from "./schemas";

const order = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";

describe("cartonFormSchema", () => {
  it("keeps what was typed and leaves the rest as not set, never zero", () => {
    expect(cartonFormSchema.parse({ orderId: order, cartonNo: "1", weightG: "4200", lengthMm: "400", widthMm: "", heightMm: " " })).toMatchObject({
      cartonNo: 1, weightG: 4200, lengthMm: 400, widthMm: null, heightMm: null,
    });
    expect(cartonFormSchema.parse({ orderId: order, cartonNo: "2" })).toMatchObject({ weightG: null, lengthMm: null });
  });

  it("refuses zero, negatives, decimals and absurd sizes", () => {
    for (const bad of [{ weightG: "0" }, { lengthMm: "-5" }, { widthMm: "1.5" }, { heightMm: "5001" }, { cartonNo: "0" }, { cartonNo: "x" }]) {
      expect(cartonFormSchema.safeParse({ orderId: order, cartonNo: "1", ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("packBagFormSchema", () => {
  it("needs a bag and a carton", () => {
    expect(packBagFormSchema.safeParse({ orderId: order, bagId: order, cartonNo: "1" }).success).toBe(true);
    expect(packBagFormSchema.safeParse({ orderId: order, bagId: "x", cartonNo: "1" }).success).toBe(false);
    expect(packBagFormSchema.safeParse({ orderId: order, bagId: order, cartonNo: "" }).success).toBe(false);
  });
});
