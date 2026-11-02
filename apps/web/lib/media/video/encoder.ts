import { VIDEO_GAP_RULE } from "./formats";
import { overlayBox, type RenderPlan, type TextOverlay } from "./shot-plan";

/**
 * WHO ENCODES THE VIDEO, AND WHY (plan v5 L5, decision 0095).
 *
 * The plan asked for "server-side with ffmpeg if it is available in the deploy target, otherwise the
 * existing browser recorder; decide and record why". The deploy target could not be established:
 * `apps/web/vercel.json` pins a region and nothing else, **no deployment of this platform exists
 * yet** and decision 0002 is still open on the host's own function time limit. A Node function on a
 * serverless host has no ffmpeg binary unless one is bundled with it, which would mean committing a
 * third-party binary -- forbidden here -- and a GPL or LGPL licence question nobody has answered.
 *
 * So the default is **the browser recorder**, which works everywhere, and the ffmpeg path is built
 * as a command and a seam, not as a process:
 *
 *   * `chooseEncoder` picks ffmpeg only when `MEDIA_VIDEO_FFMPEG` names a binary, which no
 *     environment sets, least of all CI;
 *   * `ffmpegCommand` builds the argv from a `RenderPlan`, and its test asserts the argv. **Nothing
 *     in this change spawns a process**: there is no `node:child_process` import anywhere in it, so
 *     an environment that sets the variable by accident still runs no encoder;
 *   * `FfmpegRunner` is the one-method seam a later workstream implements against a target that
 *     really has ffmpeg, with the same plan and the same command.
 *
 * ffmpeg's licence: ffmpeg is LGPL-2.1-or-later, and GPL-2.0-or-later when built with
 * `--enable-gpl`. The platform's dependency rule is MIT, Apache or BSD, so **no ffmpeg build is
 * committed, bundled or redistributed by this repository**; the command would invoke a binary the
 * deploy target already provides. That is the sentence the plan asked for, and it is also why the
 * decision cannot be "bundle ffmpeg".
 */

export const ENCODERS = ["browser", "ffmpeg"] as const;
export type EncoderId = (typeof ENCODERS)[number];

export type VideoContainer = "video/mp4" | "video/webm";

export interface EncoderChoice {
  readonly id: EncoderId;
  /** What the person is told about where the video is made, in plain words. */
  readonly reason: string;
  readonly ruleId: string;
}

/**
 * The browser records unless an environment names an ffmpeg binary. Read from the environment on
 * every call, never cached in a module, so a change needs no deploy of its own.
 */
export function chooseEncoder(env: Readonly<{ MEDIA_VIDEO_FFMPEG?: string | undefined }>): EncoderChoice {
  const binary = env.MEDIA_VIDEO_FFMPEG?.trim();
  if (binary) {
    return { id: "ffmpeg", reason: "This deployment has an encoder of its own, so the video is made on the server.", ruleId: VIDEO_GAP_RULE };
  }
  return { id: "browser", reason: "The video is recorded in your browser from the 3D view, so nothing is sent anywhere to make it.", ruleId: VIDEO_GAP_RULE };
}

/**
 * The containers a browser is asked for, MP4 first because the spec asks for MP4. A browser that can
 * only record WebM records WebM and the person is told, rather than being handed a file that claims
 * to be something it is not.
 */
export const RECORDER_MIME_TYPES: readonly string[] = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

/** 1080p at a bit rate that keeps a 9 second clip inside the studio's size cap. A Knitwright default. */
export const RECORDER_BITS_PER_SECOND = 6_000_000;

/** What to say about the file that came out. A WebM says plainly that it is not the MP4 the spec asks for. */
export function containerNote(mimeType: string): string {
  return mimeType.startsWith("video/mp4")
    ? "Saved as MP4, which is what social platforms take."
    : "Your browser can only record WebM, so this is a WebM file. It plays on the web but some social platforms want MP4.";
}

export const containerOf = (mimeType: string): VideoContainer => (mimeType.startsWith("video/mp4") ? "video/mp4" : "video/webm");

/** Characters ffmpeg's drawtext filter reads as syntax. Escaped rather than stripped, so text is not changed. */
const escapeDrawText = (text: string): string =>
  text.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\\\'").replaceAll("%", "\\%").replaceAll(",", "\\,").replaceAll("\n", " ");

const anchorX = (overlay: TextOverlay, x: number): string =>
  overlay.align === "centre" ? `${x}-text_w/2` : overlay.align === "right" ? `${x}-text_w` : `${x}`;

/**
 * One drawtext filter per overlay, each shown only between its own two moments. Needs a font file the
 * deploy target provides (`MEDIA_VIDEO_FONT`): **no font is committed to this repository**, so with
 * no font file there is no text filter and `ffmpegCommand` says so by leaving it out.
 */
export function drawTextFilters(plan: RenderPlan, fontFile: string | null): readonly string[] {
  if (!fontFile) return [];
  return plan.overlays.map((overlay) => {
    const box = overlayBox(plan, overlay);
    const parts = [
      `drawtext=fontfile=${fontFile}`,
      `text='${escapeDrawText(overlay.text)}'`,
      `x=${anchorX(overlay, box.x)}`,
      `y=${box.y}`,
      `fontsize=${box.size}`,
      "fontcolor=white",
      `enable='between(t,${(overlay.fromMs / 1000).toFixed(3)},${(overlay.toMs / 1000).toFixed(3)})'`,
    ];
    return parts.join(":");
  });
}

export interface FfmpegInput {
  /** A printf pattern for the frames already drawn, such as `/tmp/kit/frame-%05d.png`. */
  readonly framePattern: string;
  readonly outputPath: string;
  /** A font file the deploy target provides, or null: with none, no text is burned in. */
  readonly fontFile?: string | null;
}

/**
 * The argv for one video. Pure: it builds a command and runs nothing. H.264 in MP4 with
 * `yuv420p` and `faststart`, which is what a social platform will take, and the exact size of the
 * plan's format.
 */
export function ffmpegCommand(plan: RenderPlan, input: FfmpegInput): readonly string[] {
  const filters = [`scale=${plan.format.width}:${plan.format.height}:force_original_aspect_ratio=decrease`, `pad=${plan.format.width}:${plan.format.height}:-1:-1:color=black`, ...drawTextFilters(plan, input.fontFile ?? null)];
  return [
    "-nostdin",
    "-y",
    "-framerate",
    String(plan.fps),
    "-i",
    input.framePattern,
    "-vf",
    filters.join(","),
    "-frames:v",
    String(plan.frames),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    input.outputPath,
  ];
}

export type EncodeResult =
  | Readonly<{ ok: true; video: Uint8Array; type: VideoContainer }>
  | Readonly<{ ok: false; message: string }>;

/**
 * The seam a deploy target with its own ffmpeg is wired to. Nothing implements it here, and the one
 * thing in this change that takes it is the test double: there is no encoder on this host to call.
 */
export interface FfmpegRunner {
  readonly name: string;
  run(args: readonly string[], signal: AbortSignal): Promise<EncodeResult>;
}

export const NO_ENCODER_MESSAGE = "This deployment has no video encoder of its own, so the video is recorded in your browser instead.";

/** A runner that refuses, in words, so a caller written against the seam behaves the same with no encoder. */
export const missingRunner = (): FfmpegRunner => ({
  name: "none",
  run: async () => ({ ok: false, message: NO_ENCODER_MESSAGE }),
});
