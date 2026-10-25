import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { defaultFactoryProfile } from "@/lib/validation/profile";
import { loadRunContext } from "./run-context";

vi.mock("@/lib/projects/project-reads", () => ({
  getProject: async () => ({ name: "Home tee", garmentType: "crew-tee", garmentLabel: "Crew tee", spec: { sizing: { sizes: ["S", "M"] } } }),
}));
vi.mock("@/lib/releases/service", () => ({ listReleases: async () => [{ id: "r1", number: 1, label: "Round 1", createdAt: "2026-10-25" }] }));
vi.mock("@/lib/validation/service", () => ({ loadFactoryProfile: async () => defaultFactoryProfile() }));

describe("loadRunContext", () => {
  it("joins the design, the factory profile and the releases", async () => {
    const context = await loadRunContext({} as SupabaseClient, "b", "p");
    expect(context).toMatchObject({ designName: "Home tee", garmentLabel: "Crew tee", sizeRun: ["S", "M"], moq: { status: "not-set" }, ladder: { status: "not-set" }, factoryProfileId: "knitwright-default" });
    expect(context.releases.map((r) => r.label)).toEqual(["Round 1"]);
  });
});
