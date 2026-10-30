import "server-only";
import { currentStack } from "@/lib/artwork-stack";
import { getBaseArticle } from "@/lib/catalogue";
import { getEnv } from "@/lib/config/env";
import { creditsService } from "@/lib/credits/server";
import { createGate } from "@/lib/credits-gate/gate";
import { toDesignObjectV2 } from "@/lib/design-object";
import { factoryStore } from "@/lib/factory/server";
import { capabilityFor } from "@/lib/factory/service";
import { loadPrintContext, type Clients, type PrintContext } from "@/lib/print/inputs/context";
import { getProjectAt, type OpenProject } from "@/lib/projects/project-reads";
import { buildPackFor } from "@/lib/projects/tech-pack-data";
import { loadTechPackSource } from "@/lib/projects/tech-pack-load";
import { AppError } from "@/lib/server/core/errors";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { log } from "@/lib/server/log";
import { PRINT_MAX_EMBEDDED_BYTES } from "@/lib/techpack/exports/limits";
import { shrinkForPrint } from "@/lib/techpack/exports/print-images";
import { catalogueFrom, moderationFrom } from "@/lib/validation/live-ports";
import { articleOf, moderationTargets } from "@/lib/validation/spec-input";
import { creditCharge } from "../charge";
import { exportPackage, packageFileName } from "../export";
import { buildKppInput, NOTHING_UNSOURCED, type KppRows } from "../input";
import type { KppInput, KppSources } from "../model";
import { recordPackageExport } from "../record";
import { packageRefusal, packageResponse } from "./answer";
import { draftedPattern } from "./pattern";
import { DRAFTED_BY, printSource } from "./print";
import { designFactsOf, MADE_BY_KNITWRIGHT, MADE_BY_NOTE, marketsOf, moderationOf, printSettingsOf } from "./rows";
import { techPackPdfSource } from "./techpack";

/**
 * Joins the production package to the database: the design version and its tech pack, the base article and its
 * points of measure, the factory, fabric, colour and country rows, the brand's print settings and artwork, the
 * graded drafter and the print builder. It holds no rules of its own — `input/**`, `sources/rows.ts` and
 * `sources/print.ts` have those and are tested — and the assembler itself still reads no database, no
 * environment and no clock (decision 0070 point 1).
 *
 * Nothing here invents a value. A value no row holds reaches the package as `needs_input`, and the F-G2 gate
 * refuses the package and names it; today that is the normal answer for a real design, because no table holds
 * the bill-of-materials consumption, the care-label wording or the AQL plan (0070 revision 2, "Still owed").
 */

export const WHERE = "GET /api/projects/[projectId]/production-package";

const NOT_ON_ARTICLE = "This design is not on a base article yet, so a production package cannot be built for it.";
const NO_FACTORY = "No factory is on file yet, so a production package cannot be addressed to one.";

/** The same wiring as `lib/credits-gate/server.ts`, used through `ChargeForPackage` so the F-G2 check comes first. */
const packageGate = createGate({ enforced: () => getEnv().CREDITS_ENFORCED, service: creditsService, log, now: () => new Date() });

export type Who = Readonly<{ brandId: string; brandName: string; userId: string }>;

/** The one factory on file (decision 0071 seeds a single placeholder), with what it makes and the markets. */
async function readFactory(articleCode: string) {
  const store = factoryStore();
  const [factories, fabrics, colours, rules] = await Promise.all([store.listFactories(), store.listFabrics(), store.listColours(), store.listCountryRules()]);
  const factory = [...factories].sort((a, b) => a.slug.localeCompare(b.slug))[0];
  if (factory === undefined) throw new AppError("unavailable", NO_FACTORY);
  const snapshot = await store.snapshot(factory);
  return { factory, capability: capabilityFor(snapshot, articleCode) ?? null, fabrics, colours, markets: marketsOf(rules) };
}

