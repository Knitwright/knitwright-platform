import type { Listing } from "./listing";
import { pricesAboveCost, type PriceRow } from "./pricing";

/**
 * LISTING HEALTH (09 screen 23: "preview + Listing health"; prototype p06). Each line is read off the listing and
 * the facts beside it, so the checklist can never disagree with the page. A `block` line stops Publish; a `warn`
 * line is said and does not stop it.
 */

export type HealthState = "ok" | "warn" | "block";

export interface HealthLine {
  readonly id: string;
  readonly label: string;
  readonly state: HealthState;
}

export interface HealthFacts {
  readonly rows: readonly PriceRow[];
  /** The product's stage: only a product approved for runs can be sold (its golden sample is signed off). */
  readonly stage: "idea" | "sample" | "run";
  readonly hasRelease: boolean;
  readonly productionClass: "A" | "B" | null;
  readonly euResponsiblePerson: string | null;
  readonly storefrontLive: boolean;
}

const line = (id: string, state: HealthState, ok: string, notOk: string): HealthLine => ({ id, state, label: state === "ok" ? ok : notOk });

const pictures = (count: number): HealthLine =>
  line("media", count > 0 ? "ok" : "block", `${count} ${count === 1 ? "mockup" : "mockups"}`, "Add at least one mockup");

function priceLine(rows: readonly PriceRow[]): HealthLine {
  const priced = rows.filter((row) => row.retailMinor !== null);
  if (priced.length === 0) return { id: "prices", state: "block", label: "Set a retail price for at least one size" };
  if (priced.some((row) => row.costMinor === null)) return { id: "prices", state: "warn", label: "Production cost not on file yet" };
  return line("prices", pricesAboveCost(rows) ? "ok" : "block", "Prices above cost", "A size sells at or below its cost");
}

/** Every line, in the order the checklist shows them. */
export function listingHealth(listing: Listing, facts: HealthFacts): readonly HealthLine[] {
  const words = listing.title.trim().length > 0 && listing.description.trim().length > 0;
  return [
    pictures(listing.media.length),
    line("words", words ? "ok" : "block", "Title and description", "Add a title and a description"),
    line("size-table", listing.showSizeTable ? "ok" : "warn", "Size table", "Size table hidden"),
    line("eu-person", facts.euResponsiblePerson ? "ok" : "warn", "EU responsible person", "EU responsible person missing"),
    priceLine(facts.rows),
    line("stage", facts.stage === "run" ? "ok" : "block", "Approved for production runs", "Approve the golden sample before selling"),
    line("release", facts.hasRelease ? "ok" : "block", "A frozen version to make", "Freeze a version for production first"),
    line("fabric", listing.fabricKey ? "ok" : "block", "Fabric chosen", "Choose the fabric it is made in"),
    ...(listing.mode === "made_to_order"
      ? [line("class", facts.productionClass === "B" ? "block" : "ok", "Made to order (Class A)", "Made to order is Class A only: sell it as a drop")]
      : []),
    ...(listing.channel === "storefront" ? [line("storefront", facts.storefrontLive ? "ok" : "warn", "Storefront live", "Your storefront is not live yet")] : []),
  ];
}

export const canPublish = (lines: readonly HealthLine[]): boolean => lines.every((one) => one.state !== "block");

/** The reasons Publish is refused, in one sentence for the person. */
export const blockersOf = (lines: readonly HealthLine[]): string =>
  lines
    .filter((one) => one.state === "block")
    .map((one) => `${one.label}.`)
    .join(" ");
