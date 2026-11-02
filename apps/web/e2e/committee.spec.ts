import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createAccount, passBotCheck, signIn, standInForBotCheck, test } from "./support";

/**
 * Committee link v2 (spec F-T3, plan v5 Z7, decision 0086).
 *
 * The acceptance test is "works on a phone without login; approval is recorded with name, timestamp
 * and version", so the committee member here is a separate browser context at 390 by 844 with no
 * session at all. The club's own screen is at the desktop size it is used at.
 */

const serviceClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** The design's one version, checked against a profile, which is what locking needs (plan v5 X4). */
const markChecked = async (projectId: string, brandId: string, userId: string): Promise<void> => {
  const { error } = await serviceClient().rpc("set_design_status", {
    p_project_id: projectId,
    p_brand_id: brandId,
    p_user_id: userId,
    p_version: 1,
    p_status: "validated",
    p_profile_id: "knitwright-default",
    p_findings_hash: "d".repeat(64),
  });
  if (error) throw new Error(error.message);
};

/** What the design's one version is now, read with the server's own key. */
const statusOf = async (projectId: string): Promise<string | undefined> => {
  const { data, error } = await serviceClient().from("design_statuses").select("status").eq("project_id", projectId).eq("version", 1).single();
  if (error) throw new Error(error.message);
  return (data as { status: string } | null)?.status;
};

const idsOf = async (email: string): Promise<{ userId: string; brandId: string }> => {
  const admin = serviceClient();
  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw new Error(users.error.message);
  const userId = users.data.users.find((entry) => entry.email === email)?.id;
  if (!userId) throw new Error(`No account for ${email}.`);
  const membership = await admin.from("memberships").select("brand_id").eq("user_id", userId).single();
  if (membership.error) throw new Error(membership.error.message);
  return { userId, brandId: (membership.data as { brand_id: string }).brand_id };
};

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname.split("/")[2] ?? "";
};

const projectOf = (path: string): string => path;