/** Every row one package is built from, read for one design version of one brand. */
async function readRows(clients: Clients, who: Who, projectId: string): Promise<Readonly<{ rows: KppRows; project: OpenProject; context: PrintContext }>> {
  const project = await getProjectAt(clients.client, who.brandId, projectId);
  const targets = moderationTargets(project.spec);
  const [ref, context, statuses] = await Promise.all([
    articleOf(project.spec, catalogueFrom(clients.client)),
    loadPrintContext(clients, who.brandId),
    moderationFrom(clients.admin).statusesFor(who.brandId, targets),
  ]);
  if (ref === null) throw new AppError("conflict", NOT_ON_ARTICLE);
  const article = await getBaseArticle(clients.client, ref.baseArticleCode);
  if (article === null) throw new AppError("conflict", NOT_ON_ARTICLE);
  // The fabric's catalogue code is not passed: nothing maps a design's own fabric to a programme code, so the
  // design object carries its own and `chosenFabric` finds a programme row only when the two already agree.
  const object = toDesignObjectV2(project.spec, { article: ref, moderation: new Map(statuses.map((status) => [status.target.id, status.result])) });
  if (!object.ok) throw new AppError("conflict", object.reason);
  const factory = await readFactory(article.code);
  return {
    project,
    context,
    rows: {
      // The route exports a sample package: a batch is Knitwright's own run, which ops orders, and it needs orders.
      kind: "sample",
      design: designFactsOf(project, who.brandName),
      object: object.object,
      article,
      factory: factory.factory,
      capability: factory.capability,
      fabrics: factory.fabrics,
      fabricColours: factory.colours,
      markets: factory.markets,
      print: printSettingsOf(context.profile),
      moderation: moderationOf(targets, statuses),
      // No promised date can be worked out yet: QC days and freight days are unset everywhere (plan v5 X6).
      dueDate: null,
      madeByKnitwright: MADE_BY_KNITWRIGHT,
      orders: [],
      personalisation: [],
      unsourced: NOTHING_UNSOURCED,
    },
  };
}

/** The tech pack PDF of the same version, with its dates pinned to the version's save time, as the package is. */
async function techPack(clients: Clients, who: Who, projectId: string): Promise<KppSources["techpack"]> {
  const source = await loadTechPackSource(clients.client, who.brandId, projectId, { shrink: shrinkForPrint, maxEmbeddedBytes: PRINT_MAX_EMBEDDED_BYTES });
  const pack = buildPackFor({
    project: source.project,
    history: source.history,
    brandName: who.brandName,
    now: new Date(source.project.versionSavedAt),
    charts: source.charts,
    memberNames: source.memberNames,
    ...(source.production === undefined ? {} : { production: source.production }),
  });
  return techPackPdfSource(pack, source.pictures.images);
}

/**
 * The generators the package is built from. The pattern and the print files come from one drafted
 * `GradedPattern`, which is the whole point of this seam: `03_patterns/**` and `04_print/**` cannot disagree.
 */
async function sourcesFor(clients: Clients, who: Who, projectId: string, input: KppInput, project: OpenProject, context: PrintContext): Promise<Readonly<{ sources: KppSources; notes: readonly string[] }>> {
  const drafted = draftedPattern(input.design.articleCode);
  if (!drafted.ok) throw new AppError("conflict", drafted.reason);
  const print = printSource({
    drafted: { pattern: drafted.pattern, articleCode: input.design.articleCode, articleVersion: drafted.articleVersion, drafter: DRAFTED_BY },
    spec: project.spec,
    colourwayId: currentStack(project.spec).colourways[0]?.id ?? "main",
    printFileType: input.factory.printFileType,
    print: input.print,
    context,
  });
  return {
    sources: { pattern: drafted.source, print: print.source, techpack: await techPack(clients, who, projectId), renders: { frontBack: async () => null } },
    notes: [...print.notes, ...drafted.warnings, MADE_BY_NOTE],
  };
}

/**
 * One production package for one design version, built when it is asked for and sent once. Nothing is stored
 * but the record of what was sent (`package_exports`), and the ZIP is not sent when that record cannot be
 * written. The order is decision 0070 revision 2's: check, charge, build, record, send.
 */
export async function serveProductionPackage(who: Who, projectId: string): Promise<Response> {
  const clients: Clients = { client: await sessionClient(), admin: adminClient() };
  const { rows, project, context } = await readRows(clients, who, projectId);
  const built = buildKppInput(rows);
  const { sources, notes } = await sourcesFor(clients, who, projectId, built, project, context);
  const input: KppInput = { ...built, notes: [...built.notes, ...notes] };
  const charging = creditCharge(packageGate, who, WHERE);
  const result = await exportPackage(input, sources, charging.charge);
  if (!result.ok) throw packageRefusal(result);
  await recordPackageExport(clients.admin, projectId, who.userId, result.record);
  return packageResponse(result.zip, packageFileName(input), charging.note());
}
