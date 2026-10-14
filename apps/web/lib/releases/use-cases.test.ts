import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Call } from "@/lib/orders/fixtures/fake-client";
import { rosterHash } from "@/lib/orders/hash";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { buildSnapshot } from "./build";
import { fakeBuilder, PROFILE, specFor } from "./fixtures/fake-builder";
import { checkReorder, freezeRelease, openRelease } from "./use-cases";

const getProject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/projects/service", () => ({ getProject }));

const BRAND = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const SO = "55555555-5555-4555-8555-555555555555";
const REL = "44444444-4444-4444-8444-444444444444";
const WHO = { brandId: BRAND, userId: BRAND };
const spec = { sizing: { sizes: ["S", "M", "L", "XL", "2XL", "3XL"], baseSize: "M" }, namesAndNumbers: { places: [{ place: "back-name" }] } };
beforeEach(() => getProject.mockResolvedValue({ currentVersion: 5, spec }));

const lines = (rows = ROSTER_22.rows) => rows.map((r) => ({ name: r.name, number: r.number, size_label: r.sizeLabel, cut: r.cut, quantity: r.quantity }));
const body = (over = {}) => ({ label: "Round 1", orderId: ORDER, patternBlockId: "jersey", patternBlockVersion: 2, fabricTestIds: [`strike-off-${SO}`], printProfile: PROFILE, files: [specFor("front"), specFor("back", "XL", "10")], ...over });

describe("freezeRelease", () => {
  const answers = (rows = ROSTER_22.rows) => ({
    team_orders: { data: { id: ORDER, name: "T", updated_at: "t" } },
    team_order_rows: { data: lines(rows) },
    create_release: { data: [{ id: REL, number: 1 }] },
    strike_offs: { data: [{ id: SO }] },
  });

  it("freezes the design version it read, and a hash of the roster, never the names", async () => {
    const { client, calls } = fakeClient(answers());
    const result = await freezeRelease({ client, admin: client }, WHO, PROJECT, body(), () => fakeBuilder());
    expect(result).toEqual({ id: REL, number: 1, files: 2 });
    const sent = calls.find((c) => c.name === "create_release")?.steps[0]?.[1][0] as { p_snapshot: { specVersion: number; rosterHash: string }; p_order_id: string };
    expect(sent.p_snapshot.specVersion).toBe(5);
    expect(sent.p_snapshot.rosterHash).toBe(rosterHash(ROSTER_22.rows));
    expect(JSON.stringify(sent)).not.toContain("OKAFOR");
  });

  it("hands the builder the roster it was made from", async () => {
    const { client } = fakeClient(answers());
    const seen: unknown[] = [];
    await freezeRelease({ client, admin: client }, WHO, PROJECT, body(), (ctx) => (seen.push(ctx.roster?.length), fakeBuilder()));
    expect(seen).toEqual([22]);
  });

  it("refuses a team list with problems", async () => {
    const dup = [...ROSTER_22.rows.slice(0, 2), { ...ROSTER_22.rows[2]!, number: ROSTER_22.rows[0]!.number }];
    const { client } = fakeClient(answers(dup));
    await expect(freezeRelease({ client, admin: client }, WHO, PROJECT, body(), () => fakeBuilder())).rejects.toMatchObject({ code: "invalid_input", message: expect.stringContaining("team list") });
  });

  it("refuses a fabric test that is not one of this brand's, and makes no release", async () => {
    const { client, calls } = fakeClient({ ...answers(), strike_offs: { data: [] } });
    await expect(freezeRelease({ client, admin: client }, WHO, PROJECT, body(), () => fakeBuilder())).rejects.toMatchObject({ code: "invalid_input", message: expect.stringContaining(SO) });
    expect(calls.some((c) => c.name === "create_release")).toBe(false);
  });

  it("freezes a release with no team order", async () => {
    const { client } = fakeClient(answers());
    const result = await freezeRelease({ client, admin: client }, WHO, PROJECT, body({ orderId: null, files: [specFor("front")] }), () => fakeBuilder());
    expect(result.files).toBe(1);
  });
});

