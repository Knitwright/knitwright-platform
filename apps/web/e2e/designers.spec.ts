import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { seedTemplates } from "../lib/templates/seed/seed";
import { createAccount, makePlatformAdmin, signIn, test } from "./support";

/**
 * Workstream W4-B acceptance (decision 0061): a person becomes a designer, offers a design with a rights statement, a
 * platform admin accepts it, and the template appears in the library with the designer's name. The admin page does not
 * exist for anyone else. The ledger and its rules are held by tests/integration/designers.test.ts. Needs `pnpm db:start`.
 */

const serviceClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const TITLE = `E2E designer hoops ${Math.random().toString(36).slice(2, 8)}`;

test.beforeAll(async () => {
  await seedTemplates(serviceClient());
});

// Other specs count the library, so the template this one makes is removed again.
test.afterAll(async () => {
  await serviceClient().from("templates").delete().eq("title", TITLE);
});

test.describe.configure({ mode: "serial" });

test.describe("designer templates", () => {
  test("a designer offers a design, an admin accepts it, and the library shows the designer's name", async ({ page, browser }) => {
    await signIn(page, await createAccount("designer-e2e"));
    await expect(page).toHaveURL(/\/studio$/);

    await page.goto("/designer");
    await expect(page.getByRole("heading", { level: 1, name: "Designer" })).toBeVisible();
    await page.getByLabel("Name to show on your templates").fill("Ada E2E");
    await page.getByRole("button", { name: "Become a designer" }).click();
    // The page redraws as the designer's own page once they have opted in.
    await expect(page.getByRole("heading", { name: "Your submissions" })).toBeVisible();

    // A design to offer: a copy of a starter template.
    await page.goto("/templates?sport=football&article=team-jersey");
    await page.getByRole("button", { name: "Use this template: Navy and gold hoops" }).click();
    await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);

    await page.goto("/designer/new");
    await page.getByLabel("Design to offer").selectOption({ label: "Navy and gold hoops" });
    await page.getByLabel("Template title").fill(TITLE);
    await page.getByLabel("Sport").selectOption("football");
    await page.getByLabel("Style").selectOption("hoops");
    await page.getByLabel("Main colour").selectOption("blue");
    await page.getByRole("button", { name: "Save as a draft" }).click();
    await expect(page.getByText("Saved as a draft.")).toBeVisible();

    await page.goto("/designer");
    await expect(page.getByText("No royalty rate is set yet, so nothing accrues.")).toBeVisible();
    const entry = page.getByTestId("submission").filter({ hasText: TITLE });
    await expect(entry).toContainText("Draft, not sent yet");
    await entry.getByRole("button", { name: `Send for review: ${TITLE}` }).click();
    await expect(entry.getByText("Tick the box to say you hold the rights")).toBeVisible();
    await entry.getByLabel(/I hold the rights to every artwork/).check();
    await entry.getByRole("button", { name: `Send for review: ${TITLE}` }).click();
    // The page redraws with the submission waiting for review, and no send form.
    await expect(entry).toContainText("Waiting for Knitwright to review");

    // The admin side, in its own session.
    const adminPage = await (await browser.newContext()).newPage();
    const adminEmail = await createAccount("designer-e2e-admin");
    await makePlatformAdmin(adminEmail);
    await signIn(adminPage, adminEmail);
    await expect(adminPage).toHaveURL(/\/studio$/);
    await adminPage.goto("/admin/templates");
    const queued = adminPage.getByTestId("queue-entry").filter({ hasText: TITLE });
    await expect(queued).toContainText("By Ada E2E");
    await expect(queued).toContainText("Rights statement made");
    await queued.getByRole("button", { name: `Accept: ${TITLE}` }).click();
    // The page redraws without it in the queue, and lists it as decided, in words.
    await expect(queued).toHaveCount(0);
    await expect(adminPage.getByTestId("decided-entry").filter({ hasText: TITLE })).toContainText("Live in the template library");

    await page.goto("/templates?sport=football&article=team-jersey");
    const card = page.getByRole("list", { name: "Templates" }).getByRole("listitem").filter({ hasText: TITLE });
    await expect(card).toContainText("By Ada E2E, not reviewed by a factory");

    await page.goto("/designer");
    await expect(page.getByTestId("submission").filter({ hasText: TITLE })).toContainText("Live in the template library");
  });

  test("the review page does not exist for a visitor or a member", async ({ page }) => {
    expect((await page.goto("/admin/templates"))?.status()).toBe(404);
    await signIn(page, await createAccount("designer-e2e-member"));
    await expect(page).toHaveURL(/\/studio$/);
    expect((await page.goto("/admin/templates"))?.status()).toBe(404);
  });
});
