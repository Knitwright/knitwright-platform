import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesignImportPanel, NOT_APPLIED_YET } from "./DesignImportPanel";

/**
 * WHAT ACCEPTING A READING DOES NOT DO, said before anyone accepts (decision 0124 item 3a).
 *
 * `acceptImport` keeps the chosen layers on the reading's own row and keeps the pictures cut from
 * the picture as the brand's artwork. It does **not** write them onto the design the panel is open
 * on: decision 0038 item 6 left that to the step after it, and nothing in the repository does it.
 * Mounting the panel inside a design's editor is what made the old "now part of your design"
 * sentence a promise it could not keep, so the panel says what is true instead, and this test is
 * what stops the sentence drifting back.
 */

const render = (): string =>
  renderToStaticMarkup(createElement(DesignImportPanel)).replaceAll("&#x27;", "'").replaceAll("&amp;", "&");

describe("the design-import panel's standing note", () => {
  it("says the reading and its pictures are kept, and that this design is not changed", () => {
    expect(NOT_APPLIED_YET).toContain("keeps the reading");
    expect(NOT_APPLIED_YET).toContain("It does not change this design");
    expect(NOT_APPLIED_YET).toContain("not built yet");
  });

  it("is on screen from the first paint, before a picture is even chosen", () => {
    const html = render();
    expect(html).toContain(NOT_APPLIED_YET);
    expect(html).toContain("Nothing is kept until you accept it.");
  });

  it("never says a design was saved or changed, in any of its words", () => {
    const html = render();
    expect(html).not.toMatch(/part of your design/i);
    expect(html).not.toMatch(/saved as your design/i);
  });

  /** Decision 0038 item 9: three words this screen never uses about a picture. */
  it("never calls the reading exact", () => {
    expect(render()).not.toMatch(/\b(exact|identical|matches your picture)\b/i);
  });
});
