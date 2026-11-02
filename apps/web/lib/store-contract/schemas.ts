import { z } from "zod";
import { dropPayloadSchema } from "@/lib/collections/schemas";
import { LISTING_KIND, LISTING_PAYLOAD_VERSION, type ListingPayload } from "@/lib/flows/listing";
import { FLOW_FORMATS } from "@/lib/flows/types";
import { SELL_CURRENCIES } from "@/lib/factory/schemas";

/**
 * What this contract accepts, on the way in and on the way out of the database.
 *
 * Two of the payloads are not this workstream's: a collection drop is Z4's (decision 0085) and a
 * launch listing is L6's (decision 0096). Both are already written, both are already stored, and
 * this contract carries each one through unchanged rather than writing a second one beside it. So
 * the drop's own schema is reused as it stands, and the listing's is written here against L6's own
 * type: `z.ZodType<ListingPayload>` makes a change to that type a compile error here, which is how
 * the two stay the same shape.
 *
 * A stored payload is parsed every time it is read. It was written by this platform, but it is
 * `jsonb` and it was written by an older deploy than the one reading it, so a shape this code does
 * not recognise is a failure and never a value that reaches another product.
 */

/** The query every list endpoint takes: a page of rows, newest first. */
export const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Only rows for one brand, where the caller knows which. */
  brandId: z.uuid().optional(),
});
export type ListQuery = z.output<typeof listQuery>;

/** The products endpoint also takes the market it is asking about, because a price is per market. */
export const productsQuery = listQuery.extend({
  currency: z.enum(SELL_CURRENCIES).optional(),
  /** ISO 3166 alpha-2, for the destination's freight days. Defaults to the one market selling is on for. */
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
});
export type ProductsQuery = z.output<typeof productsQuery>;

export { dropPayloadSchema };

const listingMediaSchema = z.object({
  boardId: z.string().min(1),
  name: z.string().min(1),
  fileId: z.string().min(1),
  format: z.enum(FLOW_FORMATS),
  role: z.enum(["image", "video"]),
  label: z.string().min(1).nullable(),
  trueColourFileId: z.string().min(1).nullable(),
  sort: z.number().int().min(1),
});

/** L6's listing payload as stored. Held to L6's own type, so the two cannot drift apart. */
export const listingPayloadSchema: z.ZodType<ListingPayload> = z.object({
  kind: z.literal(LISTING_KIND),
  payloadVersion: z.literal(LISTING_PAYLOAD_VERSION),
  launchProjectId: z.string().min(1),
  title: z.string().min(1),
  designProjectId: z.string().min(1).nullable(),
  designVersion: z.number().int().min(1).nullable(),
  media: z.array(listingMediaSchema),
  note: z.string().min(1),
  ruleId: z.string().regex(/^R-[A-Z]+-[0-9]{3}$/),
});
