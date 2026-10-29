import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { createAccount, makePlatformAdmin, signIn, test } from "./support";

/**
 * Decision 0067, the rulebook and "Why?" v1: the admin page does not exist for anyone but a platform admin; a Why?
 * popover shows a seeded rule's words and that it is a draft, is keyboard-usable and passes axe; an unknown id shows
 * the gap text and lands in the gap list; an edit saves a new version, which can then be confirmed.
 */

const three = () => String(Math.floor(Math.random() * 1000)).padStart(3, "0");

test.describe("the rulebook", () => {
  test("does not exist for a visitor or a member", async ({ page }) => {
    expect((await page.goto("/admin/rulebook"))?.status()).toBe(404);
    await signIn(page, await createAccount("rulebook-member"));
    await expect(page).toHaveURL(/\/studio$/);
    expect((await page.goto("/admin/rulebook"))?.status()).toBe(404);
  });

  test("opens a Why? popover, shows a gap, and saves and confirms a new version", async ({ page }) => {
    const email = await createAccount("rulebook-admin");
    await makePlatformAdmin(email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto("/admin/rulebook");
    await expect(page.getByRole("heading", { name: "Rulebook", exact: true })).toBeVisible();

    // A seeded rule, word for word, marked as a draft.
    const why = page.getByTestId("rule-R-SUB-004").getByRole("button", { name: "Why? Rulebook R-SUB-004" });
    await expect(why).toHaveAttribute("aria-expanded", "false");
    await why.click();
    const popover = page.getByRole("dialog");
    await expect(popover).toContainText("Artwork that crosses a seam can be offset by up to 3 mm after sewing");
    await expect(popover).toContainText("Draft, not yet confirmed by the factory");
    await expect(popover).toContainText("Sublimation practice");
    await expect(why).toHaveAttribute("aria-expanded", "true");
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(why).toBeFocused();

    // An id with no rule shows the gap text and is counted for the team.
    const missing = `R-NONE-${three()}`;
    await page.getByLabel("Rule id to try").fill(missing);
    await page.getByRole("button", { name: `Why? Rulebook ${missing}` }).click();
    await expect(page.getByRole("dialog")).toContainText("No rule written yet; the team has been told");
    await page.reload();
    await expect(page.getByTestId(`gap-${missing}`)).toContainText("met 1 time");

    // A new rule, then a new version of it that leaves the first as it was, then the factory's confirmation.
    const ruleId = `R-ETOE-${three()}`;
    const add = page.getByTestId("rule-editor-new");
    await add.getByLabel("Rule id").fill(ruleId);
    await add.getByLabel("Topic").selectOption("print");
    await add.getByLabel("Applies to").fill("A test of the editor");
    await add.getByLabel("Rule", { exact: true }).fill("First words");
    await add.getByLabel("Why", { exact: true }).fill("Because");
    await add.getByLabel("Best practice").fill("Do it well");
    await add.getByLabel("Source", { exact: true }).selectOption("knitwright");
    await add.getByRole("button", { name: "Add the rule" }).click();
    await expect(add.getByText(`Saved as version 1 of ${ruleId}, a draft.`)).toBeVisible();

    await page.reload();
    const item = page.getByTestId(`rule-${ruleId}`);
    await item.getByText("Edit as a new version").click();
    const edit = page.getByTestId(`rule-editor-${ruleId}`);
    await edit.getByLabel("Rule", { exact: true }).fill("Second words");
    await edit.getByRole("button", { name: "Save as a new version" }).click();
    await expect(edit.getByText(`Saved as version 2 of ${ruleId}, a draft.`)).toBeVisible();

    await page.reload();
    await expect(item).toContainText("version 2");
    await expect(item).toContainText("Second words");
    await item.getByText("Earlier versions (1)").click();
    await expect(item).toContainText("First words");
    await item.getByRole("button", { name: "The factory confirmed version 2" }).click();
    await expect(page.getByTestId(`status-${ruleId}`)).toContainText(`Confirmed by the factory on`);
    await expect(page.getByTestId(`status-${ruleId}`)).toContainText(`recorded by ${email}`);
  });
});
