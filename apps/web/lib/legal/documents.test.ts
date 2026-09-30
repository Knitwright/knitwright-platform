import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS, legalDocument, legalFilePath } from "./documents";
import { toMarkdown } from "./model";
import { PROCESSORS } from "./processors";

const text = (slug: string) => toMarkdown(legalDocument(slug)!);

describe("the legal documents", () => {
  it("are the terms, the privacy notice and the data-processing terms", () => {
    expect(LEGAL_DOCUMENTS.map((doc) => doc.slug)).toEqual(["terms", "privacy", "data-processing"]);
  });

  it("are all drafts until the owner and a lawyer approve them (owner action A9)", () => {
    for (const doc of LEGAL_DOCUMENTS) expect(doc.status).toBe("draft");
  });

  it("name every processor in the privacy notice and the data-processing terms", () => {
    for (const slug of ["privacy", "data-processing"]) {
      for (const name of ["Supabase", "Vercel", "Anthropic", "OpenAI", "Gemini"]) {
        expect(text(slug)).toContain(name);
      }
      for (const processor of PROCESSORS) expect(text(slug)).toContain(processor.name);
    }
  });

  it("frame the privacy notice for UK and EU data protection law", () => {
    const privacy = text("privacy");
    for (const phrase of ["UK GDPR", "EU GDPR", "Information Commissioner", "Article 6(1)(b)", "standard contractual clauses"]) {
      expect(privacy).toContain(phrase);
    }
  });

  it("never call a pattern production-ready, except to say it is not", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      for (const match of toMarkdown(doc).matchAll(/production-ready/g)) {
        const before = toMarkdown(doc).slice(Math.max(0, (match.index ?? 0) - 40), match.index);
        expect(before).toMatch(/never presented as $/);
      }
    }
  });

  it("finds a document by its address, and nothing else", () => {
    expect(legalDocument("terms")?.title).toBe("Terms of use");
    expect(legalDocument("constructor")).toBeNull();
    expect(legalDocument(undefined)).toBeNull();
  });

  it.each(LEGAL_DOCUMENTS.map((doc) => doc.slug))(
    "docs/legal/%s.md is the same text as the page (run scripts/write-legal-docs.mts after a change)",
    (slug) => {
      expect(readFileSync(legalFilePath(slug), "utf8").replaceAll("\r\n", "\n")).toBe(text(slug));
    },
  );
});
