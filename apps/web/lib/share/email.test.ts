import { describe, expect, it, vi } from "vitest";
import { inviteMessage, noEmailSender, NO_EMAIL_PROVIDER, recordingSender, type InviteWords } from "./email";
import { resendSender } from "./email-server";

/**
 * Nothing is emailed without a provider and its key. No test reaches a real provider: the adapter
 * is given a `fetch` of its own here, and the real one is only built when the settings are set.
 */

const words = (patch: Partial<InviteWords> = {}): InviteWords => ({
  to: "chair@northside.org",
  fromName: "sam@northside.org",
  replyTo: "sam@northside.org",
  brandName: "Northside Hockey Club",
  designName: "Home kit 2027",
  access: "comment",
  message: "",
  address: `https://knitwright.test/s/${"a".repeat(43)}`,
  ...patch,
});

describe("with no email provider", () => {
  it("sends nothing and says so, so the member sends the link themselves", async () => {
    expect(await noEmailSender.send(inviteMessage(words()))).toEqual({ sent: false, reason: NO_EMAIL_PROVIDER });
    expect(noEmailSender.provider).toBe("none");
    expect(NO_EMAIL_PROVIDER).toContain("we have not emailed anyone");
  });
});

describe("the invite's words", () => {
  it("say who shared what, what the reader may do, and where to open it", () => {
    const message = inviteMessage(words());
    expect(message.to).toBe("chair@northside.org");
    expect(message.subject).toBe('sam@northside.org shared "Home kit 2027" with you');
    expect(message.body).toContain("Design: Home kit 2027");
    expect(message.body).toContain("Shared by: Northside Hockey Club");
    expect(message.body).toContain("You are invited as: Can comment.");
    expect(message.body).toContain("leave a comment");
    expect(message.body).toContain(words().address);
    expect(message.replyTo).toBe("sam@northside.org");
  });

  it("says an edit invite needs an account", () => {
    expect(inviteMessage(words({ access: "edit" })).body).toContain("You need a Knitwright account");
  });

  it("carries the member's own words only when they wrote some", () => {
    expect(inviteMessage(words()).body).not.toContain("wrote:");
    expect(inviteMessage(words({ message: "  Have a look.  " })).body).toContain("sam@northside.org wrote:\nHave a look.");
  });

  it("says the reader will not be emailed about anything else, and claims nothing about the design", () => {
    const body = inviteMessage(words()).body;
    expect(body).toContain("We will not email you about anything else.");
    expect(body).not.toMatch(/\b(checked|verified|approved|confirmed|final|production-ready|passed|validated|certified)\b/i);
  });

  it("holds one link and nothing else, so there is nothing to track a reader with", () => {
    const links = inviteMessage(words()).body.match(/https?:\/\/\S+/g) ?? [];
    expect(links).toEqual([words().address]);
  });
});

describe("the stub sender", () => {
  it("keeps what it was given and reaches no network", async () => {
    const sender = recordingSender();
    const outcome = await sender.send(inviteMessage(words()));
    expect(outcome).toEqual({ sent: true, provider: "stub" });
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe("chair@northside.org");
  });
});

describe("the Resend adapter", () => {
  const ok = () => new Response(JSON.stringify({ id: "1" }), { status: 200 });

  it("sends the message as plain text, with the reply going to the member", async () => {
    const send = vi.fn(async () => ok());
    const outcome = await resendSender("re_key", "designs@knitwright.test", send as unknown as typeof fetch).send(inviteMessage(words()));
    expect(outcome).toEqual({ sent: true, provider: "resend" });
    const [address, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(address).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ from: "designs@knitwright.test", to: ["chair@northside.org"], reply_to: ["sam@northside.org"] });
    expect(body.text).toContain("Home kit 2027");
    expect(body).not.toHaveProperty("html");
  });

  it("leaves the reply address out when the member's own is not known", async () => {
    const send = vi.fn(async () => ok());
    await resendSender("re_key", "designs@knitwright.test", send as unknown as typeof fetch).send(inviteMessage(words({ replyTo: null })));
    expect(JSON.parse(String((send.mock.calls[0] as unknown as [string, RequestInit])[1].body))).not.toHaveProperty("reply_to");
  });

  it("says plainly when the provider would not take it, and when it could not be reached", async () => {
    const refused = await resendSender("re_key", "a@b.test", (async () => new Response("no", { status: 422 })) as unknown as typeof fetch).send(inviteMessage(words()));
    expect(refused).toMatchObject({ sent: false });
    expect(refused.sent === false && refused.reason).toContain("Copy the invite link");
    const broken = await resendSender("re_key", "a@b.test", (() => {
      throw new Error("no network");
    }) as unknown as typeof fetch).send(inviteMessage(words()));
    expect(broken).toMatchObject({ sent: false });
  });
});
