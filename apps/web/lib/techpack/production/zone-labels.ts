import type { PrintZone } from "@/lib/production/contract";

/** Plain names for the places a mark may go. */
export const ZONE_LABELS: Readonly<Record<PrintZone["purpose"], string>> = {
  crest: "Crest",
  sponsor: "Sponsor",
  "front-number": "Front number",
  "back-name": "Back name",
  "back-number": "Back number",
  "sleeve-badge": "Sleeve badge",
  "sleeve-band": "Sleeve band",
};

