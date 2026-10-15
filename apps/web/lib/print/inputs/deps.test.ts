import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { gradedJersey } from "../fixtures/graded";
import { DEFAULT_PRINT_PROFILE } from "../profiles";
import { printQuerySchema } from "../service";
import { LIBRARY_NOT_OPEN } from "./access";
import { NO_LIBRARY_PATTERN } from "./pattern";

const getProject = vi.fn();
const loadDesignPattern = vi.fn();
const loadPrintContext = vi.fn();
const getTeamOrder = vi.fn();
const getEnvMock = vi.fn();
vi.mock("@/lib/projects/service", () => ({ getProject: (...a: unknown[]) => getProject(...a) }));
vi.mock("@/lib/orders/service", () => ({ getTeamOrder: (...a: unknown[]) => getTeamOrder(...a) }));
vi.mock("@/lib/config/env", async (original) => ({ ...(await original<typeof import("@/lib/config/env")>()), getEnv: () => getEnvMock() }));
vi.mock("./pattern", async (original) => ({ ...(await original<typeof import("./pattern")>()), loadDesignPattern: (...a: unknown[]) => loadDesignPattern(...a) }));
vi.mock("./context", () => ({ loadPrintContext: (...a: unknown[]) => loadPrintContext(...a) }));

import { loadPrintDeps } from "./deps";

const clients = { client: {} as SupabaseClient, admin: {} as SupabaseClient };
const who = { brandId: "11111111-1111-4111-8111-111111111111", email: "me@example.com" };
const PROJECT = "22222222-2222-4222-8222-222222222222";
const ID = "33333333-3333-4333-8333-333333333333";
const context = { profile: DEFAULT_PRINT_PROFILE, icc: null, rules: { minTextHeightMm: null, minLineMm: null, coloursToAvoid: [], numberRules: null }, assets: { getAsset: async () => null } };

beforeEach(() => {
  vi.clearAllMocks();
  getEnvMock.mockReturnValue({ OWNER_EMAIL: "me@example.com", VERCEL_ENV: "production", NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://example.com" });
  getProject.mockResolvedValue({ name: "Home kit", currentVersion: 4, spec: jersey() });
  loadDesignPattern.mockResolvedValue({ ok: true, pattern: gradedJersey(["48"]), reviewed: false, note: "n" });
  loadPrintContext.mockResolvedValue(context);
  getTeamOrder.mockResolvedValue({ id: ID, name: "Round 1", updatedAt: "x", rows: ROSTER_22.rows });
});

describe("loadPrintDeps", () => {
  it("reads the design, the library's pattern for its garment and the brand's settings, and no team list unless one is named", async () => {
    const deps = await loadPrintDeps(clients, who, PROJECT, printQuerySchema.parse({}));
    expect(deps.project).toMatchObject({ name: "Home kit", version: 4 });
    expect(loadDesignPattern).toHaveBeenCalledWith(clients.client, who.brandId, { typeId: jersey().typeId });
    expect(loadPrintContext).toHaveBeenCalledWith(clients, who.brandId, undefined);
    expect(deps.roster).toBeNull();
    expect(getTeamOrder).not.toHaveBeenCalled();
  });

  it("reads a named pattern, rule set and team list, all for the session's brand", async () => {
    const deps = await loadPrintDeps(clients, who, PROJECT, printQuerySchema.parse({ pattern: ID, rules: ID, order: ID }));
    expect(loadDesignPattern).toHaveBeenCalledWith(clients.client, who.brandId, { typeId: jersey().typeId, blockId: ID });
    expect(loadPrintContext).toHaveBeenCalledWith(clients, who.brandId, ID);
    expect(getTeamOrder).toHaveBeenCalledWith(clients.client, who.brandId, PROJECT, ID);
    expect(deps.roster?.rows).toHaveLength(ROSTER_22.rows.length);
  });

  it("says so when there is no pattern, and keeps the library to those it is open to", async () => {
    loadDesignPattern.mockResolvedValue({ ok: false, reason: NO_LIBRARY_PATTERN });
    await expect(loadPrintDeps(clients, who, PROJECT, printQuerySchema.parse({}))).rejects.toMatchObject({ code: "not_found", message: NO_LIBRARY_PATTERN });
    await expect(loadPrintDeps(clients, { ...who, email: "other@example.com" }, PROJECT, printQuerySchema.parse({}))).rejects.toMatchObject({ code: "unavailable", message: LIBRARY_NOT_OPEN });
    expect(getProject).toHaveBeenCalledTimes(1);
  });
});
