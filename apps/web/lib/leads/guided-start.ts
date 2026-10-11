import { z } from "zod";
import { guidedStartSchema } from "@/lib/guided/start";
import { buyerKindSchema } from "./buyer-kind";

/** The guided start's form: the path first (decision 0024), then the way to start (lib/guided/start.ts). */
export const guidedStartWithKindSchema = z.intersection(z.object({ buyerKind: buyerKindSchema }), guidedStartSchema);
