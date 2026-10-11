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

  it("say Knitwright is offered worldwide, under the law of England and Wales (owner, 2026-09-30)", () => {
    const terms = text("terms");
    expect(terms).toMatch(/offered worldwide/);
    expect(terms).toContain("governed by the law of England and Wales");
    expect(terms).toContain("the courts of England and Wales");
    expect(terms).not.toMatch(/\[owner and lawyer: England and Wales, or another\]/);
  });

  it("name an EU representative under Article 27, with the name still owed by the owner", () => {
    const privacy = text("privacy");
    expect(privacy).toContain("Article 27");
    expect(privacy).toMatch(/representative in the European Union/);
    expect(privacy).toMatch(/\[owner: name and address of the EU representative/);
    expect(privacy).not.toMatch(/if Knitwright offers its service to people in the EU/);
  });

  it("ask the lawyer to review for a worldwide offering, beyond the UK and the EU", () => {
    for (const slug of ["terms", "privacy", "data-processing"]) {
      expect(text(slug)).toMatch(/\[lawyer: Knitwright is offered worldwide/);
    }
  });

  it("name Sentry, in its EU region, as the error monitoring provider (owner, 2026-09-30)", () => {
    const sentry = PROCESSORS.find((processor) => processor.name.includes("Sentry"));
    expect(sentry?.location).toMatch(/European Union.*Germany/);
    expect(PROCESSORS.some((processor) => processor.name.includes("[owner: error monitoring"))).toBe(false);
    expect(text("privacy")).toMatch(/Sentry/);
  });

  describe("Australia, the first market (guide pages 10 and 14, decision 0025)", () => {
    it("explain the Spam Act: consent first, Knitwright named, an unsubscribe honoured within 5 working days", () => {
      const privacy = text("privacy");
      for (const phrase of ["Spam Act 2003", "only if you tick", "identifies Knitwright", "5 working days", "never ticked for you"]) {
        expect(privacy).toContain(phrase);
      }
    });

    it("never email the people a user invites, and never use uploads for anything else", () => {
      const privacy = text("privacy");
      expect(privacy).toMatch(/never email people you invite/);
      expect(privacy).toMatch(/written permission/);
    });

    it("follow the Privacy Act 1988 and the Australian Privacy Principles, with the overseas hosting and the OAIC", () => {
      const privacy = text("privacy");
      for (const phrase of ["Privacy Act 1988", "Australian Privacy Principles", "outside Australia", "access", "correct", "Office of the Australian Information Commissioner", "oaic.gov.au"]) {
        expect(privacy).toContain(phrase);
      }
      expect(privacy).toMatch(/\[owner and Australian adviser: whether the Privacy Act applies/);
    });

    it("keep the UK and EU text it had", () => {
      const privacy = text("privacy");
      for (const phrase of ["UK GDPR", "EU GDPR", "Article 27", "Information Commissioner's Office"]) expect(privacy).toContain(phrase);
    });

    it("note the Australian Consumer Law for custom-made goods, and prices in AUD", () => {
      const terms = text("terms");
      expect(terms).toContain("Australian Consumer Law");
      expect(terms).toMatch(/made to your design/);
      expect(terms).toMatch(/Australian dollars \(AUD\)/);
    });

    it("say pro team and brand logos need a licence, and Knitwright may refuse them (guide p.14)", () => {
      const terms = text("terms");
      expect(terms).toMatch(/pro team and brand logos need a licence/i);
      expect(terms).toMatch(/may refuse/);
      expect(terms).toContain("I own this logo or have permission to use it on garments.");
    });

    it("leave the governing law as it was, and ask the owner instead", () => {
      const terms = text("terms");
      expect(terms).toContain("governed by the law of England and Wales");
      expect(readFileSync(new URL("./OWNER-QUESTIONS.md", import.meta.url), "utf8")).toMatch(/governing law[\s\S]*Australia/i);
    });
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
