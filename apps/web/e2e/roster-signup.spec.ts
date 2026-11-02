import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type Page } from "@playwright/test";
import { createAccount, passBotCheck, signIn, standInForBotCheck, test } from "./support";

/**
 * Roster sign-up (spec F-T4, plan v5 Z7, decision 0086).
 *
 * The acceptance test is "a roster of 25 is collected through the sign-up link with zero spreadsheet
 * work". Twenty-five browsers would make the suite minutes longer for nothing, so this collects a
 * squad of three through three separate phone contexts with no session, which is the same path, and
 * the database test covers the limits. The collected-versus-missing grid, the duplicate flag, the
 * WhatsApp chase and the fold into the roster are all checked here.
 */

const makeSeason = async (page: Page, name: string): Promise<void> => {
  await page.goto("/club");
  const seasons = page.getByRole("region", { name: "Seasons and rosters" });
  await seasons.getByLabel("New season").fill(name);
  await seasons.getByRole("button", { name: "Make season" }).click();
  await expect(seasons.getByText("The season is made.")).toBeVisible();
};

/** One player, in their own browser with no session, filling the link in on a phone. */
const fillIn = async (
  browser: Browser,
  address: string,
  answer: Readonly<{ name: string; number: string; size: string; address: string }>,
): Promise<Page> => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await standInForBotCheck(phone);
  // Its own address, so one player's rate limit is not shared with another's.
  await phone.setExtraHTTPHeaders({ "x-real-ip": answer.address });
  const player = await phone.newPage();
  await player.goto(address);
  await player.getByLabel("Name on your shirt").fill(answer.name);
  await player.getByLabel("Your number").fill(answer.number);
  await player.getByLabel("Your size").selectOption(answer.size);
  await passBotCheck(player);
  await player.getByRole("button", { name: "Send my details" }).click();
  await expect(player.getByText("Your club has your shirt name, your number and your size.")).toBeVisible();
  return player;
};

