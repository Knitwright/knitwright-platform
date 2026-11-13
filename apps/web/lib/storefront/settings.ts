import { z } from "zod";
import { RESERVED_SUBDOMAINS, SLUG_PATTERN } from "@/lib/team-stores/host";
import { DEFAULT_RETURNS_POLICY, RETURNS_POLICY_MAX } from "./policy";
import type { Storefront } from "./rows";

/**
 * STOREFRONT SETTINGS (spec F-L5): the address, the name, whether it is live, the returns policy and the EU
 * responsible person for GPSR. C5's Store pages link here (`/store/storefront`); this workstream owns the form.
 */

export const STOREFRONT_PATH = "/store/storefront";

export const storefrontBody = z.object({
  name: z.string().trim().min(1, "Name your storefront.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "Use 3 to 40 lower-case letters, numbers and dashes, not starting or ending with a dash.")
    .refine((slug) => !slug.includes("--"), "Use one dash at a time.")
    .refine((slug) => !RESERVED_SUBDOMAINS.includes(slug), "That address is kept for Knitwright. Choose another."),
  status: z.enum(["draft", "live"]),
  returnsPolicy: z.string().trim().min(1, "Write the returns policy.").max(RETURNS_POLICY_MAX),
  euResponsiblePerson: z
    .string()
    .trim()
    .max(300)
    .transform((value) => (value === "" ? null : value)),
});
export type StorefrontInput = z.output<typeof storefrontBody>;

/** The form's starting values: the saved storefront, or the brand's name and the spec's policy. */
export function storefrontDefaults(saved: Storefront | null, brandName: string, suggestedSlug: string): Readonly<{
  name: string;
  slug: string;
  status: "draft" | "live";
  returnsPolicy: string;
  euResponsiblePerson: string;
}> {
  if (saved) return { name: saved.name, slug: saved.slug, status: saved.status, returnsPolicy: saved.returnsPolicy, euResponsiblePerson: saved.euResponsiblePerson ?? "" };
  return { name: brandName.slice(0, 80), slug: suggestedSlug, status: "draft", returnsPolicy: DEFAULT_RETURNS_POLICY, euResponsiblePerson: "" };
}

/** The storefront row to write. Whoever puts the storefront live becomes the person its batches are ordered as. */
export function storefrontWrite(input: StorefrontInput, brandId: string, userId: string, saved: Storefront | null) {
  const owner = input.status === "live" && saved?.status !== "live" ? userId : (saved?.batchOwner ?? (input.status === "live" ? userId : null));
  return {
    brand_id: brandId,
    slug: input.slug,
    name: input.name,
    status: input.status,
    returns_policy: input.returnsPolicy,
    eu_responsible_person: input.euResponsiblePerson,
    batch_owner: owner,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  };
}

export const SLUG_TAKEN = "That address is taken. Choose another.";
