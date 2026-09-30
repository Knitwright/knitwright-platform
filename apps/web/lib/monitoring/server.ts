import "server-only";
import { after } from "next/server";
import { log } from "@/lib/server/log";
import { createMonitor, type Monitor } from "./monitor";
import { createSpendAlert, logAndReport } from "./wire";

/**
 * The app's monitor, built once from the environment. MONITORING_DSN is optional: without it
 * errors go to the server log only. It is read here rather than in lib/config/env.ts so that
 * monitoring can never stop the app from starting.
 */

let monitor: Monitor | undefined;

export const appMonitor = (): Monitor => {
  monitor ??= createMonitor({
    dsn: process.env.MONITORING_DSN,
    send: (url, init) => fetch(url, init),
    warn: log,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
  });
  return monitor;
};

/** The server log, with errors also sent to monitoring once the response has gone. */
export const monitoredLog = logAndReport({
  log,
  report: (event) => appMonitor().reportError(event),
  schedule: after,
});

/** Call when a spend ceiling is reached. See `createSpendAlert`. */
export const alertSpendCeiling = createSpendAlert({
  log,
  report: (event) => appMonitor().reportError(event),
});
