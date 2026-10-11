import { z } from "zod";
import { organisationDetailsSchema } from "@/lib/leads/organisation";
import { brandNameSchema } from "./service";

export const brandNameFormSchema = z.object({ name: brandNameSchema });

/** A new brand: its name, and the optional organisation details (decision 0024). */
export const newBrandFormSchema = z.intersection(brandNameFormSchema, organisationDetailsSchema);

export const switchBrandSchema = z.object({ brandId: z.uuid("Choose one of your brands.") });
