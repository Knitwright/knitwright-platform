import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FLOW_TEMPLATES } from "@/lib/flows";
import { panelDouble, type LaunchContext, type LaunchPanelProps } from "@/lib/launch";
import { designBoard, project } from "@/lib/launch/fixtures/canvas";
import { FlowPacks } from "./FlowPacks";
import TemplatesPanel from "./TemplatesPanel";

/**
 * The six launch packs in the Templates panel of the launch rail (decision 0124, mounting L6's
 * picker from decision 0096). Rendered against `panelDouble()`: no shell and no browser.
 */

const render = (element: Parameters<typeof renderToStaticMarkup>[0]): string =>
  renderToStaticMarkup(element).replaceAll("&#x27;", "'").replaceAll("&amp;", "&").replaceAll("&quot;", '"');

const context = (boards: LaunchContext["project"]["boards"]): LaunchContext => ({
  project: project(boards, []),
  selection: null,
  credits: 120,
  presets: [],
  unit: "px",
  zoom: 100,
  dockTool: "select",
  busy: false,
});

const props = (boards: LaunchContext["project"]["boards"]): LaunchPanelProps & { calls: ReturnType<typeof panelDouble>["calls"] } => {
  const double = panelDouble();
  return { context: context(boards), commands: double.commands, calls: double.calls };
};

describe("the launch packs", () => {
  it("offers every pack, with a way to open it, and asks the shell for nothing on its own", () => {
    const given = props([designBoard("design-1")]);
    const html = render(createElement(FlowPacks, given));
    expect(FLOW_TEMPLATES.length).toBe(6);
    for (const pack of FLOW_TEMPLATES) {
      expect(html, pack.slug).toContain(`flow-template-${pack.slug}`);
      expect(html, pack.slug).toContain(pack.title);
      expect(html, pack.slug).toContain(`flow-template-open-${pack.slug}`);
    }
    expect(given.calls).toEqual([]);
  });

  it("says a pack costs nothing to open, and that the canvas shows a run's cost first", () => {
    const html = render(createElement(FlowPacks, props([designBoard("design-1")])));
    expect(html).toContain("the cost is shown before anything is spent");
  });

  it("says plainly that a canvas with no Design board opens the pack with an empty one", () => {
    expect(render(createElement(FlowPacks, props([])))).toContain("has no Design board yet");
    expect(render(createElement(FlowPacks, props([designBoard("design-1")])))).not.toContain("has no Design board yet");
  });

  it("is inside the Templates panel, so the rail's Templates tab is the door", () => {
    const html = render(createElement(TemplatesPanel, props([designBoard("design-1")])));
    expect(html).toContain("launch-flow-packs");
    expect(html).toContain("flow-templates");
    // And the panel no longer sends anyone to the canvas to look for a pack.
    expect(html).not.toContain("a flow is started from the canvas");
  });
});
