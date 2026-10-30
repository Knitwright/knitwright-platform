import { z } from "zod";
import { SELL_CURRENCIES } from "@/lib/factory/schemas";
import { STYLE_STATUSES } from "./vocabulary";

/**
 * What the collection screens may send (plan v5 Z4, decision 0085). The brand and the person are never
 * in a body: they come from the session. Money is an integer in minor units, never a decimal and never
 * a float, and nothing here is a payment of any kind: the platform takes none (owner decision 1).
 */

const minor = z.number().int().min(0).max(100_000_000);
const name = z.string().trim().min(1).max(80);
const canvas = z.number().int().min(-100_000).max(100_000);
const sizeLabel = z.string().trim().min(1).max(16);
const requestKey = z.string().min(8).max(64);
const articleCode = z.string().regex(/^[A-Z]{3}-[A-Z]{2}-[0-9]{2}$/, "Use an article code such as JSY-SS-01.");
const fabricCode = z.string().regex(/^F-[A-Z0-9]+(-[A-Z0-9]+)*$/, "Use a fabric code such as F-POLY-INT.");

export const createCollectionBody = z.object({
  name,
  /** ISO 3166 alpha-2. The database refuses a country Knitwright does not sell to. */
  destinationCountry: z.string().trim().length(2).regex(/^[A-Z]{2}$/),
  currency: z.enum(SELL_CURRENCIES),
});
export type CreateCollectionBody = z.output<typeof createCollectionBody>;

export const saveFrameBody = z.object({
  collectionId: z.uuid(),
  /** Null creates a group; an id renames or moves one. */
  frameId: z.uuid().nullable().default(null),
  name: z.string().trim().min(1).max(60),
  x: canvas.default(0),
  y: canvas.default(0),
});

export const saveStyleBody = z.object({
  collectionId: z.uuid(),
  /** Null adds a style card; an id changes one. */
  styleId: z.uuid().nullable().default(null),
  frameId: z.uuid().nullable().default(null),
  productId: z.uuid().nullable().default(null),
  name,
  status: z.enum(STYLE_STATUSES).default("draft"),
  colourway: z.string().trim().max(60).default(""),
  articleCode: articleCode.nullable().default(null),
  fabricCode: fabricCode.nullable().default(null),
  productionClass: z.enum(["A", "B"]).nullable().default(null),
  wholesaleMinor: minor.nullable().default(null),
  rrpMinor: minor.nullable().default(null),
  /** The wholesale share of the units, in basis points: 6000 is 60% wholesale. */
  wholesaleSplitBp: z.number().int().min(0).max(10_000).default(0),
  /** Pieces per size. The style's quantity is their sum, so it is never sent on its own. */
  sizes: z.record(sizeLabel, z.number().int().min(0).max(999_999)).default({}),
  x: canvas.default(0),
  y: canvas.default(0),
});
export type SaveStyleBody = z.output<typeof saveStyleBody>;

export const removeStyleBody = z.object({ collectionId: z.uuid(), styleId: z.uuid() });

/** Removing a whole plan. Its groups, styles, sizes and exported payloads go with it. */
export const removeCollectionBody = z.object({ collectionId: z.uuid() });

/** "Create drop": the app builds the payload itself, so the body names only the plan. */
export const createDropBody = z.object({ collectionId: z.uuid() });

/** "Order samples for all approved styles": one request key covers the whole press. */
export const orderSamplesBody = z.object({ collectionId: z.uuid(), requestKey });

/** The drop payload, checked before it is written, so nothing malformed is ever handed to the Store. */
export const dropPayloadSchema = z.object({
  kind: z.literal("collection-drop"),
  payloadVersion: z.number().int().min(1),
  collectionId: z.uuid(),
  collectionName: z.string().min(1),
  destinationCountry: z.string().regex(/^[A-Z]{2}$/),
  currency: z.enum(SELL_CURRENCIES),
  generatedAt: z.string(),
  styles: z
    .array(
      z.object({
        styleId: z.uuid(),
        name: z.string().min(1),
        colourway: z.string(),
        status: z.enum(STYLE_STATUSES),
        group: z.string().nullable(),
        articleCode: articleCode.nullable(),
        fabricCode: fabricCode.nullable(),
        productionClass: z.enum(["A", "B"]).nullable(),
        productId: z.uuid().nullable(),
        sizes: z.array(z.object({ size: sizeLabel, targetQty: z.number().int().min(1) })),
        targetUnits: z.number().int().min(0),
        wholesaleMinor: minor.nullable(),
        rrpMinor: minor.nullable(),
        unitCostMinor: minor.nullable(),
        marginBp: z.number().int().nullable(),
      }),
    )
    .min(1)
    .max(500),
  totals: z.object({
    styles: z.number().int().min(0),
    colourways: z.number().int().min(0),
    skus: z.number().int().min(0),
    targetUnits: z.number().int().min(0),
    landedCostMinor: z.number().int().nullable(),
    wholesaleRevenueMinor: z.number().int().nullable(),
    d2cRevenueMinor: z.number().int().nullable(),
    marginBp: z.number().int().nullable(),
  }),
  assumes: z.string().min(1),
  handover: z.string().min(1),
  labels: z.array(z.string()),
  notes: z.array(z.string()),
});
