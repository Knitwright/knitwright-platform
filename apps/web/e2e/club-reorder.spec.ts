import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createAccount, signIn, test, userIdOf } from "./support";

/**
 * Plan V4 W4-F (decision 0065): reorder from the club's order history in two clicks. A release is
 * made with the server's key because freezing one needs the print file builder, which is covered by
 * its own tests; everything the reorder reads is real.
 */

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const id = page.url().match(/\/studio\/([0-9a-f-]{36})/)?.[1];
  if (!id) throw new Error("No design id in the address.");
  return id;
};

const EARLIER = [
  { name: "Ana Reyes", number: "10", size_label: "M", cut: "womens", quantity: 1 },
  { name: "Cy Lowe", number: "12", size_label: "S", cut: "junior", quantity: 1 },
];

/** An earlier order and the release frozen from it, both written with the server's key. */
const seedRelease = async (email: string, projectId: string, rows: readonly Record<string, unknown>[]): Promise<void> => {
  const userId = await userIdOf(email);
  const member = await admin().from("memberships").select("brand_id").eq("user_id", userId).single();
  if (member.error) throw new Error(member.error.message);
  const brandId = member.data.brand_id as string;
  const order = await admin().rpc("save_team_order", { p_order_id: null, p_project_id: projectId, p_brand_id: brandId, p_user_id: userId, p_name: "Round 1", p_rows: rows });
  if (order.error) throw new Error(order.error.message);
  const profile = { bleedMm: 15, dpi: 150, iccFileId: null, maxPrintWidthMm: null, source: "knitwright-default" };
  const snapshot = { specVersion: 1, patternBlockId: "crew", patternBlockVersion: 1, fabricTestIds: [], printProfile: profile, rosterHash: "a".repeat(64), files: [] };
  const release = await admin().rpc("create_release", {
    p_project_id: projectId, p_brand_id: brandId, p_user_id: userId, p_label: "Round 1", p_snapshot: snapshot, p_file_specs: [], p_order_id: order.data,
  });
  if (release.error) throw new Error(release.error.message);
};

const saveSeason = async (page: Page, csv: string): Promise<void> => {
  await page.goto("/club");
  const seasons = page.getByRole("region", { name: "Seasons and rosters" });
  await seasons.getByLabel("New season").fill("2027");
  await seasons.getByRole("button", { name: "Make season" }).click();
  await expect(seasons.getByText("The season is made.")).toBeVisible();
  await seasons.getByLabel("Read players from a CSV file").setInputFiles({ name: "roster.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await seasons.getByRole("button", { name: "Save roster" }).click();
  await expect(seasons.getByText(/Saved \d+ players?\./)).toBeVisible();
};

test.describe("two-click reorder (W4-F)", () => {
  test("reorders in two clicks when nothing changed", async ({ page }) => {
    const email = await createAccount("reorder-same");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Reorder same");
    await seedRelease(email, projectId, EARLIER);
    await saveSeason(page, "Name,Number,Size,Cut\nAna Reyes,10,M,women\nCy Lowe,12,S,junior\n");

    const history = page.getByRole("region", { name: "Order history" });
    await history.getByRole("button", { name: "Reorder" }).click();
    const review = history.getByTestId("reorder-review");
    await expect(review.getByText("Nothing changed since the earlier order.")).toBeVisible();
    await expect(review.getByRole("region", { name: "Design validation" })).toBeVisible();
    await review.getByRole("button", { name: "Confirm" }).click();
    await expect(history.getByText("The new team list is made with 2 players.")).toBeVisible();
    await expect(history.getByRole("link", { name: "Open it on the design" })).toBeVisible();
  });

  test("flags a removed size and a player who left, and needs an answer for each", async ({ page }) => {
    const email = await createAccount("reorder-fix");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Reorder fix");
    await seedRelease(email, projectId, EARLIER);
    await saveSeason(page, "Name,Number,Size,Cut\nAna Reyes,10,M,women\nBo Tran,11,ZZ,men\n");

    const history = page.getByRole("region", { name: "Order history" });
    await history.getByRole("button", { name: "Reorder" }).click();
    const review = history.getByTestId("reorder-review");
    await expect(review.getByText("2 lines need an answer")).toBeVisible();
    await expect(review.getByText(/saved in size ZZ/)).toBeVisible();
    await expect(review.getByText(/is not on the roster any more/)).toBeVisible();
    await expect(review.getByRole("button", { name: "Confirm" })).toBeDisabled();

    await review.getByLabel("Size for Bo Tran").selectOption("M");
    await review.getByRole("button", { name: "Leave Cy Lowe out" }).click();
    await expect(review.getByRole("button", { name: "Confirm" })).toBeEnabled();
    await review.getByRole("button", { name: "Confirm" }).click();
    await expect(history.getByText("The new team list is made with 2 players, and 1 left out.")).toBeVisible();
  });
});
