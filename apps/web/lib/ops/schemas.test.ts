import { describe, expect, it } from "vitest";
import { cutFormSchema, delayFormSchema, holdFormSchema, moveFormSchema, orderIdSchema, settingsFormSchema, statusFormSchema } from "./schemas";

const ID = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";

describe("ops form schemas", () => {
  it("accepts only the three forward steps from the status form", () => {
    expect(statusFormSchema.safeParse({ orderId: ID, to: "received" }).success).toBe(true);
    for (const to of ["batched", "submitted", "held", "paid", ""]) expect(statusFormSchema.safeParse({ orderId: ID, to }).success).toBe(false);
  });

  it("reads hold as a flag and keeps the note short", () => {
    expect(holdFormSchema.parse({ orderId: ID, hold: "true" })).toEqual({ orderId: ID, hold: true, note: "" });
    expect(holdFormSchema.parse({ orderId: ID, hold: "false", note: " artwork " }).note).toBe("artwork");
    expect(holdFormSchema.safeParse({ orderId: ID, hold: "yes" }).success).toBe(false);
    expect(holdFormSchema.safeParse({ orderId: ID, hold: "true", note: "x".repeat(301) }).success).toBe(false);
  });

  it("needs real ids", () => {
    expect(orderIdSchema.safeParse({ orderId: "nope" }).success).toBe(false);
    expect(moveFormSchema.safeParse({ orderId: ID, batchId: "nope" }).success).toBe(false);
    expect(moveFormSchema.safeParse({ orderId: ID, batchId: ID }).success).toBe(true);
    expect(cutFormSchema.safeParse({}).success).toBe(true);
  });

  it("needs a date and a reason for a delay", () => {
    expect(delayFormSchema.safeParse({ orderId: ID, promisedOn: "2026-12-01", reason: "Yarn late" }).success).toBe(true);
    expect(delayFormSchema.safeParse({ orderId: ID, promisedOn: "1 Dec", reason: "Yarn late" }).success).toBe(false);
    expect(delayFormSchema.safeParse({ orderId: ID, promisedOn: "2026-12-01", reason: "  " }).success).toBe(false);
  });

  it("turns the settings form into minutes, and an empty lead time into not set", () => {
    expect(settingsFormSchema.parse({ weekday: "5", time: "17:30", leadTimeDays: "", label: "Agreed with Factory X" })).toEqual({ cutoffWeekday: 5, cutoffMinutes: 1050, leadTimeDays: null, label: "Agreed with Factory X" });
    expect(settingsFormSchema.parse({ weekday: "0", time: "00:00", leadTimeDays: "21", label: "x" })).toMatchObject({ cutoffWeekday: 0, cutoffMinutes: 0, leadTimeDays: 21 });
  });

  it.each([
    [{ weekday: "7", time: "17:00", leadTimeDays: "", label: "x" }],
    [{ weekday: "5", time: "25:00", leadTimeDays: "", label: "x" }],
    [{ weekday: "5", time: "17:00", leadTimeDays: "1.5", label: "x" }],
    [{ weekday: "5", time: "17:00", leadTimeDays: "-1", label: "x" }],
    [{ weekday: "5", time: "17:00", leadTimeDays: "", label: " " }],
  ])("refuses bad settings %#", (input) => {
    expect(settingsFormSchema.safeParse(input).success).toBe(false);
  });
});
