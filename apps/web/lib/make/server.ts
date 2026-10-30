import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getBaseArticle, baseArticleForType } from "@/lib/catalogue";
import { promisedDate, type PromisedDate } from "@/lib/factory/dates";
import type { Ladder } from "@/lib/factory/pricing";
import { loadProductionSettings } from "@/lib/factory/production-settings";
import type { Capability, FactorySnapshot, SellCurrency } from "@/lib/factory/schemas";
import { capabilityFor } from "@/lib/factory/service";
import { factoryStore } from "@/lib/factory/server";
import type { GarmentSpec } from "@/lib/garment/spec-schema";
import { rosterContextOf } from "@/lib/orders/context";
import { getProjectAt } from "@/lib/projects/project-reads";
import { listReleases } from "@/lib/releases/service";
import { loadIllustrations } from "@/lib/images/illustrations";
import { latestImages } from "@/lib/images/service";
import { adminClient } from "@/lib/server/deps";
import { createFileReader, TOO_LARGE } from "@/lib/storage/read";
import { shrinkPicture } from "@/lib/storage/thumbnail";
import { listProducts, type ProductView } from "@/lib/brand-runs/service";
import { buildMakeContext, toOrderProducts, type FactoryFacts, type MakeContext, type ProductRef } from "./context";
import type { OrderProduct } from "./order-modal";
import type { RunClass } from "./run";
import { listGoldenSamples, type GoldenSampleView } from "./service";

/**
 * Joins the make pages to the database: the design and its versions, the product and its golden samples, the
 * base article and the factory rows. It holds no rules of its own -- `context.ts` has those and is tested -- and
 * it reads the factory model with the server's own key, as decision 0071 asks.
 *
 * The country whose freight days apply comes from the market the person is looking at: GBP is the United
 * Kingdom, AUD is Australia (spec F-S8). Where a part of the sum is not set, the date is not set.
 */

const COUNTRY_OF: Readonly<Record<SellCurrency, string>> = { GBP: "GB", AUD: "AU" };

/** How many versions back a golden sample's own design is read, so a long history cannot make the page slow. */
const VERSIONS_COMPARED = 3;

type Factory = Awaited<ReturnType<ReturnType<typeof factoryStore>["listFactories"]>>[number];

interface FactoryData {
  readonly factory: Factory | null;
  readonly snapshot: FactorySnapshot | null;
  readonly freightDays: number | null;
  readonly cutoff: Awaited<ReturnType<typeof loadProductionSettings>>;
}

/** The one factory on file (decision 0071 seeds a single placeholder), with the country rule of the market. */
async function readFactory(currency: SellCurrency): Promise<FactoryData> {
  const store = factoryStore();
  const [factories, rules, cutoff] = await Promise.all([store.listFactories(), store.listCountryRules(), loadProductionSettings(adminClient())]);
  const factory = [...factories].sort((a, b) => a.slug.localeCompare(b.slug))[0] ?? null;
  const rule = rules.find((one) => one.country === COUNTRY_OF[currency] && one.sellingEnabled) ?? null;
  return { factory, snapshot: factory ? await store.snapshot(factory) : null, freightDays: rule?.freightDays ?? null, cutoff };
}

const ladderOf = (data: FactoryData, capability: Capability | undefined): Ladder =>
  capability && data.snapshot ? data.snapshot.tiers.filter((tier) => tier.capabilityId === capability.id) : [];

const dateFor = (data: FactoryData, capability: Capability | undefined, productionClass: RunClass, orderAt: Date): PromisedDate =>
  promisedDate({
    orderAt,
    productionClass: productionClass ?? "A",
    timeZone: data.factory?.timeZone ?? "UTC",
    cutoff: data.cutoff.cutoff,
    leadTimeDays: capability?.leadTimeDays ?? null,
    qcDays: data.cutoff.qcDays,
    freightDays: data.freightDays,
  });

