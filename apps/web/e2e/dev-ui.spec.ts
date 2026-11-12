import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The component library's fixture page (decision 0137). The browser tests serve a production
 * build, where /dev/ui answers 404 unless DEV_UI_ROUTES is "on". With it on, the page renders
 * with no session and passes axe with nothing serious.
 */

const ON = process.env.DEV_UI_ROUTES === "on";

test("/dev/ui is not served by a production build unless DEV_UI_ROUTES is on", async ({ request }) => {
  test.skip(ON, "DEV_UI_ROUTES is on here");
  const response = await request.get("/dev/ui");
  expect(response.status()).toBe(404);
});

test("/dev/ui shows the library with no session and no serious axe findings", async ({ page }) => {
  test.skip(!ON, "DEV_UI_ROUTES is off here");
  await page.goto("/dev/ui");
  await expect(page.getByRole("heading", { level: 1, name: "Component library" })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
  expect(serious.map((entry) => `${entry.id}: ${entry.nodes.slice(0, 8).map((node) => node.target.join(" ")).join("; ")}`)).toEqual([]);
});
