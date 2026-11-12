import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { describePurge, PURGE_SWITCHED_OFF, purgeRefusal, ROSTER_PURGE_PATH, ROSTER_PURGE_SCHEDULE, runRosterPurge } from "./purge";

const WEB = join(__dirname, "..", "..", "..");

describe("describePurge", () => {
  it("says how many seasons lost their roster and how many players went", () => {
    expect(describePurge({ seasonsPurged: 2, playersRemoved: 31, requestsRemoved: 4, entriesRemoved: 9 })).toBe(
      "Removed the rosters of 2 seasons older than two seasons: 31 players, 4 people waited on and 9 sign-up answers.",
    );
    expect(describePurge({ seasonsPurged: 1, playersRemoved: 1, requestsRemoved: 0, entriesRemoved: 1 })).toBe(
      "Removed the roster of 1 season older than two seasons: 1 player, 0 people waited on and 1 sign-up answer.",
    );
  });

  it("says plainly that a run with nothing past keeping removed nothing", () => {
    expect(describePurge({ seasonsPurged: 0, playersRemoved: 0, requestsRemoved: 0, entriesRemoved: 0 })).toBe(
      "No roster was older than two seasons, so nothing was removed.",
    );
  });
});

describe("runRosterPurge", () => {
  it("reads the counts the database gave back", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ seasons_purged: 3, players_removed: 40, requests_removed: 2, entries_removed: 5 }],
      error: null,
    });
    expect(await runRosterPurge({ rpc } as never)).toEqual({ seasonsPurged: 3, playersRemoved: 40, requestsRemoved: 2, entriesRemoved: 5 });
    expect(rpc).toHaveBeenCalledWith("purge_old_rosters", {});
  });

  it("passes a clock when it is given one, and accepts a single row", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { seasons_purged: 0, players_removed: 0, requests_removed: 0, entries_removed: 0 },
      error: null,
    });
    await runRosterPurge({ rpc } as never, new Date("2027-01-01T00:00:00Z"));
    expect(rpc).toHaveBeenCalledWith("purge_old_rosters", { p_now: "2027-01-01T00:00:00.000Z" });
  });

  it("fails when the database refuses or answers with nothing, without passing on its words", async () => {
    const bad = vi.fn().mockResolvedValue({ data: null, error: { message: "raw detail", code: "XX000" } });
    await expect(runRosterPurge({ rpc: bad } as never)).rejects.toThrow("The roster purge did not run.");
    const empty = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(runRosterPurge({ rpc: empty } as never)).rejects.toThrow("The roster purge did not run.");
  });
});

describe("purgeRefusal", () => {
  it("names the purge, not the cut, when the deploy has no secret, and hides the route from a stranger", () => {
    expect(purgeRefusal({ ok: false, status: 503, reason: "anything" })).toEqual({ status: 503, error: PURGE_SWITCHED_OFF });
    expect(purgeRefusal({ ok: false, status: 404, reason: "Not found." })).toEqual({ status: 404, error: "Not found." });
  });
});

describe("the schedule", () => {
  it("is in vercel.json at the route's own address, beside the weekly cut", () => {
    const vercel = JSON.parse(readFileSync(join(WEB, "vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(vercel.crons).toContainEqual({ path: ROSTER_PURGE_PATH, schedule: ROSTER_PURGE_SCHEDULE });
    expect(vercel.crons.map((c) => c.path)).toContain("/api/cron/ops-cut-batches");
  });

  it("has a route file at that address that admits only the cron secret", () => {
    const route = readFileSync(join(WEB, "app", ROSTER_PURGE_PATH, "route.ts"), "utf8");
    expect(route).toMatch(/admitCron\(\(await headers\(\)\)\.get\("authorization"\), process\.env\.CRON_SECRET\)/);
    expect(route).toContain('auth: "public"');
  });

  it("is a public route on the list, with its reason", () => {
    expect(readFileSync(join(WEB, "lib", "server", "public-routes.ts"), "utf8")).toContain(`"app${ROSTER_PURGE_PATH}/route.ts#GET"`);
  });
});
