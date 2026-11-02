import { expect, type Locator, type Page } from "@playwright/test";
import { accessible, headerFitsAtEveryWidth, openAccountMenu, openStudioSection } from "./chrome";
import { createAccount, signIn, test } from "./support";

/**
 * The studio top bar (decision 0103): the shared chrome of every signed-in page. The account
 * cluster is one menu, the sections past the fourth are in another, both are the bar's own glass
 * panel, and the row keeps its words on the glass at every width it supports.
 *
 * Nothing here creates a row another spec could pick up: each test signs a new account in and
 * reads the chrome the studio home already draws.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  // signIn only presses the button: the session cookie arrives with the redirect.
  await expect(page).toHaveURL(/\/studio$/);
};

const bar = (page: Page): Locator => page.locator("header");

/** The panel a menu button opens, found by the id the button itself names. */
const panelOf = async (button: Locator): Promise<Locator> => {
  const id = await button.getAttribute("aria-controls");
  expect(id, "a menu button says which panel it opens").not.toBeNull();
  return button.page().locator(`[id="${id}"]`);
};

test.describe("the top bar's sections", () => {
  test("shows the first four as pills and lists the rest, with every waiting section wired in", async ({ page }) => {
    await signedIn(page, "chrome-sections");

    const pills = bar(page).getByRole("navigation", { name: "Studio" }).getByRole("link");
    await expect(pills).toHaveText(["Designs", "Templates", "Launch", "Catalogue"]);
    await expect(pills.filter({ hasText: "Launch" })).toHaveAttribute("href", "/launch");

    const more = bar(page).getByRole("button", { name: "More", exact: true });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");

    const listed = bar(page).getByRole("navigation", { name: "More studio sections" }).getByRole("link");
    await expect(listed).toHaveText(["Size charts", "Designer", "Teamwear", "Club", "Brand", "Benchmarks"]);
    // The addresses the workstreams were waiting for a door to.
    await expect(listed.filter({ hasText: "Teamwear" })).toHaveAttribute("href", "/teamwear");
    await expect(listed.filter({ hasText: "Benchmarks" })).toHaveAttribute("href", "/studio/benchmarks");

    // The open panel is scanned too: it is drawn over the aurora like everything else in the bar.
    await accessible(page);

    await page.keyboard.press("Escape");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await headerFitsAtEveryWidth(page);
  });

  test("says which section is current, whether it is a pill or inside the menu", async ({ page }) => {
    await signedIn(page, "chrome-current");

    // A pill: the section the address is in is marked for a screen reader.
    await expect(bar(page).getByRole("link", { name: "Designs", exact: true })).toHaveAttribute("aria-current", "page");

    // Inside the menu: the button's own name says which section is current, because no pill can.
    await openStudioSection(page, "Teamwear");
    await expect(page).toHaveURL(/\/teamwear/);
    const more = bar(page).getByRole("button", { name: /More.*current section: Teamwear/ });
    await expect(more).toBeVisible();
    // No pill claims to be the current section while the current one is in the menu.
    await expect(bar(page).getByRole("navigation", { name: "Studio" }).locator('[aria-current="page"]')).toHaveCount(0);

    await more.click();
    await expect(bar(page).getByRole("link", { name: "Teamwear", exact: true })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("the top bar's menus", () => {
  test("the account menu opens from the keyboard, holds Tab, and Escape gives its button the focus back", async ({ page }) => {
    const email = await createAccount("chrome-account");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    const button = bar(page).getByRole("button", { name: "Account", exact: true });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    const panel = await panelOf(button);
    await expect(panel).toBeHidden();

    // Opened by the keyboard alone: focus the button and press it.
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();

    // The three controls the row used to hold side by side, all three still here.
    await expect(panel.getByTestId("account-email")).toHaveText(email);
    await expect(panel.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    await expect(panel.getByRole("button", { name: "Sign out" })).toBeVisible();

    // Tab goes round the button and the panel's own controls and leaves neither.
    const id = (await button.getAttribute("aria-controls")) as string;
    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate((panelId) => {
        const wrapper = document.getElementById(panelId)?.parentElement ?? null;
        return wrapper !== null && wrapper.contains(document.activeElement);
      }, id);
      expect(inside, `Tab ${press + 1} left the account menu`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
  });

  test("Settings and Sign out still work from the account menu", async ({ page }) => {
    await signedIn(page, "chrome-signout");

    await openAccountMenu(page);
    await bar(page).getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await openAccountMenu(page);
    await bar(page).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

test.describe("the top bar on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("still has one menu, and it holds every section and the account rows", async ({ page }) => {
    const email = await createAccount("chrome-phone");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    /*
     * The mark is a 40 px target even though its drawing is 24 px wide and the name beside it is
     * for screen readers only here. `mobile.spec.ts` catches this on every signed-in page at once,
     * but the browser tests are not on the pull-request gate, so the chrome asserts its own.
     */
    const home = bar(page).getByRole("link", { name: "Knitwright", exact: true });
    const box = await home.boundingBox();
    expect(box, "the top bar's way home has no box").not.toBeNull();
    expect(Math.round(box?.width ?? 0), "the way home is this wide").toBeGreaterThanOrEqual(40);
    expect(Math.round(box?.height ?? 0), "the way home is this tall").toBeGreaterThanOrEqual(40);

    // One menu, not two: the account menu of a desktop is not drawn at this width.
    await expect(bar(page).getByRole("button", { name: "Account", exact: true })).toBeHidden();
    const button = bar(page).getByRole("button", { name: "Menu", exact: true });
    await button.click();

    const panel = await panelOf(button);
    await expect(panel.getByRole("navigation", { name: "Studio" }).getByRole("link")).toHaveCount(10);
    await expect(panel.getByTestId("account-email")).toHaveText(email);
    await expect(panel.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Sign out" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "the studio home scrolls sideways on a phone by this many pixels").toBeLessThanOrEqual(0);
    await headerFitsAtEveryWidth(page);
    await accessible(page);
  });
});
