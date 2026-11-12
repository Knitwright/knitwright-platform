import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * The Projects page (plan v6 P1, 09 screen 14, decision 0139): the top tabs Recent, Projects and AI
 * Creations; the sub-tabs Projects, Folders, Shared and Trash; folders; the Trash with restore and
 * delete for good. Every name is made per run, so a retry never finds its own leftover row.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

const startDesign = async (page: Page, name: string): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

const tile = (page: Page, name: string) => page.getByTestId("project-tile").filter({ hasText: name });

const choose = async (page: Page, name: string, entry: string): Promise<void> => {
  await tile(page, name).hover();
  await page.getByRole("button", { name: `More for ${name}` }).click();
  await page.getByRole("menuitem", { name: entry }).click();
};

const accessible = async (page: Page): Promise<void> => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(serious.map((entry) => `${entry.id}: ${entry.help}`)).toEqual([]);
};

test.describe("the Projects page", () => {
  test("lists a design with its kind, and the tabs reach every list", async ({ page }) => {
    await signedIn(page, "p1-list");
    const name = `Home kit ${Date.now()}`;
    await startDesign(page, name);

    await page.goto("/projects");
    await expect(tile(page, name)).toContainText("Kit design");
    await expect(page.getByRole("link", { name: "New project" })).toHaveAttribute("href", "/studio/start");
    await expect(page.getByTestId("guide-tile")).toHaveCount(3);
    await accessible(page);

    const tabs = page.locator("header").getByRole("navigation", { name: "Projects" });
    for (const [label, url] of [["AI Creations", /\/projects\/ai$/], ["Recent", /\/projects\/recent$/], ["Projects", /\/projects$/]] as const) {
      await tabs.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(url);
    }
    const lists = page.getByRole("navigation", { name: "Kinds of project list" });
    await lists.getByRole("link", { name: "Shared" }).click();
    await expect(page.getByRole("heading", { name: "Nothing shared with you yet" })).toBeVisible();
    await lists.getByRole("link", { name: "Trash" }).click();
    await expect(page.getByRole("heading", { name: "Trash is empty" })).toBeVisible();
  });

  test("searches and sorts from the address", async ({ page }) => {
    await signedIn(page, "p1-search");
    const stamp = Date.now();
    await startDesign(page, `Alpha ${stamp}`);
    await startDesign(page, `Bravo ${stamp}`);

    await page.goto(`/projects?q=Bravo`);
    await expect(tile(page, `Bravo ${stamp}`)).toBeVisible();
    await expect(tile(page, `Alpha ${stamp}`)).toHaveCount(0);
    await page.goto("/projects?q=nothing-by-this-name");
    await expect(page.getByRole("heading", { name: 'Nothing called "nothing-by-this-name"' })).toBeVisible();
    await page.goto("/projects?sort=name");
    await expect(page.getByTestId("project-tile").first()).toContainText(`Alpha ${stamp}`);
  });

  test("makes a folder and moves a design into it", async ({ page }) => {
    await signedIn(page, "p1-folder");
    const name = `Training top ${Date.now()}`;
    const folder = `Training ${Date.now()}`;
    await startDesign(page, name);

    await page.goto("/projects/folders");
    await expect(page.getByRole("heading", { name: "No folders yet" })).toBeVisible();
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByRole("dialog").getByLabel("Folder name").fill(folder);
    await page.getByRole("dialog").getByRole("button", { name: "Make folder" }).click();
    await expect(page.getByRole("heading", { level: 1, name: folder })).toBeVisible();
    await expect(page.getByRole("heading", { name: "This folder is empty" })).toBeVisible();

    await page.goto("/projects");
    await choose(page, name, "Move to folder");
    const dialog = page.getByRole("dialog", { name: `Move ${name}` });
    await dialog.getByLabel("Folder").selectOption({ label: folder });
    await dialog.getByRole("button", { name: "Move" }).click();
    await expect(dialog).toBeHidden();

    await page.goto("/projects/folders");
    await expect(page.getByTestId("folder-tile").filter({ hasText: folder })).toContainText("1 project");
    await page.getByTestId("folder-tile").filter({ hasText: folder }).click();
    await expect(tile(page, name)).toBeVisible();
  });

  test("moves a design to the Trash, restores it, and deletes it for good", async ({ page }) => {
    await signedIn(page, "p1-trash");
    const name = `Away kit ${Date.now()}`;
    await startDesign(page, name);

    await page.goto("/projects");
    await choose(page, name, "Move to Trash");
    await expect(tile(page, name)).toHaveCount(0);
    await page.goto("/projects/trash");
    await expect(tile(page, name)).toContainText("Moved to the Trash");
    await page.goto("/projects/recent");
    await expect(page.getByTestId("design-card").filter({ hasText: name })).toHaveCount(0);

    await page.goto("/projects/trash");
    await choose(page, name, "Restore");
    await expect(tile(page, name)).toHaveCount(0);
    await page.goto("/projects");
    await expect(tile(page, name)).toBeVisible();

    await choose(page, name, "Move to Trash");
    await page.goto("/projects/trash");
    await choose(page, name, "Delete for good");
    const dialog = page.getByRole("dialog", { name: `Delete ${name} for good?` });
    await dialog.getByLabel('Type "delete" to confirm').fill("delete");
    await dialog.getByRole("button", { name: "Delete for good" }).click();
    await expect(page).toHaveURL(/\/projects\/trash$/);
    await expect(page.getByRole("heading", { name: "Trash is empty" })).toBeVisible();
  });

  test("AI Creations says what will appear there", async ({ page }) => {
    await signedIn(page, "p1-ai");
    await page.goto("/projects/ai");
    await expect(page.getByRole("heading", { name: "No AI pictures yet" })).toBeVisible();
    await page.getByRole("button", { name: "Garment-locked" }).click();
    await expect(page).toHaveURL(/\/projects\/ai\?show=locked$/);
    await accessible(page);
  });
});
