import type { ReactElement } from "react";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { PDF_FONT_FAMILY, PDF_URDU_FONT_FAMILY, PDF_URDU_FONT_FILE } from "@/lib/flat/pdf-font";
import { TRANSLATION_KEYS } from "@/lib/translate/keys";
import { DRAFT_STRINGS } from "@/lib/translate/strings";
import { fullDesign, packFor } from "../../fixtures/designs";
import { drawable, drawableIn } from "../pdf-text";
import { CLOSING_PAGES, TECH_PACK_PAGES, pagePlan } from "../pages";
import { exportSections } from "../tables";
import { readPdfOf } from "../fixtures/pdf-helpers";
import { sourceMarks } from "./marks";
import { heading } from "./parts";
import { pageElement, pageMark } from "./page";
import { typesetFor } from "./typeset";

/** One element of the document, as a test reads it: its key and the props it was given. */
type Part = Readonly<{ key: string | null; props: Readonly<{ fixed?: boolean; children?: unknown }> }>;

/** The children of one element of the document, flattened, so a test can look for one by its key. */
const childrenOf = (element: ReactElement): readonly Part[] =>
  (Array.isArray((element.props as { children?: unknown }).children)
    ? ((element.props as { children: unknown[] }).children as unknown[])
    : [(element.props as { children?: unknown }).children]
  ).filter((child): child is Part => typeof child === "object" && child !== null && "props" in child);

/**
 * The tech pack in Urdu (spec F-S6 "Translate", `docs/spec/06-build-plan.md` phase 3 item 12; plan v5
 * O3, decision 0103).
 *
 * The three things that make this a translated document rather than English in another font: the words
 * are Urdu, the font draws every one of their characters, and the pages read right to left. The fourth
 * is the one that matters most: nobody has read the translation, and every page says so.
 */

const pack = () => packFor(fullDesign("crew-tee"));
const A4_MIDDLE = 595.28 / 2;

/** Every piece of text on one page, with where it starts across the page. */
async function textRuns(bytes: Uint8Array): Promise<readonly (readonly Readonly<{ text: string; x: number }>[])[]> {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, verbosity: 0 });
  const document = await task.promise;
  const pages: Readonly<{ text: string; x: number }>[][] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const content = await (await document.getPage(number)).getTextContent();
    pages.push(
      content.items.flatMap((item) =>
        "str" in item && item.str.trim() !== "" ? [{ text: item.str, x: item.transform[4] as number }] : [],
      ),
    );
  }
  await task.destroy();
  return pages;
}

describe("how an Urdu document is set", () => {
  const urdu = typesetFor("ur");
  const english = typesetFor("en");

  it("is set in the Urdu font and reads right to left; the English document is unchanged", () => {
    expect(urdu.family).toBe(PDF_URDU_FONT_FAMILY);
    expect(urdu.direction).toBe("rtl");
    expect(urdu.row).toBe("row-reverse");
    expect(english.family).toBe(PDF_FONT_FAMILY);
    expect(english.direction).toBe("ltr");
    expect(english.row).toBe("row");
  });

  it("carries the notice that nobody has read the translation, and says what is not translated", () => {
    expect(urdu.unreviewedNotice).toBe(DRAFT_STRINGS.ur["notice.unreviewed"]);
    expect(urdu.scopeNotice).toBe(DRAFT_STRINGS.ur["notice.scope"]);
    // English is not a translation, so it carries neither.
    expect(english.unreviewedNotice).toBeNull();
    expect(english.scopeNotice).toBeNull();
  });

  it("draws every character of every Urdu word, so no word becomes a question mark", () => {
    for (const key of TRANSLATION_KEYS) {
      const words = DRAFT_STRINGS.ur[key];
      expect(drawableIn(PDF_URDU_FONT_FILE, words), key).toBe(words);
      expect(urdu.words(key), key).toBe(words);
      expect(urdu.lacks(words), key).toBe(false);
    }
  });

  it("would have shown every one of those words as question marks in the Latin font", () => {
    // Which is why the font travels with the text: the English font has no Arabic script at all.
    expect(drawable(DRAFT_STRINGS.ur["page.overview"])).toMatch(/^\?+$/u);
    expect(english.lacks(DRAFT_STRINGS.ur["page.qc"])).toBe(true);
  });

  it("titles every page in Urdu, and the same page in English in the English document", () => {
    for (const page of pagePlan(exportSections(pack()))) {
      const titles = [...TECH_PACK_PAGES, ...CLOSING_PAGES].find((entry) => entry.id === page.id)!.title;
      expect(pageMark(page, english), page.id).toBe(titles);
      expect(pageMark(page, urdu), page.id).toMatch(/\p{Script=Arabic}/u);
    }
  });
});

