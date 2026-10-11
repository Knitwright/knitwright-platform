import { describe, expect, it } from "vitest";
import { buildLeadList, leadFormSchema, parseLeadRows, quoteStatusFormSchema } from "./admin";

const NOW = new Date("2026-10-11T09:00:00Z");
const BRAND = "0d7f6a1c-3a55-4a62-9c1b-6b1f2b7f8e01";
const OTHER = "1e8a7b2d-4b66-4b73-8d2c-7c2a3c8a9f12";
const QUOTE = "2f9b8c3e-5c77-4c84-9e3d-8d3b4d9b0a23";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: BRAND,
  name: "Harbour Hockey Club",
  organisation_type: "club",
  country: "AU",
  region: "NSW",
  segment: "team_kit",
  created_at: "2026-10-01T00:00:00+00:00",
  updated_at: "2026-10-02T00:00:00+00:00",
  emails: ["sec@harbour.example"],
  designs: 2,
  most_versions: 5,
  shared: false,
  last_design_at: "2026-10-10T08:00:00+00:00",
  quotes: [
    {
      id: QUOTE,
      project_id: OTHER,
      project_name: "Home jersey",
      version: 5,
      quantity: 120,
      needed_by: "2026-11-30",
      sizes_note: "",
      message: "For the winter season",
      status: "new",
      created_at: "2026-10-10T09:00:00+00:00",
    },
  ],
  lead: null,
  ...overrides,
});

describe("parseLeadRows", () => {
  it("reads what the database sends", () => {
    const [lead] = parseLeadRows([row()]);

    expect(lead).toMatchObject({ id: BRAND, organisationType: "club", mostVersions: 5, lead: null });
    expect(lead.quotes[0]).toMatchObject({ quantity: 120, neededBy: "2026-11-30", projectName: "Home jersey" });
  });

  it("refuses rows it does not understand", () => {
    expect(() => parseLeadRows([row({ designs: "two" })])).toThrow();
    expect(() => parseLeadRows({})).toThrow();
  });
});

describe("buildLeadList", () => {
  it("scores each lead, marks hot ones and suggests an owner", () => {
    const [lead] = buildLeadList(parseLeadRows([row()]), NOW);

    expect(lead.score.total).toBe(10 + 20 + 25 + 15 + 10);
    expect(lead.hot).toBe(true);
    expect(lead.suggestedOwner).toBe("partner");
    expect(lead.lastActivity).toBe("2026-10-10T09:00:00+00:00");
  });

  it("gives the engagement points for a share link, once even when the design was also edited often", () => {
    const quiet = { organisation_type: null, country: null, region: null, quotes: [], most_versions: 1 };
    const [shared] = buildLeadList(parseLeadRows([row({ ...quiet, shared: true })]), NOW);
    const [both] = buildLeadList(parseLeadRows([row({ ...quiet, shared: true, most_versions: 9 })]), NOW);
    const [neither] = buildLeadList(parseLeadRows([row(quiet)]), NOW);

    expect(shared.score).toEqual({ total: 15, reasons: ["Shared with others"] });
    expect(both.score.total).toBe(15);
    expect(neither.score.total).toBe(0);
  });

  it("sorts by score, then by the latest activity", () => {
    const quiet = row({ id: OTHER, name: "Quiet", organisation_type: null, country: null, region: null, quotes: [], most_versions: 1 });
    const recentQuiet = row({ ...quiet, id: QUOTE, name: "Recent quiet", updated_at: "2026-10-11T08:00:00+00:00", last_design_at: null });
    const list = buildLeadList(parseLeadRows([quiet, row(), recentQuiet]), NOW);

    expect(list.map((lead) => lead.name)).toEqual(["Harbour Hockey Club", "Recent quiet", "Quiet"]);
  });

  it("keeps the owner an admin set", () => {
    const owned = row({ lead: { owner: "knitwright", next_step: "Call Tuesday", next_step_on: "2026-10-14", updated_at: "2026-10-11T00:00:00+00:00" } });
    const [lead] = buildLeadList(parseLeadRows([owned]), NOW);

    expect(lead.suggestedOwner).toBe("knitwright");
    expect(lead.lead).toMatchObject({ owner: "knitwright", nextStep: "Call Tuesday", nextStepOn: "2026-10-14" });
  });
});

describe("leadFormSchema", () => {
  it("takes an owner, a next step and a date, each of which may be empty", () => {
    expect(leadFormSchema.parse({ brandId: BRAND, owner: "", nextStep: "", nextStepOn: "" })).toEqual({
      brandId: BRAND,
      owner: null,
      nextStep: "",
      nextStepOn: null,
    });
    expect(leadFormSchema.parse({ brandId: BRAND, owner: "partner", nextStep: " Visit ", nextStepOn: "2026-10-20" })).toEqual({
      brandId: BRAND,
      owner: "partner",
      nextStep: "Visit",
      nextStepOn: "2026-10-20",
    });
  });

  it("refuses an unknown owner, a long step and a date that does not exist", () => {
    expect(leadFormSchema.safeParse({ brandId: BRAND, owner: "agency" }).success).toBe(false);
    expect(leadFormSchema.safeParse({ brandId: BRAND, nextStep: "x".repeat(201) }).success).toBe(false);
    expect(leadFormSchema.safeParse({ brandId: BRAND, nextStepOn: "2026-02-30" }).success).toBe(false);
  });
});

describe("quoteStatusFormSchema", () => {
  it("takes one of the three statuses", () => {
    expect(quoteStatusFormSchema.parse({ quoteId: QUOTE, status: "quoted" })).toEqual({ quoteId: QUOTE, status: "quoted" });
    expect(quoteStatusFormSchema.safeParse({ quoteId: QUOTE, status: "won" }).success).toBe(false);
  });
});
