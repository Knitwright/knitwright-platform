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

const fake = (status: object | null) => {
  const rpcs: unknown[] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) chain[m] = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: status, error: null });
  const client = { from: () => chain, rpc: (_n: string, a: unknown) => (rpcs.push(a), Promise.resolve({ error: null })) } as unknown as SupabaseClient;
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
  it("validates a design with no blockers and writes the status once", async () => {
    const { client, rpcs } = fake(null);
    const report = await moveStatus({ client, admin: client }, who, "p", 1, "validated", clean, at);
    expect(report.status).toBe("validated");
    expect(report.statusSentence).toBe("No blockers against profile knitwright-default on 2026-10-24.");
    expect(rpcs).toHaveLength(1);
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
