import { describe, expect, it } from "vitest";
import { DESIGN_ANCHORS, designActions, jumpLinks } from "./design-actions";

const ID = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

describe("what to do once a design is drawn", () => {
  it("offers sharing, pictures, a quote, the editor and the tech pack, in that order", () => {
    expect(designActions(ID).map((action) => action.id)).toEqual(["share", "photoreal", "quote", "editor", "tech-pack"]);
  });

  it("gives every action a label and one sentence on what it does", () => {
    for (const action of designActions(ID)) {
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.sentence).toMatch(/^[A-Z].*\.$/);
      expect(action.sentence.split(". ").length).toBe(1);
    }
  });

  it("takes the person to the part of the design page that does each thing", () => {
    const hrefs = Object.fromEntries(designActions(ID).map((action) => [action.id, action.href]));
    expect(hrefs).toEqual({
      share: `/studio/${ID}#${DESIGN_ANCHORS.share}`,
      photoreal: `/studio/${ID}#${DESIGN_ANCHORS.photoreal}`,
      quote: `/studio/${ID}#${DESIGN_ANCHORS.quote}`,
      editor: `/studio/${ID}`,
      "tech-pack": `/studio/${ID}/tech-pack`,
    });
  });

  it("escapes an id that is not a plain one", () => {
    expect(designActions("a b")[3].href).toBe("/studio/a%20b");
  });

  it("names nothing settled or approved", () => {
    const words = designActions(ID).map((action) => `${action.label} ${action.sentence}`).join(" ");
    expect(words).not.toMatch(/\b(checked|approved|confirmed|final|verified)\b/i);
  });
});

describe("the jump links at the top of the design page", () => {
  it("lead to the share, picture and quote sections on the same page", () => {
    expect(jumpLinks()).toEqual([
      { id: "share", label: "Share", href: `#${DESIGN_ANCHORS.share}` },
      { id: "photoreal", label: "Photoreal images", href: `#${DESIGN_ANCHORS.photoreal}` },
      { id: "quote", label: "Get a quote", href: `#${DESIGN_ANCHORS.quote}` },
    ]);
  });
});
