import { isHot } from "./score";

/**
 * Who should follow up a lead (Platform and Store Guide, pages 9 and 12). Any Australian club
 * scoring 60 or more goes to the partner unless it already has an owner; brands, creators and
 * buyers overseas stay with Knitwright. There are no partner accounts yet: "partner" is a label
 * the admin sets. The list only suggests; an admin decides.
 */

export const LEAD_OWNERS = [
  { id: "knitwright", label: "Knitwright" },
  { id: "partner", label: "Partner" },
] as const;

export type LeadOwner = (typeof LEAD_OWNERS)[number]["id"];

export const leadOwnerLabel = (owner: LeadOwner | null): string =>
  LEAD_OWNERS.find((entry) => entry.id === owner)?.label ?? "Unassigned";

interface RoutingInput {
  readonly owner: LeadOwner | null;
  readonly country: string | null;
  readonly organisationType: string | null;
  readonly score: number;
}

/** The owner to suggest, or null while the lead is not hot enough to need one. */
export function suggestedOwner(lead: RoutingInput): LeadOwner | null {
  if (lead.owner) return lead.owner;
  if (!isHot(lead.score)) return null;
  return lead.country === "AU" && lead.organisationType === "club" ? "partner" : "knitwright";
}
