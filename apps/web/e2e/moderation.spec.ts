import { expect } from "@playwright/test";
import { createAccount, makePlatformAdmin, passBotCheck, signIn, summary, test } from "./support";

/**
 * Moderation and IP basics (F-G1, decision 0073): a rights holder reports a mark with no account, ops reads the notice and the
 * review queue at /ops/review, a page nobody else has, and decides with a reason. The vision check is the stub here
 * (AI_PROVIDER_STUB), so no model is ever called.
 */

test.describe("the rights-holder report", () => {
  test("takes a report from somebody with no account, and asks for what is missing", async ({ page }) => {
    await page.goto("/report-a-mark");
    await expect(page.getByRole("heading", { level: 1, name: "Report a trademark or copyright" })).toBeVisible();
    await passBotCheck(page);

    await page.getByRole("button", { name: "Send the report" }).click();
    await expect(summary(page)).toBeVisible();
    await expect(page.getByText("Confirm that you own the mark or act for its owner.")).toBeVisible();

    await page.getByLabel("Your name", { exact: true }).fill("Ada Lovelace");
    await page.getByLabel("Email", { exact: true }).fill("ada@example.com");
    await page.getByLabel("Who owns the mark or work", { exact: true }).fill("Example Football Club");
    await page.getByLabel("The mark or work", { exact: true }).fill("Our club crest");
    await page.getByLabel("Where you saw it").fill("A jersey listed as Example FC home shirt");
    await page.getByLabel("Anything else we should know").fill("We have never licensed it.");
    await page.getByRole("checkbox", { name: /I own this mark or work/ }).check();
    await page.getByRole("button", { name: "Send the report" }).click();

    await expect(page.getByText("We have your report.")).toBeVisible();
    await expect(page.getByText("ada@example.com")).toBeVisible();
  });
});

test.describe("the ops review page", () => {
  test("is a page nobody but a platform admin has", async ({ page }) => {
    const signedOut = await page.goto("/ops/review");
    expect(signedOut?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    const email = await createAccount("moderation-member");
    await signIn(page, email);
    const member = await page.goto("/ops/review");
    expect(member?.status()).toBe(404);

    await makePlatformAdmin(email);
    const admin = await page.goto("/ops/review");
    expect(admin?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Review" })).toBeVisible();
  });

  test("shows a notice a rights holder sent, and ops upholds or rejects it with a reason", async ({ page }) => {
    await page.goto("/report-a-mark");
    await passBotCheck(page);
    await page.getByLabel("Your name", { exact: true }).fill("Grace Hopper");
    await page.getByLabel("Email", { exact: true }).fill("grace@example.com");
    await page.getByLabel("Who owns the mark or work", { exact: true }).fill("Example Rugby Union");
    await page.getByLabel("The mark or work", { exact: true }).fill("The union badge");
    await page.getByLabel("Where you saw it").fill("A training top");
    await page.getByRole("checkbox", { name: /I own this mark or work/ }).check();
    await page.getByRole("button", { name: "Send the report" }).click();
    await expect(page.getByText("We have your report.")).toBeVisible();

    const email = await createAccount("moderation-ops");
    await makePlatformAdmin(email);
    await signIn(page, email);
    await page.goto("/ops/review");

    const notice = page.getByTestId("takedown-notice").filter({ hasText: "The union badge" }).first();
    await expect(notice).toBeVisible();
    await expect(notice.getByText("Example Rugby Union")).toBeVisible();

    await notice.getByLabel("Reason", { exact: true }).fill("The reporter could not show they own it.");
    await notice.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByTestId("takedown-notice").filter({ hasText: "The union badge" }).first().getByText("rejected")).toBeVisible();
  });

  test("adds a mark to the registry by name and switches it off again", async ({ page }) => {
    const email = await createAccount("moderation-marks");
    await makePlatformAdmin(email);
    await signIn(page, email);
    await page.goto("/ops/review");

    const name = `Example Mark ${Date.now()}`;
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Add mark" }) });
    await form.getByLabel("Owner", { exact: true }).fill("Example Holdings Ltd");
    await form.getByLabel("Mark (name)", { exact: true }).fill(name);
    await form.getByRole("button", { name: "Add mark" }).click();

    const row = page.getByRole("listitem").filter({ hasText: name }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Switch off" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: name }).first().getByRole("button", { name: "Switch on" })).toBeVisible();
  });
});
