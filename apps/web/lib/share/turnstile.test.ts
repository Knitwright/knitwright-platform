import { describe, expect, it, vi } from "vitest";
import { SITEVERIFY_URL, verifyBotCheck, type Send } from "./turnstile";

const answering = (body: unknown, status = 200): Send =>
  vi.fn<Send>(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("verifyBotCheck", () => {
  it("asks Cloudflare with the secret, the token and the visitor's address, and passes when Cloudflare says so", async () => {
    const send = answering({ success: true });

    expect(await verifyBotCheck({ send, secret: "s3cret", token: "tok", address: "203.0.113.9" })).toBe("passed");

    const [url, init] = vi.mocked(send).mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init?.method).toBe("POST");
    const body = init?.body as URLSearchParams;
    expect(body.get("secret")).toBe("s3cret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("203.0.113.9");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("leaves the address out when it is not known", async () => {
    const send = answering({ success: true });

    await verifyBotCheck({ send, secret: "s", token: "t", address: "unknown" });

    expect((vi.mocked(send).mock.calls[0][1]?.body as URLSearchParams).has("remoteip")).toBe(false);
  });

  it("fails when Cloudflare says no, or answers with anything but a clear yes", async () => {
    expect(await verifyBotCheck({ send: answering({ success: false }), secret: "s", token: "t", address: "" })).toBe("failed");
    expect(await verifyBotCheck({ send: answering({ success: "true" }), secret: "s", token: "t", address: "" })).toBe("failed");
    expect(await verifyBotCheck({ send: answering(null), secret: "s", token: "t", address: "" })).toBe("failed");
  });

  it("says Cloudflare could not be reached when the call fails or Cloudflare has a fault", async () => {
    const thrown: Send = async () => {
      throw new Error("offline");
    };

    expect(await verifyBotCheck({ send: thrown, secret: "s", token: "t", address: "" })).toBe("unreachable");
    expect(await verifyBotCheck({ send: answering({}, 500), secret: "s", token: "t", address: "" })).toBe("unreachable");
    const notJson: Send = async () => new Response("<html>", { status: 200 });
    expect(await verifyBotCheck({ send: notJson, secret: "s", token: "t", address: "" })).toBe("unreachable");
  });
});
