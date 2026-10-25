import { expect, type Page } from "@playwright/test";
import { createAccount, openTool, signIn, standInForBotCheck, test } from "./support";

/**
 * Plan W4-D (decision 0063): members comment on a design, reply, and resolve; a member of another
 * brand cannot see any of it.
 */

const startDesign = async (page: Page, name: string): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Crew neck tee" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop() ?? "";
};

test.describe("design comments (W4-D)", () => {
  test("comment on a panel, reply, resolve, and a member of another brand sees nothing", async ({ page, browser }) => {
    await signIn(page, await createAccount("comments-owner", { brand: "Comment Club" }));
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startDesign(page, "Comments test");

    await openTool(page, "Comments");
    const panel = page.getByTestId("comments-panel");
    await expect(panel.getByTestId("comments-mentions")).toHaveText("No open comments name you.");

    // A new comment about the first panel offered. Markup stays text.
    await panel.getByLabel("New comment on version 1").fill("The <b>crest</b> sits low.");
    const about = panel.getByLabel("About");
    await about.selectOption({ index: 1 });
    const panelName = (await about.locator("option:checked").textContent()) ?? "";
    await panel.getByRole("button", { name: "Comment", exact: true }).click();

    const thread = panel.getByTestId("comment-thread");
    await expect(thread).toHaveCount(1);
    await expect(thread.getByTestId("comment-anchor")).toHaveText(`Version 1, ${panelName}`);
    await expect(thread.getByTestId("comment").first()).toContainText("The <b>crest</b> sits low.");

    // A reply stays in the same thread.
    await thread.getByLabel("Reply").fill("Moved it up 2 cm.");
    await thread.getByRole("button", { name: "Send reply" }).click();
    await expect(thread.getByTestId("comment")).toHaveCount(2);
    await expect(thread).toContainText("Moved it up 2 cm.");

    // The author changes their words within the window.
    await thread.getByTestId("comment").first().getByRole("button", { name: "Change" }).click();
    await thread.getByLabel("Your words").fill("The crest sits too low.");
    await thread.getByRole("button", { name: "Save", exact: true }).click();
    await expect(thread.getByTestId("comment").first()).toContainText("The crest sits too low.");
    await expect(thread.getByTestId("comment").first()).toContainText("changed");

    // Another brand's member: the design does not exist for them, and the API says so.
    const other = await browser.newContext();
    await standInForBotCheck(other);
    // Its own address, so its rate limits are not shared with other tests.
    await other.setExtraHTTPHeaders({ "x-real-ip": `10.251.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}` });
    const stranger = await other.newPage();
    await signIn(stranger, await createAccount("comments-stranger", { brand: "Other Club" }));
    await expect(stranger).toHaveURL(/\/studio$/);
    const url = `/api/projects/${projectId}/comments`;
    const read = await stranger.request.get(url);
    expect(read.status()).toBe(404);
    expect(JSON.stringify(await read.json())).not.toContain("crest");
    const write = await stranger.request.post(url, { data: { body: "Hello", version: 1 } });
    expect(write.status()).toBe(404);
    await other.close();

    // Resolve: the thread leaves the open list and is found under Resolved; open it again.
    await thread.getByRole("button", { name: "Mark resolved" }).click();
    await expect(panel.getByTestId("comment-thread")).toHaveCount(0);
    await panel.getByRole("button", { name: "Resolved", exact: true }).click();
    await expect(panel.getByTestId("comment-thread")).toHaveCount(1);
    await expect(panel.getByTestId("comment-anchor")).toContainText("Resolved");
    await panel.getByRole("button", { name: "Open again" }).click();
    await panel.getByRole("button", { name: "Open", exact: true }).click();
    await expect(panel.getByTestId("comment-thread")).toHaveCount(1);
  });

  test("a call with no session is refused", async ({ request }) => {
    const response = await request.get("/api/projects/6f1c2f0e-7a53-4a6f-9d63-2f6f9a3c8b11/comments");
    expect(response.status()).toBe(401);
  });
});
