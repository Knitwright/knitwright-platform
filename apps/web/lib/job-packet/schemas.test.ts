import { describe, expect, it } from "vitest";
import { createPacketSchema, noteFormSchema, photoFormSchema, resendPacketSchema, revokePacketSchema, stepFormSchema, tokenSchema } from "./schemas";
import { DEFAULT_PACKET_DAYS, MAX_PACKET_DAYS, NOTE_MAX } from "./steps";
import { newPacketToken } from "./token";

const BATCH = "11111111-1111-4111-8111-111111111111";
const PACKET = "22222222-2222-4222-8222-222222222222";
const token = newPacketToken();

const firstError = (result: { success: boolean; error?: { issues: readonly { message: string }[] } }): string | undefined =>
  result.success ? undefined : result.error?.issues[0]?.message;

describe("tokenSchema", () => {
  it("takes a token the server made and refuses anything else with one message", () => {
    expect(tokenSchema.parse(token)).toBe(token);
    for (const value of ["", "short", `${token}x`, "../../etc/passwd", `${token.slice(0, 42)}/`]) {
      expect(firstError(tokenSchema.safeParse(value))).toBe("That link does not exist.");
    }
  });
});

describe("stepFormSchema", () => {
  it("takes the token, the step and an optional note", () => {
    expect(stepFormSchema.parse({ token, step: "received" })).toEqual({ token, step: "received", note: "" });
    expect(stepFormSchema.parse({ token, step: "ready_for_qc", note: "  Cut finished.  " })).toMatchObject({ note: "Cut finished." });
  });

  it("refuses a step the factory cannot press and a step that is really an order status", () => {
    expect(firstError(stepFormSchema.safeParse({ token, step: "note" }))).toBe("Choose a step.");
    expect(stepFormSchema.safeParse({ token, step: "ready" }).success).toBe(false);
    expect(stepFormSchema.safeParse({ token, step: "" }).success).toBe(false);
  });

  it("refuses a note longer than the database allows, and a token of the wrong shape", () => {
    expect(firstError(stepFormSchema.safeParse({ token, step: "received", note: "x".repeat(NOTE_MAX + 1) }))).toContain(`under ${NOTE_MAX}`);
    expect(stepFormSchema.safeParse({ token: "nope", step: "received" }).success).toBe(false);
  });
});

describe("noteFormSchema", () => {
  it("wants words in the box", () => {
    expect(noteFormSchema.parse({ token, note: " Yarn arrived. " })).toEqual({ token, note: "Yarn arrived." });
    expect(firstError(noteFormSchema.safeParse({ token, note: "   " }))).toBe("Write the note first.");
    expect(firstError(noteFormSchema.safeParse({ token, note: "x".repeat(NOTE_MAX + 1) }))).toContain(`under ${NOTE_MAX}`);
  });
});

describe("photoFormSchema", () => {
  it("wants one file and takes an optional caption", () => {
    const photo = new File([new Uint8Array([1, 2, 3])], "line.jpg", { type: "image/jpeg" });

    expect(photoFormSchema.parse({ photo, note: " On the table " })).toMatchObject({ photo, note: "On the table" });
    expect(photoFormSchema.parse({ photo })).toMatchObject({ note: "" });
    expect(firstError(photoFormSchema.safeParse({ photo: "not a file" }))).toBe("Choose a photo.");
    expect(photoFormSchema.safeParse({}).success).toBe(false);
  });
});

describe("createPacketSchema", () => {
  it("falls back to four weeks and no WhatsApp number when ops leaves both empty", () => {
    expect(createPacketSchema.parse({ batchId: BATCH, whatsapp: "", days: "" })).toEqual({ batchId: BATCH, whatsapp: null, days: DEFAULT_PACKET_DAYS });
    expect(createPacketSchema.parse({ batchId: BATCH })).toEqual({ batchId: BATCH, whatsapp: null, days: DEFAULT_PACKET_DAYS });
  });

  it("takes a number as a person types it and keeps only what the API needs", () => {
    expect(createPacketSchema.parse({ batchId: BATCH, whatsapp: "+92 (300) 123-4567" }).whatsapp).toBe("+923001234567");
    expect(createPacketSchema.parse({ batchId: BATCH, whatsapp: " 923001234567 " }).whatsapp).toBe("923001234567");
  });

  it("refuses a number that could not be a phone number, saying how to write one", () => {
    expect(firstError(createPacketSchema.safeParse({ batchId: BATCH, whatsapp: "ring the office" }))).toContain("+923001234567");
    expect(createPacketSchema.safeParse({ batchId: BATCH, whatsapp: "0" }).success).toBe(false);
  });

  it("holds the days to what the database allows", () => {
    expect(createPacketSchema.parse({ batchId: BATCH, days: "7" }).days).toBe(7);
    expect(createPacketSchema.parse({ batchId: BATCH, days: String(MAX_PACKET_DAYS) }).days).toBe(MAX_PACKET_DAYS);
    expect(firstError(createPacketSchema.safeParse({ batchId: BATCH, days: "0" }))).toBe("At least 1 day.");
    expect(firstError(createPacketSchema.safeParse({ batchId: BATCH, days: String(MAX_PACKET_DAYS + 1) }))).toContain(`At most ${MAX_PACKET_DAYS}`);
    expect(firstError(createPacketSchema.safeParse({ batchId: BATCH, days: "1.5" }))).toBe("Whole days only.");
  });

  it("refuses anything that is not a batch", () => {
    expect(firstError(createPacketSchema.safeParse({ batchId: "the latest one" }))).toBe("That is not a batch.");
  });
});

describe("resendPacketSchema and revokePacketSchema", () => {
  it("both name the batch and the link, so a link is only ever changed on its own batch's page", () => {
    expect(resendPacketSchema.parse({ batchId: BATCH, packetId: PACKET })).toEqual({ batchId: BATCH, packetId: PACKET, whatsapp: null, days: DEFAULT_PACKET_DAYS });
    expect(revokePacketSchema.parse({ batchId: BATCH, packetId: PACKET })).toEqual({ batchId: BATCH, packetId: PACKET });
  });

  it("refuse a missing or malformed link id", () => {
    expect(firstError(resendPacketSchema.safeParse({ batchId: BATCH, packetId: "the live one" }))).toBe("That is not a factory link.");
    expect(revokePacketSchema.safeParse({ batchId: BATCH }).success).toBe(false);
  });
});
