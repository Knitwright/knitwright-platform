import { describe, expect, it, vi } from "vitest";
import { jersey } from "@/lib/artwork-stack/fixtures/designs";
import { readinessFor } from "./design-input";
import { UNWIRED_CATALOGUE, UNWIRED_MODERATION, UNWIRED_PORTS, type ParameterDef } from "./ports";

/**
 * `readinessFor` is what the readiness list, the status move and the reorder preview read a design
 * through. The ports it is given are the catalogue (X1) and moderation (X8), and it must hand them
 * on: a path that reads a design through the unwired pair counts fewer findings than the save of
 * that same design did, which is what the status move and the reorder preview did until the
 * orchestrator wired them (see the note in `ports.ts`).
 */

const PROJECT = "7c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const DEFS: readonly ParameterDef[] = [{ key: "body_length_offset", type: "range", min: -30, max: 40, step: 10, ruleId: "R-PAT-003" }];

const spec = jersey({ article: { baseArticleCode: "JSY-SS-01", productionClass: "A", parameters: { body_length_offset: 10 } } });

vi.mock("@/lib/projects/tech-pack-load", () => ({
  readTechPack: async () => ({ project: { spec, currentVersion: 4 }, history: [], charts: [], memberNames: {}, production: null }),
}));
vi.mock("@/lib/projects/tech-pack-data", () => ({ buildTechPackCore: () => ({ pack: { readiness: { ready: true } } }) }));

const client = {} as never;
const brand = { id: "b1", name: "Oak" };

describe("reading a design for the checks", () => {
  it("gives the garment type, the readiness and the version the design is on", async () => {
    const { design, version } = await readinessFor(client, brand, PROJECT, UNWIRED_PORTS);

    expect(version).toBe(4);
    expect(design.typeId).toBe(spec.typeId);
    expect(design.readiness).toEqual({ ready: true });
  });

  it("asks the ports it was given, not the unwired pair", async () => {
    const parameterDefs = vi.fn(async () => DEFS);
    const statusesFor = vi.fn(async () => []);

    const { design } = await readinessFor(client, brand, PROJECT, {
      catalogue: { ...UNWIRED_CATALOGUE, parameterDefs },
      moderation: { ...UNWIRED_MODERATION, statusesFor },
    });

    expect(parameterDefs).toHaveBeenCalledWith("JSY-SS-01");
    expect(statusesFor).toHaveBeenCalled();
    expect(design.parameterDefs).toEqual(DEFS);
  });

  it("knows no parameter and no screening while the ports are unwired, so it raises no finding about either", async () => {
    const { design } = await readinessFor(client, brand, PROJECT, UNWIRED_PORTS);

    expect(design.parameterDefs).toBeNull();
    expect(design.moderation).toEqual([]);
  });
});