/** "Made by Knitwright · Sialkot", with the factory row's own label, because that label is what stands behind it. */
const madeByOf = (data: FactoryData): string =>
  data.factory === null ? "No factory is on file yet." : `Made by Knitwright · ${data.factory.city} · ${data.factory.label}`;

function factsFor(data: FactoryData, articleCode: string | null, productionClass: RunClass, orderAt: Date, profileId: string): FactoryFacts {
  const capability = data.snapshot && articleCode ? capabilityFor(data.snapshot, articleCode) : undefined;
  return {
    profileId,
    madeBy: madeByOf(data),
    ladder: ladderOf(data, capability),
    promised: dateFor(data, capability, productionClass, orderAt),
    placeholder: data.cutoff.isPlaceholder,
    fabricKeys: data.snapshot && articleCode ? [...new Set(data.snapshot.capabilities.filter((one) => one.articleCode === articleCode).map((one) => one.fabricCode))] : [],
    colourDeltaMax: capability?.colourDeltaMax ?? null,
    moq: capability?.moq ?? null,
  };
}

/** The base article behind a garment type, for the production class, the size run and the sample size. */
async function readArticle(client: SupabaseClient, garmentType: string) {
  const code = baseArticleForType(garmentType) ?? null;
  if (code === null) return { code: null, productionClass: null as RunClass, sizeRange: [] as readonly string[], sampleSize: null };
  const article = await getBaseArticle(client, code);
  return {
    code,
    productionClass: (article?.productionClass ?? null) as RunClass,
    sizeRange: article?.sizeRange ?? ([] as readonly string[]),
    sampleSize: article?.sampleSize ?? null,
  };
}

const productOf = (products: readonly ProductView[], projectId: string): ProductRef | null => {
  const found = products.find((product) => product.projectId === projectId);
  return found ? { id: found.id, name: found.name, stage: found.stage, designVersion: found.designVersion } : null;
};

/** The design as it was saved at each version a signed-off golden sample was cut from. */
async function readOldVersions(client: SupabaseClient, brandId: string, projectId: string, samples: readonly GoldenSampleView[], current: number): Promise<Map<number, GarmentSpec>> {
  const wanted = [...new Set(samples.filter((one) => one.state === "approved" && one.designVersion !== current).map((one) => one.designVersion))]
    .sort((a, b) => b - a)
    .slice(0, VERSIONS_COMPARED);
  const pairs = await Promise.all(
    wanted.map(async (version) => {
      const read = await getProjectAt(client, brandId, projectId, version).catch(() => null);
      return read ? ([version, read.spec] as const) : null;
    }),
  );
  return new Map(pairs.filter((pair): pair is readonly [number, GarmentSpec] => pair !== null));
}

/** Everything the make pages of one design show. */
export async function loadMake(client: SupabaseClient, brandId: string, projectId: string, currency: SellCurrency, now: Date = new Date()): Promise<MakeContext> {
  const [project, releases, products] = await Promise.all([
    getProjectAt(client, brandId, projectId),
    listReleases(client, brandId, projectId),
    listProducts(client, brandId),
  ]);
  const product = productOf(products, projectId);
  const [article, factory, goldenSamples] = await Promise.all([
    readArticle(client, project.garmentType),
    readFactory(currency),
    product ? listGoldenSamples(client, brandId, product.id) : Promise.resolve([] as readonly GoldenSampleView[]),
  ]);
  const specsByVersion = await readOldVersions(client, brandId, projectId, goldenSamples, project.currentVersion);
  const sizeRun = rosterContextOf(project.spec).run;

  return buildMakeContext({
    projectId,
    designName: project.name,
    garmentLabel: project.garmentLabel,
    currentVersion: project.currentVersion,
    spec: project.spec,
    product,
    articleCode: article.code,
    productionClass: article.productionClass,
    sizeRun: sizeRun.length > 0 ? sizeRun : article.sizeRange,
    sampleSize: article.sampleSize,
    releases: releases.map((release) => ({ id: release.id, number: release.number, label: release.label, version: null })),
    goldenSamples,
    specsByVersion,
    factory: factsFor(factory, article.code, article.productionClass, now, "knitwright-default"),
    currency,
  });
}

