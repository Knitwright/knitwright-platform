import { fileURLToPath } from "node:url";
import { DATA_PROCESSING } from "./data-processing";
import type { LegalDocument, LegalSlug } from "./model";
import { PRIVACY } from "./privacy";
import { TERMS } from "./terms";

/** Every legal page, in the order they are listed. Served at /legal/<slug>. */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [TERMS, PRIVACY, DATA_PROCESSING];

/** The document at this address, or null. Only the known slugs match. */
export const legalDocument = (slug: unknown): LegalDocument | null =>
  LEGAL_DOCUMENTS.find((doc) => doc.slug === slug) ?? null;

/** Where the markdown copy of a document lives, for the owner and the lawyer to review. */
export const legalFilePath = (slug: LegalSlug): string =>
  fileURLToPath(new URL(`../../../../docs/legal/${slug}.md`, import.meta.url));
