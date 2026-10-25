import { expect, type Page } from "@playwright/test";
import { createAccount, signIn, standInForBotCheck, test } from "./support";

/**
 * Plan W3-A: studio renders of a design version through the API with the built-in renderer (no model is called). Pictures
 * are watermarked until the set is unlocked; the clean bytes are served only after.
 */

const startJersey = async (page: Page): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Team jersey" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill("Media test");
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Media test" })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop() ?? "";
};

type SetView = { id: string; status: string; unlocked: boolean; items: { id: string; view: string; watermarked: boolean; href: string | null }[] };

const waitForSet = async (page: Page, url: string): Promise<SetView> => {
  let set: SetView | null = null;
  await expect
    .poll(
      async () => {
        const body = await (await page.request.get(url)).json();
        set = body.data.set;
        return set?.status;
      },
      { timeout: 45_000 },
    )
    .toBe("succeeded");
  if (!set) throw new Error("No set");
  return set;
};

test.describe("media sets (W3-A)", () => {
  test("makes front, back and flat lay, serves them watermarked, then clean after the unlock", async ({ page }) => {
    await signIn(page, await createAccount("media", { brand: "Media Rovers" }));
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startJersey(page);
    const url = `/api/projects/${projectId}/media`;

    const started = await (await page.request.post(url, { data: {} })).json();
    expect(started).toMatchObject({ success: true, data: { created: true } });
    const again = await (await page.request.post(url, { data: {} })).json();
    expect(again.data).toMatchObject({ created: false });
    expect(again.data.set.id).toBe(started.data.set.id);

    const set = await waitForSet(page, url);
    expect(set.items.map((item) => item.view)).toEqual(["front", "back", "flat_lay"]);
    expect(set.unlocked).toBe(false);
    expect(set.items.every((item) => item.watermarked)).toBe(true);
    expect(JSON.stringify(set)).not.toContain("_private");

    const before: Buffer[] = [];
    for (const item of set.items) {
      const response = await page.request.get(item.href ?? "");
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
      expect(response.headers()["x-media-watermarked"]).toBe("true");
      before.push(await response.body());
    }

    const unlock = await (await page.request.post(`${url}/${set.id}/unlock`, { data: {} })).json();
    expect(unlock).toMatchObject({ success: true });

    const after = await (await page.request.get(`${url}/${set.id}`)).json();
    expect(after.data.set.unlocked).toBe(true);
    expect(after.data.set.items.every((item: { watermarked: boolean }) => !item.watermarked)).toBe(true);
    for (const [i, item] of set.items.entries()) {
      const response = await page.request.get(item.href ?? "");
      expect(response.headers()["x-media-watermarked"]).toBe("false");
      expect((await response.body()).equals(before[i] ?? Buffer.alloc(0))).toBe(false);
    }
  });

  test("another brand cannot see the set or its pictures", async ({ page, browser }) => {
    await signIn(page, await createAccount("media-owner", { brand: "Media Owners" }));
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startJersey(page);
    const url = `/api/projects/${projectId}/media`;
    await page.request.post(url, { data: {} });
    const set = await waitForSet(page, url);

    const context = await browser.newContext();
    await standInForBotCheck(context);
    const stranger = await context.newPage();
    await signIn(stranger, await createAccount("media-stranger", { brand: "Media Strangers" }));
    await expect(stranger).toHaveURL(/\/studio$/);
    expect((await stranger.request.get(`${url}/${set.id}`)).status()).toBe(404);
    expect((await stranger.request.get(set.items[0]?.href ?? "")).status()).toBe(404);
    expect((await stranger.request.post(`${url}/${set.id}/unlock`, { data: {} })).status()).not.toBe(200);
    await context.close();
  });
});
