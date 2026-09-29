import { expect, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { createAccount, signIn, test } from "./support";

/**
 * Plan step 7: the drawing in the editor. It is drawn on the server and shown as a
 * picture. It must follow the options, the measurements, the colours and the artwork.
 */

const NOT_TO_SCALE = "Not to scale. Some measurements are missing.";

const signedIn = async (page: Page, label: string): Promise<void> => {
  await signIn(page, await createAccount(label));
  await expect(page).toHaveURL(/\/studio$/);
};

const startDesign = async (page: Page, type: string, name = "Flat test"): Promise<void> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: type });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill(name);
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

const saved = (page: Page, version: number) =>
  expect(page.getByTestId("save-status")).toHaveText(`Saved as version ${version}.`);

const front = (page: Page): Locator => page.getByTestId("flat-front");

const source = async (page: Page): Promise<string> => (await front(page).getAttribute("src")) ?? "";

/** The drawing's SVG text, decoded from the address the page shows it with. */
const svgOf = async (page: Page): Promise<string> => {
  const src = await source(page);
  return decodeURIComponent(src.slice(src.indexOf(",") + 1));
};

const MEASUREMENTS: readonly [string, string][] = [
  ["Chest width", "48"],
  ["Body length", "70"],
  ["Shoulder width", "46"],
  ["Sleeve length", "22"],
  ["Armhole", "23"],
  ["Upper arm", "19"],
  ["Sleeve opening", "17"],
  ["Hem width", "52"],
  ["Neck width", "18"],
  ["Front neck drop", "8.5"],
  ["Back neck drop", "2"],
];

const logo = (): Promise<Buffer> =>
  sharp({ create: { width: 120, height: 60, channels: 3, background: "#cc3300" } }).png().toBuffer();

