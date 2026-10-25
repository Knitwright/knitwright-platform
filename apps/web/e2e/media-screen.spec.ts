import { expect, type Page } from "@playwright/test";
import { NEEDS_MATCHING_STILL, UNLOCKED_LABEL } from "../components/media/screen/copy";
import { createStopwatch, describeRun } from "../components/media/screen/timing";
import { SAVED_LABEL, UNSUPPORTED_MESSAGE } from "../lib/media/video/copy";
import { createAccount, openTool, signIn, test } from "./support";

/**
 * Plan W3-E: the Media tool of the studio workspace, with the stub providers (no model is called). Make a set, watch the
 * tiles fill in watermarked, use credits, see clean tiles with downloads, record a turntable, and time the whole run.
 * The 3D view is off in these tests (SHOW_3D is false), so the test draws a turning square on a canvas where the 3D view's
 * canvas would be; the screen's real button, the real recorder and the real upload route do the rest. No lifestyle provider
 * is switched on here, so there is no passed lifestyle picture and the clip button must say why it is off.
 */

const startJersey = async (page: Page): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Team jersey" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill("Media screen test");
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Media screen test" })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop() ?? "";
};

/** A canvas that is drawn on all the time, inside the wrapper the screen looks for. */
const putUpACanvas = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-testid", "garment-3d");
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);
    const context = canvas.getContext("2d");
    let angle = 0;
    const draw = () => {
      if (!context) return;
      context.fillStyle = "#223";
      context.fillRect(0, 0, 320, 240);
      context.save();
      context.translate(160, 120);
      context.rotate((angle += 0.1));
      context.fillStyle = "#e33";
      context.fillRect(-50, -50, 100, 100);
      context.restore();
      requestAnimationFrame(draw);
    };
    draw();
  });

test.describe("the Media tool (W3-E)", () => {
  test("makes a set, shows watermarked tiles, spends credits, shows clean tiles and records a turntable", async ({ page }, testInfo) => {
    const watch = createStopwatch();
    watch.mark("start");
    await signIn(page, await createAccount("media-screen", { brand: "Media Screen Rovers" }));
    await expect(page).toHaveURL(/\/studio$/);
    await startJersey(page);

    await openTool(page, "Media");
    const screen = page.getByTestId("media-screen");
    await expect(screen).toBeVisible();
    await expect(screen.getByText("No media has been made for this version of the design yet.")).toBeVisible();
    await expect(screen.getByTestId("media-price")).toContainText(/credits?, once for each saved version/);

    // Everything is reachable by keyboard: the button takes focus and Enter starts the set.
    const make = screen.getByRole("button", { name: "Make media" });
    await make.focus();
    await expect(make).toBeFocused();
    await page.keyboard.press("Enter");

    const tiles = screen.getByTestId("media-tile");
    await expect(tiles).toHaveCount(3);
    await expect(screen.getByTestId("media-progress")).toHaveText(/3 of 3 pictures ready\./);
    watch.mark("set ready");
    for (const label of ["Front", "Back", "Flat lay"]) {
      const tile = tiles.filter({ hasText: label });
      await expect(tile).toHaveAttribute("data-watermarked", "true");
      await expect(tile.getByRole("img", { name: `${label}, preview with a Knitwright mark` })).toBeVisible();
      await expect(tile.getByRole("link", { name: /^Download/ })).toHaveCount(0);
    }
    await expect(screen.getByRole("button", { name: "Use credits" })).toBeEnabled();

    // The server serves the preview before the spend: the picture the tile points at is watermarked.
    const src = await tiles.first().getByRole("img").getAttribute("src");
    const before = await page.request.get(src ?? "");
    expect(before.headers()["x-media-watermarked"]).toBe("true");

    await screen.getByRole("button", { name: "Use credits" }).click();
    await expect(screen.getByText(UNLOCKED_LABEL)).toBeVisible();
    watch.mark("credits used");
    for (const label of ["Front", "Back", "Flat lay"]) {
      const tile = tiles.filter({ hasText: label });
      await expect(tile).toHaveAttribute("data-watermarked", "false");
      await expect(tile.getByRole("link", { name: `Download ${label}` })).toHaveAttribute("download", /^knitwright-.*\.png$/);
    }
    const after = await page.request.get(src ?? "");
    expect(after.headers()["x-media-watermarked"]).toBe("false");
    await expect(screen.getByRole("button", { name: "Use credits" })).toBeDisabled();

    // No lifestyle picture exists, so the clip button is off and says why.
    await expect(screen.getByRole("button", { name: "Make 5-second clip" })).toBeDisabled();
    await expect(screen.getByTestId("media-clip-note")).toHaveText(NEEDS_MATCHING_STILL);

    // The turntable: the screen's own button records the canvas and the set shows it.
    await putUpACanvas(page);
    const canRecord = await page.evaluate(() => typeof MediaRecorder !== "undefined" && ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].some((t) => MediaRecorder.isTypeSupported(t)));
    await screen.getByRole("button", { name: "Record turntable" }).click();
    if (canRecord) {
      await expect(screen.getByText(SAVED_LABEL)).toBeVisible({ timeout: 30_000 });
      const turntable = tiles.filter({ has: page.locator('video[aria-label="Turntable"]') });
      await expect(turntable).toHaveCount(1);
      await expect(screen.getByRole("link", { name: "Download Turntable" })).toBeVisible();
    } else {
      // The CI browser cannot record: the plain sentence appears and nothing is saved.
      await expect(screen.getByText(UNSUPPORTED_MESSAGE)).toBeVisible();
      await expect(tiles).toHaveCount(3);
    }
    watch.mark("turntable");

    const report = watch.report("stub", ["clip: no lifestyle picture exists without a lifestyle provider, so the clip step did not run"]);
    console.log(describeRun(report));
    await testInfo.attach("media-run-timing.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
    expect(report.target.status).toBe("unmeasured");
  });

  test("the page never carries a path to a clean file", async ({ page }) => {
    await signIn(page, await createAccount("media-screen-b", { brand: "Media Screen Two" }));
    await expect(page).toHaveURL(/\/studio$/);
    await startJersey(page);
    await openTool(page, "Media");
    const screen = page.getByTestId("media-screen");
    await screen.getByRole("button", { name: "Make media" }).click();
    await expect(screen.getByTestId("media-tile")).toHaveCount(3);
    const markup = await screen.innerHTML();
    expect(markup).not.toContain("_private");
    expect(markup).not.toContain("cleanPath");
  });
});