test.describe("sharing a design with a committee", () => {
  test("a committee comments, votes and approves on a phone with no account, then the club locks it", async ({ page, browser }) => {
    // Unique per run, because CI retries a failed browser test once and a locator that filtered on a
    // shared name would find the attempt before it (plan v5 Lesson 11).
    const run = Math.random().toString(36).slice(2, 8);
    const designName = `Committee kit ${run}`;
    const email = await createAccount("committee-owner", { brand: `Committee FC ${run}` });
    await signIn(page, email);
    // signIn only presses the button; the session cookie arrives with the redirect (plan v5 Lessons).
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = projectOf(await startDesign(page, designName));
    const { userId, brandId } = await idsOf(email);
    await markChecked(projectId, brandId, userId);

    // The club makes the link on Collect.
    await page.goto("/collect");
    await expect(page.getByRole("heading", { level: 1, name: "Ask your committee and your squad" })).toBeVisible();
    const design = page.getByRole("listitem").filter({ hasText: designName }).first();
    await expect(design.getByText("No committee link yet. Make one and send it to the people who decide.")).toBeVisible();
    await design.getByRole("button", { name: "Make a committee link" }).click();
    const address = await page.getByTestId("committee-link-address").inputValue();
    expect(address).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);

    // A committee member on a phone, with no session at all.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await standInForBotCheck(phone);
    // Its own address, so its rate limits are not shared with other tests.
    await phone.setExtraHTTPHeaders({ "x-real-ip": `10.251.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}` });
    const guest = await phone.newPage();
    const response = await guest.goto(address);

    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(guest.getByTestId("committee-design-name")).toHaveText(designName);
    await expect(guest.getByTestId("committee-option-A")).toBeVisible();
    await expect(guest.getByTestId("committee-flat-A-front")).toBeVisible();
    await expect(guest.getByTestId("committee-flat-A-back")).toBeVisible();
    // Read only: nothing here changes the design, and the measurement table is not shown.
    await expect(guest.getByText("Measurement table")).toHaveCount(0);
    expect(await guest.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await expect(guest.locator("h1")).toHaveCount(1);
    await expect(guest.locator("main#main")).toBeVisible();

    // The read-only 3D view of the option, loaded only when it is asked for.
    await guest.getByTestId("committee-3d-toggle").click();
    await expect(guest.getByTestId("garment-3d")).toBeVisible();

    // A pin on a point of a panel: pressing the drawing moves the mark.
    await guest.getByRole("group", { name: "Where on it?" }).getByLabel("Top left").check();
    await guest.getByLabel("Which part").selectOption({ index: 1 });
    await guest.getByLabel("Your name").fill("Sam the chair");
    await guest.getByLabel("What would you change?").fill("<b>Navy</b> sleeves please.");
    await passBotCheck(guest.locator("form").filter({ has: guest.getByLabel("What would you change?") }));
    await guest.getByRole("button", { name: "Pin this comment" }).click();
    await expect(guest.getByText("Your comment is pinned.")).toBeVisible();

    // Approve, with a name. One option was shared, so there is nothing to vote between and the page says so.
    await expect(guest.getByText("The club shared one option")).toBeVisible();
    const approve = guest.locator("form").filter({ has: guest.getByRole("button", { name: "Approve" }) });
    await approve.getByLabel("Your name").fill("Dana the treasurer");
    await approve.getByLabel("Your email (optional)").fill("dana@example.test");
    await passBotCheck(approve);
    await approve.getByRole("button", { name: "Approve" }).click();
    await expect(guest.getByText("Your approval is recorded with your name, the time and the option you chose.")).toBeVisible();

    const { violations } = await new AxeBuilder({ page: guest }).analyze();
    const serious = violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical");
    expect(serious.map((entry) => `${entry.id}: ${entry.help}`)).toEqual([]);

    // The club sees the comment and the approval, with who, when and against which version.
    await page.reload();
    const link = page.getByTestId("committee-link").first();
    await expect(link.getByTestId("committee-pin")).toContainText("Navy sleeves please.");
    // Shown as typed, never as markup.
    await expect(link.getByText("<b>Navy</b> sleeves please.")).toBeVisible();
    await expect(link.getByTestId("committee-approvals")).toContainText("Dana the treasurer approved version 1");
    await expect(link.getByTestId("committee-approvals")).toContainText("dana@example.test");

    // The club locks the version the committee approved, which moves it to status approved.
    await page.getByRole("button", { name: "Lock version 1" }).first().click();
    await expect(page.getByTestId("committee-lock")).toContainText("Version 1 is locked");
    expect(await statusOf(projectId)).toBe("approved");

    // The committee, on the link they already hold, is told the choice is made.
    await guest.goto(address);
    await expect(guest.getByTestId("committee-locked-note")).toContainText("already locked version 1");
    await expect(guest.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await phone.close();
  });

  test("a withdrawn link says what happened and who to ask, and still answers 404", async ({ page, browser }) => {
    const run = Math.random().toString(36).slice(2, 8);
    const designName = `Withdrawn kit ${run}`;
    const email = await createAccount("committee-revoker", { brand: `Withdrawn FC ${run}` });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    await startDesign(page, designName);

    await page.goto("/collect");
    const design = page.getByRole("listitem").filter({ hasText: designName }).first();
    await design.getByRole("button", { name: "Make a committee link" }).click();
    const address = await page.getByTestId("committee-link-address").inputValue();

    const visitor = await browser.newContext();
    await standInForBotCheck(visitor);
    await visitor.setExtraHTTPHeaders({ "x-real-ip": `10.253.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}` });
    const guest = await visitor.newPage();
    await guest.goto(address);
    await expect(guest.getByTestId("committee-design-name")).toHaveText(designName);

    await design.getByRole("button", { name: "Withdraw" }).click();
    await expect(page.getByTestId("committee-link").first()).toHaveAttribute("data-state", "closed");

    const gone = await guest.goto(address);
    expect(gone?.status()).toBe(404);
    await expect(guest.getByRole("heading", { level: 1, name: "This link does not work" })).toBeVisible();
    await expect(guest.getByTestId("share-link-closed")).toContainText("Ask the person at the club who sent it to you");
    await visitor.close();
  });

  test("a made-up committee address is a page that does not exist, and explains itself", async ({ page }) => {
    const response = await page.goto(`/s/${"B".repeat(43)}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByTestId("share-link-closed")).toBeVisible();
  });
});
