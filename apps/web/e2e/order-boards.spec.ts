import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * The Tech pack and Order boards, the Order drawer, and the Export and Share popovers (plan v6 E4,
 * decision 0148; screens 12–13, e20, e21, e27–e30).
 *
 *   * a Tech pack board added after a garment summarises its design's tech pack and opens the tech
 *     pack page, which keeps its address;
 *   * an Order board with no order says so, and the Order button waits for the garment's checks;
 *   * Export offers the garment's tech pack and production package; Share has Link and Invite, with
 *     the Knitwright factory desk as a tech-pack-only member.
 */

const startDesign = async (page: Page, name: string): Promise<string> => {
  await signIn(page, await createAccount("order-boards"));
  await expect(page).toHaveURL(/\/projects\/recent$/);
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}\?focus=garment$/);
  const id = /\/project\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
  await page.goto(`/project/${id}`);
  await expect(page.getByRole("article", { name: "Garment board" })).toBeVisible();
  return id;
};

/** Adds a board of a kind after the garment board through its Add… menu. */
const addAfterGarment = async (page: Page, kind: "tech_pack" | "order"): Promise<void> => {
  const garment = page.getByRole("article", { name: "Garment board" });
  const boardId = ((await garment.getAttribute("data-testid")) ?? "").replace("flow-board-", "");
  await page.getByTestId(`flow-add-open-${boardId}`).click();
  await page.getByTestId(`flow-add-${kind}-${boardId}`).click();
};

test.describe("the tech pack and order boards", () => {
  test("summarise the design's tech pack and its orders, with their doors", async ({ page }) => {
    const name = `Order kit ${randomUUID().slice(0, 6)}`;
    const id = await startDesign(page, name);

    await addAfterGarment(page, "tech_pack");
    const tech = page.getByRole("article", { name: "Tech pack board" });
    await expect(tech).toBeVisible();
    await expect(page.locator('[data-testid^="techpack-board-line-"]')).toContainText("16 pages");
    const open = page.locator('[data-testid^="canvas-open-tech_pack-"]');
    await expect(open).toHaveAttribute("href", `/studio/${id}/tech-pack`);

    await addAfterGarment(page, "order");
    await expect(page.locator('[data-testid^="order-board-"]').filter({ hasText: "No order yet." })).toBeVisible();

    // The garment has never been checked, so the Order button waits and says why.
    const order = page.getByTestId("project-order");
    await expect(order).toHaveAttribute("aria-disabled", "true");

    await open.click();
    await expect(page).toHaveURL(new RegExp(`/studio/${id}/tech-pack$`));
  });
});

test.describe("the project panels", () => {
  test("Export offers the garment's files and Share has Link, Invite and the factory desk", async ({ page }) => {
    const id = await startDesign(page, `Panel kit ${randomUUID().slice(0, 6)}`);

    await page.getByTestId("project-export").click();
    const exporting = page.getByRole("dialog", { name: "Export" });
    await expect(exporting).toBeVisible();
    await expect(exporting.getByTestId("export-techpack-xlsx")).toHaveAttribute("href", new RegExp(`/api/projects/${id}/exports/xlsx\\?version=\\d+$`));
    await expect(exporting.getByTestId("export-production-package")).toHaveAttribute("href", `/api/projects/${id}/production-package`);
    await page.keyboard.press("Escape");
    await expect(exporting).toBeHidden();

    await page.getByTestId("project-share").click();
    const sharing = page.getByRole("dialog", { name: "Share project" });
    await expect(sharing.getByRole("button", { name: "Make a share link" })).toBeVisible();
    await sharing.getByRole("radio", { name: "Invite" }).click();
    await expect(sharing.getByTestId("share-factory-desk")).toContainText("Tech pack only");
    await expect(sharing.getByLabel("Invite by email")).toBeVisible();

    const results = await new AxeBuilder({ page }).include('[data-testid="share-popover"]').analyze();
    const serious = results.violations.filter((one) => one.impact === "serious" || one.impact === "critical");
    expect(serious.map((one) => `${one.id}: ${one.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);

    await sharing.getByTestId("share-publish").click();
    await expect(page.getByRole("dialog", { name: "Publish project" })).toContainText("not built yet");
  });
});
