import { z } from "zod";
import { brandNameSchema } from "./service";

export const brandNameFormSchema = z.object({ name: brandNameSchema });

export const switchBrandSchema = z.object({ brandId: z.uuid("Choose one of your brands.") });
