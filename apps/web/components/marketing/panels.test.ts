import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAUNCH_PANELS } from "@/lib/launch";
import { MARKETING_PANELS } from "@/lib/marketing";
import { MARKETING_PANEL_COMPONENTS, marketingPanel } from "./panels";

/**
 * The six panels, as the wiring step will mount them. A panel is a default export taking exactly
 * `LaunchPanelProps` (L1's contract), so the shell can load it with `next/dynamic`.
 */

const HERE = __dirname;

describe("the panel registry", () => {
  it("has a component for every panel this workstream fills, and for nothing else", () => {
    expect(Object.keys(MARKETING_PANEL_COMPONENTS).sort()).toEqual([...MARKETING_PANELS].sort());
    for (const id of MARKETING_PANELS) expect(typeof MARKETING_PANEL_COMPONENTS[id], id).toBe("function");
  });

  it("answers nothing for a panel another workstream owns", () => {
    expect(marketingPanel("text")).toBe(MARKETING_PANEL_COMPONENTS.text);
    expect(marketingPanel("mockups")).toBeNull();
    expect(marketingPanel("flow-run")).toBeNull();
    for (const id of LAUNCH_PANELS) {
      if ((MARKETING_PANELS as readonly string[]).includes(id)) continue;
      expect(marketingPanel(id), id).toBeNull();
    }
  });

  /** The six files the registry mounts. `ExportPanel.tsx` is not one: it is part of the inspector. */
  const PANEL_FILES = ["TextPanel.tsx", "ElementsPanel.tsx", "PatternFillsPanel.tsx", "AssistantPanel.tsx", "LayersPanel.tsx", "MarketingBoardPanel.tsx"];

  it("gives every panel a default export and no props of its own", () => {
    expect(PANEL_FILES).toHaveLength(MARKETING_PANELS.length);
    for (const name of PANEL_FILES) {
      expect(readdirSync(HERE), name).toContain(name);
      const text = readFileSync(join(HERE, name), "utf8");
      expect(text, name).toMatch(/export default function \w+\(\{ context,? ?(commands)? \}: LaunchPanelProps\)/);
    }
  });

  it("says in its own words that it is a client component, because every panel has state", () => {
    for (const name of readdirSync(HERE).filter((one) => /\.tsx$/.test(one))) {
      const text = readFileSync(join(HERE, name), "utf8");
      // PanelFrame and the preview hold no state of their own; everything else does.
      if (name === "PanelFrame.tsx") continue;
      expect(text.startsWith('"use client";'), name).toBe(true);
    }
  });
});
