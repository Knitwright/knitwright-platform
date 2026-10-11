import { beforeAll, describe, expect, it } from "vitest";
import { buildLeadList } from "@/lib/leads/admin";
import {
  amPlatformAdmin,
  getBrandDetails,
  listDesignQuotes,
  loadLeadRows,
  requestQuote,
  setBrandDetails,
  setLead,
  setProjectBuyerKind,
  setQuoteStatus,
} from "@/lib/leads/service";
import { adminClient, anonClient, brandOf, must, person, type Person } from "./support";

/**
 * The lead engine (decision 0024): organisation details, buyer kind, quote requests and the
 * platform admins who read across brands. Members reach their own brand only; platform admins
 * are added by hand and are the only ones who see leads.
 */

let ada: Person;
let bob: Person;
let kate: Person;
let adaBrand: string;
let bobBrand: string;
let adaDesign: string;
let bobDesign: string;

const day = (offset: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const design = async (brandId: string, userId: string): Promise<string> =>
  must(
    await adminClient().rpc("create_project", {
      p_brand_id: brandId,
      p_user_id: userId,
      p_name: "Home jersey",
      p_style_number: "",
      p_season: "",
      p_garment_type: "crew-tee",
      p_spec: { seeded: true },
      p_schema_version: 1,
    }),
  );

const quoteFor = (projectId: string, userId: string, overrides: Record<string, unknown> = {}) =>
  requestQuote(adminClient(), {
    projectId,
    userId,
    version: 1,
    quantity: 120,
    neededBy: day(30),
    sizesNote: "10 S, 50 M",
    message: "For the winter season",
    ...overrides,
  });

const failure = async (work: Promise<unknown>): Promise<string> => {
  try {
    await work;
  } catch (error) {
    return (error as { code?: string }).code ?? "thrown";
  }
  return "none";
};

beforeAll(async () => {
  [ada, bob, kate] = await Promise.all([person("ada"), person("bob"), person("kate")]);
  [adaBrand, bobBrand] = await Promise.all([brandOf(ada, "Ada Hockey Club"), brandOf(bob, "Bob Boots")]);
  [adaDesign, bobDesign] = await Promise.all([design(adaBrand, ada.userId), design(bobBrand, bob.userId)]);
  // A platform admin is added by hand, as the owner would in the database.
  must(await adminClient().from("platform_admins").insert({ user_id: kate.userId }).select("user_id"));
});

describe("organisation details", () => {
  it("lets a member set and clear their brand's details", async () => {
    await setBrandDetails(ada.client, adaBrand, { organisationType: "club", country: "AU", region: "VIC" });
    expect(await getBrandDetails(ada.client, adaBrand)).toEqual({
      organisationType: "club",
      country: "AU",
      region: "VIC",
      segment: null,
    });

    await setBrandDetails(ada.client, adaBrand, { organisationType: null, country: null, region: "VIC" });
    expect(await getBrandDetails(ada.client, adaBrand)).toMatchObject({ country: null, region: null });
  });

  it("refuses a place in Australia that is not a state, and an unknown type", async () => {
    expect(await failure(setBrandDetails(ada.client, adaBrand, { organisationType: null, country: "AU", region: "Melbourne" }))).toBe("invalid_input");
    const { error } = await ada.client.rpc("set_brand_details", {
      p_brand_id: adaBrand,
      p_organisation_type: "charity",
      p_country: "",
      p_region: "",
    });
    expect(error?.code).toBe("22023");
  });

  it("lets nobody change another brand's details", async () => {
    expect(await failure(setBrandDetails(bob.client, adaBrand, { organisationType: "brand", country: null, region: null }))).toBe("not_found");
    const { error } = await anonClient().rpc("set_brand_details", {
      p_brand_id: adaBrand,
      p_organisation_type: "brand",
      p_country: "",
      p_region: "",
    });
    expect(error).not.toBeNull();
  });
});

describe("buyer kind", () => {
  it("remembers the path on the design and gives the brand its first segment only", async () => {
    await setProjectBuyerKind(adminClient(), { projectId: adaDesign, userId: ada.userId, buyerKind: "team_kit" });
    const second = await design(adaBrand, ada.userId);
    await setProjectBuyerKind(adminClient(), { projectId: second, userId: ada.userId, buyerKind: "creator_merch" });

    const rows = must(await adminClient().from("projects").select("id, buyer_kind").in("id", [adaDesign, second]));
    expect(Object.fromEntries(rows.map((row) => [row.id, row.buyer_kind]))).toEqual({
      [adaDesign]: "team_kit",
      [second]: "creator_merch",
    });
    expect((await getBrandDetails(ada.client, adaBrand)).segment).toBe("team_kit");
  });

  it("refuses a design of another brand, and a browser", async () => {
    expect(await failure(setProjectBuyerKind(adminClient(), { projectId: bobDesign, userId: ada.userId, buyerKind: "team_kit" }))).toBe("not_found");
    const { error } = await ada.client.rpc("set_project_buyer_kind", {
      p_project_id: adaDesign,
      p_user_id: ada.userId,
      p_buyer_kind: "team_kit",
    });
    expect(error).not.toBeNull();
  });
});

describe("quote requests", () => {
  it("stores a request as new, and shows it to the brand's members only", async () => {
    const id = await quoteFor(adaDesign, ada.userId);

    expect(await listDesignQuotes(ada.client, adaBrand, adaDesign)).toEqual([
      expect.objectContaining({ id, quantity: 120, version: 1, status: "new" }),
    ]);
    expect(await listDesignQuotes(bob.client, adaBrand, adaDesign)).toEqual([]);
    expect(must(await bob.client.from("quote_requests").select("id").eq("id", id))).toEqual([]);
    const { data } = await anonClient().from("quote_requests").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("refuses today, a missing version, a quantity of 0 and another brand's design", async () => {
    expect(await failure(quoteFor(adaDesign, ada.userId, { neededBy: day(0) }))).toBe("invalid_input");
    expect(await failure(quoteFor(adaDesign, ada.userId, { version: 9 }))).toBe("invalid_input");
    expect(await failure(quoteFor(adaDesign, ada.userId, { quantity: 0 }))).toBe("invalid_input");
    expect(await failure(quoteFor(bobDesign, ada.userId))).toBe("not_found");
  });

  it("cannot be made or changed by a browser", async () => {
    const { error } = await ada.client.rpc("request_quote", {
      p_project_id: adaDesign,
      p_user_id: ada.userId,
      p_version: 1,
      p_quantity: 5,
      p_needed_by: day(10),
      p_sizes_note: "",
      p_message: "",
    });
    expect(error).not.toBeNull();
    const { error: statusError } = await ada.client.rpc("admin_set_quote_status", {
      p_quote_id: (await listDesignQuotes(ada.client, adaBrand, adaDesign))[0].id,
      p_status: "closed",
    });
    expect(statusError?.code).toBe("P0002");
  });
});

describe("platform admins", () => {
  it("knows who is one", async () => {
    expect(await amPlatformAdmin(kate.client)).toBe(true);
    expect(await amPlatformAdmin(ada.client)).toBe(false);
    expect(await amPlatformAdmin(anonClient())).toBe(false);
  });

  it("lets no browser read or add platform admins", async () => {
    const { data } = await ada.client.from("platform_admins").select("user_id");
    expect(data ?? []).toEqual([]);
    expect((await ada.client.from("platform_admins").insert({ user_id: ada.userId })).error).not.toBeNull();
    expect(await amPlatformAdmin(ada.client)).toBe(false);
  });

  it("shows every brand to an admin, with the members' emails, and nothing to anyone else", async () => {
    await quoteFor(adaDesign, ada.userId, { quantity: 250 });
    const rows = await loadLeadRows(kate.client);
    const adaRow = rows.find((row) => row.id === adaBrand);

    expect(rows.some((row) => row.id === bobBrand)).toBe(true);
    expect(adaRow).toMatchObject({ emails: [ada.email], designs: 2, segment: "team_kit" });
    expect(adaRow?.quotes.map((quote) => quote.quantity)).toEqual([250, 120]);
    expect(await failure(loadLeadRows(ada.client))).toBe("not_found");
    expect((await anonClient().rpc("admin_lead_rows")).error).not.toBeNull();
  });

  it("lets an admin read every quote request, and no member read another brand's", async () => {
    const all = must(await kate.client.from("quote_requests").select("brand_id"));

    expect(all.some((row) => row.brand_id === adaBrand)).toBe(true);
    expect(must(await bob.client.from("quote_requests").select("brand_id")).every((row) => row.brand_id === bobBrand)).toBe(true);
  });

  it("lets an admin set the owner and next step, which members never see", async () => {
    await setLead(kate.client, { brandId: adaBrand, owner: "partner", nextStep: "Visit at training", nextStepOn: day(3) });
    const [lead] = buildLeadList((await loadLeadRows(kate.client)).filter((row) => row.id === adaBrand), new Date());

    expect(lead.lead).toMatchObject({ owner: "partner", nextStep: "Visit at training", nextStepOn: day(3) });
    expect(lead.suggestedOwner).toBe("partner");
    const { data } = await ada.client.from("leads").select("brand_id");
    expect(data ?? []).toEqual([]);
    expect(await failure(setLead(ada.client, { brandId: adaBrand, owner: null, nextStep: "", nextStepOn: null }))).toBe("not_found");
  });

  it("lets an admin change a quote request's status", async () => {
    const [latest] = await listDesignQuotes(ada.client, adaBrand, adaDesign);
    await setQuoteStatus(kate.client, { quoteId: latest.id, status: "quoted" });

    expect((await listDesignQuotes(ada.client, adaBrand, adaDesign))[0]).toMatchObject({ id: latest.id, status: "quoted" });
    expect(await failure(setQuoteStatus(bob.client, { quoteId: latest.id, status: "closed" }))).toBe("not_found");
  });
});

describe("account deletion", () => {
  it("takes the brand's quote requests and lead with it, and the person out of platform_admins", async () => {
    const dan = await person("dan");
    const danBrand = await brandOf(dan, "Dan Darts");
    const danDesign = await design(danBrand, dan.userId);
    const quoteId = await quoteFor(danDesign, dan.userId);
    await setLead(kate.client, { brandId: danBrand, owner: "knitwright", nextStep: "", nextStepOn: null });
    must(await adminClient().from("platform_admins").insert({ user_id: dan.userId }).select("user_id"));

    must(await adminClient().rpc("delete_account_data", { p_user_id: dan.userId }));
    must(await adminClient().auth.admin.deleteUser(dan.userId));

    expect(must(await adminClient().from("quote_requests").select("id").eq("id", quoteId))).toEqual([]);
    expect(must(await adminClient().from("leads").select("brand_id").eq("brand_id", danBrand))).toEqual([]);
    expect(must(await adminClient().from("platform_admins").select("user_id").eq("user_id", dan.userId))).toEqual([]);
  });
});
