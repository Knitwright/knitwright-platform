import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import {
  amPlatformAdmin,
  getBrandDetails,
  listDesignQuotes,
  loadDesignLeads,
  loadLeadRows,
  requestQuote,
  setBrandDetails,
  setLead,
  setProjectBuyerKind,
  setQuoteStatus,
} from "./service";

const BRAND = "0d7f6a1c-3a55-4a62-9c1b-6b1f2b7f8e01";
const PROJECT = "1e8a7b2d-4b66-4b73-8d2c-7c2a3c8a9f12";
const QUOTE = "2f9b8c3e-5c77-4c84-9e3d-8d3b4d9b0a23";
const USER = "3a0c9d4f-6d88-4d95-8f4e-9e4c5e0c1b34";

type Answer = Readonly<{ data: unknown; error: { code?: string; message: string } | null }>;
const ok = (data: unknown): Answer => ({ data, error: null });
const refused = (code: string): Answer => ({ data: null, error: { code, message: "refused" } });

/** A client whose every call answers with `answer`, and which remembers what it was asked. */
const fake = (answer: Answer) => {
  const calls: unknown[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return chain;
    };
  }
  chain.maybeSingle = async () => answer;
  chain.then = (resolve: (value: Answer) => unknown) => resolve(answer);
  const client = {
    rpc: async (fn: string, args?: unknown) => {
      calls.push(["rpc", fn, args]);
      return answer;
    },
    from: (table: string) => {
      calls.push(["from", table]);
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
};

const failureOf = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

describe("brand details", () => {
  it("reads a brand's details and segment", async () => {
    const { client } = fake(ok({ organisation_type: "club", country: "AU", region: "VIC", segment: "team_kit" }));

    expect(await getBrandDetails(client, BRAND)).toEqual({
      organisationType: "club",
      country: "AU",
      region: "VIC",
      segment: "team_kit",
    });
  });

  it("treats a stored value the app would refuse as not given, rather than failing the page", async () => {
    const { client } = fake(ok({ organisation_type: "club", country: "ZZ", region: "Nowhere", segment: "unknown" }));

    expect(await getBrandDetails(client, BRAND)).toEqual({
      organisationType: "club",
      country: null,
      region: null,
      segment: null,
    });
  });

  it("says a brand it cannot see does not exist", async () => {
    expect((await failureOf(getBrandDetails(fake(ok(null)).client, BRAND))).code).toBe("not_found");
  });

  it("sends empty text for a detail not given", async () => {
    const { client, calls } = fake(ok(null));
    await setBrandDetails(client, BRAND, { organisationType: "gym", country: null, region: null });

    expect(calls).toEqual([
      ["rpc", "set_brand_details", { p_brand_id: BRAND, p_organisation_type: "gym", p_country: "", p_region: "" }],
    ]);
  });

  it("turns a refusal into a failure the form can show", async () => {
    const details = { organisationType: null, country: null, region: null };
    expect((await failureOf(setBrandDetails(fake(refused("P0002")).client, BRAND, details))).code).toBe("not_found");
    expect((await failureOf(setBrandDetails(fake(refused("22023")).client, BRAND, details))).code).toBe("invalid_input");
  });
});

describe("designs and quote requests", () => {
  it("records the path a design was started from", async () => {
    const { client, calls } = fake(ok(null));
    await setProjectBuyerKind(client, { projectId: PROJECT, userId: USER, buyerKind: "team_kit" });

    expect(calls).toEqual([
      ["rpc", "set_project_buyer_kind", { p_project_id: PROJECT, p_user_id: USER, p_buyer_kind: "team_kit" }],
    ]);
  });

  it("stores a quote request and returns its id", async () => {
    const { client, calls } = fake(ok(QUOTE));
    const input = { projectId: PROJECT, userId: USER, version: 2, quantity: 80, neededBy: "2026-12-01", sizesNote: "", message: "Hi" };

    expect(await requestQuote(client, input)).toBe(QUOTE);
    expect(calls[0]).toEqual([
      "rpc",
      "request_quote",
      {
        p_project_id: PROJECT,
        p_user_id: USER,
        p_version: 2,
        p_quantity: 80,
        p_needed_by: "2026-12-01",
        p_sizes_note: "",
        p_message: "Hi",
      },
    ]);
  });

  it("lists a design's quote requests, newest first", async () => {
    const row = { id: QUOTE, version: 2, quantity: 80, needed_by: "2026-12-01", status: "new", created_at: "2026-10-11T00:00:00Z" };
    const { client, calls } = fake(ok([row]));

    expect(await listDesignQuotes(client, BRAND, PROJECT)).toEqual([
      { id: QUOTE, version: 2, quantity: 80, neededBy: "2026-12-01", status: "new", createdAt: "2026-10-11T00:00:00Z" },
    ]);
    expect(calls).toContainEqual(["eq", "brand_id", BRAND]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
  });
});

describe("platform admins", () => {
  it("is an admin only when the database says so", async () => {
    expect(await amPlatformAdmin(fake(ok(true)).client)).toBe(true);
    expect(await amPlatformAdmin(fake(ok(false)).client)).toBe(false);
    expect(await amPlatformAdmin(fake(refused("42501")).client)).toBe(false);
  });

  it("reads the lead rows, and fails when they cannot be read", async () => {
    expect(await loadLeadRows(fake(ok([])).client)).toEqual([]);
    expect((await failureOf(loadLeadRows(fake(refused("P0002")).client))).code).toBe("not_found");
  });

  it("sets a lead's owner and next step", async () => {
    const { client, calls } = fake(ok(null));
    await setLead(client, { brandId: BRAND, owner: null, nextStep: "Call", nextStepOn: null });

    expect(calls).toEqual([
      ["rpc", "admin_set_lead", { p_brand_id: BRAND, p_owner: "", p_next_step: "Call", p_next_step_on: null }],
    ]);
    const missing = await failureOf(setLead(fake(refused("P0002")).client, { brandId: BRAND, owner: "partner", nextStep: "", nextStepOn: null }));
    expect(missing.message).toBe("That brand does not exist.");
  });

  it("sets a quote's status", async () => {
    const { client, calls } = fake(ok(null));
    await setQuoteStatus(client, { quoteId: QUOTE, status: "closed" });

    expect(calls).toEqual([["rpc", "admin_set_quote_status", { p_quote_id: QUOTE, p_status: "closed" }]]);
    const missing = await failureOf(setQuoteStatus(fake(refused("P0002")).client, { quoteId: QUOTE, status: "new" }));
    expect(missing.message).toBe("That quote request does not exist.");
  });
});

describe("loadDesignLeads", () => {
  it("asks for the details while any is missing, and offers tomorrow as the first date", async () => {
    const answers: Record<string, Answer> = {
      brands: ok({ organisation_type: "club", country: "AU", region: null, segment: null }),
      quote_requests: ok([]),
    };
    const client = {
      from: (table: string) => fake(answers[table]).client.from(table),
    } as unknown as SupabaseClient;

    const leads = await loadDesignLeads(client, BRAND, PROJECT, new Date("2026-10-11T09:00:00Z"));

    expect(leads).toMatchObject({ askDetails: true, quotes: [], firstDate: "2026-10-12" });
    expect(leads.details).toMatchObject({ organisationType: "club", country: "AU", region: null });
  });
});
