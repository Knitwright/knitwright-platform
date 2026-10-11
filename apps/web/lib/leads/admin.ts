import { z } from "zod";
import { BUYER_KINDS, type BuyerKind } from "./buyer-kind";
import { ORGANISATION_TYPES, type OrganisationType } from "./organisation";
import { isCalendarDate, quoteStatusSchema } from "./quote";
import { LEAD_OWNERS, suggestedOwner, type LeadOwner } from "./routing";
import { isHot, leadScore, type LeadScore } from "./score";

/**
 * The leads page for platform admins: one row per brand, read from admin_lead_rows, scored and
 * sorted here. The forms an admin uses to set the owner, the next step and a quote's status are
 * checked here too.
 */

const ids = <T extends string>(list: readonly { id: T }[]) => list.map((entry) => entry.id) as [T, ...T[]];

const timestamp = z.string().min(1);
const date = z.string().refine(isCalendarDate);

const quoteRow = z
  .object({
    id: z.uuid(),
    project_id: z.uuid(),
    project_name: z.string(),
    version: z.number().int(),
    quantity: z.number().int(),
    needed_by: date,
    sizes_note: z.string(),
    message: z.string(),
    status: quoteStatusSchema,
    created_at: timestamp,
  })
  .transform((quote) => ({
    id: quote.id,
    projectId: quote.project_id,
    projectName: quote.project_name,
    version: quote.version,
    quantity: quote.quantity,
    neededBy: quote.needed_by,
    sizesNote: quote.sizes_note,
    message: quote.message,
    status: quote.status,
    createdAt: quote.created_at,
  }));

const leadRow = z
  .object({
    id: z.uuid(),
    name: z.string(),
    organisation_type: z.enum(ids<OrganisationType>(ORGANISATION_TYPES)).nullable(),
    country: z.string().nullable(),
    region: z.string().nullable(),
    segment: z.enum(ids<BuyerKind>(BUYER_KINDS)).nullable(),
    created_at: timestamp,
    updated_at: timestamp,
    emails: z.array(z.string()),
    designs: z.number().int(),
    most_versions: z.number().int(),
    // Whether the brand has made any share link.
    shared: z.boolean(),
    last_design_at: timestamp.nullable(),
    quotes: z.array(quoteRow),
    lead: z
      .object({
        owner: z.enum(ids<LeadOwner>(LEAD_OWNERS)).nullable(),
        next_step: z.string(),
        next_step_on: date.nullable(),
        updated_at: timestamp,
      })
      .nullable(),
  })
  .transform((row) => ({
    id: row.id,
    name: row.name,
    organisationType: row.organisation_type,
    country: row.country,
    region: row.region,
    segment: row.segment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    emails: row.emails,
    designs: row.designs,
    mostVersions: row.most_versions,
    shared: row.shared,
    lastDesignAt: row.last_design_at,
    quotes: row.quotes,
    lead: row.lead && {
      owner: row.lead.owner,
      nextStep: row.lead.next_step,
      nextStepOn: row.lead.next_step_on,
      updatedAt: row.lead.updated_at,
    },
  }));

export type LeadRow = z.output<typeof leadRow>;
export type LeadQuote = LeadRow["quotes"][number];

export const parseLeadRows = (data: unknown): LeadRow[] => z.array(leadRow).parse(data);

export interface LeadListItem extends LeadRow {
  readonly score: LeadScore;
  /** 60 or more: contact within 24 hours. */
  readonly hot: boolean;
  readonly suggestedOwner: LeadOwner | null;
  readonly lastActivity: string;
}

const latest = (times: readonly (string | null)[]): string =>
  times
    .filter((time): time is string => time !== null)
    .reduce((newest, time) => (Date.parse(time) > Date.parse(newest) ? time : newest));

export function buildLeadList(rows: readonly LeadRow[], now: Date): LeadListItem[] {
  return rows
    .map((row) => {
      const score = leadScore(
        {
          organisationType: row.organisationType,
          country: row.country,
          quotes: row.quotes,
          mostVersions: row.mostVersions,
          sharedWithOthers: row.shared,
          // Paid credits and samples are not built: see lib/leads/score.ts.
          paidCreditsOrSample: false,
        },
        now,
      );
      return {
        ...row,
        score,
        hot: isHot(score.total),
        suggestedOwner: suggestedOwner({
          owner: row.lead?.owner ?? null,
          country: row.country,
          organisationType: row.organisationType,
          score: score.total,
        }),
        lastActivity: latest([row.updatedAt, row.lastDesignAt, ...row.quotes.map((quote) => quote.createdAt)]),
      };
    })
    .sort((a, b) => b.score.total - a.score.total || Date.parse(b.lastActivity) - Date.parse(a.lastActivity));
}

const emptyToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

export const NEXT_STEP_MAX = 200;

export const leadFormSchema = z.object({
  brandId: z.uuid("That is not a brand."),
  owner: z.preprocess(emptyToNull, z.enum(ids<LeadOwner>(LEAD_OWNERS), "Choose who owns the lead.").nullable().default(null)),
  nextStep: z.string().trim().max(NEXT_STEP_MAX, `Keep it under ${NEXT_STEP_MAX} characters.`).default(""),
  nextStepOn: z.preprocess(emptyToNull, z.string().refine(isCalendarDate, "Choose a real date.").nullable().default(null)),
});

export const quoteStatusFormSchema = z.object({
  quoteId: z.uuid("That is not a quote request."),
  status: quoteStatusSchema,
});
