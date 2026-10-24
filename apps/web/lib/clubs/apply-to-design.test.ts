import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { start } from "@/lib/garment/fixtures/specs";
import { EMPTY_KIT } from "./kit";

const getProject = vi.fn();
const saveActions = vi.fn();
vi.mock("@/lib/projects/service", () => ({ getProject: (...a: unknown[]) => getProject(...a), saveActions: (...a: unknown[]) => saveActions(...a) }));
const getKit = vi.fn();
vi.mock("./service", () => ({ getKit: (...a: unknown[]) => getKit(...a) }));

import { applyKitToDesign } from "./apply-to-design";

const clients = { client: {} as SupabaseClient, admin: {} as SupabaseClient };
const who = { brandId: "b", userId: "u" };
const body = { projectId: "6f1c1b0e-6a39-4b0e-8f0e-2b6a1d2f3c4d", expectedVersion: 3, parts: ["colours" as const] };

beforeEach(() => {
  vi.resetAllMocks();
  getProject.mockResolvedValue({ spec: start("crew-tee"), currentVersion: 3 });
});

describe("applyKitToDesign", () => {
  it("saves one version from the kit's colours", async () => {
    getKit.mockResolvedValue({ ...EMPTY_KIT, primaryColour: "#0b3d91" });
    saveActions.mockResolvedValue({ ok: true, version: 4, spec: {}, dropped: [] });
    const result = await applyKitToDesign(clients, who, body);
    expect(result).toMatchObject({ version: 4, changed: true });
    expect(saveActions.mock.calls[0]?.[2]).toMatchObject({ brandId: "b", userId: "u", expectedVersion: 3 });
    expect(saveActions.mock.calls[0]?.[2].actions).toHaveLength(1);
  });

  it("saves nothing when the kit has nothing to give", async () => {
    getKit.mockResolvedValue(EMPTY_KIT);
    const result = await applyKitToDesign(clients, who, body);
    expect(result).toMatchObject({ version: 3, changed: false });
    expect(result.notes).toHaveLength(1);
    expect(saveActions).not.toHaveBeenCalled();
  });

  it("reports a refused change in the design's own words", async () => {
    getKit.mockResolvedValue({ ...EMPTY_KIT, primaryColour: "#0b3d91" });
    saveActions.mockResolvedValue({ ok: false, reason: "This design was changed somewhere else." });
    await expect(applyKitToDesign(clients, who, body)).rejects.toMatchObject({ code: "conflict", message: "This design was changed somewhere else." });
  });

  it("says unchanged when the design already had the same colours", async () => {
    getKit.mockResolvedValue({ ...EMPTY_KIT, primaryColour: "#0b3d91" });
    saveActions.mockResolvedValue({ ok: true, version: 3, spec: {}, dropped: [] });
    expect((await applyKitToDesign(clients, who, body)).changed).toBe(false);
  });
});
