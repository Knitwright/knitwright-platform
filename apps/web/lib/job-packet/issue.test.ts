import { describe, expect, it, vi } from "vitest";
import { dueDateOf, issuePacket, type IssueDeps } from "./issue";
import { stubNotifier, type PacketNotifier } from "./notify";
import { newPacketToken } from "./token";

const PACKET = "11111111-1111-4111-8111-111111111111";
const BATCH = "22222222-2222-4222-8222-222222222222";
const EXPIRES = "2026-11-29T09:00:00Z";
const TOKEN = newPacketToken();

const INPUT = { actor: "ops-1", days: 28, whatsapp: null, batch: "crew-tee, mesh-140", due: "2026-12-04" };

const deps = (over: Partial<IssueDeps> = {}): IssueDeps & { rpc: ReturnType<typeof vi.fn> } => {
  const rpc = vi.fn().mockResolvedValue({ data: [{ id: PACKET, expires_at: EXPIRES }], error: null });
  return { admin: { rpc }, siteUrl: "https://app.knitwright.com", notifier: stubNotifier, newToken: () => TOKEN, ...over, rpc };
};

const sending = (): PacketNotifier & { send: ReturnType<typeof vi.fn> } => {
  const send = vi.fn().mockResolvedValue({ sent: true, provider: "whatsapp" });
  return { name: "whatsapp", send };
};

describe("dueDateOf", () => {
  it("is the earliest promised date among the batch's orders", () => {
    expect(dueDateOf([{ promisedOn: "2026-12-11" }, { promisedOn: "2026-12-04" }, { promisedOn: "2027-01-02" }])).toBe("2026-12-04");
  });

  it("skips the orders with no date, and says so when none has one", () => {
    expect(dueDateOf([{ promisedOn: null }, { promisedOn: "2026-12-04" }])).toBe("2026-12-04");
    expect(dueDateOf([{ promisedOn: null }])).toBe("Not set");
    expect(dueDateOf([])).toBe("Not set");
  });
});

describe("issuePacket", () => {
  it("makes the token here, gives ops the address once, and hands the database the token only", async () => {
    const d = deps();

    const issued = await issuePacket(d, { kind: "create", batchId: BATCH }, INPUT);

    expect(issued).toMatchObject({ packetId: PACKET, address: `https://app.knitwright.com/job/${TOKEN}`, expiresAt: EXPIRES });
    expect(d.rpc).toHaveBeenCalledWith("create_job_packet", { p_actor: "ops-1", p_batch_id: BATCH, p_token: TOKEN, p_days: 28 });
  });

  it("renews a link by its batch and its id, with a token nobody has held before", async () => {
    const d = deps();

    await issuePacket(d, { kind: "resend", batchId: BATCH, packetId: PACKET }, INPUT);

    expect(d.rpc).toHaveBeenCalledWith("resend_job_packet", { p_actor: "ops-1", p_batch_id: BATCH, p_packet_id: PACKET, p_token: TOKEN, p_days: 28 });
  });

  it("sends nothing and says nothing was sent when ops gave no number", async () => {
    const notifier = sending();

    const issued = await issuePacket(deps({ notifier }), { kind: "create", batchId: BATCH }, INPUT);

    expect(issued.notify).toBeNull();
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it("sends the factory the link, the due date and what the buttons do, and reports what happened", async () => {
    const notifier = sending();

    const issued = await issuePacket(deps({ notifier }), { kind: "create", batchId: BATCH }, { ...INPUT, whatsapp: "+923001234567" });

    expect(issued.notify).toEqual({ sent: true, provider: "whatsapp" });
    const [message] = notifier.send.mock.calls[0]!;
    expect(message.to).toBe("+923001234567");
    expect(message.text).toContain(issued.address);
    expect(message.text).toContain("2026-12-04");
    expect(message.text).toContain("crew-tee, mesh-140");
    // The day the link stops, not the whole timestamp.
    expect(message.text).toContain("The link works until 2026-11-29.");
  });

  it("still gives ops the address when the message could not be sent, with the reason", async () => {
    const notifier: PacketNotifier = { name: "whatsapp", send: async () => ({ sent: false, provider: "whatsapp", reason: "WhatsApp could not be reached. Send the link yourself." }) };

    const issued = await issuePacket(deps({ notifier }), { kind: "create", batchId: BATCH }, { ...INPUT, whatsapp: "+923001234567" });

    expect(issued.address).toContain("/job/");
    expect(issued.notify).toMatchObject({ sent: false });
  });

  it("does not send anything when the database refused to make the link", async () => {
    const notifier = sending();
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "P0001", hint: "packet_exists", message: "x" } });

    await expect(issuePacket({ ...deps({ notifier }), admin: { rpc } }, { kind: "create", batchId: BATCH }, { ...INPUT, whatsapp: "+923001234567" })).rejects.toMatchObject({
      code: "conflict",
    });
    expect(notifier.send).not.toHaveBeenCalled();
  });
});
