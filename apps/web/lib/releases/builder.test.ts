import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { gradedJersey } from "@/lib/print/fixtures/graded";
import { DEFAULT_PRINT_PROFILE } from "@/lib/print/profiles";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { specFor } from "./fixtures/fake-builder";

const getProject = vi.fn();
const loadDesignPattern = vi.fn();
const loadPrintContext = vi.fn();
vi.mock("@/lib/projects/service", () => ({ getProject: (...args: unknown[]) => getProject(...args) }));
vi.mock("@/lib/print/inputs/pattern", () => ({ loadDesignPattern: (...args: unknown[]) => loadDesignPattern(...args) }));
vi.mock("@/lib/print/inputs/context", () => ({ loadPrintContext: (...args: unknown[]) => loadPrintContext(...args) }));

import { printFileBuilder } from "./builder";

const clients = { client: { tag: "session" } as unknown as SupabaseClient, admin: { tag: "admin" } as unknown as SupabaseClient };
const BRAND = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const ask = { projectId: PROJECT, roster: null, patternBlockId: "33333333-3333-4333-8333-333333333333", patternBlockVersion: 4 };

beforeEach(() => {
  vi.clearAllMocks();
  getProject.mockResolvedValue({ spec: jersey() });
  loadDesignPattern.mockResolvedValue({ ok: true, pattern: gradedJersey(["48"]), reviewed: true, note: "Pattern: Team jersey, version 4. Reviewed by Sam Cutter (technician) on 2026-10-12." });
  loadPrintContext.mockResolvedValue({ profile: DEFAULT_PRINT_PROFILE, icc: null, rules: { minTextHeightMm: null, minLineMm: null, coloursToAvoid: [], numberRules: null }, assets: { getAsset: async () => null } });
});

describe("printFileBuilder", () => {
  it("reads nothing until a file is built, then the design, the named pattern at its frozen version and the brand's print settings", async () => {
    const builder = printFileBuilder(clients, BRAND)(ask);
    expect(getProject).not.toHaveBeenCalled();
    const file = await builder.build({ ...specFor("collar", "48"), format: "svg" });
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(getProject).toHaveBeenCalledWith(clients.client, BRAND, PROJECT);
    expect(loadDesignPattern).toHaveBeenCalledWith(clients.client, BRAND, { typeId: jersey().typeId, blockId: ask.patternBlockId, blockVersion: 4 });
    expect(loadPrintContext).toHaveBeenCalledWith(clients, BRAND);
    expect(new TextDecoder().decode(file.bytes)).toContain("Reviewed by Sam Cutter");
  }, 60_000);

  it("makes the files for the team list the release was made from", async () => {
    const row = { ...ROSTER_22.rows[0]!, sizeLabel: "48" };
    const builder = printFileBuilder(clients, BRAND)({ ...ask, roster: [row] });
    const file = await builder.build({ ...specFor("back", "48", row.number), format: "svg" });
    expect(new TextDecoder().decode(file.bytes)).toContain(row.number);
  }, 60_000);
});
