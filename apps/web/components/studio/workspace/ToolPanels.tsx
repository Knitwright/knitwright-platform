"use client";

import { JOURNEY_TOOLS, RAIL_TOOLS, TOOLS, type ToolId } from "@/lib/workspace/tools";
import { PanelSection, type SectionContext } from "./PanelSections";

export const tabId = (tool: ToolId): string => `tool-tab-${tool}`;
export const panelId = (tool: ToolId): string => `tool-panel-${tool}`;

type ToolPanelsProps = Readonly<{ tool: ToolId; context: SectionContext }>;

/**
 * Every panel of the workspace, drawn once and kept: only the open one shows. A panel that is
 * hidden keeps what was typed in it, and its saves carry on. Each panel scrolls inside itself.
 */
export function ToolPanels({ tool, context }: ToolPanelsProps) {
  return (
    <section
      aria-label="Tool panel"
      className="glass flex min-h-0 flex-col rounded-3xl lg:overflow-hidden"
      data-testid="tool-panel"
    >
      {RAIL_TOOLS.map((id) => (
        <div
          key={id}
          id={panelId(id)}
          role="tabpanel"
          aria-labelledby={tabId(id)}
          tabIndex={0}
          hidden={id !== tool}
          data-tool={id}
          className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-3xl p-5 outline-offset-[-2px]"
        >
          <PanelBody tool={id} context={context} />
        </div>
      ))}
      {JOURNEY_TOOLS.map((id) => (
        <div
          key={id}
          id={panelId(id)}
          hidden={id !== tool}
          data-tool={id}
          className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-3xl p-5 [&_section]:rounded-none! [&_section]:border-0! [&_section]:bg-transparent! [&_section]:p-0!"
        >
          <div className="panel-in flex flex-col gap-6">
            {TOOLS[id].sections.map((section) => (
              <PanelSection key={section} section={section} context={context} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function PanelBody({ tool, context }: Readonly<{ tool: ToolId; context: SectionContext }>) {
  const info = TOOLS[tool];
  return (
    <div className="panel-in flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">{info.title}</h2>
        <p className="text-[13px] leading-relaxed text-chalk-muted">{info.lead}</p>
      </header>
      {info.sections.map((section) => (
        <PanelSection key={section} section={section} context={context} />
      ))}
    </div>
  );
}
