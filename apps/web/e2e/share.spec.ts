import { expect, type Page } from "@playwright/test";
import { createAccount, passBotCheck, signIn, standInForBotCheck, test } from "./support";

/**
 * Decision 0026: a member shares one version of a design with their committee. Someone with the
 * link and no account sees the drawings, votes and comments; the member sees the tally; once the
 * link is revoked it is a page that does not exist.
 */

const startDesign = async (page: Page, name: string): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

test.describe("sharing a design with a committee", () => {
  test("make a link, answer it without an account, see the tally, revoke it", async ({ page, browser }) => {
    await signIn(page, await createAccount("share-owner", { brand: "Northside Hockey Club" }));
    await expect(page).toHaveURL(/\/studio$/);
    await startDesign(page, "Home kit 2027");

    const panel = page.getByRole("region", { name: "Share with your committee" });
    await panel.getByLabel("Link works for").selectOption("7");
    await panel.getByRole("button", { name: "Make a share link" }).click();
    const address = await panel.getByTestId("share-link-address").inputValue();
    expect(address).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);
    await expect(panel.getByTestId("share-link")).toHaveCount(1);
    await expect(panel.getByTestId("share-tally")).toHaveText("No votes yet.");

    // A committee member: a new browser with no session.
    const visitor = await browser.newContext();
    await standInForBotCheck(visitor);
    // Its own address, so its rate limits are not shared with other tests.
    await visitor.setExtraHTTPHeaders({ "x-real-ip": `10.250.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}` });
    const guest = await visitor.newPage();
    const response = await guest.goto(address);
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(guest.getByTestId("share-design-name")).toHaveText("Home kit 2027");
    await expect(guest.getByText("Northside Hockey Club shared this design with you")).toBeVisible();
    await expect(guest.getByTestId("share-flat-front")).toBeVisible();
    await expect(guest.getByTestId("share-flat-back")).toBeVisible();
    await expect(guest.getByText("Measurement table")).toHaveCount(0);
    await expect(guest.getByLabel(/email/i)).toHaveCount(0);

    await guest.getByLabel("Your name").fill("Sam");
    await guest.getByLabel("Yes, I like it").check();
    await guest.getByLabel("Comment (optional)").fill("<b>Navy</b> sleeves please.");
    await passBotCheck(guest);
    await guest.getByRole("button", { name: "Send my answer" }).click();
    await expect(guest.getByText("Your answer is saved.")).toBeVisible();

    // The same browser changes its mind: the vote is replaced, not added.
    await guest.reload();
    await guest.getByLabel("Your name").fill("Sam");
    await guest.getByLabel("Not yet").check();
    await passBotCheck(guest);
    await guest.getByRole("button", { name: "Send my answer" }).click();
    await expect(guest.getByText("Your answer is saved.")).toBeVisible();

    await page.reload();
    await expect(panel.getByTestId("share-tally")).toHaveText("0 yes, 1 not yet.");
    // Shown as typed, never as markup.
    await expect(panel.getByText("<b>Navy</b> sleeves please.")).toBeVisible();

    await panel.getByRole("button", { name: "Revoke" }).click();
    await expect(panel.getByTestId("share-link")).toHaveAttribute("data-state", "revoked");

    const gone = await guest.goto(address);
    expect(gone?.status()).toBe(404);
    await expect(guest.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await visitor.close();
  });

  test("a made-up link is the page that does not exist", async ({ page }) => {
    const response = await page.goto(`/s/${"A".repeat(43)}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
