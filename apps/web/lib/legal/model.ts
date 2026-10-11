/**
 * The legal pages, held as data so the site and the files in docs/legal are made from one text.
 * The files are written by scripts/write-legal-docs.mts, and a test fails when they differ.
 */

export type LegalBlock =
  | Readonly<{ kind: "p"; text: string }>
  | Readonly<{ kind: "list"; items: readonly string[] }>
  | Readonly<{ kind: "table"; head: readonly string[]; rows: readonly (readonly string[])[] }>;

export type LegalSection = Readonly<{ heading: string; blocks: readonly LegalBlock[] }>;

export type LegalSlug = "terms" | "privacy" | "data-processing";

export type LegalDocument = Readonly<{
  slug: LegalSlug;
  title: string;
  summary: string;
  /** The date of the last change, as YYYY-MM-DD. */
  updated: string;
  /** "approved" only once the owner and a lawyer have signed it off (owner action A9). */
  status: "draft" | "approved";
  sections: readonly LegalSection[];
}>;

export const DRAFT_NOTICE =
  "DRAFT. Not in force. The owner and a qualified lawyer must approve this text before Knitwright opens to the public (owner action A9). Text in [square brackets] is for the owner to fill in.";

/** The lawyer's note under each Australian section (decision 0025). */
export const AUSTRALIA_REVIEW =
  "[lawyer: Australia is the first market (owner, 2026-10-11; the Platform and Store Guide). Review the Australian sections for the Spam Act 2003, the Privacy Act 1988 and the Australian Consumer Law before Knitwright is offered to Australian clubs.]";

const cell = (text: string): string => text.replaceAll("|", "\\|");

const blockToMarkdown = (block: LegalBlock): string => {
  if (block.kind === "p") return block.text;
  if (block.kind === "list") return block.items.map((item) => `- ${item}`).join("\n");
  return [
    `| ${block.head.map(cell).join(" | ")} |`,
    `|${block.head.map(() => "---").join("|")}|`,
    ...block.rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ].join("\n");
};

export const toMarkdown = (doc: LegalDocument): string => {
  const parts = [
    `# ${doc.title}`,
    ...(doc.status === "draft" ? [`> **${DRAFT_NOTICE}**`] : []),
    `Last updated: ${doc.updated}`,
    doc.summary,
    ...doc.sections.flatMap((section, index) => [
      `## ${index + 1}. ${section.heading}`,
      ...section.blocks.map(blockToMarkdown),
    ]),
  ];
  return `${parts.join("\n\n")}\n`;
};
