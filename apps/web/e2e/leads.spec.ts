import { expect, type Page } from "@playwright/test";
import { createAccount, makePlatformAdmin, signIn, test } from "./support";

/**
 * Decision 0024, the lead engine: the guided start asks which path fits first; a saved design
 * asks for the organisation details without blocking; a member requests a quote; the leads page
 * is a page that does not exist for everyone but a platform admin.
 */

const signedIn = async (page: Page, label: string): Promise<string> => {
  const email = await createAccount(label);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/studio$/);
  return email;
};

/** A date this many days from today, as a date field takes it. */
const inDays = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const newDesign = async (page: Page): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill("Home shirt");
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
};

test.describe("the lead engine", () => {
  test("asks which path fits before a guided design starts", async ({ page }) => {
    await signedIn(page, "leads-path");
    await page.goto("/studio/start");
    await page.getByRole("button", { name: "Start from a picture" }).click();
    await expect(page.getByText("Choose which path fits you first.")).toBeVisible();

    await page.getByRole("radio", { name: /Team kit/ }).check();
    await page.getByRole("button", { name: "Start from a picture" }).click();
    await expect(page).toHaveURL(/\/guide\?step=start&from=sketch/);
  });

  test("keeps the garment and wearer when the path is still to be chosen", async ({ page }) => {
    await signedIn(page, "leads-kept");
    await page.goto("/studio/start");
    await page.getByLabel("Garment type").selectOption({ label: "Team jersey" });
    await page.getByLabel("Made for").selectOption({ label: "Men" });
    await page.getByRole("button", { name: "Start from this garment" }).click();
    await expect(page.getByText("Choose which path fits you first.")).toBeVisible();
    await expect(page.getByLabel("Garment type")).toHaveValue("team-jersey");
    await expect(page.getByLabel("Made for")).toHaveValue("men");

    await page.getByRole("radio", { name: /Team kit/ }).check();
    await page.getByRole("button", { name: "Start from this garment" }).click();
    await expect(page).toHaveURL(/\/guide\?step=start&from=picker/);
  });

  test("asks for the organisation once a design is saved, and lets a member request a quote", async ({ page }) => {
    await signedIn(page, "leads-quote");
    const design = await newDesign(page);

    const prompt = page.getByRole("region", { name: "Your design is saved. Who is it for?" });
    await expect(prompt).toBeVisible();
    await prompt.getByLabel("Type of organisation").selectOption({ label: "Club" });
    await prompt.getByLabel("Country").selectOption({ label: "Australia" });
    await prompt.getByLabel("State or territory").selectOption({ label: "Victoria" });
    await prompt.getByRole("button", { name: "Save organisation details" }).click();
    await expect(prompt.getByText("Thank you. The details are saved.")).toBeVisible();

    const quote = page.getByTestId("quote-request");
    await quote.getByRole("button", { name: "Request a quote" }).click();
    await quote.getByLabel("How many pieces?").fill("0");
    await quote.getByLabel("Needed by").fill(inDays(30));
    await quote.getByRole("button", { name: "Send request" }).click();
    await expect(quote.getByText("Enter a whole number from 1.")).toBeVisible();

    await quote.getByLabel("How many pieces?").fill("120");
    await quote.getByLabel("Sizes").fill("10 S, 50 M, 60 L");
    await quote.getByRole("button", { name: "Send request" }).click();
    await expect(quote.getByText("The Knitwright team will reply by email.")).toBeVisible();
    await expect(quote.getByText(/Asked: 120 pieces/)).toBeVisible();

    // The prompt is not shown again once the details are given.
    await page.goto(design);
    await expect(page.getByRole("region", { name: "Your design is saved. Who is it for?" })).toHaveCount(0);
    await expect(page.getByTestId("quote-request").getByText(/Waiting for a reply/)).toBeVisible();
  });

  test("shows the leads page to nobody but a platform admin", async ({ page }) => {
    const signedOut = await page.goto("/admin/leads");
    expect(signedOut?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

    const email = await signedIn(page, "leads-member");
    const member = await page.goto("/admin/leads");
    expect(member?.status()).toBe(404);

    await makePlatformAdmin(email);
    const admin = await page.goto("/admin/leads");
    expect(admin?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Leads" })).toBeVisible();
    await expect(page.getByTestId("lead").first()).toBeVisible();
  });
});
