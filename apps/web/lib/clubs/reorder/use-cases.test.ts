import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Call } from "@/lib/orders/fixtures/fake-client";
import type { RosterRow } from "@/lib/production/contract";
import { buildSnapshot } from "@/lib/releases/build";
import { fakeBuilder, PROFILE, specFor } from "@/lib/releases/fixtures/fake-builder";
import { planFingerprint, planReorder } from "./plan";
import { confirmReorder, previewReorder } from "./use-cases";

const getProject = vi.hoisted(() => vi.fn());
const readinessFor = vi.hoisted(() => vi.fn());
const reportFor = vi.hoisted(() => vi.fn());
vi.mock("@/lib/projects/service", () => ({ getProject }));
vi.mock("@/lib/validation/design-input", () => ({ readinessFor }));
vi.mock("@/lib/validation/use-cases", () => ({ reportFor }));

const BRAND = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const REL = "44444444-4444-4444-8444-444444444444";
const SEASON = "55555555-5555-4555-8555-555555555555";
const NEW_ORDER = "66666666-6666-4666-8666-666666666666";
const PLAYER = (n: number) => `77777777-7777-4777-8777-77777777777${n}`;
const brand = { id: BRAND, name: "Club" };
const who = { brandId: BRAND, userId: BRAND };
const spec = { sizing: { sizes: ["S", "M", "L"], baseSize: "M" }, namesAndNumbers: { places: [{ place: "back-name" }] } };

const earlier: readonly RosterRow[] = [
  { name: "Ana", number: "10", sizeLabel: "M", cut: "womens", quantity: 1 },
  { name: "Cy", number: "12", sizeLabel: "S", cut: "junior", quantity: 1 },
];
const orderLine = (r: RosterRow) => ({ name: r.name, number: r.number, size_label: r.sizeLabel, cut: r.cut, quantity: r.quantity });
const playerRow = (i: number, name: string, number: string, size: string, group = "womens") => ({ id: PLAYER(i), name, number, size_label: size, wearer_group: group });

const selecting = (needle: string) => (call: Call) => call.steps.some(([m, a]) => m === "select" && String(a[0]).includes(needle));

async function world(opts: { orderId?: string | null; erased?: boolean; label?: string; season?: unknown[]; seasonExists?: boolean; rows?: readonly RosterRow[] } = {}) {
  const rows = opts.rows ?? earlier;
  const snapshot = await buildSnapshot({ specVersion: 3, patternBlockId: "jersey", patternBlockVersion: 1, fabricTestIds: [], printProfile: PROFILE, roster: rows, files: [specFor("front")] }, fakeBuilder());
  const orderId = opts.orderId === undefined ? ORDER : opts.orderId;
  const release = { id: REL, number: 1, label: opts.label ?? "Round 1", created_at: "t", snapshot, file_specs: [specFor("front")], order_id: orderId };
  return fakeClient({
    production_releases: (call) => ({ data: selecting("project_id")(call) && !selecting("snapshot")(call) ? { project_id: PROJECT } : release }),
    team_orders: orderId === null || opts.erased ? { data: null } : { data: { id: ORDER, name: "T", updated_at: "t" } },
    team_order_rows: { data: orderId === null ? [] : rows.map(orderLine) },
    club_seasons: { data: opts.seasonExists === false ? null : { id: SEASON } },
    roster_players: { data: opts.season ?? [] },
    save_team_order: { data: NEW_ORDER },
  });
}

beforeEach(() => {
  getProject.mockResolvedValue({ name: "Home shirt", currentVersion: 3, spec });
  readinessFor.mockResolvedValue({ design: { typeId: "jersey", readiness: {} }, version: 3 });
  reportFor.mockResolvedValue({ profileName: "Default", profileLabel: "Knitwright default profile, not agreed with a factory", blockers: 1, warnings: 2, findings: [{ severity: "blocker", message: "A blocker." }, { severity: "warning", message: "A warning." }] });
});

