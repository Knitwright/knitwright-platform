import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { defaultFactoryProfile } from "@/lib/validation/profile";
import { loadRunContext } from "./run-context";

vi.mock("@/lib/projects/project-reads", () => ({
  getProject: async () => ({ name: "Home tee", garmentType: "crew-tee", garmentLabel: "Crew tee", spec: { sizing: { sizes: ["S", "M"] } } }),
}));
vi.mock("@/lib/releases/service", () => ({ listReleases: async () => [{ id: "r1", number: 1, label: "Round 1", createdAt: "2026-10-25" }] }));
vi.mock("@/lib/validation/service", () => ({ loadFactoryProfile: async () => defaultFactoryProfile() }));
// The base article's production class says whether a run is Class B, which decides whether a person
// has to have looked at the design before it starts (security review v5 H3, decision 0116).
vi.mock("@/lib/validation/live-ports", () => ({
  catalogueFrom: () => ({ articleForType: async () => ({ baseArticleCode: "TEE-TR-01", productionClass: "B" }), parameterDefs: async () => [] }),
}));

describe("loadRunContext", () => {
  it("joins the design, the factory profile and the releases", async () => {
    const context = await loadRunContext({} as SupabaseClient, "b", "p");
    expect(context).toMatchObject({ designName: "Home tee", garmentLabel: "Crew tee", sizeRun: ["S", "M"], moq: { status: "not-set" }, ladder: { status: "not-set" }, factoryProfileId: "knitwright-default" });
    expect(context.releases.map((r) => r.label)).toEqual(["Round 1"]);
  });

  it("carries the design and its production class, which the order's screens need", async () => {
    const context = await loadRunContext({} as SupabaseClient, "b", "p");
    expect(context.productionClass).toBe("B");
    expect(context.spec).toMatchObject({ sizing: { sizes: ["S", "M"] } });
  });
});
