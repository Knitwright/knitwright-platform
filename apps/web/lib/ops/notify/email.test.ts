import { describe, expect, it, vi } from "vitest";
import { recordingSender } from "@/lib/share/email";
import { EMAIL_KINDS, kindForStatus, NO_DATE_LINE, statusMessage } from "./email";
import { statusEmailSchema } from "./schemas";
import { emailIsSetUp, noOpsEmailSender, OPS_NO_EMAIL_PROVIDER, selectOpsSender } from "./select";
import { listCustomerEmails, sendStatusEmail, toCustomerEmail } from "./service";

const words = { orderRef: "KW-0001", brandName: "Rangers FC", status: "in_production" as const };

describe("statusMessage", () => {
  it("writes a subject and words for every kind, and never states a delivery date", () => {
    for (const kind of EMAIL_KINDS) {
      const message = statusMessage({ ...words, kind });
      expect(message.subject, kind).toContain("KW-0001");
      expect(message.body, kind).toContain("Rangers FC");
      expect(message.body, kind).not.toMatch(/\b(deliver(y|ed)? (on|by)|arrive[sd]? (on|by))\b/i);
    }
  });

  it("says why no date is given on every message that would otherwise want one", () => {
    for (const kind of ["batched", "received", "in_production", "ready", "qc_failed"] as const) {
      expect(statusMessage({ ...words, kind }).body, kind).toContain(NO_DATE_LINE);
    }
  });

  it("gives the courier, the number and the tracking page on a parcel", () => {
    const body = statusMessage({ ...words, kind: "shipped", parcel: { courier: "DHL", trackingNumber: "T1", trackingUrl: "https://track.example/T1" } }).body;
    expect(body).toContain("sent with DHL");
    expect(body).toContain("https://track.example/T1");
  });

  it("says there is no tracking page rather than making one up", () => {
    const body = statusMessage({ ...words, kind: "shipped", parcel: { courier: "DHL", trackingNumber: "T1", trackingUrl: null } }).body;
    expect(body).toContain("no tracking page on file");
    expect(body).not.toContain("http");
  });

  it("works without a parcel or a delay to quote", () => {
    expect(statusMessage({ ...words, kind: "shipped" }).body).toContain("has been sent");
    expect(statusMessage({ ...words, kind: "delayed" }).body).toContain("has moved");
  });

  it("quotes a delay's new date and its reason as recorded", () => {
    const body = statusMessage({ ...words, kind: "delayed", delay: { promisedOn: "2027-01-15", reason: "The fabric arrived late" } }).body;
    expect(body).toContain("2027-01-15");
    expect(body).toContain("The fabric arrived late");
  });

  it("matches a kind to the statuses that have one, and none to the others", () => {
    expect(kindForStatus("in_production")).toBe("in_production");
    expect(kindForStatus("batched")).toBe("batched");
    expect([kindForStatus("submitted"), kindForStatus("held")]).toEqual([null, null]);
  });
});

describe("the provider", () => {
  it("sends nothing at all unless all three settings are set", () => {
    expect(selectOpsSender({})).toBe(noOpsEmailSender);
    expect(selectOpsSender({ OPS_EMAIL_PROVIDER: "resend", OPS_EMAIL_KEY: "k" })).toBe(noOpsEmailSender);
    expect(selectOpsSender({ OPS_EMAIL_PROVIDER: "resend", OPS_EMAIL_KEY: "k", OPS_EMAIL_FROM: "  " })).toBe(noOpsEmailSender);
    expect(emailIsSetUp({})).toBe(false);
  });

  it("is the Resend adapter with all three set, and reaches no network until it is asked", () => {
    const send = vi.fn();
    const sender = selectOpsSender({ OPS_EMAIL_PROVIDER: "resend", OPS_EMAIL_KEY: "k", OPS_EMAIL_FROM: "ops@example.com" }, send as never);
    expect(sender.provider).toBe("resend");
    expect(send).not.toHaveBeenCalled();
    expect(emailIsSetUp({ OPS_EMAIL_PROVIDER: "resend", OPS_EMAIL_KEY: "k", OPS_EMAIL_FROM: "ops@example.com" })).toBe(true);
  });

  it("is not set up where tests run", () => {
    expect(process.env.OPS_EMAIL_KEY).toBeUndefined();
    expect(selectOpsSender()).toBe(noOpsEmailSender);
  });

  it("says plainly that nothing was sent", async () => {
    expect(await noOpsEmailSender.send({ to: "a@b.co", subject: "s", body: "b", replyTo: null })).toEqual({ sent: false, reason: OPS_NO_EMAIL_PROVIDER });
  });
});

