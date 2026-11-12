import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accessible, shellFitsAtEveryWidth } from "./chrome";
import { createAccount, signIn, test, userIdOf } from "./support";

/**
 * Brand Studio, typed by hand (spec F-S9 without the URL import; plan v5 Y6, decision 0079): the
 * brand record, the completion pill in the top bar, a palette with its gamut estimate, the licensed
 * kit-font list, and the club kit read through rather than copied.
 *
 * Every palette name carries a run id, because CI runs a failed browser test again and a retry must
 * not find the row its own first attempt left behind.
 */

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** The brand an account belongs to. The account has exactly one. */
const brandOf = async (email: string): Promise<string> => {
  const { data, error } = await admin().from("memberships").select("brand_id").eq("user_id", await userIdOf(email)).single();
  expect(error).toBeNull();
  return (data as { brand_id: string }).brand_id;
};

const runId = () => Math.random().toString(36).slice(2, 10);

/*
 * The top bar's first guard was written here and lives in `e2e/chrome.ts`. Since decision 0138 it is
 * `shellFits`: the page never scrolls sideways and no control of the top bar runs past the window,
 * measured at each of `SHELL_WIDTHS` by `shellFitsAtEveryWidth`.
 */

test.describe("Brand Studio (Y6)", () => {
  test("a brand is filled in by hand, and the top bar's New goes once its details are saved", async ({ page }) => {
    await signIn(page, await createAccount("bs-details"));
    await expect(page).toHaveURL(/\/studio$/);
    // The way in is the top bar's brand pill, with a gold New until the brand is set up (decision 0138).
    await expect(page.getByTestId("brand-new")).toBeVisible();
    await page.locator("header").getByRole("link", { name: /^Brand: .* Open Brand Studio\.$/ }).click();
    await expect(page).toHaveURL(/\/brand-studio$/);

    await expect(page.getByTestId("brand-completion")).toHaveText("0% complete");

    const details = page.getByRole("region", { name: "Details", exact: true });
    await details.getByLabel("Category").selectOption({ label: "Club" });
    await details.getByLabel("Website").fill("https://example.test");
    await details.getByLabel("About").fill("A club in the north, founded by the people who still run it.");
    await details.getByRole("button", { name: "Community" }).click();
    await details.getByLabel("Sizes you make by default").fill("S, M, L");
    await details.getByRole("button", { name: "Save brand" }).click();
    await expect(details.getByText("Your brand is saved.")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("brand-completion")).not.toHaveText("0% complete");
    await expect(page.getByTestId("brand-new")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Overview", exact: true }).getByText("Community")).toBeVisible();

    // One h1, the page's own landmark, and the shell inside the window at every width it supports,
    // not only at the browser tests' own 1280.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await shellFitsAtEveryWidth(page);
    await accessible(page);
  });

  test("the phone layout holds the tabs and the panels without scrolling sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, await createAccount("bs-phone"));
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/brand-studio?tab=colours");

    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    // The tabs wrap rather than cut off, so every one of the seven is still reachable.
    await expect(page.getByRole("navigation", { name: "Brand" }).getByRole("link")).toHaveCount(7);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "Brand Studio scrolls sideways on a phone by this many pixels").toBeLessThanOrEqual(0);
    await accessible(page);
  });

  test("a palette is saved, and a colour the estimate refuses says so and names its rule", async ({ page }) => {
    await signIn(page, await createAccount("bs-colours"));
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/brand-studio?tab=colours");

    const editor = page.getByRole("region", { name: "New palette", exact: true });
    await editor.getByPlaceholder("Palette name, such as Primary or Kit colours").fill(`Primary ${runId()}`);
    await editor.getByLabel("Colour", { exact: true }).fill("#0000ff");
    await editor.getByPlaceholder("Name, such as Club red").fill("Electric blue");

    const warning = editor.getByTestId("gamut-warning");
    await expect(warning).toContainText("Knitwright's own estimate, not a colour match");
    await expect(warning).toContainText("R-GAP-000");
    await expect(editor.getByText("no Pantone TCX code yet")).toBeVisible();

    await editor.getByPlaceholder("Pantone TCX, as printed in your book").fill("19-4052 TCX");
    await expect(editor.getByText("no Pantone TCX code yet")).toBeHidden();

    await editor.getByRole("button", { name: "Save palette" }).click();
    await expect(editor.getByText("The palette is saved.")).toBeVisible();

    await page.goto("/brand-studio");
    await expect(page.getByTestId("brand-findings")).toContainText("Knitwright's own estimate");
  });

  test("a colour the estimate accepts carries no warning", async ({ page }) => {
    await signIn(page, await createAccount("bs-in-gamut"));
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/brand-studio?tab=colours");

    const editor = page.getByRole("region", { name: "New palette", exact: true });
    await editor.getByLabel("Colour", { exact: true }).fill("#0b1f4b");
    await expect(editor.getByTestId("gamut-warning")).toBeHidden();
  });

  test("only a font whose licence is on file can be chosen", async ({ page }) => {
    await signIn(page, await createAccount("bs-fonts"));
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/brand-studio?tab=fonts");

    const fonts = page.getByRole("region", { name: "Fonts", exact: true });
    for (const role of ["Headline", "Subheadline", "Body", "Accent", "Name & number"]) {
      await fonts.getByRole("combobox", { name: `${role} font`, exact: true }).selectOption({ label: "Geist Sans" });
    }
    await fonts.getByRole("button", { name: "Save fonts" }).click();
    await expect(fonts.getByText("Your fonts are saved.")).toBeVisible();

    const placeholders = fonts.getByRole("region", { name: "Fonts we cannot offer yet" });
    await expect(placeholders).toContainText("No licence for a font of this kind is on file");
    // toBeDisabled reads the accessibility tree, which does not carry the state of a native option
    // inside a closed select, so the element's own property is checked instead.
    const blocked = fonts.getByRole("combobox", { name: "Headline font", exact: true }).getByRole("option", { name: /no licence on file/ }).first();
    await expect(blocked).toHaveJSProperty("disabled", true);
  });

  test("the club kit shows through, labelled, and is still changed on the Club page", async ({ page }) => {
    const email = await createAccount("bs-club-kit");
    const brandId = await brandOf(email);
    const { error } = await admin().rpc("save_club_kit", {
      p_brand_id: brandId,
      p_user_id: await userIdOf(email),
      p_kit: { primaryColour: "#0b3d91", accentColour: "#ffd100" },
    });
    expect(error).toBeNull();

    await signIn(page, email);
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/brand-studio?tab=colours");

    const readThrough = page.getByRole("region", { name: "Club kit", exact: true });
    await expect(readThrough).toContainText("From your club kit. Change it on the Club page.");
    await expect(readThrough).toContainText("#0b3d91");
    await expect(readThrough.getByRole("button", { name: "Save palette" })).toBeHidden();

    // The club kit is still the only place it is stored: Brand Studio has written nothing.
    const { data } = await admin().from("brand_colours").select("hex").eq("brand_id", brandId);
    expect(data).toEqual([]);
  });

  /**
   * The offer used to be "a design's artwork", which was a screen nobody had built: the panel it
   * named existed and no page imported it. It is on this page's own Overview tab now (decision
   * 0124), so the empty state offers something a person can really open.
   */
  test("a brand with no uploads is told where to put its logos first", async ({ page }) => {
    await signIn(page, await createAccount("bs-logos"));
    await expect(page).toHaveURL(/\/studio$/);
    await page.goto("/brand-studio?tab=logos");
    const logos = page.getByRole("region", { name: "Logos", exact: true });
    await expect(logos).toContainText("Add your logo to your artwork first");
    // An empty state offers the one thing that fills it, and the offer is not a dead link.
    await expect(logos.getByRole("link", { name: "Your artwork" })).toHaveAttribute("href", "/brand-studio?tab=overview#artwork");
  });
});
