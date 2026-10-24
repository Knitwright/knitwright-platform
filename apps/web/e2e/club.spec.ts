import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createAccount, createColleagueOf, signIn, test, userIdOf } from "./support";

/**
 * Plan V4 (decision 0042): the club workspace. A season is made, a roster is read from a CSV file
 * and saved, then the next season starts from it with every size pre-filled. A viewer sees the
 * roster and cannot change it.
 */

const CSV = "Name,Number,Size,Cut\nAna Reyes,10,M,women\nBo Tran,11,L,men\nCy Lowe,12,S,junior\n";

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

test.describe("club workspace (V4)", () => {
  test("a season is made, a roster is imported, and next season starts with the same sizes", async ({ page }) => {
    await signIn(page, await createAccount("club"));
    await expect(page).toHaveURL(/\/studio$/);
    await page.getByRole("link", { name: "Club" }).first().click();
    await expect(page).toHaveURL(/\/club$/);

    const seasons = page.getByRole("region", { name: "Seasons and rosters" });
    await seasons.getByLabel("New season").fill("2026");
    await seasons.getByRole("button", { name: "Make season" }).click();
    await expect(seasons.getByText("The season is made.")).toBeVisible();

    await seasons.getByLabel("Read players from a CSV file").setInputFiles({ name: "roster.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
    await expect(seasons.getByText("Read 3 players. Press Save to keep them.")).toBeVisible();
    await seasons.getByRole("button", { name: "Save roster" }).click();
    await expect(seasons.getByText("Saved 3 players.")).toBeVisible();

    await seasons.getByLabel("New season").fill("2027");
    await seasons.getByLabel("Start with the players of").selectOption({ label: "2026" });
    await seasons.getByRole("button", { name: "Make season" }).click();
    await expect(seasons.getByText("The season is made with last season's players and sizes.")).toBeVisible();

    await expect(seasons.getByLabel("Name, player 1")).toHaveValue("Ana Reyes");
    await expect(seasons.getByLabel("Size, player 1")).toHaveValue("M");
    await expect(seasons.getByLabel("Size, player 2")).toHaveValue("L");
    await expect(seasons.getByLabel("Wearer, player 3")).toHaveValue("junior");
  });

  test("erasing a season removes its players", async ({ page }) => {
    await signIn(page, await createAccount("club-erase"));
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/club");
    const seasons = page.getByRole("region", { name: "Seasons and rosters" });
    await seasons.getByLabel("New season").fill("Gone");
    await seasons.getByRole("button", { name: "Make season" }).click();
    await seasons.getByLabel("Read players from a CSV file").setInputFiles({ name: "roster.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
    await seasons.getByRole("button", { name: "Save roster" }).click();
    await expect(seasons.getByText("Saved 3 players.")).toBeVisible();

    await seasons.getByRole("button", { name: "Erase season" }).click();
    await expect(seasons.getByText("Gone and its players are erased.")).toBeVisible();
    await expect(seasons.getByText("No seasons yet.")).toBeVisible();
  });

  test("a viewer sees the roster and cannot change it", async ({ page, browser }) => {
    const ownerEmail = await createAccount("club-owner");
    const viewerEmail = await createColleagueOf(ownerEmail, "club-viewer");
    const { error } = await admin().from("memberships").update({ role: "viewer" }).eq("user_id", await userIdOf(viewerEmail));
    expect(error).toBeNull();

    await signIn(page, ownerEmail);
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/club");
    const seasons = page.getByRole("region", { name: "Seasons and rosters" });
    await seasons.getByLabel("New season").fill("2026");
    await seasons.getByRole("button", { name: "Make season" }).click();
    await seasons.getByLabel("Read players from a CSV file").setInputFiles({ name: "roster.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
    await seasons.getByRole("button", { name: "Save roster" }).click();
    await expect(seasons.getByText("Saved 3 players.")).toBeVisible();

    const other = await browser.newContext();
    const viewerPage = await other.newPage();
    await signIn(viewerPage, viewerEmail);
    await expect(viewerPage).toHaveURL(/\/studio$/);
    await viewerPage.goto("/club");
    const theirs = viewerPage.getByRole("region", { name: "Seasons and rosters" });
    // The newest season opens by itself.
    await expect(theirs.getByLabel("Name, player 1")).toBeDisabled();
    await expect(theirs.getByRole("button", { name: "Save roster" })).toHaveCount(0);
    await expect(theirs.getByLabel("New season")).toHaveCount(0);
    await expect(viewerPage.getByText("Your role can look at the kit but not change it.")).toBeVisible();
    await other.close();
  });

  test("an owner saves the kit", async ({ page }) => {
    await signIn(page, await createAccount("club-kit"));
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/club");
    const kit = page.getByRole("region", { name: "Club kit" });
    await kit.getByLabel("Main colour, pick").fill("#0b3d91");
    await kit.getByRole("button", { name: "Add a sponsor" }).click();
    await kit.getByLabel("Sponsor 1 name").fill("Harbour Bakery");
    await kit.getByRole("button", { name: "Save kit" }).click();
    await expect(kit.getByText("The kit is saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Club kit" }).getByText("#0b3d91")).toBeVisible();
    await expect(page.getByLabel("Sponsor 1 name")).toHaveValue("Harbour Bakery");
  });
});
