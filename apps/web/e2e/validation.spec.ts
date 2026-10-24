import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/** Plan V1: the factory file's readiness list names what blocks an order, and the status stays a draft. */

const startDesign = async (page: Page, name: string): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

test.describe("validation gate (V1)", () => {
  test("a design with no fabric test shows the named blocker and cannot be recorded", async ({ page }) => {
    await signIn(page, await createAccount("validation"));
    await expect(page).toHaveURL(/\/studio$/);
    await startDesign(page, "Validation test");
    await page.goto(`${page.url().split("?")[0]}?tool=production`);

    const panel = page.getByTestId("validation-panel");
    await expect(panel.getByTestId("validation-profile")).toHaveText("Knitwright default profile, not agreed with a factory");
    const blocker = panel.getByTestId("finding-readiness-fabric-test");
    await expect(blocker).toBeVisible();
    await expect(blocker).toHaveAttribute("data-severity", "blocker");
    await expect(blocker).toContainText("Your print house");
    await expect(panel.getByTestId("validation-status")).toHaveAttribute("data-status", "draft");
    await expect(panel.getByRole("button", { name: "Record no blockers today" })).toBeDisabled();
  });
});