describe("checkReorder", () => {
  const freeze = (salt = "") => buildSnapshot({ specVersion: 5, patternBlockId: "jersey", patternBlockVersion: 2, fabricTestIds: [`strike-off-${SO}`], printProfile: PROFILE, roster: ROSTER_22.rows, files: body().files }, fakeBuilder(salt));
  const setup = async (extra: Record<string, (call: Call) => never | { data: unknown }> = {}) =>
    fakeClient({
      production_releases: { data: { id: REL, number: 1, label: "R", created_at: "t", snapshot: await freeze(), file_specs: body().files, order_id: ORDER } },
      team_orders: { data: { id: ORDER, name: "T", updated_at: "t" } },
      team_order_rows: { data: lines() },
      ...extra,
    });
  const now = (over = {}) => ({ orderId: null, patternBlockId: "jersey", patternBlockVersion: 2, fabricTestIds: [`strike-off-${SO}`], printProfile: PROFILE, ...over });

  it("is identical when nothing changed", async () => {
    const { client } = await setup();
    expect(await checkReorder(client, BRAND, PROJECT, REL, now(), () => fakeBuilder())).toMatchObject({ identical: true, differences: [] });
  });

  it("reports a fabric test changed after the release", async () => {
    const { client } = await setup();
    const report = await checkReorder(client, BRAND, PROJECT, REL, now({ fabricTestIds: ["t2"] }), () => fakeBuilder("scaled"));
    expect(report.identical).toBe(false);
    expect(report.differences.map((d) => d.code)).toEqual(["fabric-tests"]);
  });

  it("says the team list is gone when the order was erased", async () => {
    const { client } = await setup({ team_orders: () => ({ data: null }) });
    const report = await checkReorder(client, BRAND, PROJECT, REL, now(), () => fakeBuilder());
    expect(report.differences.map((d) => d.code)).toContain("team-list");
  });

  it("reports the design having moved on", async () => {
    getProject.mockResolvedValue({ currentVersion: 6, spec });
    const { client } = await setup();
    expect((await checkReorder(client, BRAND, PROJECT, REL, now(), () => fakeBuilder())).differences.map((d) => d.code)).toEqual(["design-version"]);
  });

  it("does not hide a real fault behind the erased-list case", async () => {
    const { client } = await setup({ team_orders: () => ({ error: { code: "XX", message: "m" } }) as never });
    await expect(checkReorder(client, BRAND, PROJECT, REL, now(), () => fakeBuilder())).rejects.toMatchObject({ code: "internal" });
  });

  it("uses a team order given today instead of the release's own", async () => {
    const { client } = await setup();
    const report = await checkReorder(client, BRAND, PROJECT, REL, now({ orderId: ORDER }), () => fakeBuilder());
    expect(report.identical).toBe(true);
  });

  it("works for a release with no team order", async () => {
    const none = await buildSnapshot({ specVersion: 5, patternBlockId: "jersey", patternBlockVersion: 2, fabricTestIds: [`strike-off-${SO}`], printProfile: PROFILE, roster: null, files: [specFor("front")] }, fakeBuilder());
    const { client } = fakeClient({ production_releases: { data: { id: REL, number: 1, label: "R", created_at: "t", snapshot: none, file_specs: [specFor("front")], order_id: null } } });
    expect((await checkReorder(client, BRAND, PROJECT, REL, now(), () => fakeBuilder())).identical).toBe(true);
  });
});

describe("openRelease", () => {
  it("joins the release with its sign-offs and strike-offs", async () => {
    const snapshot = await buildSnapshot({ specVersion: 5, patternBlockId: "jersey", patternBlockVersion: 2, fabricTestIds: [], printProfile: PROFILE, roster: null, files: [specFor("front")] }, fakeBuilder());
    const { client } = fakeClient({
      production_releases: { data: { id: REL, number: 1, label: "R", created_at: "t", snapshot, file_specs: [specFor("front")], order_id: null } },
      sign_offs: { data: [{ id: ORDER, release_id: REL, role: "club", signer_name: "Bo", signed_on: "2026-10-16", note: "", created_at: "t" }] },
      strike_offs: { data: [] },
    });
    const view = await openRelease(client, BRAND, PROJECT, REL);
    expect(view.signOffs.find((l) => l.role === "club")?.sentence).toBe("Club signed by Bo on 2026-10-16.");
    expect(view.proofs.met).toBe(false);
  });
});
