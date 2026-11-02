import { describe, expect, it } from "vitest";
import { currentNote, FOCUSABLE, menuButtonProps, menuPanelProps } from "./menu-a11y";

/**
 * The attributes of the top bar's menus (decision 0103). They are tested here rather than through
 * the component, as the "Why?" popover's and the create-new modal's are.
 */

describe("the button that opens a menu", () => {
  it("says what it opens and whether it is open", () => {
    expect(menuButtonProps("panel-7", false)).toEqual({ type: "button", "aria-expanded": false, "aria-controls": "panel-7" });
    expect(menuButtonProps("panel-7", true)["aria-expanded"]).toBe(true);
  });
});

describe("the panel it opens", () => {
  it("carries the id the button names, and a role that can take a name", () => {
    expect(menuPanelProps("panel-7", "Account")).toEqual({ id: "panel-7", role: "group", "aria-label": "Account" });
  });
});

describe("what the overflow button adds to its own name", () => {
  it("names the current section when that section is inside the menu", () => {
    expect(currentNote("Teamwear")).toBe(", current section: Teamwear");
  });

  it("adds nothing when no section inside the menu is current", () => {
    expect(currentNote(null)).toBeNull();
  });
});

describe("the controls a Tab goes round", () => {
  it("lists links, enabled buttons, fields and anything given a tab stop, and nothing taken out of the order", () => {
    expect(FOCUSABLE).toContain("a[href]");
    expect(FOCUSABLE).toContain("button:not([disabled])");
    expect(FOCUSABLE).toContain('[tabindex]:not([tabindex="-1"])');
  });
});
