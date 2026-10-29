import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { listTypes } from "@/lib/garment";
import type { DesignInput } from "./registry";
import { moveStatus, reportFor } from "./use-cases";

const typeId = listTypes()[0]!.id;
const open = { groups: [{ id: "fabric", title: "Fabric", items: [{ id: "fabric-test", met: false, sentence: "Needs a fabric test.", whoActs: "print-house" as const, actorLabel: "Your print house", ownerInput: null }] }] };
const clean: DesignInput = { typeId, readiness: { groups: [] } };
const blocked: DesignInput = { typeId, readiness: open };
const who = { brandId: "b", userId: "u" };

/**
 * A client that answers per table: the status row for `design_statuses`, and nothing for `factory_profiles`, so the
 * default profile is used as it stands. One chain for both tables would feed a status row to the profile reader.
 */
const fake = (status: object | null) => {
  const rpcs: [string, unknown][] = [];
  const chainFor = (data: object | null): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq"]) chain[m] = () => chain;
    chain.maybeSingle = () => Promise.resolve({ data, error: null });
    return chain;
  };
  const client = {
    from: (table: string) => chainFor(table === "design_statuses" ? status : null),
    rpc: (n: string, a: unknown) => (rpcs.push([n, a]), Promise.resolve({ error: null })),
  } as unknown as SupabaseClient;
  return { client, rpcs };
};
const at = new Date("2026-10-24T00:00:00Z");

describe("reportFor", () => {
  it("reports findings with the profile label and a draft status", async () => {
    const report = await reportFor(fake(null).client, "b", "p", 1, blocked);
    expect(report).toMatchObject({ status: "draft", orderable: false, profileLabel: "Knitwright default profile, not agreed with a factory" });
    expect(report.findings.some((f) => f.code === "readiness-fabric-test")).toBe(true);
  });
});

describe("moveStatus", () => {
  it("validates a design with no blockers, stores the full checks and writes the status once", async () => {
    const { client, rpcs } = fake(null);
    const report = await moveStatus({ client, admin: client }, who, "p", 1, "validated", clean, at);
    expect(report.status).toBe("validated");
    expect(report.statusSentence).toBe("No blockers against profile knitwright-default on 2026-10-24.");
    expect(rpcs.map(([name]) => name)).toEqual(["record_validation_result", "set_design_status"]);
    expect(rpcs[0]![1]).toMatchObject({ p_scope: "full", p_passed: true, p_profile_id: "knitwright-default" });
    expect(report.checks.every((check) => /^R-[A-Z]+-[0-9]{3}$/.test(check.ruleId))).toBe(true);
  });

  it("accepts a validated version for ordering", async () => {
    const { client, rpcs } = fake({ status: "validated", profile_id: "knitwright-default", findings_hash: "a".repeat(64), changed_at: "2026-10-23T00:00:00Z" });
    const report = await moveStatus({ client, admin: client }, who, "p", 1, "approved", clean, at);
    expect(report.status).toBe("approved");
    expect(report.statusSentence).toBe("Accepted for ordering by the brand. No blockers against profile knitwright-default on 2026-10-24.");
    expect(rpcs.at(-1)![1]).toMatchObject({ p_status: "approved" });
  });

  it("refuses to accept a draft for ordering, and to take an accepted version back to draft", async () => {
    await expect(moveStatus({ client: fake(null).client, admin: fake(null).client }, who, "p", 1, "approved", clean, at)).rejects.toMatchObject({ code: "conflict" });
    const accepted = fake({ status: "approved", profile_id: "knitwright-default", findings_hash: "a".repeat(64), changed_at: "2026-10-23T00:00:00Z" });
    await expect(moveStatus({ client: accepted.client, admin: accepted.client }, who, "p", 1, "draft", clean, at)).rejects.toMatchObject({ code: "conflict" });
    expect(accepted.rpcs).toHaveLength(0);
  });

  it("refuses to validate a design with a blocker and writes nothing", async () => {
    const { client, rpcs } = fake(null);
    await expect(moveStatus({ client, admin: client }, who, "p", 1, "validated", blocked, at)).rejects.toMatchObject({ code: "conflict" });
    expect(rpcs).toHaveLength(0);
  });

  it("refuses an illegal move: draft to draft", async () => {
    const { client } = fake(null);
    await expect(moveStatus({ client, admin: client }, who, "p", 1, "draft", clean, at)).rejects.toMatchObject({ code: "conflict" });
  });
});
