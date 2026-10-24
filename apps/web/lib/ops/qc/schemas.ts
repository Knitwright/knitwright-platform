import { z } from "zod";
import { checkOwnerAndDue } from "../exceptions/rules";
import { CHECKLIST_KEYS, CHECKLIST_RESULTS, evaluateInspection, type ChecklistItem } from "./checklist";
import { parseFileIds, parseMeasurements, parseSizes } from "./parse";
import type { InspectionToRecord } from "./service";

const result = z.enum(CHECKLIST_RESULTS, "Choose pass, fail or not inspected.");
const int = (label: string, min: number, max: number) => z.coerce.number(`${label}: give a number.`).int(`${label}: whole numbers only.`).min(min, `${label}: at least ${min}.`).max(max, `${label}: at most ${max}.`);

/**
 * The inspection form. The result is not a field: it is worked out from the answers (checklist, measurements against
 * their tolerances, defects), as the database does. A fail must say what to make again, who owns it and by when.
 */
export const inspectionFormSchema = z
  .object({
    orderId: z.uuid("That is not an order."),
    measurementsResult: result,
    colourResult: result,
    artworkResult: result,
    namesNumbersResult: result,
    measurements: z.string().default(""),
    sampleSize: int("Pieces inspected", 1, 99_999),
    defectCount: int("Defective pieces", 0, 99_999),
    photos: z.string().default(""),
    note: z.string().trim().max(300, "Keep the note under 300 characters.").default(""),
    remakeSizes: z.string().default(""),
    remakeOwner: z.string().trim().default(""),
    remakeDueOn: z.string().default(""),
  })
  .transform((v, ctx): InspectionToRecord => {
    const fail = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
      return z.NEVER;
    };
    const measurements = parseMeasurements(v.measurements);
    if (!measurements.ok) return fail("measurements", measurements.problem);
    const photos = parseFileIds(v.photos);
    if (!photos.ok) return fail("photos", photos.problem);
    if (v.defectCount > v.sampleSize) return fail("defectCount", "More defective pieces than pieces inspected.");
    const answers: Record<(typeof CHECKLIST_KEYS)[number], z.infer<typeof result>> = {
      measurements: v.measurementsResult, colour: v.colourResult, artwork: v.artworkResult, names_numbers: v.namesNumbersResult,
    };
    const checklist: ChecklistItem[] = CHECKLIST_KEYS.map((key) => ({ key, result: answers[key], note: "" }));
    const evaluation = evaluateInspection({ checklist, measurements: measurements.value, defectCount: v.defectCount });
    const base = { orderId: v.orderId, checklist, measurements: measurements.value, sampleSize: v.sampleSize, defectCount: v.defectCount, photoFileIds: photos.value, note: v.note };
    if (evaluation.result === "pass") return { ...base, remake: null };
    const sizes = parseSizes(v.remakeSizes);
    if (!sizes.ok) return fail("remakeSizes", `This inspection fails (${evaluation.reasons[0] ?? "see the checklist"}). ${sizes.problem}`);
    const problem = checkOwnerAndDue(v.remakeOwner, v.remakeDueOn);
    if (problem) return fail(v.remakeOwner === "" ? "remakeOwner" : "remakeDueOn", problem);
    return { ...base, remake: { sizes: sizes.value, owner: v.remakeOwner, dueOn: v.remakeDueOn } };
  });
