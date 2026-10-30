import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, standInForBotCheck, test } from "./support";

/**
 * The Share popover of spec F-S4 (plan v5 Y8, decision 0081): invite by email with Can view / Can
 * comment / Can edit and a message, a People-with-access list, and a link that is either "Only
 * invited people" or "Anyone with the link can view".
 *
 * No email is sent: the deploy has no email provider, so the panel says so and shows the invite's
 * one-time link for the member to send themselves.
 */

const startDesign = async (page: Page, name: string): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

test.describe("inviting someone to a design", () => {
  test("invite by email, read the access list, open the invite, and close the link to everyone else", async ({ page, browser }) => {
    // The address is unique per run: CI retries once, and a retry must not find its own leftover row.
    const chair = `chair-${Date.now()}-${Math.floor(Math.random() * 100000)}@northside.test`;
    await signIn(page, await createAccount("invite-owner", { brand: "Northside Hockey Club" }));
    await expect(page).toHaveURL(/\/studio$/);
    await startDesign(page, "Away kit 2027");

    await page.getByRole("link", { name: "Share", exact: true }).click();
    await expect(page).toHaveURL(/\?tool=share$/);
    const panel = page.getByRole("region", { name: "Share with your committee" });

    // Nobody is invited yet.
    await expect(panel.getByTestId("share-access-empty")).toBeVisible();

    await panel.getByLabel("Invite by email").fill(chair);
    await panel.getByLabel("They can").selectOption("comment");
    await expect(panel.getByTestId("share-access-note")).toContainText("leave a vote and a comment");
    await panel.getByLabel("Message (optional)").fill("Have a look at the sleeves.");
    await panel.getByRole("button", { name: "Send the invite" }).click();

    // No email provider is set up, so the panel says so and hands over the link.
    const made = panel.getByTestId("share-invite-made");
    await expect(made).toContainText("we have not emailed anyone");
    const inviteAddress = await panel.getByTestId("share-invite-address").inputValue();
    expect(inviteAddress).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);

    const row = panel.getByTestId("share-access-row").filter({ hasText: chair });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Can comment");
    await expect(row).toContainText("We have not emailed them.");
    await expect(row).toHaveAttribute("data-state", "open");

    // The invited person opens the design. They see it, and no answer box: an invite is not
    // answered through (decision 0081).
    const visitor = await browser.newContext();
    await standInForBotCheck(visitor);
    await visitor.setExtraHTTPHeaders({ "x-real-ip": `10.251.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}` });
    const guest = await visitor.newPage();
    await guest.goto(inviteAddress);
    await expect(guest.getByTestId("share-design-name")).toHaveText("Away kit 2027");
    await expect(guest.getByTestId("share-invite-note")).toContainText("invited you to this design");
    await expect(guest.getByRole("heading", { name: "What do you think?" })).toHaveCount(0);

    // A link of this design, set to "Only invited people", opens nothing at all.
    await panel.getByLabel("Link works for").selectOption("7");
    await panel.getByRole("button", { name: "Make a share link" }).click();
    const linkAddress = await panel.getByTestId("share-link-address").inputValue();
    await expect(panel.getByTestId("share-link-audience")).toHaveAttribute("data-audience", "anyone");
    expect((await guest.goto(linkAddress))?.status()).toBe(200);

    await panel.getByRole("button", { name: "Change to only invited people" }).click();
    await expect(panel.getByTestId("share-link-audience")).toHaveAttribute("data-audience", "invited");
    expect((await guest.goto(linkAddress))?.status()).toBe(404);
    // The invite still works: it is that one person's own.
    expect((await guest.goto(inviteAddress))?.status()).toBe(200);

    // Withdrawing the invite closes the design to them too.
    await page.reload();
    await panel.getByTestId("share-access-row").filter({ hasText: chair }).getByRole("button", { name: `Withdraw the invite to ${chair}` }).click();
    await expect(panel.getByTestId("share-access-row").filter({ hasText: chair })).toHaveAttribute("data-state", "revoked");
    expect((await guest.goto(inviteAddress))?.status()).toBe(404);
    await visitor.close();
  });

  test("inviting the same address again changes that invite rather than adding a second row", async ({ page }) => {
    const chair = `chair-${Date.now()}-${Math.floor(Math.random() * 100000)}@northside.test`;
    await signIn(page, await createAccount("invite-again", { brand: "Eastside Netball" }));
    await expect(page).toHaveURL(/\/studio$/);
    await startDesign(page, "Training top 2027");
    await page.getByRole("link", { name: "Share", exact: true }).click();
    await expect(page).toHaveURL(/\?tool=share$/);
    const panel = page.getByRole("region", { name: "Share with your committee" });

    await panel.getByLabel("Invite by email").fill(chair);
    await panel.getByRole("button", { name: "Send the invite" }).click();
    await expect(panel.getByTestId("share-access-row").filter({ hasText: chair })).toContainText("Can view");

    await panel.getByLabel("Invite by email").fill(chair.toUpperCase());
    await panel.getByLabel("They can").selectOption("edit");
    await panel.getByRole("button", { name: "Send the invite" }).click();

    const rows = panel.getByTestId("share-access-row").filter({ hasText: chair });
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Can edit");
    // The invite kept its own token, so the link already sent still works and is not shown again.
    await expect(panel.getByTestId("share-invite-address")).toHaveCount(0);
    await expect(panel.getByTestId("share-invite-made")).toContainText("its own link still works");
  });

  test("refuses an address that is not one, and says so on the field", async ({ page }) => {
    await signIn(page, await createAccount("invite-bad", { brand: "Westside Rugby" }));
    await expect(page).toHaveURL(/\/studio$/);
    await startDesign(page, "Match shirt 2027");
    await page.getByRole("link", { name: "Share", exact: true }).click();
    await expect(page).toHaveURL(/\?tool=share$/);
    const panel = page.getByRole("region", { name: "Share with your committee" });

    await panel.getByLabel("Invite by email").fill("chair");
    await panel.getByRole("button", { name: "Send the invite" }).click();

    await expect(panel.getByText("Enter an email address.")).toBeVisible();
    await expect(panel.getByTestId("share-access-empty")).toBeVisible();
  });
});
