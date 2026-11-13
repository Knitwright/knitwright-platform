import { expect, type Page } from "@playwright/test";
import { accessible } from "./chrome";
import { createAccount, signIn, test } from "./support";

/**
 * Team, Brand, Settings and the plans modal (plan v6 P6, decision 0144; 09 screens 17, 18, 19, 29).
 *
 * The behaviour of the panels inside them (rosters, kit, committee, brand forms) keeps its own specs,
 * moved to the new addresses. This one covers what P6 added: the plans modal from Upgrade, Settings'
 * cards and the stored unit, Team's tabs and the roster-retention opt-in, and the Brand empty state's
 * import, which carries the address typed into the import screen.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

test.describe("the plans modal", () => {
  test("Upgrade opens Choose Your Plan, Annual by default, and choosing a plan opens its checkout", async ({ page }) => {
    await signedIn(page, "p6-plans");
    await page.locator("header").getByRole("button", { name: "Upgrade" }).click();
    const modal = page.getByRole("dialog", { name: "Choose Your Plan" });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("radio", { name: /Annual/ })).toHaveAttribute("aria-checked", "true");
    await expect(modal.getByRole("article")).toHaveCount(3);
    await expect(modal).toContainText("Prices are placeholders.");
    await accessible(page);

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    await expect(page.locator("header").getByRole("button", { name: "Upgrade" })).toBeFocused();

    // Plans billing (plan v6 C1, decision 0152): choosing a plan opens its checkout, the test checkout here.
    await page.locator("header").getByRole("button", { name: "Upgrade" }).click();
    await modal.getByRole("radio", { name: "Monthly" }).click();
    await expect(modal.getByTestId("plan-starter")).toContainText("billed monthly");
    await modal.getByRole("button", { name: "Get Studio Pro" }).click();
    await expect(page).toHaveURL(/\/checkout\/test\/cs_test_kw_/);
    await expect(page.getByRole("heading", { level: 1, name: "Knitwright Studio Pro, monthly" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel and go back" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Checkout cancelled" })).toBeVisible();
  });
});

test.describe("Settings", () => {
  test("shows its cards and keeps the unit garment lengths are read in", async ({ page }) => {
    await signedIn(page, "p6-settings");
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    for (const card of ["Plan & billing", "Members", "Units", "Account", "Get more credits"]) {
      await expect(page.getByRole("heading", { level: 2, name: card, exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("Millimetres for garments · px for social")).toBeVisible();
    await accessible(page);

    const units = page.getByRole("region", { name: "Units" });
    await units.getByLabel("Inches (in)").check();
    await units.getByRole("button", { name: "Save units" }).click();
    await expect(units.getByText("Garment lengths now read in inches (in).")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Inches for garments · px for social")).toBeVisible();
    await expect(page.getByRole("region", { name: "Units" }).getByLabel("Inches (in)")).toBeChecked();

    await page.getByRole("button", { name: "See plans" }).click();
    await expect(page.getByRole("dialog", { name: "Choose Your Plan" })).toBeVisible();
  });
});

test.describe("Team", () => {
  test("has Roster, Approvals and Seasons, and an owner opts in to keeping old rosters", async ({ page }) => {
    await signedIn(page, "p6-team");
    await page.goto("/team");
    await expect(page.getByRole("heading", { level: 1, name: /^Team · / })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Team" });
    await expect(tabs.getByRole("link")).toHaveText(["Roster", "Approvals", "Seasons"]);
    await expect(page.getByText("No season yet")).toBeVisible();
    await accessible(page);

    await tabs.getByRole("link", { name: "Seasons" }).click();
    const seasons = page.getByRole("region", { name: "Seasons and rosters" });
    await seasons.getByLabel("New season").fill("2026/27");
    await seasons.getByRole("button", { name: "Make season" }).click();
    await expect(seasons.getByText("The season is made.")).toBeVisible();

    const retention = page.getByTestId("roster-retention");
    await expect(retention).toContainText("removed automatically");
    await retention.getByRole("switch", { name: "Keep rosters after two seasons" }).click();
    await retention.getByRole("button", { name: "Save roster setting" }).click();
    await expect(retention).toContainText("because your club opted in");
    await page.reload();
    await expect(page.getByTestId("roster-retention").getByRole("switch")).toHaveAttribute("aria-checked", "true");

    await page.goto("/team");
    await expect(tabs.getByRole("link", { name: "Roster 2026/27" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("No players in 2026/27 yet")).toBeVisible();
    await page.getByRole("link", { name: "Add player", exact: true }).click();
    await expect(page).toHaveURL(/\/team\?view=edit$/);
    await expect(page.getByRole("region", { name: "Edit the 2026/27 roster" }).getByRole("button", { name: "Add a player" })).toBeVisible();
  });
});

test.describe("Brand", () => {
  test("the empty state's Import opens the import screen with the address typed", async ({ page }) => {
    await signedIn(page, "p6-brand");
    await page.goto("/brand");
    await page.getByLabel("Your website or Instagram link").fill("https://example.test");
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page).toHaveURL(/\/brand\/import\?url=https%3A%2F%2Fexample\.test/);
    await expect(page.getByTestId("import-url")).toHaveValue("https://example.test");
  });
});
