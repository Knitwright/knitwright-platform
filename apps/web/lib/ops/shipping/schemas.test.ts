import { describe, expect, it } from "vitest";
import { restOf, restProblem, shipmentFormSchema } from "./schemas";

const ok = { orderId: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11", courier: " DHL ", trackingNumber: "T1", shippedOn: "2026-10-30", sizes: "M 2, L 1" };

describe("shipmentFormSchema", () => {
  it("reads a parcel", () => {
    expect(shipmentFormSchema.parse(ok)).toMatchObject({ courier: "DHL", sizes: { M: 2, L: 1 }, restOwner: "", note: "" });
  });
  it("needs a courier, a number, a real date and readable sizes", () => {
    for (const bad of [{ courier: "" }, { trackingNumber: "" }, { shippedOn: "2026-13-01" }, { sizes: "lots" }]) {
      expect(shipmentFormSchema.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("what is left behind", () => {
  it("is nothing when both are empty, and needs both otherwise", () => {
    expect(restOf({ restOwner: "", restDueOn: "" })).toBeNull();
    expect(restProblem({ restOwner: "", restDueOn: "" })).toBeNull();
    expect(restProblem({ restOwner: "Sam", restDueOn: "" })).toMatch(/due date/);
    expect(restProblem({ restOwner: "Sam", restDueOn: "2026-11-05" })).toBeNull();
  });
});