test.describe("the drawing", () => {
  test("a new crew tee is drawn from proportions and marked not to scale, until every measurement is typed", async ({ page }) => {
    await signedIn(page, "flat-scale");
    await startDesign(page, "Crew neck tee");

    await expect(front(page)).toBeVisible();
    await expect(page.getByTestId("flat-back")).toBeVisible();
    await expect(front(page)).toHaveAttribute("alt", /^Front view\. Crew neck tee for women\./);
    await expect(page.getByTestId("flat-notice")).toContainText(NOT_TO_SCALE);
    await expect(page.getByTestId("flat-notice")).toContainText("Chest width");
    expect(await svgOf(page)).not.toMatch(/\d\.\d cm/);

    await page.getByLabel("Sizes, smallest first").fill("S, M, L");
    await page.getByLabel("Base size").selectOption("M");
    await page.getByRole("button", { name: "Save sizes" }).click();
    await saved(page, 2);

    let version = 2;
    for (const [label, value] of MEASUREMENTS) {
      const before = await source(page);
      const field = page.getByLabel(`${label} in centimetres`);
      await field.fill(value);
      await field.press("Enter");
      version += 1;
      await saved(page, version);
      if (label === "Chest width") await expect.poll(() => source(page)).not.toBe(before);
    }

    await expect(page.getByTestId("flat-notice")).toHaveCount(0);
    await expect(page.getByTestId("flat-scale")).toHaveText("Drawn to scale from your measurements.");
    await page.reload();
    await expect(page.getByTestId("flat-notice")).toHaveCount(0);
  });

  test("changing the sleeve length option changes the drawing", async ({ page }) => {
    await signedIn(page, "flat-sleeve");
    await startDesign(page, "Polo shirt");
    const before = await source(page);

    await page.getByRole("group", { name: "Sleeve length" }).getByRole("radio", { name: /^Long sleeve/ }).check();
    await saved(page, 2);

    await expect.poll(() => source(page)).not.toBe(before);
    await expect(front(page)).toHaveAttribute("alt", /Sleeve length: Long sleeve\./);
  });

  test("setting the colour of a part changes the drawing, and keeps the other parts", async ({ page }) => {
    await signedIn(page, "flat-colour");
    await startDesign(page, "Crew neck tee");
    const before = await source(page);

    const hex = page.getByLabel("Body front drawn colour as #rrggbb");
    await hex.fill("1B2A49");
    await hex.press("Enter");
    await saved(page, 2);
    await expect(page.getByLabel("Body front colour", { exact: true })).toHaveValue("#1b2a49");
    await page.getByLabel("Body back colour", { exact: true }).fill("#aa0000");
    await saved(page, 3);
    // A colour picked for the screen is not a colour code for a factory, so the code stays empty.
    await expect(page.getByLabel("Body back colour code")).toHaveValue("");
    await expect(page.getByLabel("Body back drawn colour as #rrggbb")).toHaveValue("#aa0000");
    await hex.fill("navy");
    await hex.press("Enter");
    await expect(page.getByText("Pick a colour, such as #1b2a49.")).toBeVisible();
    await expect(hex).toHaveAttribute("aria-describedby", /.+/);
    const describedBy = await hex.getAttribute("aria-describedby");
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText("Pick a colour");
    await hex.fill("#1b2a49");
    await page.getByLabel("Body front colour code").fill("Navy 19-4052");
    await page.getByLabel("Body front colour code").press("Enter");
    await saved(page, 4);

    await expect.poll(() => source(page)).not.toBe(before);
    expect(await svgOf(page)).toContain('fill="#1b2a49"');
    await page.reload();
    await expect(page.getByLabel("Body front colour code")).toHaveValue("Navy 19-4052");
    await expect(page.getByLabel("Body back colour", { exact: true })).toHaveValue("#aa0000");
    await expect(front(page)).toHaveAttribute("alt", /Colours: Body front Navy 19-4052, Body back #aa0000\./);
  });

  test("a logo can be uploaded, placed, moved and removed", async ({ page }) => {
    await signedIn(page, "flat-logo");
    await startDesign(page, "Crew neck tee");
    expect(await svgOf(page)).not.toContain("<image");

    await page.getByLabel("Logo or picture").setInputFiles({ name: "badge.png", mimeType: "image/png", buffer: await logo() });
    const form = page.getByRole("form", { name: "New artwork" });
    await expect(form).toBeVisible();
    await form.getByLabel("Name").fill("Club badge");
    await form.getByLabel("Width (cm)").fill("6");
    await form.getByLabel("Height (cm)").fill("3");
    await form.getByRole("button", { name: "Add to design" }).click();
    await saved(page, 2);

    await expect.poll(async () => await svgOf(page)).toContain("data:image/png;base64,");
    await expect(page.getByRole("form", { name: "Change Club badge" })).toBeVisible();
    const placed = await svgOf(page);

    const edit = page.getByRole("form", { name: "Change Club badge" });
    await edit.getByLabel("Move across (cm)").fill("4");
    await edit.getByLabel("Turn (degrees)").fill("20");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await saved(page, 3);
    await expect.poll(async () => await svgOf(page)).not.toBe(placed);
    expect(await svgOf(page)).toContain('transform="rotate(20 ');

    await page.getByRole("button", { name: "Remove Club badge" }).click();
    await saved(page, 4);
    await expect.poll(async () => await svgOf(page)).not.toContain("<image");
  });

  test("text artwork with a script in it is shown as text and nothing runs", async ({ page }) => {
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await signedIn(page, "flat-script");
    await startDesign(page, "Crew neck tee");

    await page.getByLabel("Words to print").first().fill("</text><script>window.hacked=1;alert(1)</script>");
    await page.getByRole("button", { name: "Add words" }).click();
    const form = page.getByRole("form", { name: "New artwork" });
    await form.getByRole("button", { name: "Add to design" }).click();
    await saved(page, 2);

    await expect.poll(async () => await svgOf(page)).toContain("&lt;/text&gt;&lt;script&gt;window.hacked=1;alert(1)&lt;/script&gt;");
    expect(await svgOf(page)).not.toContain("<script");
    expect(await page.evaluate(() => (window as unknown as { hacked?: number }).hacked)).toBeUndefined();
    expect(dialogs).toEqual([]);
    await page.reload();
    await expect(page.getByRole("form", { name: /^Change / }).getByLabel("Words to print")).toHaveValue("</text><script>window.hacked=1;alert(1)</script>");
  });

  test("refuses a file that is not a picture, beside the field", async ({ page }) => {
    await signedIn(page, "flat-badfile");
    await startDesign(page, "Crew neck tee");

    await page.getByLabel("Logo or picture").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });

    await expect(page.getByText("Upload a PNG, JPEG or WebP image.")).toBeVisible();
    await expect(page.getByRole("form", { name: "New artwork" })).toHaveCount(0);
  });
});