const row = {
  id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a31",
  order_id: "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11",
  kind: "in_production",
  to_email: "club@example.com",
  subject: "KW-0001: In production",
  body: "words",
  provider: "none",
  sent: false,
  reason: OPS_NO_EMAIL_PROVIDER,
  at: "2026-12-07T10:00:00Z",
};

describe("sendStatusEmail", () => {
  it("keeps the words and the provider that took them", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null });
    const sender = recordingSender("stub");
    const message = statusMessage({ ...words, kind: "in_production" });
    const out = await sendStatusEmail({ rpc } as never, "actor", { orderId: row.order_id, kind: "in_production", toEmail: row.to_email, message }, sender);
    expect(out).toMatchObject({ sent: true, reason: "" });
    expect(sender.sent[0]).toMatchObject({ to: row.to_email, subject: message.subject });
    expect(rpc).toHaveBeenCalledWith("ops_record_customer_email", expect.objectContaining({ p_sent: true, p_provider: "stub", p_reason: "" }));
  });

  it("keeps the reason when nothing was sent, so the record never claims an email went out", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null });
    const message = statusMessage({ ...words, kind: "ready" });
    const out = await sendStatusEmail({ rpc } as never, "actor", { orderId: row.order_id, kind: "ready", toEmail: row.to_email, message }, noOpsEmailSender);
    expect(out).toMatchObject({ sent: false, reason: OPS_NO_EMAIL_PROVIDER });
    expect(rpc).toHaveBeenCalledWith("ops_record_customer_email", expect.objectContaining({ p_sent: false, p_provider: "none", p_reason: OPS_NO_EMAIL_PROVIDER }));
  });

  it("refuses when the database does, and when it answers with nothing", async () => {
    const message = statusMessage({ ...words, kind: "ready" });
    const send = { orderId: row.order_id, kind: "ready" as const, toEmail: row.to_email, message };
    const bad = vi.fn().mockResolvedValue({ data: null, error: { message: "raw", code: "P0002" } });
    await expect(sendStatusEmail({ rpc: bad } as never, "a", send, noOpsEmailSender)).rejects.toThrow();
    const empty = vi.fn().mockResolvedValue({ data: null, error: null });
    await expect(sendStatusEmail({ rpc: empty } as never, "a", send, noOpsEmailSender)).rejects.toThrow(/answered with nothing/);
  });
});

describe("the record", () => {
  it("reads a row", () => {
    expect(toCustomerEmail(row)).toMatchObject({ sent: false, provider: "none", toEmail: row.to_email });
  });

  it("lists an order's messages, newest first", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [row], error: null });
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => ({ limit }) }) }) }));
    expect(await listCustomerEmails({ from } as never, row.order_id)).toHaveLength(1);
  });

  it("refuses when the read fails", async () => {
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: null, error: { message: "raw", code: "P0002" } }) }) }) }) }));
    await expect(listCustomerEmails({ from } as never, row.order_id)).rejects.toThrow();
  });
});

describe("the form", () => {
  it("needs an address and one of the kinds, and keeps the address in lower case", () => {
    const parsed = statusEmailSchema.safeParse({ orderId: row.order_id, kind: "ready", toEmail: " Club@Example.com " });
    expect(parsed.success && parsed.data.toEmail).toBe("club@example.com");
    expect(statusEmailSchema.safeParse({ orderId: row.order_id, kind: "ready", toEmail: "not-an-address" }).success).toBe(false);
    expect(statusEmailSchema.safeParse({ orderId: row.order_id, kind: "whatever", toEmail: "a@b.co" }).success).toBe(false);
  });
});
