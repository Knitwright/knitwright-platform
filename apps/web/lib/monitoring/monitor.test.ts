import { describe, expect, it } from "vitest";
import { createMonitor, NOT_EU_REGION, parseTarget, regionWarning } from "./monitor";

type Sent = { url: string; init: RequestInit };

const recorder = (status = 200) => {
  const sent: Sent[] = [];
  const send = async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return new Response(null, { status });
  };
  return { sent, send };
};

const warnings = () => {
  const lines: unknown[] = [];
  return { lines, warn: (event: unknown) => void lines.push(event) };
};

const NOW = new Date("2026-09-30T12:00:00.000Z");
const SENTRY_DSN = "https://abc123@o42.ingest.example.io/7";

describe("the chosen provider: Sentry, EU region (owner decision 2026-09-30)", () => {
  const EU_DSN = "https://abc123@o42.ingest.de.sentry.io/7";

  it("sends to the EU ingest host named in the DSN", () => {
    expect(parseTarget(EU_DSN)).toMatchObject({
      kind: "sentry",
      endpoint: "https://o42.ingest.de.sentry.io/api/7/envelope/",
    });
    expect(regionWarning(parseTarget(EU_DSN))).toBeNull();
  });

  it("warns when a sentry.io DSN is outside the EU region, but still sends", () => {
    const us = parseTarget("https://abc123@o42.ingest.us.sentry.io/7");
    expect(regionWarning(us)).toBe(NOT_EU_REGION);
    expect(regionWarning(parseTarget("https://abc123@o42.ingest.sentry.io/7"))).toBe(NOT_EU_REGION);

    const { lines, warn } = warnings();
    const monitor = createMonitor({ dsn: "https://abc123@o42.ingest.us.sentry.io/7", send: recorder().send, warn });
    expect(monitor.enabled).toBe(true);
    expect(lines).toEqual([expect.objectContaining({ level: "warn", message: NOT_EU_REGION })]);
  });

  it("says nothing about the region of a host that is not sentry.io", () => {
    expect(regionWarning(parseTarget(SENTRY_DSN))).toBeNull();
    expect(regionWarning(parseTarget("https://hooks.example.com/knitwright"))).toBeNull();
    expect(regionWarning(parseTarget("https://k@evil-sentry.io.example.com/1"))).toBeNull();
  });
});

describe("parseTarget", () => {
  it("reads a Sentry-style address: key, host and project", () => {
    expect(parseTarget(SENTRY_DSN)).toEqual({
      kind: "sentry",
      key: "abc123",
      endpoint: "https://o42.ingest.example.io/api/7/envelope/",
    });
  });

  it("keeps a path prefix in a Sentry-style address", () => {
    expect(parseTarget("https://k@errors.example.com/prefix/12")).toMatchObject({
      endpoint: "https://errors.example.com/prefix/api/12/envelope/",
    });
  });

  it("treats any other https address as a webhook that takes JSON", () => {
    expect(parseTarget("https://hooks.example.com/knitwright")).toEqual({
      kind: "webhook",
      url: "https://hooks.example.com/knitwright",
    });
  });

  it("is off when nothing is set", () => {
    expect(parseTarget(undefined)).toEqual({ kind: "off" });
    expect(parseTarget("  ")).toEqual({ kind: "off" });
  });

  it("refuses an address that is not https, so errors never travel in the clear", () => {
    expect(parseTarget("http://hooks.example.com/x")).toEqual({
      kind: "invalid",
      reason: "MONITORING_DSN must be an https address.",
    });
    expect(parseTarget("not a url")).toMatchObject({ kind: "invalid" });
  });
});

