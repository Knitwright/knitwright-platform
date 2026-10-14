import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * Plan W4: a team list is read from a CSV file, checked against the design, saved, and turned into a
 * manifest. Freezing a release and checking a reorder need the print file builder (workstream W3), so
 * they are covered by the unit and database tests until it is joined.
 */

const startDesign = async (page: Page, name: string): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

const CSV = "Name,Number,Size\nANA,10,M\nBO,11,M\nCY,10,L\n";

test.describe("team orders (W4)", () => {
  test("a member reads a team list, sees the repeated number, saves it and downloads the manifest", async ({ page }) => {
    await signIn(page, await createAccount("team-orders"));
    await expect(page).toHaveURL(/\/studio$/);
    await startDesign(page, "Team order test");
    await page.goto(`${page.url().split("?")[0]}?tool=production`);

    const panel = page.getByTestId("team-orders-panel");
    await expect(panel.getByText("No team lists yet.")).toBeVisible();
    await expect(panel.getByText(/Freezing a release needs/)).toBeVisible();

    await panel.getByRole("button", { name: "Add a team list" }).click();
    await panel.getByLabel("Name of this team list").fill("Round 1");
    await panel.getByLabel("Read a team list from a CSV file").setInputFiles({ name: "team.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
    await expect(panel.getByText("Read 3 players.")).toBeVisible();
    await expect(panel.getByTestId("roster-issues")).toContainText("Number 10 is used by rows 1, 3");

    await panel.getByRole("button", { name: "Save", exact: true }).click();
    const savedList = panel.getByRole("listitem").filter({ hasText: "Round 1" });
    await expect(savedList).toBeVisible();
    await expect(savedList.getByText("(3 rows)")).toBeVisible();

    await panel.getByRole("button", { name: "Open Round 1" }).click();
    const href = await panel.getByRole("link", { name: "Manifest (CSV)" }).getAttribute("href");
    expect(href).toMatch(/\/orders\/[0-9a-f-]{36}\/manifest\?format=csv$/);
    const response = await page.request.get(href ?? "");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toContain('filename="Round-1.csv"');
    const text = await response.text();
    expect(text).toContain("Total,3,3");
    expect(text).toContain("ANA,10,M,unisex,1");
  });

  test("erasing a team list removes its names", async ({ page }) => {
    await signIn(page, await createAccount("team-orders-erase"));
    await expect(page).toHaveURL(/\/studio$/);
    await startDesign(page, "Erase test");
    await page.goto(`${page.url().split("?")[0]}?tool=production`);

    const panel = page.getByTestId("team-orders-panel");
    await panel.getByRole("button", { name: "Add a team list" }).click();
    await panel.getByLabel("Name of this team list").fill("Round 1");
    await panel.getByLabel("Read a team list from a CSV file").setInputFiles({ name: "team.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
    await expect(panel.getByText("Read 3 players.")).toBeVisible();
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    await panel.getByRole("button", { name: "Open Round 1" }).click();
    await panel.getByRole("button", { name: "Erase this list" }).click();
    await panel.getByRole("button", { name: "Yes, erase every name in this list" }).click();
    await expect(panel.getByText("No team lists yet.")).toBeVisible();
  });
});