describe("the Urdu PDF itself", () => {
  it("is a PDF of every page, made with nothing cut off or lost", async () => {
    const { bytes, pages, warnings } = await readPdfOf(pack(), new Map(), { language: "ur" });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(pages.length).toBeGreaterThanOrEqual(TECH_PACK_PAGES.length + CLOSING_PAGES.length);
    expect(warnings).toEqual([]);
  });

  it("sets the page furniture at the right-hand side of every page, which the English document never does", async () => {
    const [urdu, english] = await Promise.all([
      readPdfOf(pack(), new Map(), { language: "ur" }),
      readPdfOf(pack(), new Map(), {}),
    ]);
    const urduRuns = await textRuns(urdu.bytes);
    const englishRuns = await textRuns(english.bytes);
    // The header block is the first thing on every page, and in Urdu it runs from the right margin.
    for (const [index, runs] of urduRuns.entries()) {
      expect(runs.length, `page ${index + 1}`).toBeGreaterThan(0);
      expect(runs[0]!.x, `page ${index + 1}`).toBeGreaterThan(A4_MIDDLE);
    }
    for (const [index, runs] of englishRuns.entries()) {
      expect(runs[0]!.x, `page ${index + 1}`).toBeLessThan(A4_MIDDLE);
    }
  });

  it("carries the words nobody has read on every page, and the English document carries none", () => {
    // Read from the document itself rather than from the drawing of it: the extracted text of a
    // shaped Arabic run does not always map back to the characters it was drawn from, and what has
    // to be true is that every page holds the notice, fixed, so it repeats on every sheet of paper.
    const made = pack();
    const plan = pagePlan(exportSections(made));
    for (const language of ["ur", "en"] as const) {
      const safe = typesetFor(language);
      const context = { pack: made, images: new Map(), safe, pictureLeftOut: false, marks: sourceMarks(exportSections(made)) };
      const options = { illustrations: null, appendix: [], notice: null };
      for (const planned of plan) {
        const page = pageElement(planned, context, options, heading(2, "", safe));
        const notice = childrenOf(page).find((child) => child.key === "unreviewed");
        if (language === "ur") {
          expect(notice, planned.id).toBeDefined();
          expect(notice!.props.fixed, planned.id).toBe(true);
          expect(notice!.props.children, planned.id).toBe(DRAFT_STRINGS.ur["notice.unreviewed"]);
        } else {
          expect(notice, planned.id).toBeUndefined();
        }
      }
    }
  });

  it("says on the first page what is in Urdu and what is not, once and not on every page", () => {
    const made = pack();
    const safe = typesetFor("ur");
    const context = { pack: made, images: new Map(), safe, pictureLeftOut: false, marks: sourceMarks(exportSections(made)) };
    const options = { illustrations: null, appendix: [], notice: null };
    const plan = pagePlan(exportSections(made));
    const scopes = plan.map((planned) =>
      childrenOf(pageElement(planned, context, options, heading(2, "", safe))).filter((child) => child.key === "scope"),
    );
    expect(scopes.filter((found) => found.length === 1)).toHaveLength(1);
    expect(scopes[0]![0]!.props.children).toBe(DRAFT_STRINGS.ur["notice.scope"]);
  });
});
