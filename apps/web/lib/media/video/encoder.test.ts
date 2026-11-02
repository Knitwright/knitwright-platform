import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  chooseEncoder,
  containerNote,
  containerOf,
  drawTextFilters,
  ffmpegCommand,
  missingRunner,
  NO_ENCODER_MESSAGE,
  RECORDER_MIME_TYPES,
} from "./encoder";
import { VIDEO_GAP_RULE } from "./formats";
import { VIDEO_SEQUENCES } from "./sequences";
import { buildRenderPlan, type TextOverlay } from "./shot-plan";

const plan = buildRenderPlan({ sequence: VIDEO_SEQUENCES.turntable, aspect: "9:16" });

const headline: TextOverlay = {
  id: "headline",
  text: "New kit: 2026/27",
  fromMs: 0,
  toMs: 3000,
  xPercent: 50,
  yPercent: 12,
  align: "centre",
  sizePercent: 7,
  role: "headline",
};

describe("who encodes the video", () => {
  it("is the browser, unless an environment names an encoder of its own", () => {
    expect(chooseEncoder({}).id).toBe("browser");
    expect(chooseEncoder({ MEDIA_VIDEO_FFMPEG: "   " }).id).toBe("browser");
    expect(chooseEncoder({ MEDIA_VIDEO_FFMPEG: "/usr/bin/ffmpeg" }).id).toBe("ffmpeg");
  });

  it("says in plain words where the video is made, with a rule id", () => {
    expect(chooseEncoder({}).reason).toMatch(/in your browser/);
    expect(chooseEncoder({}).ruleId).toBe(VIDEO_GAP_RULE);
    expect(chooseEncoder({ MEDIA_VIDEO_FFMPEG: "ffmpeg" }).reason).toMatch(/on the server/);
  });

  it("spawns no process anywhere in the video studio", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    /** The code only: what a comment mentions is not a call. */
    const code = (text: string): string => text.replaceAll(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const name of readdirSync(here).filter((file) => file.endsWith(".ts") && !file.includes(".test."))) {
      expect(code(readFileSync(join(here, name), "utf8")), name).not.toMatch(/child_process|execFile|execSync|spawn\(/);
    }
  });

  it("has a runner that refuses in words, so a caller behaves the same with no encoder", async () => {
    const answer = await missingRunner().run(["-y"], new AbortController().signal);
    expect(answer).toEqual({ ok: false, message: NO_ENCODER_MESSAGE });
  });
});

describe("what the browser is asked to record", () => {
  it("asks for MP4 first, because the spec asks for MP4", () => {
    expect(RECORDER_MIME_TYPES[0]?.startsWith("video/mp4")).toBe(true);
    expect(RECORDER_MIME_TYPES.some((type) => type.startsWith("video/webm"))).toBe(true);
  });

  it("says plainly when a browser could only record WebM", () => {
    expect(containerNote("video/mp4")).toMatch(/MP4/);
    expect(containerNote("video/webm;codecs=vp9")).toMatch(/only record WebM/);
    expect(containerOf("video/mp4;codecs=avc1")).toBe("video/mp4");
    expect(containerOf("video/webm")).toBe("video/webm");
  });
});

describe("the ffmpeg command", () => {
  it("writes H.264 in MP4 at the plan's own size and frame rate", () => {
    const args = ffmpegCommand(plan, { framePattern: "/tmp/kit/frame-%05d.png", outputPath: "/tmp/kit/out.mp4" });
    expect(args).toContain("libx264");
    expect(args).toContain("yuv420p");
    expect(args).toContain("+faststart");
    expect(args[args.length - 1]).toBe("/tmp/kit/out.mp4");
    expect(args[args.indexOf("-framerate") + 1]).toBe(String(plan.fps));
    expect(args[args.indexOf("-frames:v") + 1]).toBe(String(plan.frames));
    expect(args.join(" ")).toContain("scale=1080:1920");
  });

  it("asks for no sound, because the deterministic videos have none", () => {
    expect(ffmpegCommand(plan, { framePattern: "f-%05d.png", outputPath: "o.mp4" })).toContain("-an");
  });

  it("reads from standard input never, and overwrites its own output", () => {
    const args = ffmpegCommand(plan, { framePattern: "f-%05d.png", outputPath: "o.mp4" });
    expect(args[0]).toBe("-nostdin");
    expect(args).toContain("-y");
  });

  it("burns text in only when the deploy target provides a font, because no font is committed here", () => {
    const withText = buildRenderPlan({ sequence: VIDEO_SEQUENCES.turntable, aspect: "9:16", overlays: [headline] });
    expect(drawTextFilters(withText, null)).toEqual([]);
    expect(ffmpegCommand(withText, { framePattern: "f-%05d.png", outputPath: "o.mp4" }).join(" ")).not.toContain("drawtext");
    const filters = drawTextFilters(withText, "/usr/share/fonts/sans.ttf");
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain("fontfile=/usr/share/fonts/sans.ttf");
    expect(filters[0]).toContain("fontsize=134");
    expect(filters[0]).toContain("x=540-text_w/2");
    expect(filters[0]).toContain("between(t,0.000,3.000)");
  });

  it("escapes what drawtext reads as syntax, rather than changing the words", () => {
    const risky = buildRenderPlan({
      sequence: VIDEO_SEQUENCES.turntable,
      aspect: "1:1",
      overlays: [{ ...headline, text: "50% off: O'Brien, 7\nnow" }],
    });
    const filter = drawTextFilters(risky, "f.ttf")[0] ?? "";
    expect(filter).toContain("50\\% off\\: O\\\\'Brien\\, 7 now");
    expect(filter).not.toContain("\n");
  });

  it("anchors text left, centre or right", () => {
    const made = (align: TextOverlay["align"]) =>
      drawTextFilters(buildRenderPlan({ sequence: VIDEO_SEQUENCES.turntable, aspect: "1:1", overlays: [{ ...headline, align }] }), "f.ttf")[0] ?? "";
    expect(made("left")).toContain("x=540:");
    expect(made("centre")).toContain("x=540-text_w/2");
    expect(made("right")).toContain("x=540-text_w");
  });
});
