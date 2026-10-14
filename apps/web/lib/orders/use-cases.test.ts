import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { ROSTER_22 } from "@/lib/production/fixtures";
import { fakeClient } from "./fixtures/fake-client";
import { manifestFile, openOrder, previewImport, saveOrder } from "./use-cases";
import { csvLine } from "./text";

const getProject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/projects/service", () => ({ getProject }));

const BRAND = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const ORDER = "33333333-3333-4333-8333-333333333333";
const WHO = { brandId: BRAND, userId: BRAND };
const spec = { sizing: { sizes: ["S", "M", "L", "XL", "2XL", "3XL"], baseSize: "M" }, namesAndNumbers: { places: [{ place: "back-name" }] } };

beforeEach(() => getProject.mockResolvedValue({ name: "Polka jersey", spec }));

const lines = ROSTER_22.rows.map((r) => ({ name: r.name, number: r.number, size_label: r.sizeLabel, cut: r.cut, quantity: r.quantity }));
const stored = () => fakeClient({ team_orders: { data: { id: ORDER, name: "Round 1", updated_at: "t" } }, team_order_rows: { data: lines } }).client;

describe("saveOrder", () => {
  it("saves a list that has problems and returns them", async () => {
    const { client, calls } = fakeClient({ save_team_order: { data: ORDER } });
    const rows = [{ name: "", number: "7", sizeLabel: "9XL", cut: "mens" as const, quantity: 1 }];
    const saved = await saveOrder({ client, admin: client }, WHO, PROJECT, null, { name: "T", rows });
    expect(saved.id).toBe(ORDER);
    expect(saved.issues.map((i) => i.code)).toEqual(["size-not-in-run", "missing-name"]);
    expect(calls.some((c) => c.name === "save_team_order")).toBe(true);
  });
  it("passes the order id when replacing one", async () => {
    const { client, calls } = fakeClient({ save_team_order: { data: ORDER } });
    await saveOrder({ client, admin: client }, WHO, PROJECT, ORDER, { name: "T", rows: ROSTER_22.rows });
    expect((calls.find((c) => c.name === "save_team_order")?.steps[0]?.[1][0] as { p_order_id: string }).p_order_id).toBe(ORDER);
  });
});

describe("openOrder", () => {
  it("returns the rows with their checks", async () => {
    const order = await openOrder(stored(), BRAND, PROJECT, ORDER);
    expect(order.rows).toHaveLength(22);
    expect(order.issues).toEqual([]);
  });
});

describe("previewImport", () => {
  const csv = (...rows: string[][]) => rows.map((r) => csvLine(r)).join("");
  it("reads a file, matches sizes to the run and reports problems with the design", async () => {
    const text = csv(["Name", "Number", "Size"], ["Ana", "10", "xl"], ["Bo", "10", "M"], ["Cy", "3", "9XL"]);
    const result = await previewImport(stored(), BRAND, PROJECT, { csv: text });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => r.sizeLabel)).toEqual(["XL", "M", "9XL"]);
    expect(result.issues.map((i) => i.code)).toEqual(["duplicate-number", "duplicate-number", "size-not-in-run"]);
  });
  it("passes on the options it was given", async () => {
    const result = await previewImport(stored(), BRAND, PROJECT, { csv: csv(["Ana", "9", "M"]), header: false, defaultCut: "womens", mapping: { name: 0, number: 1, sizeLabel: 2 } });
    expect(result.ok && result.rows[0]?.cut).toBe("womens");
  });
  it("asks for a column mapping when it cannot tell", async () => {
    expect(await previewImport(stored(), BRAND, PROJECT, { csv: csv(["Foo", "Bar"], ["1", "2"]) })).toMatchObject({ ok: false, needsMapping: true });
  });
});

describe("manifestFile", () => {
  it("gives the manifest CSV", async () => {
    const file = await manifestFile(stored(), BRAND, PROJECT, ORDER, "csv");
    expect(file).toMatchObject({ contentType: "text/csv; charset=utf-8", fileName: "Round-1.csv" });
    expect(file.body).toContain("Total,22,22");
  });
  it("gives the plain roster that an import reads back", async () => {
    expect((await manifestFile(stored(), BRAND, PROJECT, ORDER, "roster")).body).toMatch(/^Name,Number,Size,Cut,Quantity\r\n/);
  });
  it("gives the manifest PDF", async () => {
    const file = await manifestFile(stored(), BRAND, PROJECT, ORDER, "pdf");
    expect(file.contentType).toBe("application/pdf");
    expect((await readPdf(file.body as Uint8Array)).text).toContain("Team order: Round 1");
  }, 30_000);
});