describe("createMonitor", () => {
  it("sends nothing and succeeds quietly when no address is set", async () => {
    const { sent, send } = recorder();
    const monitor = createMonitor({ dsn: undefined, send, warn: () => {} });
    expect(monitor.enabled).toBe(false);
    await monitor.reportError({ level: "error", message: "Failed", where: "x", error: new Error("boom") });
    expect(sent).toEqual([]);
  });

  it("sends a Sentry envelope with the error, the place and the environment", async () => {
    const { sent, send } = recorder();
    const monitor = createMonitor({
      dsn: SENTRY_DSN,
      send,
      warn: () => {},
      environment: "production",
      release: "abc",
      now: () => NOW,
      eventId: () => "0".repeat(32),
    });

    await monitor.reportError({ level: "error", message: "Unexpected failure", where: "GET /api/me", error: new TypeError("bad") });

    expect(sent).toHaveLength(1);
    const [{ url, init }] = sent;
    expect(url).toBe("https://o42.ingest.example.io/api/7/envelope/");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-sentry-auth"]).toBe(
      "Sentry sentry_version=7, sentry_key=abc123, sentry_client=knitwright-monitor/1",
    );
    const [header, item, event] = String(init.body).trimEnd().split("\n").map((line) => JSON.parse(line));
    expect(header).toEqual({ event_id: "0".repeat(32), sent_at: NOW.toISOString() });
    expect(item).toEqual({ type: "event" });
    expect(event).toMatchObject({
      event_id: "0".repeat(32),
      level: "error",
      platform: "node",
      environment: "production",
      release: "abc",
      message: { formatted: "Unexpected failure" },
      tags: { where: "GET /api/me" },
      exception: { values: [{ type: "TypeError", value: "bad" }] },
    });
  });

  it("posts plain JSON to a webhook", async () => {
    const { sent, send } = recorder();
    const monitor = createMonitor({ dsn: "https://hooks.example.com/k", send, warn: () => {}, now: () => NOW });

    await monitor.reportError({ level: "error", message: "Spend ceiling", where: "usage" });

    expect(sent[0].url).toBe("https://hooks.example.com/k");
    expect(JSON.parse(String(sent[0].init.body))).toMatchObject({
      time: NOW.toISOString(),
      level: "error",
      message: "Spend ceiling",
      where: "usage",
    });
  });

  it("removes keys, tokens and email addresses before anything leaves the server", async () => {
    const { sent, send } = recorder();
    const monitor = createMonitor({ dsn: "https://hooks.example.com/k", send, warn: () => {} });

    await monitor.reportError({
      level: "error",
      message: "Failed for maker@example.com",
      where: "x",
      error: new Error("key sb_secret_abcDEF123 and Bearer abc.def.ghi and token_hash=xyz789"),
    });

    const body = String(sent[0].init.body);
    for (const secret of ["maker@example.com", "sb_secret_abcDEF123", "abc.def.ghi", "xyz789"]) {
      expect(body).not.toContain(secret);
    }
  });

  it("never throws when the destination fails, and says so in the log", async () => {
    const { lines, warn } = warnings();
    const failing = async () => {
      throw new Error("network down");
    };
    const monitor = createMonitor({ dsn: SENTRY_DSN, send: failing, warn });
    await expect(monitor.reportError({ level: "error", message: "m", where: "w" })).resolves.toBeUndefined();
    expect(lines).toEqual([expect.objectContaining({ level: "warn", message: "An error could not be sent to monitoring" })]);

    const refusing = recorder(500);
    const second = createMonitor({ dsn: SENTRY_DSN, send: refusing.send, warn });
    await second.reportError({ level: "error", message: "m", where: "w" });
    expect(lines).toHaveLength(2);
  });

  it("stays off and warns when the address is not valid", async () => {
    const { lines, warn } = warnings();
    const { sent, send } = recorder();
    const monitor = createMonitor({ dsn: "http://plain.example.com", send, warn });
    expect(monitor.enabled).toBe(false);
    expect(lines).toEqual([expect.objectContaining({ level: "warn", message: "MONITORING_DSN must be an https address." })]);
    await monitor.reportError({ level: "error", message: "m", where: "w" });
    expect(sent).toEqual([]);
  });
});
