import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonClasses, type ButtonVariant } from "./Button";
import { FilterChip, StatusPill } from "./Chips";
import { Toggle } from "./Inputs";
import { initialFocus, Modal, trapTab } from "./Modal";
import { parseTyped } from "./NumberInput";
import { ErrorState, PremiumGate } from "./PageStates";
import { tabPanelProps, Tabs } from "./Tabs";
import { ToastCard } from "./Toast";

const attr = (html: string, name: string): string | undefined => new RegExp(`${name}="([^"]*)"`).exec(html)?.[1];

describe("a button disabled with a reason (§8)", () => {
  const html = renderToStaticMarkup(h(Button, { disabledReason: "Fix the 2 failing checks first", onClick: () => undefined }, "Order samples"));

  it("stays focusable but is aria-disabled, never a submit button, and has no handler", () => {
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/<button[^>]* disabled=""/);
    expect(attr(html, "type")).toBe("button");
  });

  it("names its tooltip, which holds the reason even while hidden", () => {
    const describedBy = attr(html, "aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(html).toMatch(new RegExp(`<span role="tooltip" id="${describedBy}" hidden=""[^>]*>Fix the 2 failing checks first</span>`));
  });
});

describe("a loading button", () => {
  const html = renderToStaticMarkup(h(Button, { loading: true }, "Order 25 shirts"));

  it("blocks a second press, says it is busy, shows the spinner and keeps its label", () => {
    expect(html).toMatch(/<button[^>]* disabled=""/);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("data-spinner");
    expect(html).toContain("Order 25 shirts");
  });

  it("is the same for the v2.2 `pending` prop", () => {
    expect(renderToStaticMarkup(h(Button, { pending: true }, "Save"))).toContain('aria-busy="true"');
  });
});

describe("button classes", () => {
  it("give each variant its own look, from tokens only", () => {
    const variants: ButtonVariant[] = ["primary", "secondary", "premium", "ghost", "danger", "link", "quiet"];
    const looks = variants.map((variant) => buttonClasses(variant));
    expect(new Set(looks).size).toBe(variants.length);
    for (const look of looks) expect(look).not.toMatch(/#[0-9a-f]{3,8}|\[\d+px\]/i);
    expect(buttonClasses("primary")).toContain("bg-navy");
    expect(buttonClasses("premium")).toContain("bg-gold");
  });

  it("keep the v2.2 signature (variant, arrow, className) working", () => {
    expect(buttonClasses("secondary", false, "self-start")).toContain("self-start");
    expect(buttonClasses("secondary", false, "self-start")).toContain("h-10");
  });

  it("size the four heights and square the icon buttons", () => {
    expect(buttonClasses("primary", false, "", "lg")).toContain("h-11");
    expect(buttonClasses("primary", false, "", "sm")).toContain("h-8");
    expect(buttonClasses("primary", false, "", "xs")).toContain("h-7");
    expect(buttonClasses("ghost", false, "", "md", true)).toContain("w-10");
  });
});

describe("tabs", () => {
  const html = renderToStaticMarkup(
    h(Tabs, {
      idBase: "t",
      label: "Projects",
      value: "b",
      onChange: () => undefined,
      items: [
        { id: "a", label: "Recent" },
        { id: "b", label: "Projects" },
      ],
    }),
  );

  it("put only the chosen tab in the tab order and join each tab to its panel", () => {
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/id="t-tab-b" aria-selected="true" aria-controls="t-panel-b" tabindex="0"/);
    expect(html).toMatch(/id="t-tab-a" aria-selected="false" aria-controls="t-panel-a" tabindex="-1"/);
    expect(tabPanelProps("t", "b")).toMatchObject({ role: "tabpanel", id: "t-panel-b", "aria-labelledby": "t-tab-b" });
  });
});

