import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { catalogueFrom, moderationFrom } from "@/lib/validation/live-ports";
import type { ModerationTarget } from "@/lib/validation/ports";
import { adminClient, brandOf, must, person, type Person } from "./support";

/**
 * The wave 2 wiring of validation's two ports against the real database: the base article catalogue
 * (migration 20261101010000) behind `ArticleCatalogue`, and the kept moderation results (migration
 * 20261101070000) behind `ModerationReader`. Both are read with the server's own key, which is what
 * `lib/projects/service.ts` passes on a save. Needs `pnpm db:start`.
 */

let owner: Person;
let admin: Person;
let brand: string;

const catalogue = () => catalogueFrom(adminClient());
const moderation = () => moderationFrom(adminClient());

const asset = (id: string): ModerationTarget => ({ kind: "asset", id, label: "Club crest" });

/** One kept screening of an asset, through the only way into the table. */
const screened = async (targetId: string, result: "clear" | "flagged" | "blocked"): Promise<string> => {
  const severity = result === "blocked" ? "block" : result === "flagged" ? "flag" : "note";
  return must(
    await adminClient().rpc("moderation_record", {
      p_brand_id: brand,
      p_user_id: owner.userId,
      p_target_kind: "asset",
      p_target_id: targetId,
      p_hook: "upload",
      p_label: "crest.png",
      p_subject_sha256: null,
      p_result: result,
      p_reasons: [{ code: "brand_term", severity, message: "A registered name.", ruleId: "R-GAP-000", term: "Nike" }],
    }),
  ) as string;
};

beforeAll(async () => {
  [owner, admin] = await Promise.all([person("wire-owner"), person("wire-admin")]);
  brand = await brandOf(owner, "Wiring FC");
  must(await adminClient().from("platform_admins").insert({ user_id: admin.userId }).select("user_id"));
});

describe("the catalogue port over the server's own key", () => {
  it("gives the base article a garment type is made on, with its production class", async () => {
    expect(await catalogue().articleForType("football-shirt")).toEqual({ baseArticleCode: "JSY-SS-01", productionClass: "A" });
    expect(await catalogue().articleForType("crew-tee")).toEqual({ baseArticleCode: "TEE-TR-01", productionClass: "B" });
  });

  it("gives null for a garment type the catalogue does not cover", async () => {
    expect(await catalogue().articleForType("bobble-hat")).toBeNull();
  });

  it("gives the seeded ranges of JSY-SS-01, each with the rule that explains it", async () => {
    const defs = await catalogue().parameterDefs("JSY-SS-01");

    expect(defs?.map((def) => def.key)).toEqual(["body_length_offset", "sleeve_length_offset", "back_drop_tail"]);
    expect(defs?.[2]).toEqual({ key: "back_drop_tail", type: "range", min: 0, max: 40, step: 10, ruleId: "R-PAT-005" });
    expect(defs?.every((def) => /^R-[A-Z]{2,5}-\d{3}$/.test(def.ruleId ?? ""))).toBe(true);
  });

  it("gives an empty list for a launch article whose ranges a factory has not set yet, not null", async () => {
    expect(await catalogue().parameterDefs("TEE-TR-01")).toEqual([]);
  });

  it("gives null for an article the catalogue does not hold", async () => {
    expect(await catalogue().parameterDefs("ZZZ-ZZ-01")).toBeNull();
  });
});

describe("the moderation port over the server's own key", () => {
  it("gives the latest kept result of each target the design uses", async () => {
    const flagged = randomUUID();
    const blocked = randomUUID();
    await screened(flagged, "flagged");
    await screened(blocked, "blocked");

    expect(await moderation().statusesFor(brand, [asset(flagged), asset(blocked)])).toEqual([
      { target: asset(flagged), result: "flagged" },
      { target: asset(blocked), result: "blocked" },
    ]);
  });

  it("reads the newest screening when a target has more than one", async () => {
    const id = randomUUID();
    await screened(id, "flagged");
    await screened(id, "clear");

    expect(await moderation().statusesFor(brand, [asset(id)])).toEqual([{ target: asset(id), result: "clear" }]);
  });

  it("leaves a target nobody has screened out of the answer", async () => {
    expect(await moderation().statusesFor(brand, [asset(randomUUID())])).toEqual([]);
  });

  it("reads a reviewer's decision, so an allowed picture stops raising a finding", async () => {
    const id = randomUUID();
    const checkId = await screened(id, "flagged");
    must(await adminClient().rpc("moderation_review", { p_actor: admin.userId, p_check_id: checkId, p_decision: "allowed", p_reason: "The club owns this crest." }));

    expect(await moderation().statusesFor(brand, [asset(id)])).toEqual([{ target: asset(id), result: "clear" }]);
  });

  it("answers nothing, and asks the database nothing, for a design that uses nothing screened", async () => {
    expect(await moderation().statusesFor(brand, [])).toEqual([]);
  });
});
