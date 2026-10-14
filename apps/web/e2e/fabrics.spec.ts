import { expect } from "@playwright/test";
import { createAccount, signIn, summary, test } from "./support";

test.describe("fabrics", () => {
  test("adding a fabric test changes the print scale and says where the numbers came from", async ({ page }) => {
    const email = await createAccount("fabrics");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto("/brands/fabrics");
    await expect(page.getByRole("heading", { name: "Fabrics and sizes" })).toBeVisible();

    // The three benchmark fabrics are there with nothing set, so nothing is scaled.
    const interlock = page.getByRole("article", { name: "Recycled polyester interlock" });
    await expect(interlock.getByTestId("print-scale")).toContainText("Not scaled for shrink");

    await interlock.getByText("Add a fabric test").click();
    const form = interlock.getByRole("form", { name: "Add a test of Recycled polyester interlock" });
    await form.getByLabel("Who ran the test").fill("Priya Nair");
    await form.getByLabel("Day of the test").fill("2026-10-01");
    await form.getByLabel("How it was done").fill("Pressed 40 seconds at 200 degrees, measured after cooling.");
    await form.getByLabel("Shrink along the length (%)").fill("2");
    await form.getByLabel("Shrink across the width (%)").fill("1.5");
    // Shrink without the heat and time it was pressed at is refused beside the field.
    await form.getByRole("button", { name: "Save test" }).click();
    await expect(form.getByText("Say the temperature and the time the fabric was pressed at.")).toBeVisible();

    await form.getByLabel("Pressed at (°C)").fill("200");
    await form.getByLabel("Pressed for (seconds)").fill("40");
    await form.getByRole("button", { name: "Save test" }).click();
    await expect(summary(page)).toHaveCount(0);

    await page.reload();
    const tested = page.getByRole("article", { name: "Recycled polyester interlock" });
    await expect(tested.getByTestId("print-scale")).toContainText("1.0204");
    await expect(tested.getByTestId("print-scale")).toContainText("1.0152");
    await expect(tested).toContainText("From a fabric test");
  });

  test("the size labels are shown as suggested until the brand chooses", async ({ page }) => {
    const email = await createAccount("size-map");
    await signIn(page, email);
    await page.goto("/brands/fabrics");

    await expect(page.getByText("size labels have a suggested pattern size only")).toBeVisible();
    await expect(page.getByRole("row", { name: /Junior cut 16/ })).toContainText("Suggested by Knitwright");
  });
});
