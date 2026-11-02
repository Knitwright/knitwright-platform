/**
 * Every allowance, timeout and weight brand import uses, in one place and as **data**, never as a
 * literal somewhere in the code (plan v5 rule "Data, not constants").
 *
 * Each one has a key under `brand_import.*`, a schema, and a Knitwright default labelled as a
 * draft. A platform admin's row wins; a row that no longer passes its schema is ignored and the
 * default is used, exactly as `lib/settings/resolve.ts` does for the settings the console already
 * shows. The keys are not in `lib/settings/registry.ts` yet, because that file belongs to no
 * workstream in this wave; adding them to the console is an owner question on the pull request.
 *
 * Nothing here is a measurement. The numbers are chosen to be polite and cheap rather than tuned:
 * one page, a handful of pictures, ten seconds each, a minute in all.
 */

import { z } from "zod";
import type { RateLimitRule } from "@/lib/server/core/guard";
import type { StoredSettings } from "@/lib/settings/types";
import { DRAFT_LABEL } from "./words";

const MINUTE = 60;
const HOUR = 60 * MINUTE;

export interface BrandImportSettings {
  /** How long one request may take. Z3 uses ten seconds, and so does this. */
  readonly timeoutMs: number;
  /** The whole import's budget. F-S9 says "in about a minute". */
  readonly budgetMs: number;
  /** A page over this is not read: a brand's home page is words, not a download. */
  readonly pageBytes: number;
  /** One picture over this is not read. A logo and a product photo are both small. */
  readonly pictureBytes: number;
  /** How many pictures are read at all, logos and product photos together. */
  readonly pictures: number;
  /** How many colours a palette is proposed with. */
  readonly colours: number;
  /** Two colours closer than this in CIE76 are the same colour, so only one is proposed. */
  readonly colourGap: number;
  /** How many of the brand's own pictures the visual style needs. F-S9 says five or more. */
  readonly stylePictures: number;
  /** Imports one brand may run in an hour, whoever asks. */
  readonly importsPerHour: number;
  /** Requests one brand may make to one site in an hour: the page, its robots.txt, its pictures. */
  readonly requestsPerHostPerHour: number;
}

/** Knitwright's own figures. Every one is a draft and is labelled as one wherever it is shown. */
export const DEFAULT_IMPORT_SETTINGS: BrandImportSettings = {
  timeoutMs: 10_000,
  budgetMs: 60_000,
  pageBytes: 2_000_000,
  pictureBytes: 4_000_000,
  pictures: 16,
  colours: 6,
  colourGap: 4,
  stylePictures: 5,
  importsPerHour: 6,
  requestsPerHostPerHour: 40,
};

/** Said wherever one of these numbers is shown. */
export const SETTINGS_SOURCE = `${DRAFT_LABEL}: chosen to be polite and cheap, not tuned.`;

const whole = (min: number, max: number) => z.number().int().min(min).max(max);

type Key = keyof BrandImportSettings;

/** The setting key and schema behind each figure, so an admin row can replace it. */
export const IMPORT_SETTING_KEYS: Readonly<Record<Key, Readonly<{ key: string; schema: z.ZodType<number> }>>> = {
  timeoutMs: { key: "brand_import.timeout_ms", schema: whole(1_000, 30_000) },
  budgetMs: { key: "brand_import.budget_ms", schema: whole(5_000, 300_000) },
  pageBytes: { key: "brand_import.page_bytes", schema: whole(10_000, 10_000_000) },
  pictureBytes: { key: "brand_import.picture_bytes", schema: whole(10_000, 20_000_000) },
  pictures: { key: "brand_import.pictures", schema: whole(1, 60) },
  colours: { key: "brand_import.colours", schema: whole(1, 24) },
  colourGap: { key: "brand_import.colour_gap", schema: whole(1, 40) },
  stylePictures: { key: "brand_import.style_pictures", schema: whole(1, 40) },
  importsPerHour: { key: "brand_import.imports_per_hour", schema: whole(1, 200) },
  requestsPerHostPerHour: { key: "brand_import.requests_per_host_per_hour", schema: whole(1, 500) },
};

const KEYS = Object.keys(IMPORT_SETTING_KEYS) as readonly Key[];

/** The stored number for one figure, or undefined when nothing valid is stored. */
const storedNumber = (stored: StoredSettings, name: Key): number | undefined => {
  const row = stored[IMPORT_SETTING_KEYS[name].key];
  if (!row) return undefined;
  const parsed = IMPORT_SETTING_KEYS[name].schema.safeParse(row.value);
  return parsed.success ? parsed.data : undefined;
};

/** The platform's rows laid over Knitwright's defaults. A bad row can never break an import. */
export const importSettingsWith = (stored: StoredSettings, base: BrandImportSettings = DEFAULT_IMPORT_SETTINGS): BrandImportSettings =>
  Object.fromEntries(KEYS.map((name) => [name, storedNumber(stored, name) ?? base[name]])) as unknown as BrandImportSettings;

/**
 * The per-brand allowances, as rules of the shape `lib/server/rate-limit.ts` counts. They are
 * counted **per brand**, not per person, because the spec limits the reading of a site and ten
 * people in one brand must not be able to read sixty pages of it between them. `LIMITS.brandImport`
 * in `lib/server/limits.ts` counts the same action per person and per address, as every action is.
 */
export const importLimits = (settings: BrandImportSettings = DEFAULT_IMPORT_SETTINGS): Readonly<Record<"brandRun" | "hostRequest", RateLimitRule>> => ({
  brandRun: { name: "brand-import-run", limit: settings.importsPerHour, windowSeconds: HOUR },
  hostRequest: { name: "brand-import-host", limit: settings.requestsPerHostPerHour, windowSeconds: HOUR },
});

export const brandRunKey = (brandId: string): string => `brand-import-run:brand:${brandId}`;
export const hostRequestKey = (brandId: string, host: string): string => `brand-import-host:brand:${brandId}:host:${host.toLowerCase()}`;
