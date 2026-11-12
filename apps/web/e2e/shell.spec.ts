import { expect, type Page } from "@playwright/test";
import { accessible, openAccountMenu, openShellPlace, rail, shellFitsAtEveryWidth } from "./chrome";
import { createAccount, signIn, test } from "./support";

/**
 * The dashboard shell (decision 0138): the rail reaches every place of the v3.9 route map, the
 * menus work from the keyboard, the v2.2 pages keep a door, and the shell fits at every width.
 *
 * Nothing here creates a row another spec could pick up: each test signs a new account in and reads
 * the chrome the pages already draw.
 */

const signedIn = async (page: Page, label: string): Promise<string> => {
  const email = await createAccount(label);
  await signIn(page, email);
  // signIn only presses the button: the session cookie arrives with the redirect.
  await expect(page).toHaveURL(/\/studio$/);
  return email;
};

/** Each rail place, the address it opens, and the h1 a placeholder carries (null for a v2.2 page). */
const PLACES = [
  { label: "AI Studio", url: /\/ai-studio$/, heading: "AI Studio" },
  { label: "Templates", url: /\/templates$/, heading: null },
  { label: "Mockups", url: /\/mockups$/, heading: "Mockups" },
  { label: "Marketing", url: /\/marketing$/, heading: "Marketing" },
  { label: "Products", url: /\/catalogue$/, heading: null },
  { label: "Projects", url: /\/studio$/, heading: null },
  { label: "Orders", url: /\/orders$/, heading: "Orders" },
  { label: "Store", url: /\/store$/, heading: "Store" },
] as const;

test.describe("the rail", () => {
  test("reaches every place, and marks the one the page is in", async ({ page }) => {
    await signedIn(page, "shell-rail");
    await expect(rail(page).getByRole("link", { name: "Projects", exact: true })).toHaveAttribute("aria-current", "page");

    for (const place of PLACES) {
      await openShellPlace(page, place.label);
      await expect(page).toHaveURL(place.url);
      if (place.heading !== null) await expect(page.getByRole("heading", { level: 1, name: place.heading })).toBeAttached();
      await expect(rail(page).getByRole("link", { name: place.label, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(rail(page).locator('[aria-current="page"]')).toHaveCount(1);
    }
  });

  test("AI Studio's tabs reach its four pages, and a workflow has its own address", async ({ page }) => {
    await signedIn(page, "shell-ai");
    await openShellPlace(page, "AI Studio");
    const tabs = page.locator("header").getByRole("navigation", { name: "AI Studio" });
    await expect(tabs.getByRole("link", { name: "AI Workflows" })).toHaveAttribute("aria-current", "page");

    for (const [label, url] of [["Creative Agent", /\/ai-studio\/agent$/], ["Image Generator", /\/ai-studio\/image$/], ["Video Generator", /\/ai-studio\/video$/]] as const) {
      await tabs.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(url);
      await expect(tabs.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 1, name: label })).toBeAttached();
    }

    await page.goto("/ai-studio/workflow/retro-kit-remix");
    await expect(page.getByRole("heading", { level: 1, name: "Retro kit remix" })).toBeAttached();
    await page.getByRole("main").getByRole("link", { name: "AI Studio", exact: true }).click();
    await expect(page).toHaveURL(/\/ai-studio$/);
    await accessible(page);
  });

  test("⋯ keeps a door to every v2.2 page with no rail item", async ({ page }) => {
    await signedIn(page, "shell-more");
    await rail(page).getByRole("button", { name: "More", exact: true }).click();
    const menu = page.getByRole("menu", { name: "More places" });
    await expect(menu.getByRole("menuitem")).toHaveText(["Launch", "Teamwear", "Size charts", "Benchmarks", "Designer", "Club and members"]);
    await menu.getByRole("menuitem", { name: "Teamwear" }).click();
    await expect(page).toHaveURL(/\/teamwear/);
    // The button names the current page when it is one of its own.
    await expect(rail(page).getByRole("button", { name: "More, current: Teamwear" })).toBeVisible();
  });

  test("shows Team to a club, which ⋯ then leaves out", async ({ page }) => {
    const email = await createAccount("shell-club", { brand: null });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/welcome$/);
    await page.getByRole("radio", { name: "Club", exact: true }).check();
    await page.getByLabel("Club name").fill("Shell Rovers FC");
    await page.getByRole("button", { name: "Set up your club" }).click();
    await expect(page).toHaveURL(/\/studio$/);

    await openShellPlace(page, "Team");
    await expect(page).toHaveURL(/\/club$/);
    await rail(page).getByRole("button", { name: "More", exact: true }).click();
    await expect(page.getByRole("menu", { name: "More places" }).getByRole("menuitem", { name: "Club and members" })).toHaveCount(0);
  });
});

