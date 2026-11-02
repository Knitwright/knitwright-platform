import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LAUNCH_PANELS, panelDouble, panelPlaceholder, type LaunchContext, type LaunchPanelProps } from "@/lib/launch";
import { designBoard, project } from "@/lib/launch/fixtures/canvas";
import {
  APPLY_PALETTE,
  EMPTY_ACTIONS,
  EMPTY_TITLES,
  FAILED,
  FONT_NOT_APPLIED,
  LOADING,
  OPENS_THE_EDITOR,
  OPEN_MOCKUPS,
  PANEL_LEADS,
  RIGHTS_GAP,
  RIGHTS_RECORDED,
  SEARCH_LABEL,
  SHOW_ALL,
  UPLOAD_NOT_PLACED,
  USE_TEMPLATE,
  BUILT_HERE,
  type BrandPaletteRow,
  type TagFilterGroup,
  type TemplateCard,
  type TemplateCollection,
  type UploadRow,
} from "@/lib/launch-panels";
import BrandPanel, { Font, Palette } from "./BrandPanel";
import TemplatesPanel, { Collection, FilterRow } from "./TemplatesPanel";
import UploadsPanel, { UploadCard } from "./UploadsPanel";
import { TemplateCardRow } from "./TemplateCardRow";
import { PanelEmpty, PanelGap, PanelLoading, PanelProblem } from "./frame";
import { LAUNCH_PANEL_COMPONENTS, launchPanel } from "./panels";
import { showAllTemplatesProps, templateFilterSuffix, templateSuffix } from "./a11y";

/**
 * THE THREE PANELS NO WORKSTREAM OWNED, rendered against `panelDouble()` -- **no shell and no
 * browser** (the panel contract, `lib/launch/panels.ts`; plan v5, decision 0108).
 *
 * Each one is a default export taking exactly `LaunchPanelProps`, which is what lets the shell
 * mount it, and each one reads its rows through a route handler, so what a static render shows is
 * the loading state. The states a read produces are rendered through the panels' own parts, which
 * is where every word of them lives.
 *
 * What is checked is what the owner asked for: a real empty state naming the one action that fills
 * it, a loading state, an error state that says what to do, labelled controls, and a template whose
 * article has no data saying so rather than looking ready.
 */

/** React's HTML entities read back, so a sentence with an apostrophe compares with the copy file. */
const render = (element: Parameters<typeof renderToStaticMarkup>[0]): string =>
  renderToStaticMarkup(element).replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#x2F;", "/");

const context = (busy = false): LaunchContext => ({
  project: project([designBoard("design-1")], []),
  selection: null,
  credits: 120,
  presets: [],
  unit: "px",
  zoom: 100,
  dockTool: "select",
  busy,
});

const props = (busy = false): LaunchPanelProps & { calls: ReturnType<typeof panelDouble>["calls"] } => {
  const double = panelDouble();
  return { context: context(busy), commands: double.commands, calls: double.calls };
};

const card = (over: Partial<TemplateCard> = {}): TemplateCard => ({
  id: "44444444-4444-4444-8444-444444444444",
  slug: "navy-gold-hoops-jersey",
  title: "Navy and gold hoops",
  collection: "Football",
  articleLabel: "Short sleeve jersey",
  reviewLabel: "Knitwright starter, not reviewed by a factory",
  attribution: null,
  gap: null,
  ...over,
});

const upload = (over: Partial<UploadRow> = {}): UploadRow => ({
  id: "55555555-5555-4555-8555-555555555555",
  label: "Club crest",
  kindLabel: "Picture",
  detail: "PNG, 1200 × 900 px",
  rights: { whenIso: "2026-10-03T09:30:00.000Z", when: "3 Oct 2026", wordingVersion: "logo-rights-v1", wordingText: "I own this logo or have permission to use it on garments." },
  warnings: [],
  ...over,
});

const HERE = __dirname;

describe("the registry the shell mounts", () => {
  it("has a component for every panel this directory fills, and for nothing else", () => {
    expect(Object.keys(LAUNCH_PANEL_COMPONENTS).sort()).toEqual([...BUILT_HERE].sort());
    for (const id of BUILT_HERE) expect(typeof LAUNCH_PANEL_COMPONENTS[id], id).toBe("function");
  });

  it("answers nothing for a panel another workstream owns, and nothing for Likes", () => {
    expect(launchPanel("templates")).toBe(LAUNCH_PANEL_COMPONENTS.templates);
    expect(launchPanel("likes")).toBeNull();
    expect(launchPanel("mockups")).toBeNull();
    for (const id of LAUNCH_PANELS) {
      if ((BUILT_HERE as readonly string[]).includes(id)) continue;
      expect(launchPanel(id), id).toBeNull();
    }
  });

  it("gives every panel a default export taking the context and the commands, and nothing else", () => {
    for (const name of ["TemplatesPanel.tsx", "UploadsPanel.tsx", "BrandPanel.tsx"]) {
      expect(readdirSync(HERE), name).toContain(name);
      expect(readFileSync(join(HERE, name), "utf8"), name).toMatch(/export default function \w+\(\{ context,? ?(commands)? \}: LaunchPanelProps\)/);
    }
    for (const Panel of [TemplatesPanel, UploadsPanel, BrandPanel]) expect(Panel.length).toBeLessThanOrEqual(1);
  });

  it("says in its own words that each panel is a client component, because all three hold state", () => {
    for (const name of readdirSync(HERE).filter((one) => /\.tsx$/.test(one) && one !== "frame.tsx")) {
      expect(readFileSync(join(HERE, name), "utf8").startsWith('"use client";'), name).toBe(true);
    }
  });

  /** Likes is the one panel of the four that is honestly not built, and the shell still says so. */
  it("leaves the Likes placeholder in place, naming why there is nothing to list", () => {
    const placeholder = panelPlaceholder("likes");
    expect(placeholder.note).toContain("Nothing in the platform records a like");
    expect(placeholder.testId).toBe("launch-panel-likes");
  });
});

