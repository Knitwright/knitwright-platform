import { randomUUID } from "node:crypto";
import type { LogEvent } from "@/lib/server/core/guard";
import { scrub } from "@/lib/server/log";

/**
 * Error monitoring that is not tied to one vendor. It does nothing unless MONITORING_DSN is set.
 *
 * - A Sentry-style address (https://<key>@<host>/<project>) gets a Sentry envelope over plain
 *   HTTPS. Sentry and the services that accept its protocol (GlitchTip, for one) take this.
 * - Any other https address is treated as a webhook and gets one JSON object per error.
 *
 * No vendor SDK is loaded. Everything sent is scrubbed of keys, tokens and email addresses first,
 * and a failure to send never becomes a failure of the request.
 */

export type Target =
  | Readonly<{ kind: "off" }>
  | Readonly<{ kind: "invalid"; reason: string }>
  | Readonly<{ kind: "sentry"; key: string; endpoint: string }>
  | Readonly<{ kind: "webhook"; url: string }>;

const NOT_HTTPS = "MONITORING_DSN must be an https address.";

export const parseTarget = (dsn: string | undefined): Target => {
  const text = dsn?.trim() ?? "";
  if (text === "") return { kind: "off" };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { kind: "invalid", reason: "MONITORING_DSN is not an address." };
  }
  if (url.protocol !== "https:") return { kind: "invalid", reason: NOT_HTTPS };

  const segments = url.pathname.split("/").filter(Boolean);
  const project = segments.at(-1) ?? "";
  if (url.username && /^\d+$/.test(project)) {
    const prefix = segments.slice(0, -1).map((segment) => `/${segment}`).join("");
    return {
      kind: "sentry",
      key: decodeURIComponent(url.username),
      endpoint: `https://${url.host}${prefix}/api/${project}/envelope/`,
    };
  }
  return { kind: "webhook", url: url.toString() };
};

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Nothing that identifies a person or unlocks anything leaves the server. */
const clean = (text: string): string => scrub(text).replace(EMAIL, "[email]");

const MAX_CAUSES = 5;

type ExceptionValue = Readonly<{ type: string; value: string; stack?: string }>;

const chainOf = (error: unknown): ExceptionValue[] => {
  const values: ExceptionValue[] = [];
  let current: unknown = error;
  for (let depth = 0; current !== undefined && depth <= MAX_CAUSES; depth += 1) {
    if (current instanceof Error) {
      values.push({
        type: current.name,
        value: clean(current.message),
        ...(current.stack ? { stack: clean(current.stack) } : {}),
      });
      current = current.cause;
    } else {
      values.push({ type: "Thrown", value: clean(String(current)) });
      current = undefined;
    }
  }
  return values;
};

export type Send = (url: string, init: RequestInit) => Promise<Response>;

export type MonitorOptions = Readonly<{
  dsn: string | undefined;
  send: Send;
  /** Where a failure to send is written. Never the monitor itself. */
  warn: (event: LogEvent) => void;
  environment?: string;
  release?: string;
  now?: () => Date;
  eventId?: () => string;
}>;

export type Monitor = Readonly<{
  enabled: boolean;
  /** Sends one error. Resolves whether or not it arrived. */
  reportError: (event: LogEvent) => Promise<void>;
}>;

const TIMEOUT_MS = 3000;

const sentryRequest = (
  target: Extract<Target, { kind: "sentry" }>,
  event: LogEvent,
  options: MonitorOptions,
  now: Date,
): [string, RequestInit] => {
  const eventId = (options.eventId ?? (() => randomUUID().replaceAll("-", "")))();
  const chain = chainOf(event.error);
  const payload = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: "node",
    level: event.level === "error" ? "error" : "warning",
    logger: "knitwright",
    environment: options.environment,
    release: options.release,
    message: { formatted: clean(event.message) },
    tags: { where: clean(event.where) },
    ...(chain.length > 0
      ? {
          exception: { values: chain.map(({ type, value }) => ({ type, value })).reverse() },
          extra: { stacks: chain.map((value) => value.stack ?? "") },
        }
      : {}),
  };
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(payload),
  ].join("\n");
  return [
    target.endpoint,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=knitwright-monitor/1`,
      },
      body: `${body}\n`,
    },
  ];
};

const webhookRequest = (
  target: Extract<Target, { kind: "webhook" }>,
  event: LogEvent,
  options: MonitorOptions,
  now: Date,
): [string, RequestInit] => [
  target.url,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      time: now.toISOString(),
      level: event.level,
      message: clean(event.message),
      where: clean(event.where),
      environment: options.environment,
      release: options.release,
      error: chainOf(event.error),
    }),
  },
];

export const createMonitor = (options: MonitorOptions): Monitor => {
  const target = parseTarget(options.dsn);
  if (target.kind === "invalid") {
    options.warn({ level: "warn", message: target.reason, where: "monitoring" });
  }
  if (target.kind !== "sentry" && target.kind !== "webhook") {
    return { enabled: false, reportError: async () => {} };
  }

  const now = options.now ?? (() => new Date());

  return {
    enabled: true,
    reportError: async (event) => {
      const [url, init] =
        target.kind === "sentry"
          ? sentryRequest(target, event, options, now())
          : webhookRequest(target, event, options, now());
      try {
        const response = await options.send(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!response.ok) throw new Error(`Monitoring answered ${response.status}.`);
      } catch (error) {
        options.warn({ level: "warn", message: "An error could not be sent to monitoring", where: "monitoring", error });
      }
    },
  };
};
