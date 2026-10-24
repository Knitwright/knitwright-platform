import { describe, expect, it } from "vitest";
import { raiseFormSchema, resolveFormSchema, updateFormSchema } from "./schemas";

const order = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";
const base = { orderId: order, owner: " Sam ", dueOn: "2026-11-05", note: "" };

describe("raiseFormSchema", () => {
  it("needs an owner and a due date for every kind", () => {
    expect(raiseFormSchema.safeParse({ ...base, kind: "lost_parcel", owner: "" }).success).toBe(false);
    expect(raiseFormSchema.safeParse({ ...base, kind: "lost_parcel", dueOn: "" }).success).toBe(false);
    expect(raiseFormSchema.parse({ ...base, kind: "lost_parcel" })).toMatchObject({ owner: "Sam", detail: {} });
  });

  it("reads the pieces of a remake by size, and refuses a remake without them", () => {
    expect(raiseFormSchema.parse({ ...base, kind: "remake", sizes: "M 2, L 1" }).detail).toEqual({ M: 2, L: 1 });
    const bad = raiseFormSchema.safeParse({ ...base, kind: "remake", sizes: "" });
    expect(bad.success).toBe(false);
  });

  it("does not ask for sizes on the other kinds", () => {
    expect(raiseFormSchema.parse({ ...base, kind: "size_swap", sizes: "ignored" }).detail).toEqual({});
  });
});

describe("update and resolve", () => {
  it("need the same things", () => {
    const exceptionId = order;
    expect(updateFormSchema.safeParse({ exceptionId, orderId: order, owner: "Jo", dueOn: "2026-11-09" }).success).toBe(true);
    expect(updateFormSchema.safeParse({ exceptionId, orderId: order, owner: "Jo", dueOn: "2026-02-31" }).success).toBe(false);
    expect(resolveFormSchema.safeParse({ exceptionId, orderId: order, resolution: " " }).success).toBe(false);
    expect(resolveFormSchema.parse({ exceptionId, orderId: order, resolution: " Reshipped " }).resolution).toBe("Reshipped");
  });
});