/** The brand's products, for the order modal's "search my products". */
export async function loadOrderProducts(client: SupabaseClient, brandId: string, currency: SellCurrency, now: Date = new Date()): Promise<readonly OrderProduct[]> {
  const [products, factory] = await Promise.all([listProducts(client, brandId), readFactory(currency)]);
  const rows = await Promise.all(
    products.map(async (product) => {
      const project = await getProjectAt(client, brandId, product.projectId).catch(() => null);
      if (!project) return null;
      const article = await readArticle(client, project.garmentType);
      const capability = factory.snapshot && article.code ? capabilityFor(factory.snapshot, article.code) : undefined;
      const sizeRun = rosterContextOf(project.spec).run;
      return {
        productId: product.id,
        projectId: product.projectId,
        name: product.name,
        articleCode: article.code,
        productionClass: article.productionClass,
        sizes: sizeRun.length > 0 ? sizeRun : article.sizeRange,
        ladder: ladderOf(factory, capability),
        promised: dateFor(factory, capability, article.productionClass, now),
        madeBy: madeByOf(factory),
        colourway: project.spec.colourways[0]?.name ?? "",
      };
    }),
  );
  return toOrderProducts(rows.filter((row): row is NonNullable<typeof row> => row !== null));
}

export interface Hero {
  readonly src: string;
  readonly alt: string;
  /** What the picture is. A render is always said to be a render, never a photo of a garment. */
  readonly label: string;
}

const HERO_EDGE = 640;

/** The golden sample's own photo once there is one; otherwise the newest render, said to be a render. */
export async function loadHero(client: SupabaseClient, brandId: string, projectId: string, photoFileId: string | null): Promise<Hero | null> {
  if (photoFileId !== null) {
    const stored = await createFileReader(client, brandId).read(photoFileId, 10 * 1024 * 1024).catch(() => null);
    const small = stored && stored !== TOO_LARGE ? await shrinkPicture(stored, HERO_EDGE) : null;
    if (small) {
      return {
        src: `data:${small.contentType};base64,${Buffer.from(small.bytes).toString("base64")}`,
        alt: "The golden sample as it was photographed",
        label: "A photo of the golden sample",
      };
    }
  }
  const latest = await latestImages(client, brandId, projectId).catch(() => null);
  const loaded = latest ? await loadIllustrations(createFileReader(client, brandId), latest) : null;
  const first = loaded?.illustrations[0];
  return first ? { src: first.src, alt: first.alt, label: "A render, not a photo of a garment" } : null;
}

export interface Picture {
  readonly id: string;
  readonly label: string;
}

/** The brand's own pictures, so a photo of the sample can be one it already holds. */
export async function loadPictures(client: SupabaseClient, brandId: string): Promise<readonly Picture[]> {
  const { data, error } = await client
    .from("files")
    .select("id, path, kind, created_at")
    .eq("brand_id", brandId)
    .in("kind", ["photo", "render", "artwork"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  const rows = z.array(z.object({ id: z.uuid(), path: z.string(), kind: z.string(), created_at: z.string() })).safeParse(data ?? []);
  if (!rows.success) return [];
  return rows.data.map((row) => ({ id: row.id, label: `${row.path.split("/").pop() ?? row.id} · ${row.kind} · ${row.created_at.slice(0, 10)}` }));
}

/** The samples of a product already sent to production, newest first: a golden sample is judged from one. */
export async function loadSampleRuns(client: SupabaseClient, brandId: string, projectId: string): Promise<readonly Readonly<{ id: string; label: string }>[]> {
  const products = await listProducts(client, brandId);
  const product = products.find((one) => one.projectId === projectId);
  if (!product) return [];
  return product.runs
    .filter((run) => run.kind === "sample")
    .map((run) => ({ id: run.id, label: `Sample of ${Object.keys(run.sizes).join(", ")} · ${run.createdAt.slice(0, 10)}` }));
}