describe("the templates panel", () => {
  it("shows its heading, its lead, a labelled search box and the loading line first", () => {
    const given = props();
    const html = render(createElement(TemplatesPanel, given));
    expect(html).toContain("launch-templates-panel");
    expect(html).toContain(PANEL_LEADS.templates);
    expect(html).toContain(SEARCH_LABEL);
    expect(html).toContain('type="search"');
    expect(html).toContain(LOADING.templates);
    expect(given.calls).toEqual([]);
  });

  it("says plainly that a template opens the editor rather than landing on this canvas", () => {
    const html = render(createElement(TemplatesPanel, props()));
    expect(html).toContain(OPENS_THE_EDITOR);
    expect(html).toContain(OPEN_MOCKUPS);
  });

  it("asks the shell to open the Mockups panel rather than listing a scene twice", () => {
    // The one command this panel sends is an `openPanel`, which the contract offers.
    const given = props();
    const html = render(createElement(TemplatesPanel, given));
    expect(html).toContain("launch-templates-open-mockups");
  });

  it("draws a card with its garment and its review label, and the button that uses it", () => {
    const html = render(createElement(TemplateCardRow, { card: card(), busy: false }));
    expect(html).toContain("Navy and gold hoops");
    expect(html).toContain("Short sleeve jersey");
    expect(html).toContain("not reviewed by a factory");
    expect(html).toContain(USE_TEMPLATE);
    expect(html).toContain(templateSuffix("Navy and gold hoops"));
  });

  it("says on a card what the garment behind it has no data for, with its rule", () => {
    const gap = { ruleId: "R-FIT-H01", line: "No measurement on file for this garment yet" };
    const html = render(createElement(TemplateCardRow, { card: card({ gap }), busy: false }));
    expect(html).toContain(gap.line);
    expect(html).toContain(gap.ruleId);
  });

  it("names the designer of a template a designer made", () => {
    expect(render(createElement(TemplateCardRow, { card: card({ attribution: "Ada Nkemelu" }), busy: false }))).toContain("Ada Nkemelu");
  });

  it("shows a filter chip per choice, each saying how many and which group it is", () => {
    const group: TagFilterGroup = { group: "sport", label: "Sport", choices: [{ id: "football", label: "Football", count: 3 }] };
    const html = render(createElement(FilterRow, { group, chosen: null, onChoose: () => undefined }));
    expect(html).toContain("launch-templates-filter-sport");
    expect(html).toContain("Filter by sport: Football");
    expect(html).toContain(templateFilterSuffix("sport", 3));
    expect(html).toContain('aria-pressed="false"');
  });

  it("says which filter is chosen, so the ring is not the only sign of it", () => {
    const group: TagFilterGroup = { group: "sport", label: "Sport", choices: [{ id: "football", label: "Football", count: 3 }] };
    const html = render(createElement(FilterRow, { group, chosen: "football", onChoose: () => undefined }));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Clear the sport filter Football");
  });

  it("shows a collection short, with a Show all that says how many more there are", () => {
    const collection: TemplateCollection = { key: "Football", label: "Football", shown: [card()], hidden: 3 };
    const html = render(createElement(Collection, { collection, open: false, busy: false, onToggle: () => undefined }));
    expect(html).toContain(SHOW_ALL);
    expect(html).toContain("Show all 3 more football templates");
    expect(showAllTemplatesProps("football", true, 0)["aria-label"]).toBe("Show fewer football templates");
  });
});

