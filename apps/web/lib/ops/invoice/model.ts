import { sizesLine } from "../format";

/**
 * The commercial invoice (spec F-O4: "commercial invoice with HS codes and origin, for DCTS preference into
 * the UK"; plan v5 O1, decision 0100).
 *
 * Every fact comes from a row: the HS code and the country of origin from the base article, the country the
 * goods were made in from the factory, the preference scheme from the destination's country rule, the value
 * from what the Store gave. Nothing is invented. An HS code that is not on file is left blank and named in
 * "What this invoice cannot state", because a customs document with a guessed tariff heading is worse than one
 * with a gap. **No delivery date appears anywhere**: the days for QC and the freight days are both unset
 * (decision 0071), so the document says what is missing instead.
 */

export interface InvoiceOrder {
  readonly id: string;
  readonly externalRef: string;
  readonly pieces: number;
  readonly sizes: Readonly<Record<string, number>>;
  readonly valueMinor: number | null;
  readonly currency: string | null;
  readonly articleId: string;
  readonly factoryProfileId: string;
}

export interface InvoiceArticle {
  readonly code: string;
  readonly name: string;
  /** From `base_articles.hs_code`. Null: no tariff heading is on file for this article. */
  readonly hsCode: string | null;
  /** From `base_articles.origin`. Null: the article record says nothing about origin. */
  readonly origin: string | null;
}

export interface InvoiceFactory {
  readonly name: string;
  readonly city: string;
  /** ISO 3166 alpha-2. The country the goods were made in. */
  readonly country: string;
}

export interface InvoiceDestination {
  readonly country: string;
  readonly name: string;
  /** "DCTS" for the United Kingdom, from `country_rules.preference_scheme`. Null: none on file. */
  readonly preferenceScheme: string | null;
}

export interface InvoiceSource {
  readonly order: InvoiceOrder;
  readonly brandName: string;
  readonly article: InvoiceArticle | null;
  readonly factory: InvoiceFactory | null;
  readonly destination: InvoiceDestination | null;
  /** The day ops is issuing it, as a date. */
  readonly issuedOn: string;
  /** The terms of delivery ops typed, or empty. */
  readonly incoterms: string;
}

export interface InvoiceLine {
  readonly description: string;
  readonly hsCode: string | null;
  readonly originCountry: string;
  readonly pieces: number;
  /** Null when the Store gave no value: a unit price is never worked out from nothing. */
  readonly unitValueMinor: number | null;
  readonly lineValueMinor: number | null;
}

export interface InvoiceModel {
  readonly orderId: string;
  readonly orderRef: string;
  readonly brandName: string;
  readonly issuedOn: string;
  readonly originCountry: string;
  readonly destinationCountry: string;
  readonly destinationName: string;
  readonly preferenceScheme: string | null;
  readonly incoterms: string;
  readonly consignorLine: string;
  readonly lines: readonly InvoiceLine[];
  readonly totalPieces: number;
  readonly totalValueMinor: number | null;
  readonly currency: string | null;
  readonly sizesLine: string;
  /** What the invoice cannot state, in plain words. Printed on the document, never silently dropped. */
  readonly missing: readonly string[];
  /** The one sentence that stands in for a delivery date everywhere in this platform. */
  readonly dateNote: string;
}

export const NO_DELIVERY_DATE =
  "No delivery date is stated: the days for QC and the freight days are not set, so none can be worked out.";

export const DCTS_NOTE =
  "Where the destination's preference scheme is named above, the exporter's own statement on origin still has to be made separately. This document states the origin on file and claims nothing else.";

export type InvoiceBuild =
  | Readonly<{ status: "ready"; invoice: InvoiceModel }>
  | Readonly<{ status: "blocked"; blockers: readonly string[] }>;

/** The gates an invoice cannot be issued past, each saying what would clear it. */
function blockersOf(source: InvoiceSource): readonly string[] {
  const out: string[] = [];
  if (source.factory === null) {
    out.push(`The factory "${source.order.factoryProfileId}" is not on file, so the country the goods were made in is not known. Add the factory at /ops/factories.`);
  }
  if (source.destination === null) out.push("Choose the country the goods are going to. Its rules give the preference scheme to name.");
  return out;
}

/** What the invoice cannot state, named rather than guessed at. */
function missingOf(source: InvoiceSource, article: InvoiceArticle | null): readonly string[] {
  const out: string[] = [];
  if (article === null) out.push(`No catalogue article matches "${source.order.articleId}", so neither its tariff heading nor its origin could be read.`);
  else if (article.hsCode === null) out.push(`No HS code is on file for ${article.code}. A customs broker has to give the heading; none is guessed here.`);
  if (article !== null && article.origin === null) out.push(`The article record for ${article.code} states no origin, so the origin shown is the country the factory is in.`);
  if (source.order.valueMinor === null || source.order.currency === null) out.push("The Store gave no value for this order, so no amount is stated.");
  if (source.incoterms.trim() === "") out.push("No terms of delivery are stated: nobody has agreed any.");
  return out;
}

const unitOf = (total: number | null, pieces: number): number | null => (total === null || pieces < 1 ? null : Math.round(total / pieces));

/** The invoice to issue, or the gates that stop it. Pure: the same rows always give the same document. */
export function buildInvoice(source: InvoiceSource): InvoiceBuild {
  const blockers = blockersOf(source);
  if (blockers.length > 0) return { status: "blocked", blockers };
  const factory = source.factory!;
  const destination = source.destination!;
  const article = source.article;
  const origin = article?.origin ?? factory.country;
  const line: InvoiceLine = {
    description: article === null ? source.order.articleId : `${article.name} (${article.code})`,
    hsCode: article?.hsCode ?? null,
    originCountry: origin.length === 2 ? origin.toUpperCase() : factory.country,
    pieces: source.order.pieces,
    unitValueMinor: unitOf(source.order.valueMinor, source.order.pieces),
    lineValueMinor: source.order.valueMinor,
  };
  return {
    status: "ready",
    invoice: {
      orderId: source.order.id,
      orderRef: source.order.externalRef,
      brandName: source.brandName,
      issuedOn: source.issuedOn,
      originCountry: factory.country,
      destinationCountry: destination.country,
      destinationName: destination.name,
      preferenceScheme: destination.preferenceScheme,
      incoterms: source.incoterms.trim(),
      consignorLine: `${factory.name}, ${factory.city}, ${factory.country}`,
      lines: [line],
      totalPieces: source.order.pieces,
      totalValueMinor: source.order.valueMinor,
      currency: source.order.currency,
      sizesLine: sizesLine(source.order.sizes),
      missing: missingOf(source, article),
      dateNote: NO_DELIVERY_DATE,
    },
  };
}

/** The lines as the database keeps them, so the record and the document can never drift apart. */
export const linesForRecord = (invoice: InvoiceModel): readonly Readonly<Record<string, unknown>>[] =>
  invoice.lines.map((l) => ({
    description: l.description,
    hsCode: l.hsCode,
    originCountry: l.originCountry,
    pieces: l.pieces,
    unitValueMinor: l.unitValueMinor,
    lineValueMinor: l.lineValueMinor,
  }));
