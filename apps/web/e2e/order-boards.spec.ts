import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { createAccount, signIn, test } from "./support";

/**
 * The Tech pack and Order boards, the Order drawer, and the Export and Share popovers (plan v6 E4,
 * decision 0148; screens 12–13, e20, e21, e27–e30).
 *
 *   * a Tech pack board added after a garment summarises its design's tech pack and opens the tech
 *     pack page, which keeps its address;
 *   * an Order board with no order says so and opens the Order drawer (Sample · Run · Team store ·
 *     Quote PDF), which says how an order is paid until checkout lands;
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

/**
 * Presses a control on the canvas from the keyboard. The canvas floats under the header, the prompt
 * bar and the dock, so on a small CI window a pointer press can land on one of those instead.
 */
const press = async (control: Locator): Promise<void> => {
  await control.focus();
  await control.press("Enter");
};

/** Adds a board of a kind after the garment board through its Add… menu. */
const addAfterGarment = async (page: Page, kind: "tech_pack" | "order"): Promise<void> => {
  const garment = page.getByRole("article", { name: "Garment board" });
  const boardId = ((await garment.getAttribute("data-testid")) ?? "").replace("flow-board-", "");
  await press(page.getByTestId(`flow-add-open-${boardId}`));
  await press(page.getByTestId(`flow-add-${kind}-${boardId}`));
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

    // The order board opens the Order drawer for its design, with the make flow's own forms behind it.
    await press(page.locator('[data-testid^="canvas-open-order-"]'));
    const drawer = page.getByRole("dialog", { name: `Order · ${name}` });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("order-drawer-checkout")).toContainText("Card checkout arrives with payments");
    await drawer.getByRole("tab", { name: "Team store" }).click();
    await expect(drawer.getByTestId("order-drawer-store")).toContainText("Team stores open with the Store");
    await drawer.getByRole("button", { name: `Close Order · ${name}` }).click();
    await expect(drawer).toBeHidden();

    // The door's page still answers at its own address. (Followed by address: on a small CI window the
    // board can sit under the floating header, which a pointer press would hit first.)
    await page.goto(`/studio/${id}/tech-pack`);
    await expect(page).toHaveURL(new RegExp(`/studio/${id}/tech-pack$`));
  });
});

test.describe("the project panels", () => {
  test("Export offers the garment's files and Share has Link, Invite and the factory desk", async ({ page }) => {
    const id = await startDesign(page, `Panel kit ${randomUUID().slice(0, 6)}`);

    await page.getByTestId("editor-export").click();
    const exporting = page.getByRole("dialog", { name: "Export" });
    await expect(exporting).toBeVisible();
    await expect(exporting.getByTestId("export-techpack-xlsx")).toHaveAttribute("href", new RegExp(`/api/projects/${id}/exports/xlsx\\?version=\\d+$`));
    await expect(exporting.getByTestId("export-production-package")).toHaveAttribute("href", `/api/projects/${id}/production-package`);
    await page.keyboard.press("Escape");
    await expect(exporting).toBeHidden();

    await page.getByTestId("editor-share").click();
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