test.describe("collecting a squad's names, numbers and sizes", () => {
  test("a squad fills the link in on their phones, the grid says who is missing, and the club folds it in", async ({ page, browser }) => {
    // Unique per run: CI retries a failed browser test once (plan v5 Lesson 11).
    const run = Math.random().toString(36).slice(2, 8);
    const seasonName = `Season ${run}`;
    const email = await createAccount("signup-manager", { brand: `Signup FC ${run}` });
    await signIn(page, email);
    // signIn only presses the button; the session cookie arrives with the redirect (plan v5 Lessons).
    await expect(page).toHaveURL(/\/studio$/);
    await makeSeason(page, seasonName);

    await page.goto("/collect");
    const season = page.getByRole("listitem").filter({ hasText: seasonName }).first();
    // The empty state names the one action that fills it.
    await expect(season.getByTestId("collect-summary")).toContainText("Paste your squad's names, one per line");

    // Paste the list: three people, one of them listed twice, one line unreadable.
    await season.getByLabel("Your squad, one per line").fill(
      ["Alex Morgan, +441632960001", "ALEX  MORGAN", "Sam Kerr, sam@example.test", "Jordan Nobbs", "@@@"].join("\n"),
    );
    await season.getByRole("button", { name: "Use this list" }).click();
    const pasted = season.getByTestId("signup-paste-result");
    await expect(pasted).toContainText("3 on your list.");
    await expect(pasted).toContainText("Listed twice, kept once: ALEX MORGAN.");
    await expect(pasted).toContainText("Line 5:");
    await expect(season.getByTestId("collect-summary")).toContainText("0 of 3 in, 3 still waiting.");

    // Make the link.
    await season.getByLabel("Sport").selectOption("football");
    await season.getByRole("button", { name: "Make a sign-up link" }).click();
    const address = await page.getByTestId("signup-link-address").inputValue();
    expect(address).toMatch(/\/join\/[A-Za-z0-9_-]{43}$/);

    // Two of the three answer, from their own phones, with no account.
    const first = await fillIn(browser, address, { name: "Alex Morgan", number: "7", size: "M", address: `10.240.${run.length}.11` });
    expect(await first.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await expect(first.locator("h1")).toHaveCount(1);
    const { violations } = await new AxeBuilder({ page: first }).analyze();
    expect(violations.filter((entry) => entry.impact === "serious" || entry.impact === "critical").map((entry) => entry.id)).toEqual([]);
    await first.context().close();

    // The second player takes the same number, which the club is told about rather than refused.
    const second = await fillIn(browser, address, { name: "Sam Kerr", number: "7", size: "L", address: `10.241.${run.length}.12` });
    await second.context().close();

    await page.reload();
    const after = page.getByRole("listitem").filter({ hasText: seasonName }).first();
    await expect(after.getByTestId("collect-summary")).toContainText("2 of 3 in, 1 still waiting.");
    const missing = after.getByTestId("collect-row").filter({ hasText: "Jordan Nobbs" });
    await expect(missing).toHaveAttribute("data-state", "missing");
    await expect(missing).toContainText("Still waiting");
    await expect(after.getByTestId("collect-flag").first()).toContainText("Number 7 is used more than once.");

    // Fold the answers into the season's roster, through the club's own roster writer.
    await after.getByRole("button", { name: "Put the answers in the roster" }).click();
    await expect(after.getByTestId("signup-applied")).toContainText("2 added.");

    await page.goto("/club");
    const seasons = page.getByRole("region", { name: "Seasons and rosters" });
    // The newest season opens by itself, and its roster now holds what the players sent.
    await expect(seasons.getByLabel("Name, player 1")).toHaveValue("Alex Morgan");
    await expect(seasons.getByLabel("Number, player 1")).toHaveValue("7");
    await expect(seasons.getByLabel("Size, player 1")).toHaveValue("M");
    await expect(seasons.getByLabel("Name, player 2")).toHaveValue("Sam Kerr");
  });

  test("a player is refused a number their sport does not allow and a name that will not fit", async ({ page, browser }) => {
    const run = Math.random().toString(36).slice(2, 8);
    const seasonName = `Refused ${run}`;
    const email = await createAccount("signup-refused", { brand: `Refused FC ${run}` });
    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    await makeSeason(page, seasonName);

    await page.goto("/collect");
    const season = page.getByRole("listitem").filter({ hasText: seasonName }).first();
    await season.getByLabel("Sport").selectOption("football");
    await season.getByRole("button", { name: "Make a sign-up link" }).click();
    const address = await page.getByTestId("signup-link-address").inputValue();

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await standInForBotCheck(phone);
    await phone.setExtraHTTPHeaders({ "x-real-ip": `10.242.${run.length}.13` });
    const player = await phone.newPage();
    await player.goto(address);
    await expect(player.getByText("1 to 99. A leading zero is kept, so 07 is printed as 07.")).toBeVisible();

    // The size guide is on the page, beside the field, as F-T4 asks.
    await player.getByTestId("signup-size-guide").locator("summary").click();
    await expect(player.getByTestId("signup-size-guide")).toContainText("The garment, not your body.");

    await player.getByLabel("Name on your shirt").fill("VANDERBERGHESEN");
    await player.getByLabel("Your number").fill("0");
    await player.getByLabel("Your size").selectOption({ index: 1 });
    await passBotCheck(player);
    await player.getByRole("button", { name: "Send my details" }).click();
    // The name field is capped at the zone's length, so the number is what the server refuses.
    await expect(player.getByText("A football number is 1 to 99.")).toBeVisible();
    await phone.close();
  });

  test("a sign-up address that was never a link says what happened and who to ask", async ({ page }) => {
    const response = await page.goto(`/join/${"C".repeat(43)}`);

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "This link does not work" })).toBeVisible();
    await expect(page.getByTestId("signup-link-closed")).toContainText("Ask the person at your club who sent it to you");
  });
});