describe("a modal", () => {
  it("renders nothing while closed", () => {
    expect(renderToStaticMarkup(h(Modal, { open: false, onClose: () => undefined, title: "Rename", children: "x" }))).toBe("");
  });

  it("is a labelled modal dialog at its width, with a close button", () => {
    const html = renderToStaticMarkup(h(Modal, { open: true, onClose: () => undefined, title: "Rename design", size: "md", children: "x" }));
    expect(html).toContain('role="dialog" aria-modal="true"');
    expect(html).toMatch(new RegExp(`aria-labelledby="${attr(html, "aria-labelledby")}"`));
    expect(html).toContain("max-w-180");
    expect(html).toContain('aria-label="Close"');
  });

  it("keeps Tab inside: past the last element focus goes to the first", () => {
    const items = [{ focus: vi.fn() }, { focus: vi.fn() }, { focus: vi.fn() }];
    const box = { querySelectorAll: () => items } as unknown as HTMLElement;
    const event = { key: "Tab", shiftKey: false, preventDefault: vi.fn() };
    trapTab(event, box, items[2] as unknown as Element);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(items[0].focus).toHaveBeenCalled();

    const back = { key: "Tab", shiftKey: true, preventDefault: vi.fn() };
    trapTab(back, box, items[0] as unknown as Element);
    expect(items[2].focus).toHaveBeenCalled();

    const other = { key: "a", shiftKey: false, preventDefault: vi.fn() };
    trapTab(other, box, items[2] as unknown as Element);
    expect(other.preventDefault).not.toHaveBeenCalled();
  });

  it("focuses data-autofocus first, then the first input, then the primary button", () => {
    const found = (hits: Record<string, string>) => ({ querySelector: (selector: string) => Object.entries(hits).find(([key]) => selector.startsWith(key))?.[1] ?? null }) as unknown as HTMLElement;
    expect(initialFocus(found({ "[data-autofocus]": "auto", input: "input" }))).toBe("auto");
    expect(initialFocus(found({ input: "input", "[data-primary]": "primary" }))).toBe("input");
    expect(initialFocus(found({ "[data-primary]": "primary" }))).toBe("primary");
  });
});

describe("toasts, chips, toggles and page states", () => {
  const queue = { dismiss: vi.fn(), pause: vi.fn(), resume: vi.fn() };

  it("make an error toast an alert with its Retry, and others polite status", () => {
    const error = renderToStaticMarkup(h(ToastCard, { queue, toast: { id: "1", tone: "error", title: "Generation failed", action: { label: "Retry", onAction: () => undefined } } }));
    expect(error).toContain('role="alert"');
    expect(error).toContain(">Retry<");
    expect(renderToStaticMarkup(h(ToastCard, { queue, toast: { id: "2", tone: "success", title: "Saved" } }))).toContain('role="status"');
  });

  it("show a filter chip's state and count, and a pill's words", () => {
    const chip = renderToStaticMarkup(h(FilterChip, { label: "Size", count: 3, selected: true }));
    expect(chip).toContain('aria-pressed="true"');
    expect(chip).toContain(">· 3</span>");
    expect(renderToStaticMarkup(h(StatusPill, { tone: "ok", children: "Approved" }))).toContain("text-ok");
  });

  it("make a toggle a switch", () => {
    expect(renderToStaticMarkup(h(Toggle, { label: "Show seams", checked: true, onChange: () => undefined }))).toContain('role="switch" aria-checked="true"');
  });

  it("give a page error its request ID and a support link that carries it", () => {
    const html = renderToStaticMarkup(h(ErrorState, { requestId: "req_1", onRetry: () => undefined, children: "We could not load your orders." }));
    expect(html).toContain('role="alert"');
    expect(html).toContain(">Retry<");
    expect(html).toContain("req_1");
    expect(html).toContain("subject=Request%20req_1");
  });

  it("keep a premium-gated control visible, with ♛ and the plan it needs", () => {
    const html = renderToStaticMarkup(h(PremiumGate, { label: "AI video board", plan: "Studio Pro" }));
    expect(html).toContain("AI video board");
    expect(html).toContain('aria-label="Needs Studio Pro"');
  });
});

describe("typing into a number field", () => {
  it("reads a number, a comma decimal, and refuses the rest", () => {
    expect(parseTyped("520")).toBe(520);
    expect(parseTyped(" 12,5 ")).toBe(12.5);
    expect(parseTyped("-3")).toBe(-3);
    expect(parseTyped("")).toBeNull();
    expect(parseTyped("12mm")).toBeNull();
  });
});
