import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import ts from "typescript";
import { UNSUPPORTED_MESSAGE } from "../lib/media/video/copy";
import { createAccount, signIn, test } from "./support";

/**
 * Plan W3-D: a turntable recorded in Chromium with the browser's own MediaRecorder, using the real recorder source
 * (components/media/video/record.ts, compiled here and run in the page), then uploaded through the real API into the media set.
 * If the CI browser cannot record, the test asserts the fallback message instead (and says so). The 3D view itself is off in
 * these tests (SHOW_3D is false), so the button is not clicked; the recorder is pointed at a canvas the test draws on.
 * No clip is made here: a clip needs a lifestyle picture from W3-B, which this branch does not have.
 */

const recorderSource = (): string => {
  const source = readFileSync(join(process.cwd(), "components/media/video/record.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  return `(() => { const exports = {}; ${compiled}; window.__recorder = exports; })();`;
};

const startJersey = async (page: Page): Promise<string> => {
  await page.goto("/studio/new");
  await page.getByLabel("Garment type").selectOption({ label: "Team jersey" });
  await page.getByLabel("Made for").selectOption({ label: "Women" });
  await page.getByLabel("Design name").fill("Turntable test");
  await page.getByRole("button", { name: "Create design" }).click();
  await expect(page).toHaveURL(/\/studio\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Turntable test" })).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop() ?? "";
};

type SetView = { id: string; status: string; unlocked: boolean; items: { id: string; kind: string; watermarked: boolean; href: string | null }[] };

const waitForSet = async (page: Page, url: string): Promise<SetView> => {
  let set: SetView | null = null;
  await expect
    .poll(
      async () => {
        set = (await (await page.request.get(url)).json()).data.set;
        return set?.status;
      },
      { timeout: 45_000 },
    )
    .toBe("succeeded");
  if (!set) throw new Error("No set");
  return set;
};

type Outcome = { ok: boolean; reason?: string; size?: number; type?: string; status?: number };

/** Draws a turning square on a canvas, records it for one second with the real recorder source, and uploads the result. */
const recordAndUpload = (page: Page, uploadUrl: string): Promise<Outcome> =>
  page.evaluate(async (url) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    document.body.appendChild(canvas);
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
    const recorder = (window as unknown as { __recorder: { recordCanvas: (c: HTMLCanvasElement, o: object) => Promise<{ ok: boolean; reason?: string; recording?: { video: Blob; poster: Blob } }> } }).__recorder;
    const result = await recorder.recordCanvas(canvas, {
      seconds: 1.5,
      revolutionSeconds: 1.5,
      maxBytes: 8 * 1024 * 1024,
      mimeTypes: ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"],
      bitsPerSecond: 1_000_000,
      turnEvent: "knitwright:turn",
    });
    if (!result.ok || !result.recording) return { ok: false, reason: result.reason ?? "failed" };
    const form = new FormData();
    form.append("video", result.recording.video, "turntable");
    form.append("poster", result.recording.poster, "poster.png");
    const response = await fetch(url, { method: "POST", body: form });
    return { ok: true, size: result.recording.video.size, type: result.recording.video.type, status: response.status };
  }, uploadUrl);

test.describe("turntable recording (W3-D)", () => {
  test("records a turntable in the browser and finds it in the media set", async ({ page }) => {
    await signIn(page, await createAccount("turntable", { brand: "Turntable Rovers" }));
    await expect(page).toHaveURL(/\/studio$/);
    const projectId = await startJersey(page);
    const url = `/api/projects/${projectId}/media`;
    await page.request.post(url, { data: {} });
    const set = await waitForSet(page, url);
    await page.addScriptTag({ content: recorderSource() });

    const canRecord = await page.evaluate(() => typeof MediaRecorder !== "undefined" && ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].some((t) => MediaRecorder.isTypeSupported(t)));
    const outcome = await recordAndUpload(page, `${url}/${set.id}/turntable`);

    if (!canRecord) {
      // The CI browser cannot record: the recorder must say so, nothing is saved, and the person gets the plain message.
      expect(outcome).toEqual({ ok: false, reason: "unsupported" });
      expect(UNSUPPORTED_MESSAGE).toMatch(/cannot record/);
      const after = await waitForSet(page, url);
      expect(after.items.some((item) => item.kind === "turntable")).toBe(false);
      return;
    }

    expect(outcome).toMatchObject({ ok: true, status: 200 });
    expect(outcome.type).toMatch(/^video\/(webm|mp4)$/);
    const after = await waitForSet(page, url);
    const item = after.items.find((entry) => entry.kind === "turntable");
    expect(item).toBeTruthy();
    expect(after.status).toBe("succeeded");
    expect(JSON.stringify(after)).not.toContain("_private");

    // The still is watermarked; the free turntable video is served as recorded.
    const poster = await page.request.get(item?.href ?? "");
    expect(poster.headers()["x-media-watermarked"]).toBe("true");
    const video = await page.request.get(`${item?.href}/video`);
    expect(video.status()).toBe(200);
    expect(video.headers()["content-type"]).toMatch(/^video\/(webm|mp4)$/);
    expect(video.headers()["x-media-ai-generated"]).toBe("false");
    expect((await video.body()).byteLength).toBe(outcome.size);

    // A file that is not a video is refused and the turntable stays as it was.
    const bad = await page.request.post(`${url}/${set.id}/turntable`, { multipart: { video: { name: "x", mimeType: "video/webm", buffer: Buffer.from("not a video at all") }, poster: { name: "p.png", mimeType: "image/png", buffer: Buffer.from("x") } } });
    expect(bad.status()).toBe(400);
  });
});
