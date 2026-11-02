/**
 * One import, stage by stage, inside about a minute (spec F-S9 "In about a minute it imports…").
 *
 * The six stages are the ones a person sees: the page, the logos, the colours, the fonts, the
 * product photos, the visual style. Each one reports before it starts and again when it ends, so a
 * screen can say what is happening now and what is left; a stage that finds nothing says so, and a
 * stage that would run past the budget is marked skipped with the reason rather than left spinning.
 * Only the first stage can fail the import: once a page has been read, every later stage is allowed
 * to come back empty and the person still gets what was found.
 *
 * **Nothing is written here.** This function fetches, derives and discards: it has no database
 * client, no storage client and no way to reach either. What it returns is an `ImportProposal`, a
 * plain object of numbers, colours and words, with every item still `pending`.
 */

import type { RateLimitRule } from "@/lib/server/core/guard";
import { LOGO_RIGHTS } from "@/lib/consent/wording";
import type { KitFont } from "../types";
import { proposedFonts } from "./fonts";
import { ownUrl, readOwnPage, readPicture, refuse, type Fetcher } from "./fetch";
import { proposedColours } from "./palette";
import { readPictures } from "./pictures";
import { brandRunKey, hostRequestKey, importLimits, type BrandImportSettings } from "./settings";
import { factOf, type StyleInput, type VisualStyleWriter } from "./style";
import { itemsOf } from "./items";
import type { ImportOutcome, ImportProposal, ImportedColour, ImportedFont, ImportedStyle, PictureFacts, SiteSource, StageReport } from "./types";
import { IMPORT_STAGES, RIGHTS_ASK, STAGE_EMPTY, type ImportStage } from "./words";

export type Limiter = (key: string, rule: RateLimitRule) => Promise<boolean>;
export type Who = Readonly<{ brandId: string; userId: string }>;

export type ImportDeps = Readonly<{
  fetcher: Fetcher;
  limiter: Limiter;
  styleWriter: VisualStyleWriter;
  /** The licensed font list, read from `brand_studio_fonts` by the caller (`service.ts` of Y6). */
  kitFonts: readonly KitFont[];
  settings: BrandImportSettings;
  now?: () => Date;
  /** Elapsed milliseconds, so a test can pin the budget without waiting a minute. */
  elapsed?: () => number;
  /** Called before and after every stage, for the progress a person watches. */
  onStage?: (report: StageReport) => void;
}>;

export type ImportInput = Readonly<{ url: string; brandName: string }>;

/** The picture types a vision model takes. An SVG is a drawing, so it is never sent to one. */
const MODEL_PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const SKIPPED = "The minute was up, so this was left out. Run the import again to try it on its own.";

/** Keeps the six reports, tells the caller about each change, and times each stage. */
class Progress {
  private readonly reports = new Map<ImportStage, StageReport>(
    IMPORT_STAGES.map((stage) => [stage, { stage, status: "pending", found: null, because: null, tookMs: null }]),
  );

  constructor(
    private readonly elapsed: () => number,
    private readonly tell?: (report: StageReport) => void,
  ) {}

  private put(report: StageReport): void {
    this.reports.set(report.stage, report);
    this.tell?.(report);
  }

  start(stage: ImportStage): number {
    this.put({ stage, status: "running", found: null, because: null, tookMs: null });
    return this.elapsed();
  }

  end(stage: ImportStage, from: number, found: number, because: string | null = null): void {
    const status = found === 0 ? "empty" : "done";
    this.put({ stage, status, found, because: status === "empty" ? (because ?? STAGE_EMPTY[stage]) : null, tookMs: this.elapsed() - from });
  }

  stop(stage: ImportStage, status: "skipped" | "failed", because: string): void {
    this.put({ stage, status, found: null, because, tookMs: null });
  }

  all(): readonly StageReport[] {
    return IMPORT_STAGES.map((stage) => this.reports.get(stage) as StageReport);
  }
}

/** Both per-brand counts: this brand's imports in the hour, and its requests to this site. */
async function withinAllowance(deps: ImportDeps, who: Who, host: string): Promise<boolean> {
  const rules = importLimits(deps.settings);
  if (!(await deps.limiter(brandRunKey(who.brandId), rules.brandRun))) return false;
  return deps.limiter(hostRequestKey(who.brandId, host), rules.hostRequest);
}

/** One picture of the brand's own, as a vision model takes it. Read once, sent once, then dropped. */
async function onePicture(deps: ImportDeps, pictures: readonly PictureFacts[]): Promise<StyleInput["picture"]> {
  const first = pictures.find((facts) => MODEL_PICTURE_TYPES.some((known) => known === facts.contentType));
  if (first === undefined) return undefined;
  const read = await readPicture(deps.fetcher, first.url, deps.settings);
  if (!read.ok) return undefined;
  return { mediaType: first.contentType as (typeof MODEL_PICTURE_TYPES)[number], base64: Buffer.from(read.bytes).toString("base64") };
}

type StyleOutcome = Readonly<{ style: ImportedStyle | null; writer: string | null; because: string | null }>;

