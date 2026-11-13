import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * Workstream Y1 acceptance (plan v5, decision 0074): the studio home of spec F-S4 — its sidebar,
 * its action cards and its create-new modal with no blank canvas. The catalogue and the article page
 * moved to /products in plan v6 P4 (decision 0142); their tests are in `e2e/products.spec.ts`.
 *
 * Needs local Supabase (`pnpm db:start`). The catalogue is platform data seeded by the migrations,
 * so nothing here creates a row another spec could pick up.
 */

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label, { brand: `${label} club` }));
  // signIn only presses the button: the session cookie arrives with the redirect.
  await expect(page).toHaveURL(/\/projects\/recent$/);
};

const accessible = async (page: Page): Promise<void> => {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running" || animation.effect?.getTiming().iterations === Infinity),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  // The node and the figures it failed on, so a fault names the element and its colours rather than
  // only its rule (e2e/mobile.spec.ts reports the node; the colours are in the check's own data).
  const where = (node: (typeof serious)[number]["nodes"][number]): string =>
    `${node.target.join(" ")} ${JSON.stringify(node.any.map((check) => check.data))}`;
  expect(serious.map((entry) => `${entry.id}: ${entry.help} (${entry.nodes.slice(0, 3).map(where).join("; ")})`)).toEqual([]);
};

test.describe("Recent, the studio home moved to Projects (decision 0139)", () => {
  test("greets the workspace, offers the start cards, and never shows a dead link", async ({ page }) => {
    await signedIn(page, "y1-home");
    await expect(page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), y1-home club$/ })).toBeVisible();

    const cards = page.getByRole("region", { name: "Start here" });
    await expect(cards.getByRole("heading", { level: 2 })).toHaveText([
      "Start a new design",
      "Browse products and templates",
      "Mood board",
      "Range plan",
      "Repeat print",
    ]);
    await expect(cards.getByRole("link", { name: /^Browse products and templates/ })).toHaveAttribute("href", "/products");
    // The range plan opens the collection plan of F-S10 (plan v5 Z4, decision 0085).
    await expect(cards.getByRole("link", { name: /^Range plan/ })).toHaveAttribute("href", "/orders/plans");
    // A card that is not built still says so, and is not a link.
    await expect(cards.getByRole("link", { name: /^Mood board/ })).toHaveCount(0);
    await expect(cards.getByText("Coming in a later release").first()).toBeVisible();
    await accessible(page);
  });


  test("opens the create-new modal, which offers no blank canvas, holds Tab and gives focus back", async ({ page }) => {
    await signedIn(page, "y1-modal");
    const opener = page.getByRole("region", { name: "Start here" }).getByRole("button", { name: "Start designing" });
    await opener.click();

    const dialog = page.getByRole("dialog", { name: "Create a new design" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(opener).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(["Knitwright library", "Start your own"]);
    await expect(dialog.getByRole("link", { name: /^Products/ })).toHaveAttribute("href", "/products");
    await expect(dialog.getByRole("link", { name: /^Templates/ })).toHaveAttribute("href", "/templates");
    await expect(dialog.getByText("Import your own pattern")).toBeVisible();
    await expect(dialog.getByRole("link", { name: /Import your own pattern/ })).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: /^Kit from your crest/ })).toHaveAttribute("href", "/ai-studio/workflow/crest-to-kit");

    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement)), `Tab ${press + 1} left the dialog`).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("filters Jump back in, and says when a kind of project is not built yet", async ({ page }) => {
    await signedIn(page, "y1-jump");
    const row = page.getByRole("region", { name: "Jump back in" });
    await row.getByRole("link", { name: /^Moodboards/ }).click();
    await expect(page).toHaveURL(/\/projects\/recent\?jump=moodboards$/);
    await expect(page.getByText("Moodboards: coming in a later release.")).toBeVisible();
    await expect(page.getByRole("list", { name: /^Designs of / })).toHaveCount(0);
  });
});