describe("previewReorder", () => {
  it("from the earlier order alone needs no questions when nothing changed", async () => {
    const { client } = await world();
    const preview = await previewReorder(client, brand, { releaseId: REL });
    expect(preview).toMatchObject({ source: "order", nothingChanged: true, projectId: PROJECT, designName: "Home shirt", releaseLabel: "Round 1" });
    expect(preview.plan.counts).toEqual({ ready: 2, fix: 0, sizeChanged: 0, newPlayers: 0 });
    expect(preview.report.identical).toBe(true);
    expect(preview.validation).toMatchObject({ blockers: 1, warnings: 2, blockerMessages: ["A blocker."] });
    expect(preview.fingerprint).toBe(planFingerprint(planReorder({ players: null, previous: earlier, run: ["S", "M", "L"] })));
  });

  it("from a season uses the saved sizes and lists what changed, what left and what no longer fits", async () => {
    const season = [playerRow(1, "Ana", "10", "L"), playerRow(2, "Di", "13", "XL")];
    const { client } = await world({ season });
    const preview = await previewReorder(client, brand, { releaseId: REL, seasonId: SEASON });
    expect(preview.source).toBe("season");
    expect(preview.nothingChanged).toBe(false);
    expect(preview.plan.lines.map((l) => [l.row.name, l.row.sizeLabel, l.reasons, l.change])).toEqual([
      ["Ana", "L", [], "size-changed"],
      ["Di", "XL", ["size-removed"], "new-player"],
      ["Cy", "S", ["player-left"], "same"],
    ]);
    expect(preview.report.differences.map((d) => d.code)).toEqual(["team-list"]);
    expect(preview.issues).toEqual([]);
  });

  it("reports a design that moved on since the release", async () => {
    getProject.mockResolvedValue({ name: "Home shirt", currentVersion: 6, spec });
    const { client } = await world();
    const preview = await previewReorder(client, brand, { releaseId: REL });
    expect(preview.report.differences.map((d) => d.code)).toEqual(["design-version"]);
  });

  it("shows problems the made list will have, such as a repeated number", async () => {
    const { client } = await world({ season: [playerRow(1, "Ana", "10", "M"), playerRow(2, "Bo", "10", "L")] });
    const preview = await previewReorder(client, brand, { releaseId: REL, seasonId: SEASON });
    expect(preview.plan.counts.fix).toBe(1);
    const clean = await world({ season: [playerRow(1, "Ana", "10", "M"), playerRow(2, "Cy", "10", "L")], orderId: null });
    const second = await previewReorder(clean.client, brand, { releaseId: REL, seasonId: SEASON });
    expect(second.plan.counts.fix).toBe(0);
    expect(second.issues.map((i) => i.code)).toEqual(["duplicate-number", "duplicate-number"]);
    expect(second.notes[0]).toContain("no team list");
  });

  it("asks for a season when the earlier order's list was erased", async () => {
    const { client } = await world({ orderId: null });
    await expect(previewReorder(client, brand, { releaseId: REL })).rejects.toMatchObject({ code: "not_found", message: expect.stringContaining("Choose a season") });
  });

  it("treats a list erased after the release as gone, and says so when a season is used", async () => {
    const { client } = await world({ erased: true, season: [playerRow(1, "Ana", "10", "M")] });
    const preview = await previewReorder(client, brand, { releaseId: REL, seasonId: SEASON });
    expect(preview.plan.lines).toHaveLength(1);
    expect(preview.notes[0]).toContain("no team list");
    await expect(previewReorder(client, brand, { releaseId: REL })).rejects.toMatchObject({ code: "not_found" });
  });

  it("answers not found for a release of another club", async () => {
    const { client } = fakeClient({ production_releases: { data: null } });
    await expect(previewReorder(client, brand, { releaseId: REL })).rejects.toMatchObject({ code: "not_found" });
  });

  it("does not put any name into an error or into the report", async () => {
    const { client } = await world({ season: [playerRow(1, "Ana", "10", "L")] });
    const preview = await previewReorder(client, brand, { releaseId: REL, seasonId: SEASON });
    expect(JSON.stringify(preview.report)).not.toContain("Ana");
    expect(JSON.stringify(preview.validation)).not.toContain("Ana");
  });
});