test.describe("the shell's menus", () => {
  test("Create opens from the keyboard, moves with the arrows, and Escape gives the focus back", async ({ page }) => {
    await signedIn(page, "shell-create");
    const create = rail(page).getByRole("button", { name: "Create", exact: true });
    await create.focus();
    await page.keyboard.press("Enter");
    await expect(create).toHaveAttribute("aria-expanded", "true");

    const items = page.getByRole("menu", { name: "Create" }).getByRole("menuitem");
    await expect(items).toHaveText(["New kit design", "Kit from crest", "Social post", "Explore templates", "Blank canvas"]);
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(items.last()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(items.first()).toBeFocused();
    await accessible(page);

    await page.keyboard.press("Escape");
    await expect(create).toHaveAttribute("aria-expanded", "false");
    await expect(create).toBeFocused();

    await create.click();
    await page.getByRole("menu", { name: "Create" }).getByRole("menuitem", { name: "Kit from crest" }).click();
    await expect(page).toHaveURL(/\/ai-studio\/workflow\/crest-to-kit$/);
  });

  test("the avatar holds the address, Settings and Sign out", async ({ page }) => {
    const email = await signedIn(page, "shell-account");
    await openAccountMenu(page);
    await expect(page.getByTestId("account-email")).toHaveText(email);
    const menu = page.getByRole("menu", { name: "Account" });
    await menu.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await openAccountMenu(page);
    await page.getByRole("menu", { name: "Account" }).getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("the workspace avatar switches brands, and ⊕ invites or adds credits", async ({ page }) => {
    await signedIn(page, "shell-workspace");
    await rail(page).getByRole("button", { name: "Workspace", exact: true }).click();
    await page.getByRole("menuitem", { name: "Switch brand" }).click();
    await expect(page).toHaveURL(/\/brands$/);

    await page.locator("header").getByRole("button", { name: "Invite or add credits" }).click();
    await page.getByRole("menuitem", { name: "Invite people" }).click();
    await expect(page).toHaveURL(/\/club#members$/);
  });
});

test.describe("the route map", () => {
  test("the v3.9 addresses a v2.2 page serves, and /brand, redirect", async ({ page }) => {
    await signedIn(page, "shell-redirects");
    for (const [from, to] of [["/projects", /\/studio$/], ["/products", /\/catalogue$/], ["/team", /\/club$/], ["/brand", /\/brand-studio$/]] as const) {
      await page.goto(from);
      await expect(page).toHaveURL(to);
    }
  });

  test("the shell fits at every width and scans clean", async ({ page }) => {
    await signedIn(page, "shell-fits");
    await shellFitsAtEveryWidth(page);
    await accessible(page);
    await page.goto("/orders");
    await shellFitsAtEveryWidth(page);
    await accessible(page);
  });
});

test.describe("the shell on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("hides the rail, and its Menu holds every place", async ({ page }) => {
    await signedIn(page, "shell-phone");
    await expect(rail(page)).toBeHidden();
    const button = page.locator("header").getByRole("button", { name: "Menu", exact: true });
    await button.click();
    const menu = page.getByRole("menu", { name: "Menu", exact: true });
    for (const label of ["New kit design", "AI Studio", "Projects", "Orders", "Launch", "Switch brand", "Help"]) {
      await expect(menu.getByRole("menuitem", { name: label, exact: true })).toBeVisible();
    }
    await accessible(page);
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();

    await openShellPlace(page, "Store");
    await expect(page).toHaveURL(/\/store$/);
    await expect(page.getByRole("heading", { level: 1, name: "Store" })).toBeVisible();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways, "the page scrolls sideways on a phone by this many pixels").toBeLessThanOrEqual(0);
  });
});
