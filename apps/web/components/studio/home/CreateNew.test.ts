import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreateNew } from "./CreateNew";
import { FOCUSABLE, modalProps, newButtonProps } from "./create-new-a11y";
import { ActionCards } from "./ActionCards";
import { StudioSidebar } from "./Sidebar";

/**
 * Decision 0074: the accessibility of the create-new modal, and the rule that no entry of the home
 * is a dead link. The keyboard behaviour (Escape closes and gives focus back, Tab goes round
 * inside) is in e2e/studio-catalogue.spec.ts.
 */

const ids = { dialogId: "d1", titleId: "t1" };

describe("the + New button and its modal", () => {
  it("says it opens a dialog, whether it is open, and which element it controls", () => {
    expect(newButtonProps(ids, false)).toEqual({
      type: "button",
      "aria-haspopup": "dialog",
      "aria-expanded": false,
      "aria-controls": "d1",
    });
    expect(newButtonProps(ids, true)["aria-expanded"]).toBe(true);
  });

  it("is a modal dialog labelled by its own heading", () => {
    expect(modalProps(ids)).toEqual({ id: "d1", role: "dialog", "aria-modal": true, "aria-labelledby": "t1" });
  });

  it("counts a link, a button and a field as somewhere Tab may land", () => {
    expect(FOCUSABLE).toContain("a[href]");
    expect(FOCUSABLE).toContain("button:not([disabled])");
    expect(FOCUSABLE).toContain('[tabindex]:not([tabindex="-1"])');
  });

  it("shows only the closed button until it is opened", () => {
    const html = renderToStaticMarkup(createElement(CreateNew, {}));
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("+ New");
    expect(html).not.toContain('role="dialog"');
  });
});

describe("the home's links", () => {
  it("never writes an empty address: an unbuilt section says it is coming later instead", () => {
    for (const markup of [renderToStaticMarkup(createElement(StudioSidebar)), renderToStaticMarkup(createElement(ActionCards))]) {
      expect(markup).not.toMatch(/href="(#|)"/);
      expect(markup).toContain("Coming in a later release");
    }
  });

  it("names the sidebar and spells out the entries that are not built", () => {
    const markup = renderToStaticMarkup(createElement(StudioSidebar));
    expect(markup).toContain('aria-label="Studio sections"');
    expect(markup).toContain('href="/catalogue"');
    // An unbuilt entry is plain text with the sentence beside it: aria-disabled is not allowed on a
    // span or a div, and axe reports it as a serious fault.
    expect(markup).not.toContain("aria-disabled");
    for (const label of ["Collections", "Moodboards", "Pattern fills", "Mockups", "Flows", "Trash"]) {
      expect(markup, label).toContain(label);
    }
  });
});
