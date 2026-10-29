import { describe, expect, it, vi } from "vitest";
import { LIMITS } from "@/lib/server/limits";
import { tokenFromPath, withPacketLimit } from "./record";
import { newPacketToken, packetRateKey } from "./token";

const RULE = LIMITS.jobPacketRecordLink;

describe("withPacketLimit", () => {
  it("names the packet by its token's hash, so no token is written to the rate limit table", async () => {
    const token = newPacketToken();
    const hit = vi.fn().mockResolvedValue(true);

    await withPacketLimit(hit, RULE, token, async () => "done");

    const [key, rule] = hit.mock.calls[0]!;
    expect(key).toBe(`${RULE.name}:packet:${packetRateKey(token)}`);
    expect(key).not.toContain(token);
    expect(rule).toBe(RULE);
  });

  it("runs the write and gives back what it answered", async () => {
    const run = vi.fn().mockResolvedValue({ at: "2026-11-10T12:00:00Z" });

    expect(await withPacketLimit(async () => true, RULE, newPacketToken(), run)).toEqual({ at: "2026-11-10T12:00:00Z" });
    expect(run).toHaveBeenCalledOnce();
  });

  it("refuses and never runs the write once the packet has had its share", async () => {
    const run = vi.fn();

    await expect(withPacketLimit(async () => false, RULE, newPacketToken(), run)).rejects.toMatchObject({
      code: "rate_limited",
      message: "Too many requests. Wait a moment and try again.",
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("keeps two packets' allowances apart, so one factory cannot use up another's", async () => {
    const keys: string[] = [];
    const hit = async (key: string) => {
      keys.push(key);
      return true;
    };

    await withPacketLimit(hit, RULE, newPacketToken(), async () => 1);
    await withPacketLimit(hit, RULE, newPacketToken(), async () => 1);

    expect(new Set(keys).size).toBe(2);
  });

  it("keeps a packet's buttons and its photos on separate allowances", async () => {
    const token = newPacketToken();
    const keys: string[] = [];
    const hit = async (key: string) => {
      keys.push(key);
      return true;
    };

    await withPacketLimit(hit, LIMITS.jobPacketRecordLink, token, async () => 1);
    await withPacketLimit(hit, LIMITS.jobPacketPhotoLink, token, async () => 1);

    expect(new Set(keys).size).toBe(2);
  });
});

describe("tokenFromPath", () => {
  const token = newPacketToken();

  it.each([
    [`https://x/api/job/${"T".repeat(43)}/sheet`, "T".repeat(43)],
    [`https://x/api/job/${"T".repeat(43)}/files`, "T".repeat(43)],
    [`https://x/api/job/${"T".repeat(43)}/photos?x=1`, "T".repeat(43)],
    [`https://x/job/${"T".repeat(43)}`, "T".repeat(43)],
  ])("reads the token out of %s", (url, expected) => {
    expect(tokenFromPath(url)).toBe(expected);
  });

  it("gives the empty string for an address with no token in it, which opens nothing", () => {
    expect(tokenFromPath("https://x/api/job")).toBe("");
    expect(tokenFromPath("https://x/api/job/")).toBe("");
    expect(tokenFromPath("https://x/api/ops/batches/abc/factory-sheet")).toBe("");
  });

  it("reads the real token, not a later segment, so a trailing slash cannot shift it", () => {
    expect(tokenFromPath(`https://x/api/job/${token}/photos/`)).toBe(token);
    expect(tokenFromPath(`https://x/api/job/${token}/sheet`)).toBe(token);
  });

  it("gives the event id's route nothing, because that route takes a session instead", () => {
    expect(tokenFromPath("https://x/api/job/events/abc/photo")).toBe("events");
    // "events" is not a token shape, so the limit names a hash of it and openPacket never asks the database.
    expect(tokenFromPath("https://x/api/job/events/abc/photo")).not.toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