/** The three texts, or the plain reason there are none. Fewer than five pictures writes nothing. */
async function writeStyle(deps: ImportDeps, input: ImportInput, page: SiteSource, pictures: readonly PictureFacts[]): Promise<StyleOutcome> {
  if (pictures.length < deps.settings.stylePictures) {
    return { style: null, writer: null, because: `${pictures.length} of your own pictures were read, and ${deps.settings.stylePictures} are needed. ${STAGE_EMPTY.style}` };
  }
  try {
    const picture = await onePicture(deps, pictures);
    const style = await deps.styleWriter.write({
      brandName: input.brandName,
      host: page.host,
      title: page.title,
      facts: pictures.map(factOf),
      ...(picture ? { picture } : {}),
    });
    const written = Object.values(style).some((text) => text.trim() !== "");
    return written ? { style, writer: deps.styleWriter.name, because: null } : { style: null, writer: deps.styleWriter.name, because: STAGE_EMPTY.style };
  } catch (error) {
    return { style: null, writer: null, because: error instanceof Error ? error.message : STAGE_EMPTY.style };
  }
}

type Found = Readonly<{
  logos: readonly PictureFacts[];
  graphics: readonly PictureFacts[];
  colours: readonly ImportedColour[];
  fonts: readonly ImportedFont[];
  style: ImportedStyle | null;
  styleWriter: string | null;
}>;

/**
 * Runs one stage and reports it, or marks it skipped when the budget has already gone. The stage's
 * own work decides how many things it found; `empty` is a finding too, and says what is missing.
 */
async function stage<T>(
  progress: Progress,
  name: ImportStage,
  within: () => boolean,
  nothing: T,
  work: () => Promise<Readonly<{ value: T; found: number; because?: string | null }>>,
): Promise<T> {
  if (!within()) {
    progress.stop(name, "skipped", SKIPPED);
    return nothing;
  }
  const from = progress.start(name);
  const done = await work();
  progress.end(name, from, done.found, done.because ?? null);
  return done.value;
}

/** The five stages after the page, in the order F-S9 lists them. */
async function gather(deps: ImportDeps, input: ImportInput, page: SiteSource, progress: Progress, within: () => boolean): Promise<Found> {
  const { settings } = deps;
  const reader = { fetcher: deps.fetcher, settings, before: within };
  const none: readonly PictureFacts[] = [];

  const logos = await stage(progress, "logos", within, none, async () => {
    const found = await readPictures(reader, [...page.links.icons, ...page.links.logos], settings.pictures);
    return { value: found, found: found.length };
  });

  const colours = await stage(progress, "colours", within, [] as readonly ImportedColour[], async () => {
    const found = proposedColours(page.links.cssColours, logos, settings);
    return { value: found, found: found.length };
  });

  const fonts = await stage(progress, "fonts", within, [] as readonly ImportedFont[], async () => {
    const found = proposedFonts(page.links.fontFamilies, deps.kitFonts);
    return { value: found, found: found.filter((font) => font.fontKey !== null).length };
  });

  const graphics = await stage(progress, "graphics", within, none, async () => {
    const found = await readPictures(reader, page.links.pictures, Math.max(0, settings.pictures - logos.length));
    return { value: found, found: found.length };
  });

  const style = await stage(progress, "style", within, { style: null, writer: null, because: SKIPPED } as StyleOutcome, async () => {
    const written = await writeStyle(deps, input, page, [...logos, ...graphics]);
    return { value: written, found: written.style === null ? 0 : 1, because: written.because };
  });

  return { logos, graphics, colours, fonts, style: style.style, styleWriter: style.writer };
}

/**
 * One import of the brand's own site. Fetches, derives, discards, and hands back a proposal in
 * which every item is still `pending`: nothing has been taken into the brand and nothing stored.
 */
export async function runImport(deps: ImportDeps, who: Who, input: ImportInput): Promise<ImportOutcome> {
  const elapsed = deps.elapsed ?? (() => Date.now());
  const started = elapsed();
  const within = (): boolean => elapsed() - started < deps.settings.budgetMs;
  const progress = new Progress(elapsed, deps.onStage);

  const address = ownUrl(input.url);
  if (!address.ok) {
    progress.stop("page", "failed", address.refusal.message);
    return { ok: false, refusal: address.refusal };
  }
  if (!(await withinAllowance(deps, who, address.url.host))) {
    const refusal = refuse("rate_limited");
    progress.stop("page", "failed", refusal.message);
    return { ok: false, refusal };
  }

  const pageFrom = progress.start("page");
  const read = await readOwnPage(deps.fetcher, address.url.toString(), deps.settings, deps.now);
  if (!read.ok) {
    progress.stop("page", "failed", read.refusal.message);
    return { ok: false, refusal: read.refusal };
  }
  const page = read.page;
  progress.end("page", pageFrom, 1);

  const found = await gather(deps, input, page, progress, within);
  const proposal: ImportProposal = {
    url: page.url,
    host: page.host,
    fetchedAt: page.fetchedAt,
    stages: progress.all(),
    items: itemsOf(found),
    colours: found.colours,
    fonts: found.fonts,
    logos: found.logos,
    graphics: found.graphics,
    style: found.style,
    rights: { ticked: false, wordingVersion: LOGO_RIGHTS.version, text: LOGO_RIGHTS.text, ask: RIGHTS_ASK },
    styleWriter: found.styleWriter,
  };
  return { ok: true, proposal };
}
