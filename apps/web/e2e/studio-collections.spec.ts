import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createAccount, signIn, test, userIdOf } from "./support";

/**
 * The collection plan and the line plan (plan v5 Z4, spec F-S10): the board with its frames, counters
 * and style cards, the line plan that re-prices a line from the factory tiers as a quantity is typed,
 * and the two actions -- samples for the approved styles, and a drop payload for the Store.
 *
 * The acceptance test of F-S10 is here twice over: changing a quantity re-prices the line live (the
 * 19-to-20 tier boundary of the seeded ladder), and the unit cost is the tier price plus freight and
 * duty, which `lib/collections/line-plan.test.ts` holds equal to `priceBasket` to the penny.
 *
 * Every plan and every design here takes its own name, and every sample its own fabric code, because
 * the whole suite shares one database and ops batches group by factory, fabric, article and cut-off
 * (plan v5, lesson 11).
 */

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

const snapshot = (specVersion: number) => ({
  specVersion,
  patternBlockId: "crew-tee",
  patternBlockVersion: 1,
  fabricTestIds: [],
  printProfile: { bleedMm: 3, dpi: 300, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" },
  rosterHash: null,
  files: [],
});

/** Starts a plan from the collections page and returns its id. */
const startPlan = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/collections");
  await expect(page.getByRole("heading", { level: 1, name: "Collection plans" })).toBeVisible();
  await page.getByLabel("Name this plan").fill(name);
  // The United Kingdom explicitly: the seeded ladder carries GBP prices, and Australia sorts first.
  await page.getByLabel("Landed in").selectOption({ label: "United Kingdom (GBP)" });
  await page.getByRole("button", { name: "Start the plan" }).click();
  await expect(page.getByText(new RegExp(`${name} is ready`))).toBeVisible();
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const id = /\/studio\/collections\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!id) throw new Error(`No plan id in ${page.url()}`);
  return id;
};

type StyleFields = Readonly<{ name: string; colourway: string; sizes: string; status?: string; rrp?: string; wholesale?: string; split?: string; fabric?: string; product?: string }>;

/** Fills the "Add a style" form and waits for the card to be on the board. */
async function addStyle(page: Page, style: StyleFields): Promise<void> {
  await page.getByLabel("Name", { exact: true }).fill(style.name);
  await page.getByLabel("Colourway", { exact: true }).fill(style.colourway);
  if (style.status) await page.getByLabel("Status", { exact: true }).selectOption({ label: style.status });
  await page.getByLabel("Group", { exact: true }).selectOption({ label: "Core" });
  if (style.product) await page.getByLabel("Product", { exact: true }).selectOption({ label: style.product });
  await page.getByLabel("Article code", { exact: true }).fill("JSY-SS-01");
  await page.getByLabel("Fabric code", { exact: true }).fill(style.fabric ?? "F-POLY-INT");
  await page.getByLabel("Production class", { exact: true }).selectOption({ label: "Class A" });
  await page.getByLabel(/^Wholesale price/).fill(style.wholesale ?? "42.00");
  await page.getByLabel(/^RRP/).fill(style.rrp ?? "80.00");
  await page.getByLabel("Wholesale share (%)", { exact: true }).fill(style.split ?? "60");
  await page.getByLabel("Sizes and pieces", { exact: true }).fill(style.sizes);
  await page.getByRole("button", { name: "Add this style" }).click();
  await expect(page.getByText(`${style.name} is on the board`)).toBeVisible();
}

/** A design of the brand, listed as a product with a frozen release, as the server does it. */
async function listedProduct(email: string, page: Page, name: string): Promise<string> {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const projectId = /\/studio\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!projectId) throw new Error(`No design id in ${page.url()}`);

  const db = service();
  const userId = await userIdOf(email);
  const project = await db.from("projects").select("brand_id, current_version").eq("id", projectId).single();
  if (project.error) throw new Error(project.error.message);
  const brandId = project.data.brand_id as string;
  const release = await db.rpc("create_release", {
    p_project_id: projectId, p_brand_id: brandId, p_user_id: userId, p_label: "Round 1",
    p_snapshot: snapshot(project.data.current_version as number), p_file_specs: [], p_order_id: null,
  });
  if (release.error) throw new Error(release.error.message);
  const product = await db.rpc("create_brand_product", { p_brand_id: brandId, p_user_id: userId, p_project_id: projectId, p_name: name });
  if (product.error) throw new Error(product.error.message);
  return name;
}

