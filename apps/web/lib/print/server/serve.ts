import { currentStack, type ArtworkStack, type AssetReader } from "@/lib/artwork-stack";
import { GENERATORS } from "@/lib/pattern-generators";
import { printScale, type FabricProfile, type PrintRuleSet, type SizeLabelMap } from "@/lib/production/contract";
import type { OpenProject } from "@/lib/projects/project-reads";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { fieldErrors } from "@/lib/server/core/guard";
import { buildPrintSet, TooManyFiles, TooMuchWork, zipPrintSet, type PrintRequest } from "../build";
import type { PrintFormat } from "../formats";
import type { BuildEnv, PrintSettings } from "../layout/context";
import { createLayoutMapper } from "../layout/mapper";
import { planPlayers, type PlayerJob } from "../players";
import type { Font } from "../text/font";
import { ZONE_TEMPLATES } from "../zones";
import { printFilesQuerySchema, type PrintFilesBody } from "./schemas";
import { NO_PATTERN_SENTENCE, patternFor, type PatternSource } from "./pattern-source";
import { printZipName, zipHeaders } from "./names";

/** What a download needs from outside: the design, the brand's settings and library, and the readers. The route joins these to the database. */
export interface PrintDeps {
  readonly load: (options: { version?: number }) => Promise<OpenProject>;
  readonly settings: () => Promise<PrintSettings>;
  readonly rules: (ruleSetId?: string) => Promise<PrintRuleSet>;
  /** A fabric of the brand's with its profile, or null when the brand has no such fabric. */
  readonly fabric: (fabricId: string) => Promise<{ readonly name: string; readonly profile: FabricProfile } | null>;
  readonly sizeMaps: () => Promise<readonly SizeLabelMap[]>;
  readonly assets: AssetReader;
  readonly font: () => Promise<Font>;
}

export interface PrintInput {
  /** The query of the address, as it came. It is checked here. */
  readonly query: unknown;
  readonly roster?: PrintFilesBody;
}

const badQuery = (issues: readonly { path: PropertyKey[]; message: string }[]): AppError =>
  new AppError("invalid_input", MESSAGES.invalid_input, fieldErrors(issues as never, "query"));

interface Prepared {
  readonly project: OpenProject;
  readonly source: PatternSource;
  readonly stack: ArtworkStack;
  readonly env: BuildEnv;
  readonly request: PrintRequest;
  readonly problems: readonly string[];
  readonly jobs: readonly PlayerJob[];
}

const NOT_TESTED = { shrinkLengthPct: { value: null, source: "not-set" }, shrinkWidthPct: { value: null, source: "not-set" } } as const;

/** The fabric named in the address and the print scale it gives, or no scale when none is named. */
async function scaleFor(deps: PrintDeps, fabricId: string | undefined) {
  const fabric = fabricId === undefined ? null : await deps.fabric(fabricId);
  if (fabricId !== undefined && fabric === null) throw new AppError("not_found", "That fabric is not in your library.");
  const scale = printScale(fabric?.profile ?? NOT_TESTED);
  return { scale, source: fabric === null || scale.notScaled ? null : `fabric ${fabric.name}` };
}

/** One set per roster row, with the rows that could not be planned set aside to be listed. */
async function playersFor(deps: PrintDeps, roster: PrintFilesBody, project: OpenProject, source: PatternSource, stack: ArtworkStack) {
  const planned = planPlayers({
    order: { id: "00000000-0000-4000-8000-000000000000", projectId: project.id, name: roster.name ?? "Roster", rows: roster.rows },
    stack,
    sizeMaps: await deps.sizeMaps(),
    patternSizes: source.pattern.sizes,
  });
  if (planned.jobs.length === 0) throw new AppError("invalid_input", planned.problems[0] ?? "There is nobody to make files for.");
  return planned;
}

/** Everything a download or a summary starts from: the design, its stack, the pattern and the settings. */
export async function prepare(deps: PrintDeps, input: PrintInput): Promise<Prepared> {
  const parsed = printFilesQuerySchema.safeParse(input.query);
  if (!parsed.success) throw badQuery(parsed.error.issues);
  const query = parsed.data;
  const project = await deps.load(query.version === undefined ? {} : { version: query.version });
  const source = patternFor(project.garmentType);
  if (source === null) throw new AppError("invalid_input", NO_PATTERN_SENTENCE);
  const stack = currentStack(project.spec);
  const colourway = query.colourway ?? stack.colourways[0].id;
  if (!stack.colourways.some((c) => c.id === colourway)) throw new AppError("not_found", "This design has no colourway with that name.");
  const sizes = query.sizes === undefined ? [...source.pattern.sizes] : query.sizes.split(",").map((s) => s.trim()).filter((s) => s !== "");
  const missing = sizes.find((s) => !source.pattern.sizes.includes(s));
  if (missing !== undefined) throw new AppError("invalid_input", `This pattern has no size ${missing}. It has ${source.pattern.sizes.join(", ")}.`);

  const { scale, source: scaleSource } = await scaleFor(deps, query.fabric);
  const [settings, rules, font] = await Promise.all([deps.settings(), deps.rules(query.rules), deps.font()]);
  const env: BuildEnv = {
    stack,
    colourwayId: colourway,
    mapper: createLayoutMapper({ pattern: source.pattern, baseSize: source.baseSize }),
    zoneTemplates: ZONE_TEMPLATES,
    generators: GENERATORS,
    assets: deps.assets,
    settings,
    rules,
    scale: { length: scale.length, width: scale.width, note: scale.note },
    font,
    patternReviewed: source.reviewed,
    scaleSource,
  };
  const players = input.roster === undefined ? null : await playersFor(deps, input.roster, project, source, stack);
  const request: PrintRequest = {
    sizes,
    formats: (query.format ?? ["pdf"]) as PrintFormat[],
    ...(query.view === undefined ? {} : { views: query.view }),
    ...(players === null ? {} : { players: players.jobs }),
    ...(query.guides === "off" ? { guides: false } : {}),
  };
  return { project, source, stack, env, request, problems: players?.problems ?? [], jobs: players?.jobs ?? [] };
}

/**
 * Builds the print files for a design and sends them as one zip. They are made in memory when asked for and sent once;
 * nothing is written to storage, and no SVG is ever stored. A design of another brand is not found.
 */
export async function servePrintFiles(deps: PrintDeps, input: PrintInput): Promise<Response> {
  const { project, env, request, problems } = await prepare(deps, input);
  let set;
  try {
    set = await buildPrintSet(env, request);
  } catch (error) {
    if (error instanceof TooManyFiles || error instanceof TooMuchWork) throw new AppError("invalid_input", error.message);
    throw error;
  }
  const name = printZipName({ styleNumber: project.styleNumber, designName: project.name, version: project.currentVersion });
  const zip = zipPrintSet(env, { ...set, problems: [...problems, ...set.problems] }, request, { designName: project.name, folderName: name.folder });
  const body = new Uint8Array(zip);
  return new Response(body, { status: 200, headers: zipHeaders(name, body.byteLength) });
}
