import { describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/fabrics/fixtures/fake-db";
import { createFabric, addFabricTest } from "@/lib/fabrics/service";
import { fabricInputSchema, fabricTestInputSchema } from "@/lib/fabrics/schemas";
import { DEFAULT_SETTINGS } from "../layout/context";
import { createRuleSet } from "./rules";
import { leagueRuleSetInputSchema } from "./schemas";
import { printDeps } from "./deps";
import { projectOf } from "./test-deps";

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };

describe("print dependencies", () => {
  it("reads the design, the brand's settings, rules, fabric and size maps through the person's client", async () => {
    const db = fakeDb();
    const fabricId = await createFabric(db.client, who, fabricInputSchema.parse({ name: "Interlock" }));
    await addFabricTest(
      db.client,
      who,
      fabricId,
      fabricTestInputSchema.parse({ testedBy: "Priya Nair", testedOn: "2026-10-01", method: "Pressed 40 s at 200 C", shrinkLengthPct: "2", shrinkWidthPct: "1.5", pressTempC: "200", pressSeconds: "40" }),
    );
    const ruleId = await createRuleSet(db.client, who, leagueRuleSetInputSchema.parse({ name: "League", source: "Rulebook s4", rules: { minTextHeightMm: 30, minLineMm: null, coloursToAvoid: [], numberRules: null } }));
    const project = projectOf();
    const deps = printDeps({ client: db.client, brandId: who.brandId, load: async () => project, ruleSetId: ruleId });
    expect(await deps.load({})).toBe(project);
    expect(await deps.settings()).toEqual(DEFAULT_SETTINGS);
    expect((await deps.rules()).minTextHeightMm).toBe(30);
    const fabric = await deps.fabric(fabricId);
    expect(fabric?.name).toBe("Interlock");
    expect(fabric?.profile.shrinkLengthPct).toMatchObject({ value: 2, source: "fabric-test" });
    expect(await deps.fabric("44444444-4444-4444-8444-444444444444")).toBeNull();
    expect((await deps.sizeMaps()).find((m) => m.label === "M" && m.cut === "mens")?.patternSize).toBe("48");
    expect(await deps.assets.getAsset("nothing")).toBeNull();
    expect((await deps.font()).unitsPerEm).toBeGreaterThan(0);
  });
});
