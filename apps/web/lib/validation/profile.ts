import { z } from "zod";
import { listTypes } from "@/lib/garment";

/** A value that may be missing. A missing value is `not-set`, never a guess. */
const settable = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion("status", [z.object({ status: z.literal("not-set") }), z.object({ status: z.literal("set"), value })]);

const positiveInt = z.number().int().min(1).max(1_000_000);

export const factoryProfileSchema = z.object({
  /** A stable slug. */
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64),
  name: z.string().min(1).max(120),
  /** Says who has agreed to this profile. */
  label: z.string().min(1).max(200),
  /** The garment types the factory makes, each with a minimum order. */
  articles: z.array(z.object({ typeId: z.string().max(64), moq: settable(positiveInt) })).max(500),
  /** Fabrics the factory prints, each with a swatch reference and a colour difference. */
  fabrics: z.array(z.object({ name: z.string().min(1).max(120), swatchRef: z.string().max(120).nullable(), colourDelta: settable(z.number().min(0).max(100)) })).max(200),
  structuralOptions: z.array(z.string().max(64)).max(200),
  priceLadder: settable(z.array(z.object({ fromPieces: positiveInt, unitPrice: z.number().min(0) })).min(1).max(20)),
  leadTimeDays: settable(positiveInt),
  fileFormats: z.array(z.string().max(16)).max(20),
  hsCodes: settable(z.record(z.string().max(64), z.string().regex(/^[0-9.]{4,12}$/))),
});
export type FactoryProfile = z.output<typeof factoryProfileSchema>;

export const DEFAULT_PROFILE_LABEL = "Knitwright default profile, not agreed with a factory";

/** The one seeded profile: every garment in the registry, and nothing invented about MOQ, price or lead time. */
export function defaultFactoryProfile(): FactoryProfile {
  return {
    id: "knitwright-default",
    name: "Knitwright default",
    label: DEFAULT_PROFILE_LABEL,
    articles: listTypes().map((type) => ({ typeId: type.id, moq: { status: "not-set" } })),
    fabrics: [],
    structuralOptions: [],
    priceLadder: { status: "not-set" },
    leadTimeDays: { status: "not-set" },
    fileFormats: [],
    hsCodes: { status: "not-set" },
  };
}
