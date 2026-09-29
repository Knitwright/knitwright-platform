import { expect, type APIResponse, type Page } from "@playwright/test";
import sharp from "sharp";
import { createAccount, signIn, summary, test } from "./support";

const logo = () =>
  sharp({ create: { width: 64, height: 32, channels: 4, background: "#2b46f0" } })
    .png()
    .toBuffer();

const upload = async (page: Page, file: Buffer, type = "image/png"): Promise<APIResponse> =>
  page.request.post("/api/files", {
    multipart: { kind: "artwork", file: { name: "logo.png", mimeType: type, buffer: file } },
  });

const signedIn = async (page: Page, label: string, brand?: string | null): Promise<string> => {
  const email = await createAccount(label, { brand });
  await signIn(page, email);
  await expect(page).toHaveURL(brand === null ? /\/welcome$/ : /\/studio$/);
  return email;
};

test.describe("brands", () => {
  test("someone with no brand is asked to name one, wherever they try to go", async ({ page }) => {
    await signedIn(page, "no-brand", null);

    await page.goto("/brands");
    await expect(page).toHaveURL(/\/welcome$/);

    await page.getByLabel("Brand name").fill("Harbour Rowing Club");
    await page.getByRole("button", { name: "Create brand" }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.getByTestId("active-brand")).toHaveText("Harbour Rowing Club");
  });

  test("someone who has a brand is not shown the welcome page again", async ({ page }) => {
    await signedIn(page, "has-brand");

    await page.goto("/welcome");

    await expect(page).toHaveURL(/\/studio$/);
  });

  test("a brand name that is empty is refused beside the field", async ({ page }) => {
    await signedIn(page, "empty-name", null);

    await page.getByLabel("Brand name").fill("   ");
    await page.getByRole("button", { name: "Create brand" }).click();

    await expect(page.getByText("A brand name has 1 to 80 characters.")).toBeVisible();
    await expect(page.getByLabel("Brand name")).toBeFocused();
    await expect(page).toHaveURL(/\/welcome$/);
  });

  test("a brand is renamed, a second is added, and the user moves between them", async ({
    page,
  }) => {
    await signedIn(page, "two-brands", "First Eleven");
    await page.goto("/brands");

    await page.getByLabel("Brand name").fill("First Eleven FC");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("The name is saved.")).toBeVisible();
    await expect(page.getByTestId("active-brand")).toHaveText("First Eleven FC");

    // The form draws again while it saves. That must not send focus back to the message.
    const nameField = page.getByLabel("Brand name");
    await nameField.click();
    await page.keyboard.type("!");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("active-brand")).toHaveText("First Eleven FC!");
    await expect(page.getByRole("button", { name: "Save name" })).toBeEnabled();
    await expect(nameField).toBeFocused();
    await expect(nameField).toHaveValue("First Eleven FC!");

    await page.getByLabel("Name of the new brand").fill("Second String");
    await page.getByRole("button", { name: "Create brand" }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.getByTestId("active-brand")).toHaveText("Second String");

    await page.goto("/brands");
    await page.getByRole("button", { name: "Work in this brand: First Eleven FC!" }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.getByTestId("active-brand")).toHaveText("First Eleven FC!");
  });

  test("the brand link in the header says what it is and where it goes", async ({ page }) => {
    await signedIn(page, "link-name", "Harbour Rowing Club");

    await expect(page.getByRole("link", { name: "Brand: Harbour Rowing Club. Change brand." })).toBeVisible();
    await expect(page.getByTestId("active-brand")).toHaveText("Harbour Rowing Club");
  });

  test("a fourth brand is not offered", async ({ page }) => {
    await signedIn(page, "three-brands", "One");
    for (const name of ["Two", "Three"]) {
      await page.goto("/brands");
      await page.getByLabel("Name of the new brand").fill(name);
      await page.getByRole("button", { name: "Create brand" }).click();
      await expect(page).toHaveURL(/\/studio$/);
    }

    await page.goto("/brands");

    await expect(page.getByText("You have 3 brands")).toBeVisible();
    await expect(page.getByLabel("Name of the new brand")).toHaveCount(0);
  });

  test("a cookie naming a brand the user does not belong to opens nothing", async ({
    page,
    context,
    baseURL,
  }) => {
    await signedIn(page, "cookie", "Mine");
    await context.addCookies([
      { name: "kw-brand", value: "00000000-0000-4000-8000-000000000000", url: baseURL },
    ]);

    await page.goto("/studio");

    await expect(page.getByTestId("active-brand")).toHaveText("Mine");
  });
});

test.describe("files", () => {
  test("a member uploads an image and reads it back through a short-lived link", async ({
    page,
  }) => {
    await signedIn(page, "uploader");

    const stored = await upload(page, await logo());
    expect(stored.status()).toBe(200);
    const { data: file } = await stored.json();
    expect(file).toMatchObject({ kind: "artwork", contentType: "image/png", width: 64 });

    const linked = await page.request.get(`/api/files/${file.id}/link`);
    expect(linked.status()).toBe(200);
    const { data: link } = await linked.json();
    expect(link.expiresInSeconds).toBe(60);

    const image = await page.request.get(link.url);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
  });

  test("a member of another brand gets no link to the file", async ({ page, browser }) => {
    await signedIn(page, "owner-of-file");
    const { data: file } = await (await upload(page, await logo())).json();

    const other = await browser.newContext();
    try {
      const stranger = await other.newPage();
      await stranger.setExtraHTTPHeaders({ "x-real-ip": "10.99.0.1" });
      await signIn(stranger, await createAccount("stranger"));
      await expect(stranger).toHaveURL(/\/studio$/);

      const refused = await stranger.request.get(`/api/files/${file.id}/link`);

      expect(refused.status()).toBe(404);
      expect(await refused.json()).toEqual({
        success: false,
        error: { code: "not_found", message: "That file does not exist." },
      });
    } finally {
      await other.close();
    }
  });

  test("a file that is not an image is refused in plain words", async ({ page }) => {
    await signedIn(page, "svg");
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

    const refused = await upload(page, svg, "image/svg+xml");

    expect(refused.status()).toBe(400);
    expect((await refused.json()).error.message).toBe("Upload a PNG, JPEG or WebP image.");
  });

  test("a file over the size limit is refused", async ({ page }) => {
    await signedIn(page, "too-big");

    const refused = await upload(page, Buffer.alloc(9 * 1024 * 1024, 1));

    expect(refused.status()).toBe(413);
  });

  test("someone with no brand cannot upload", async ({ page }) => {
    await signedIn(page, "no-brand-upload", null);

    const refused = await upload(page, await logo());

    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.code).toBe("no_brand");
  });
});

test("a form failure still shows in the summary", async ({ page }) => {
  // Two brands cannot be told apart by the summary test above, so this checks it alone.
  await signedIn(page, "summary", null);

  await page.getByLabel("Brand name").fill("   ");
  await page.getByRole("button", { name: "Create brand" }).click();

  await expect(summary(page)).toContainText("Some fields need another look.");
});
