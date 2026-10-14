import { createFakePieceMapper } from "@/lib/artwork-stack";
import { createBudget } from "@/lib/design-import/budget";
import { MARKS_REPLY, asText } from "@/lib/design-import/fixtures/replies";
import { SYNTHETIC_TEMPLATE } from "@/lib/design-import/fixtures/template";
import { renderTee } from "@/lib/design-import/fixtures/synthetic";
import { pendingPatternStage } from "@/lib/design-import/pattern";
import { runImport } from "@/lib/design-import/pipeline";
import { acceptImport, createImport, discardImport, getImport } from "@/lib/design-import/service";
import { createStubProvider } from "@/lib/providers/stub";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, brandOf, person, type Person } from "./support";

/** Migration 20261015060200, through the real service: a proposal is not a design until it is accepted (W7d acceptance f). */

let alice: Person;
let brandId: string;

beforeAll(async () => {
  alice = await person("alice");
  brandId = await brandOf(alice, "Alice Athletic");
});

async function proposal() {
  const png = (await renderTee({ extra: '<rect x="170" y="180" width="60" height="50" fill="#ffffff"/>' })).png;
  const out = await runImport(
    { bytes: png, mediaType: "image/png" },
    { provider: createStubProvider([asText(MARKS_REPLY)]), template: SYNTHETIC_TEMPLATE, mapper: createFakePieceMapper(), pattern: pendingPatternStage, cleanup: null, budget: createBudget(), standIn: false },
  );
  if (!out.ok) throw new Error(out.reason);
  return out;
}

const make = async (): Promise<string> =>
  createImport(adminClient(), { brandId, userId: alice.userId }, { sourceFileId: randomUUID(), rightsAcceptedAt: new Date(), outcome: await proposal(), costMicrodollars: 100 });

describe("design imports in the database", () => {
  it("saves no accepted stack until the person accepts, and a member of the brand reads the proposal", async () => {
    const id = await make();
    const { data: before } = await adminClient().from("design_imports").select("status, accepted_stack, accepted_at").eq("id", id).single();
    expect(before).toEqual({ status: "ready", accepted_stack: null, accepted_at: null });
    expect((await getImport(alice.client, brandId, id)).stack.layers.length).toBeGreaterThan(1);
    await acceptImport(adminClient(), { brandId, userId: alice.userId }, id, ["ground"]);
    const { data: after } = await adminClient().from("design_imports").select("status, accepted_by, accepted_layer_ids").eq("id", id).single();
    expect(after).toEqual({ status: "accepted", accepted_by: alice.userId, accepted_layer_ids: ["ground"] });
  });

  it("never changes an import that was accepted or discarded, even by the server", async () => {
    const id = await make();
    await discardImport(adminClient(), { brandId, userId: alice.userId }, id);
    const { error } = await adminClient().from("design_imports").update({ status: "ready" }).eq("id", id);
    expect(error).not.toBeNull();
  });

  it("refuses an accepted status with no stack", async () => {
    const id = await make();
    const { error } = await adminClient().from("design_imports").update({ status: "accepted" }).eq("id", id);
    expect(error).not.toBeNull();
  });

  it("gives a browser no way to write", async () => {
    const { error } = await alice.client.from("design_imports").insert({
      brand_id: brandId, source_file_id: randomUUID(), rights_accepted_at: new Date().toISOString(), reading: {}, report: {}, overlay: {}, result: {}, created_by: alice.userId,
    });
    expect(error).not.toBeNull();
  });
});
