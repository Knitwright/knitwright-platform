import { describe, expect, it } from "vitest";
import { DRAFT_NOTICE, toMarkdown, type LegalDocument } from "./model";

const doc: LegalDocument = {
  slug: "terms",
  title: "Terms of use",
  summary: "The rules.",
  updated: "2026-09-30",
  status: "draft",
  sections: [
    {
      heading: "One",
      blocks: [
        { kind: "p", text: "A paragraph." },
        { kind: "list", items: ["First", "Second"] },
        { kind: "table", head: ["Who", "Why"], rows: [["Supabase", "Database | files"]] },
      ],
    },
  ],
};

describe("toMarkdown", () => {
  it("writes the title, the draft notice, the date and each section in order", () => {
    expect(toMarkdown(doc)).toBe(
      [
        "# Terms of use",
        "",
        `> **${DRAFT_NOTICE}**`,
        "",
        "Last updated: 2026-09-30",
        "",
        "The rules.",
        "",
        "## 1. One",
        "",
        "A paragraph.",
        "",
        "- First",
        "- Second",
        "",
        "| Who | Why |",
        "|---|---|",
        "| Supabase | Database \\| files |",
        "",
      ].join("\n"),
    );
  });

  it("leaves the draft notice out only once a document is approved", () => {
    expect(toMarkdown({ ...doc, status: "approved" })).not.toContain(DRAFT_NOTICE);
  });

  it("says who must approve a draft", () => {
    expect(DRAFT_NOTICE).toMatch(/DRAFT/);
    expect(DRAFT_NOTICE).toMatch(/lawyer/);
  });
});