const dropsOf = async (collectionId: string) => {
  const { data, error } = await service().from("collection_drops").select("version, payload").eq("collection_id", collectionId).order("version");
  if (error) throw new Error(error.message);
  return (data ?? []) as { version: number; payload: Record<string, unknown> }[];
};

const samplesOf = async (email: string) => {
  const userId = await userIdOf(email);
  const { data, error } = await service().from("brand_runs").select("kind, pieces, sizes").eq("created_by", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as { kind: string; pieces: number; sizes: Record<string, number> }[];
};

test.describe("the collection board", () => {
  test("plans a range, counts its styles, colourways and SKUs, and shows every card's figures", async ({ page }) => {
    const email = await createAccount("z4-board", { brand: "Z4 Board" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    // The studio sidebar now opens the plan (plan v5 Z4): no dead entry.
    await page.getByRole("navigation", { name: "Studio sections" }).getByRole("link", { name: "Collections" }).click();
    await expect(page).toHaveURL(/\/studio\/collections$/);

    const name = `Spring drop ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("Name this plan").fill(name);
    await page.getByLabel("Landed in").selectOption({ label: "United Kingdom (GBP)" });
    await page.getByRole("button", { name: "Start the plan" }).click();
    await expect(page.getByText(new RegExp(`${name} is ready`))).toBeVisible();
    await page.getByRole("link", { name }).click();

    await addStyle(page, { name: "Matchday jersey", colourway: "Navy", sizes: "S:10, M:20" });
    await addStyle(page, { name: "Matchday jersey", colourway: "White", sizes: "M:10" });

    // Two cards of one style: 1 style, 2 style-colourways, 3 SKUs.
    const board = page.getByRole("region", { name: new RegExp(`The board of ${name}`) });
    await expect(board.getByRole("region", { name: /^Core, 1 style · 2 style-colourways · 3 SKUs/ })).toBeVisible();

    const card = board.getByRole("article", { name: "Matchday jersey, Navy" });
    await expect(card.getByText("Draft")).toBeVisible();
    await expect(card.getByText("£80.00")).toBeVisible();
    await expect(card.getByText("30 pieces")).toBeVisible();
    await expect(card.getByText("S · M")).toBeVisible();
    await expect(card.getByText("Class A")).toBeVisible();

    const totals = page.getByRole("complementary", { name: "Totals for this range" });
    await expect(totals.getByText("1 style · 2 style-colourways · 3 SKUs")).toBeVisible();
    await expect(totals.getByText(/Navy · 2 SKUs · 30 pieces/)).toBeVisible();
    // The spec asks for colours; the plan holds colourway names, and the panel says so rather than inventing a count.
    await expect(totals.getByText(/A colour list comes from each design's own colours/)).toBeVisible();
  });
});

test.describe("the line plan", () => {
  test("prices every line from the tiers with freight and duty, and re-prices live as a quantity changes", async ({ page }) => {
    const email = await createAccount("z4-line", { brand: "Z4 Line" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    const planId = await startPlan(page, `Line plan ${randomUUID().slice(0, 8)}`);
    await addStyle(page, { name: "Tier jersey", colourway: "Navy", sizes: "M:19" });

    await page.getByRole("navigation", { name: "How to see this plan" }).getByRole("link", { name: "Line plan" }).click();
    await expect(page).toHaveURL(new RegExp(`/studio/collections/${planId}\\?view=line-plan$`));
    await expect(page.getByText(/Unit cost is the Knitwright price tier/)).toBeVisible();

    // 19 pieces sit in the 10-19 tier: £29.00 the piece, plus £1.20 freight and 12% duty is not set for this
    // article's HS code, so the cost is the tier plus freight and the table says what is missing.
    const row = page.getByRole("row").filter({ hasText: "Tier jersey" });
    await expect(row.getByText("£30.20")).toBeVisible();

    // One more piece takes the whole plan into the 20-49 tier, in front of you, with nothing saved yet.
    await page.getByRole("button", { name: "Show the sizes of Tier jersey" }).click();
    await page.getByLabel("M", { exact: true }).fill("20");
    await expect(row.getByText("£26.20")).toBeVisible();

    // The footer totals, and the toggle the spec words for us.
    await expect(page.getByText("Assumes full-price sell-through")).toBeVisible();
    await expect(page.getByText("Total units")).toBeVisible();
    await page.getByLabel("Assumes full-price sell-through").uncheck();
    await expect(page.getByText(/no sell-through rate is on file/)).toBeVisible();

    // And the typed quantities can be saved back to the plan.
    await page.getByRole("button", { name: "Save these quantities" }).click();
    await expect(page.getByText("Saved the quantities of Tier jersey.")).toBeVisible();
  });
});

test.describe("the two actions", () => {
  test("creates a drop payload for the Store, and nothing else", async ({ page }) => {
    const email = await createAccount("z4-drop", { brand: "Z4 Drop" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    const planId = await startPlan(page, `Drop plan ${randomUUID().slice(0, 8)}`);
    const actions = page.getByRole("region", { name: "Actions" });
    await expect(actions.getByRole("button", { name: "Create drop" })).toBeDisabled();
    await expect(actions.getByText("Add a style to the plan before creating a drop.")).toBeVisible();

    await addStyle(page, { name: "Drop jersey", colourway: "Navy", sizes: "M:30", status: "Approved" });
    await actions.getByRole("button", { name: "Create drop" }).click();
    await expect(page.getByText(/Drop payload 1 is ready for the Store to collect/)).toBeVisible();
    await expect(page.getByText(/Nothing has been published or charged/)).toBeVisible();

    const drops = await dropsOf(planId);
    expect(drops).toHaveLength(1);
    expect(drops[0]!.payload.kind).toBe("collection-drop");
    expect(drops[0]!.payload.styles).toMatchObject([{ name: "Drop jersey", colourway: "Navy", status: "approved", targetUnits: 30 }]);
    // The payload is for the Store to collect: it carries no cart, no checkout and no payment.
    expect(JSON.stringify(drops[0]!.payload)).not.toMatch(/cart|checkout|stripe|payout|storefront/i);
  });

  test("orders a sample for every approved style, and says why a style cannot be sampled", async ({ page }) => {
    const email = await createAccount("z4-samples", { brand: "Z4 Samples" });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    const product = await listedProduct(email, page, `Sample tee ${randomUUID().slice(0, 8)}`);
    const planId = await startPlan(page, `Sample plan ${randomUUID().slice(0, 8)}`);
    const actions = page.getByRole("region", { name: "Actions" });
    await expect(actions.getByText("No style in this plan is approved yet.")).toBeVisible();

    // An approved style with no product behind it cannot be sampled, and the screen says which and why.
    await addStyle(page, { name: "Unlisted jersey", colourway: "Navy", sizes: "M:30", status: "Approved" });
    await expect(actions.getByText(/Unlisted jersey is not listed as a product yet/)).toBeVisible();
    await expect(actions.getByRole("button", { name: "Order samples" })).toBeDisabled();

    // One that is listed can be: one piece per size, through the make flow's own door.
    await addStyle(page, {
      name: "Listed jersey",
      colourway: "White",
      sizes: "M:40",
      status: "Approved",
      product,
      fabric: `F-Z4-${randomUUID().slice(0, 8).toUpperCase()}`,
    });
    await actions.getByRole("button", { name: "Order samples" }).click();
    await expect(page.getByText(/1 sample request sent to production/)).toBeVisible();

    const runs = await samplesOf(email);
    expect(runs.filter((run) => run.kind === "sample")).toMatchObject([{ pieces: 1, sizes: { M: 1 } }]);
    expect(await dropsOf(planId)).toEqual([]);
  });
});
