import { describe, expect, it, vi } from "vitest";
import { NOT_SET_UP, packetText, selectNotifier, stubNotifier, whatsappNotifier, WHATSAPP_NUMBER } from "./notify";

const KEYS = { WHATSAPP_TOKEN: "t-secret", WHATSAPP_PHONE_ID: "15550001111" };
const message = { to: "+923001234567", text: "Your job packet is ready." };

describe("stubNotifier", () => {
  it("sends nothing and says so, so ops knows to send the link itself", async () => {
    const outcome = await stubNotifier.send(message);

    expect(stubNotifier.name).toBe("stub");
    expect(outcome).toEqual({ sent: false, provider: "stub", reason: NOT_SET_UP });
    expect(NOT_SET_UP).toContain("Copy the link");
  });
});

describe("selectNotifier", () => {
  it("is the stub while either key is missing, so nothing is called by accident", () => {
    expect(selectNotifier({}).name).toBe("stub");
    expect(selectNotifier({ WHATSAPP_TOKEN: "t-secret" }).name).toBe("stub");
    expect(selectNotifier({ WHATSAPP_PHONE_ID: "15550001111" }).name).toBe("stub");
    expect(selectNotifier({ WHATSAPP_TOKEN: "   ", WHATSAPP_PHONE_ID: "15550001111" }).name).toBe("stub");
  });

  it("is the stub wherever the tests run, because neither key is set there", () => {
    expect(selectNotifier().name).toBe("stub");
    expect(process.env.WHATSAPP_TOKEN).toBeUndefined();
    expect(process.env.WHATSAPP_PHONE_ID).toBeUndefined();
  });

  it("is the WhatsApp adapter only when both keys are set", () => {
    expect(selectNotifier(KEYS).name).toBe("whatsapp");
  });

  it("never reaches the network while it is the stub", async () => {
    const send = vi.fn();

    await selectNotifier({}, send).send(message);

    expect(send).not.toHaveBeenCalled();
  });
});

describe("whatsappNotifier", () => {
  it("posts a plain text message to the phone's own address, with the token in the header and never in the body", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const outcome = await whatsappNotifier({ token: "t-secret", phoneId: "15550001111" }, send).send(message);

    expect(outcome).toEqual({ sent: true, provider: "whatsapp" });
    const [url, init] = send.mock.calls[0]!;
    expect(url).toBe("https://graph.facebook.com/v21.0/15550001111/messages");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer t-secret");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: "whatsapp",
      // The "+" is dropped: the API wants digits only.
      to: "923001234567",
      type: "text",
      text: { body: message.text, preview_url: false },
    });
    expect(init.body).not.toContain("t-secret");
  });

  it("escapes nothing into the address: the phone id is encoded", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await whatsappNotifier({ token: "t", phoneId: "15/55?x" }, send).send(message);

    expect(send.mock.calls[0]![0]).toBe("https://graph.facebook.com/v21.0/15%2F55%3Fx/messages");
  });

  it("tells ops to send the link itself when WhatsApp refuses, and says nothing of the token", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, status: 401 });

    const outcome = await whatsappNotifier({ token: "t-secret", phoneId: "1" }, send).send(message);

    expect(outcome).toMatchObject({ sent: false, provider: "whatsapp" });
    expect(outcome.sent === false && outcome.reason).toContain("status 401");
    expect(JSON.stringify(outcome)).not.toContain("t-secret");
  });

  it("tells ops to send the link itself when WhatsApp cannot be reached at all", async () => {
    const send = vi.fn().mockRejectedValue(new Error("socket hang up"));

    const outcome = await whatsappNotifier({ token: "t", phoneId: "1" }, send).send(message);

    expect(outcome).toEqual({ sent: false, provider: "whatsapp", reason: "WhatsApp could not be reached. Send the link yourself." });
  });
});

describe("WHATSAPP_NUMBER", () => {
  it.each(["+923001234567", "923001234567", "447700900123", "+14155550123"])("accepts %s", (value) => {
    expect(WHATSAPP_NUMBER.test(value)).toBe(true);
  });

  it.each(["", "+", "0123456", "+0923001234567", "+9230012345678901", "+92 300 1234567", "not a number", "+92300123456x"])(
    "refuses %s",
    (value) => {
      expect(WHATSAPP_NUMBER.test(value)).toBe(false);
    },
  );
});

describe("packetText", () => {
  it("is plain words with the link, the due date, what the buttons do and when the link stops", () => {
    const text = packetText({ address: "https://app.knitwright.com/job/abc", batch: "crew-tee, mesh-140", due: "2026-12-04", expiresOn: "2026-12-01" });

    expect(text).toContain("https://app.knitwright.com/job/abc");
    expect(text).toContain("crew-tee, mesh-140");
    expect(text).toContain("Due date: 2026-12-04.");
    expect(text).toContain("Received");
    expect(text).toContain("Ready for QC");
    expect(text).toContain("The link works until 2026-12-01.");
    expect(text).toContain("Do not share it outside your factory.");
  });

  it("holds no markup and no word a factory would have to look up", () => {
    const text = packetText({ address: "https://x/job/abc", batch: "b", due: "Not set", expiresOn: "2026-12-01" });

    expect(text).not.toMatch(/[<>]/);
    expect(text).toContain("Due date: Not set.");
  });
});