describe("confirmReorder", () => {
  const fingerprintOf = async (w: Awaited<ReturnType<typeof world>>, seasonId?: string) =>
    (await previewReorder(w.client, brand, { releaseId: REL, ...(seasonId ? { seasonId } : {}) })).fingerprint;

  it("saves the earlier order's list as a new team order in one step when nothing changed", async () => {
    const w = await world();
    const fingerprint = await fingerprintOf(w);
    const result = await confirmReorder({ client: w.client, admin: w.client }, who, brand, { releaseId: REL, fingerprint, resolutions: [] });
    expect(result).toMatchObject({ orderId: NEW_ORDER, projectId: PROJECT, players: 2, leftOut: 0 });
    const sent = w.calls.find((c) => c.name === "save_team_order")?.steps[0]?.[1][0] as { p_name: string; p_project_id: string; p_rows: unknown[]; p_order_id: unknown };
    expect(sent).toMatchObject({ p_name: "Reorder of Round 1", p_project_id: PROJECT, p_order_id: null });
    expect(sent.p_rows).toHaveLength(2);
  });

  it("refuses while a line needing a fix has no answer, and saves nothing", async () => {
    const w = await world({ season: [playerRow(1, "Ana", "10", "XL")] });
    const fingerprint = await fingerprintOf(w, SEASON);
    await expect(confirmReorder({ client: w.client, admin: w.client }, who, brand, { releaseId: REL, seasonId: SEASON, fingerprint, resolutions: [] })).rejects.toMatchObject({ code: "invalid_input" });
    expect(w.calls.some((c) => c.name === "save_team_order")).toBe(false);
  });

  it("saves with the answers: a chosen size, a kept player and a left-out player", async () => {
    const w = await world({ season: [playerRow(1, "Ana", "10", "XL"), playerRow(2, "Di", "13", "S")] });
    const fingerprint = await fingerprintOf(w, SEASON);
    const result = await confirmReorder({ client: w.client, admin: w.client }, who, brand, {
      releaseId: REL,
      seasonId: SEASON,
      fingerprint,
      resolutions: [{ index: 0, sizeLabel: "L" }, { index: 2, action: "leave-out" }],
    });
    expect(result).toMatchObject({ players: 2, leftOut: 1 });
    const sent = w.calls.find((c) => c.name === "save_team_order")?.steps[0]?.[1][0] as { p_rows: { size_label: string }[] };
    expect(sent.p_rows.map((r) => r.size_label)).toEqual(["L", "S"]);
  });

  it("refuses when the roster changed after the person looked", async () => {
    const w = await world({ season: [playerRow(1, "Ana", "10", "M")] });
    const stale = "0".repeat(64);
    await expect(confirmReorder({ client: w.client, admin: w.client }, who, brand, { releaseId: REL, seasonId: SEASON, fingerprint: stale, resolutions: [] })).rejects.toMatchObject({ code: "conflict" });
    expect(w.calls.some((c) => c.name === "save_team_order")).toBe(false);
  });

  it("refuses an order with nobody left in it", async () => {
    const w = await world({ season: [], rows: [] });
    const fingerprint = await fingerprintOf(w, SEASON);
    await expect(confirmReorder({ client: w.client, admin: w.client }, who, brand, { releaseId: REL, seasonId: SEASON, fingerprint, resolutions: [] })).rejects.toMatchObject({ message: expect.stringContaining("no players") });
  });

  it("keeps the new order's name within its limit", async () => {
    const w = await world({ label: "L".repeat(200) });
    const fingerprint = await fingerprintOf(w);
    await confirmReorder({ client: w.client, admin: w.client }, who, brand, { releaseId: REL, fingerprint, resolutions: [] });
    const sent = w.calls.find((c) => c.name === "save_team_order")?.steps[0]?.[1][0] as { p_name: string };
    expect(sent.p_name).toHaveLength(120);
  });
});