describe("the uploads panel", () => {
  it("shows its heading and the loading line, and asks the shell for nothing", () => {
    const given = props();
    const html = render(createElement(UploadsPanel, given));
    expect(html).toContain("launch-uploads-panel");
    expect(html).toContain(LOADING.uploads);
    expect(given.calls).toEqual([]);
  });

  it("says what it does not do, and carries the rights gap with its rule", () => {
    const html = render(createElement(UploadsPanel, props()));
    expect(html).toContain(UPLOAD_NOT_PLACED);
    expect(html).toContain(RIGHTS_GAP.line);
    expect(html).toContain("R-GAP-000");
  });

  it("shows what one file records about rights: what was said, when, and the words on screen", () => {
    const html = render(createElement(UploadCard, { row: upload() }));
    expect(html).toContain("Club crest");
    expect(html).toContain("PNG, 1200 × 900 px");
    expect(html).toContain(`${RIGHTS_RECORDED}, 3 Oct 2026.`);
    expect(html).toContain("I own this logo or have permission to use it on garments.");
  });

  it("shows only the version when the words that were on screen are no longer held", () => {
    const html = render(createElement(UploadCard, { row: upload({ rights: { ...upload().rights, wordingText: null } }) }));
    expect(html).not.toContain("I own this logo");
    expect(html).toContain("3 Oct 2026");
  });

  it("shows what a file's own upload warned about, in the upload's own words", () => {
    const html = render(createElement(UploadCard, { row: upload({ warnings: ["This picture sits on a white box."] }) }));
    expect(html).toContain("This picture sits on a white box.");
  });
});

describe("the brand panel", () => {
  const paletteRow: BrandPaletteRow = {
    id: "p1",
    name: "Primary",
    colours: [{ key: "c1", name: "Club red", paletteName: "Primary", hex: "#c8102e", safeHex: "#c8102e", inGamut: true, pantoneTcx: null, warning: null }],
  };

  it("shows its heading and the loading line, and asks the shell for nothing", () => {
    const given = props();
    const html = render(createElement(BrandPanel, given));
    expect(html).toContain("launch-brand-panel");
    expect(html).toContain(LOADING.brand);
    expect(given.calls).toEqual([]);
  });

  it("offers the way into the import screen as an underlined ink link, never the dimmed cobalt", () => {
    const html = render(createElement(BrandPanel, props()));
    expect(html).toContain("/brand-studio/import");
    expect(html).toContain("underline");
    expect(html).not.toContain("text-cobalt-soft\"");
  });

  it("applies a palette in one click, through the one command the contract offers for it", () => {
    let applied = false;
    const html = render(createElement(Palette, { palette: paletteRow, busy: false, onApply: () => (applied = true) }));
    expect(html).toContain(APPLY_PALETTE);
    expect(html).toContain("launch-brand-apply-p1");
    expect(html).toContain("Club red");
    expect(applied).toBe(false);
  });

  it("shows what the sublimation estimate says about a colour it cannot reach", () => {
    const outside = { ...paletteRow.colours[0]!, inGamut: false, safeHex: "#bb1030", warning: "This is Knitwright's own estimate." };
    const html = render(createElement(Palette, { palette: { ...paletteRow, colours: [outside] }, busy: false, onApply: () => undefined }));
    expect(html).toContain("Knitwright's own estimate.");
  });

  it("shows a type style with its licence note, and offers no button that would set it", () => {
    const html = render(
      createElement(Font, {
        font: { key: "headline:geist", label: "Geist Sans", roleLabel: "Headline", family: "var(--font-sans)", licence: "bundled", licenceNote: "SIL Open Font License 1.1.", selectable: true },
      }),
    );
    expect(html).toContain("Headline: Geist Sans");
    expect(html).toContain("SIL Open Font License 1.1.");
    expect(html).not.toContain("<button");
    expect(FONT_NOT_APPLIED).toContain("Only a font whose licence is in this repository");
  });

  it("says plainly that a font with no licence on file cannot be set", () => {
    const html = render(
      createElement(Font, {
        font: {
          key: "headline:placeholder-block",
          label: "Placeholder: wide block sans",
          roleLabel: "Headline",
          family: null,
          licence: "not_established",
          licenceNote: "No licence for a font of this kind is on file, so it cannot be chosen yet.",
          selectable: false,
        },
      }),
    );
    expect(html).toContain("No licence for a font of this kind is on file");
  });
});

describe("the three states every panel can draw", () => {
  it("names the one action that fills an empty panel, for each of the three", () => {
    for (const id of BUILT_HERE) {
      const html = render(createElement(PanelEmpty, { id }));
      expect(html, id).toContain(EMPTY_TITLES[id]);
      expect(html, id).toContain(EMPTY_ACTIONS[id].label);
      expect(html, id).toContain(EMPTY_ACTIONS[id].href);
    }
  });

  it("says what to do when a read failed, and offers the one thing worth trying", () => {
    const html = render(createElement(PanelProblem, { id: "uploads", onRetry: () => undefined }));
    expect(html).toContain(FAILED.uploads);
    expect(html).toContain("launch-uploads-retry");
    expect(html).toContain('role="alert"');
  });

  it("tells a screen reader it is reading, without taking the focus", () => {
    const html = render(createElement(PanelLoading, { id: "brand" }));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it("puts the rule beside every gap it reports", () => {
    const html = render(createElement(PanelGap, { note: RIGHTS_GAP, testId: "gap-here" }));
    expect(html).toContain(RIGHTS_GAP.line);
    expect(html).toContain("R-GAP-000");
  });
});
