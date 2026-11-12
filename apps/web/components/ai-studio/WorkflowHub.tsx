"use client";

import { ChevronRight, Clapperboard, Palette, SearchX } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SearchInput } from "@/components/ui/Inputs";
import { KwCoin } from "@/components/ui/Marks";
import { EmptyState } from "@/components/ui/PageStates";
import { tabPanelProps, Tabs } from "@/components/ui/Tabs";
import { CATEGORY_LABELS, workflowHref, type Workflow, type WorkflowCategory } from "@/lib/ai-studio/catalogue";
import { HUB_TAB_LABELS, HUB_TABS, hubRows, viewAllOf, type HubTab } from "@/lib/ai-studio/hub";
import type { Option } from "@/lib/ai-studio/forms";
import { ToneArt } from "./art";
import { BrowseStyles } from "./BrowseStyles";

/**
 * "Start a workflow" (`09` screen 3, prototype d07/d08; decision 0141): the category tabs, Search
 * workflows, the rows with View all, and the Browse styles drawer. Every card opens a workflow page
 * that runs, or says honestly why it cannot yet.
 */

const ID = "ai-workflows";

function WorkflowCard({ workflow }: Readonly<{ workflow: Workflow }>) {
  return (
    <li>
      <Link href={workflowHref(workflow) as Route} className="group flex flex-col gap-2 text-text no-underline" data-testid="ai-studio-workflow-card">
        <ToneArt tone={workflow.tone} className="transition-shadow duration-fast ease-out live:group-hover:shadow-e2">
          {workflow.cost === "free" ? null : (
            <span className="absolute top-3 left-3 rounded-full bg-bg px-1.5 py-1" title="Uses credits">
              <KwCoin label="Uses credits" />
            </span>
          )}
          {workflow.video ? (
            <span className="absolute bottom-3 left-3 grid size-7 place-items-center rounded-md bg-text text-on-dark" title="Video">
              <Icon icon={Clapperboard} size={16} />
            </span>
          ) : null}
        </ToneArt>
        <span className="text-small font-semibold">{workflow.title}</span>
      </Link>
    </li>
  );
}

function Row({ id, title, workflows, onViewAll }: Readonly<{ id: string; title: string; workflows: readonly Workflow[]; onViewAll: (() => void) | null }>) {
  return (
    <section aria-labelledby={`row-${id}`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 id={`row-${id}`} className="flex items-center gap-1 text-title text-text">
          {title}
          <Icon icon={ChevronRight} size={16} />
        </h3>
        {onViewAll ? (
          <Button variant="quiet" size="sm" onClick={onViewAll} aria-label={`View all ${title}`}>
            View all
          </Button>
        ) : null}
      </div>
      <ul className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {workflows.map((workflow) => (
          <WorkflowCard key={workflow.id} workflow={workflow} />
        ))}
      </ul>
    </section>
  );
}

export function WorkflowHub({ styles }: Readonly<{ styles: readonly Option[] }>) {
  const [tab, setTab] = useState<HubTab>("discover");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<WorkflowCategory | null>(null);
  const [drawer, setDrawer] = useState(false);
  const rows = hubRows(tab, search).filter((row) => category === null || row.id === category);

  return (
    <section aria-labelledby="start-heading" className="flex flex-col gap-6">
      <h2 id="start-heading" className="text-display text-text">
        Start a workflow
      </h2>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          idBase={ID}
          label="Workflow categories"
          items={HUB_TABS.map((id) => ({ id, label: HUB_TAB_LABELS[id] }))}
          value={tab}
          onChange={(id) => {
            setTab(id as HubTab);
            setCategory(null);
          }}
          className="flex-1 overflow-x-auto overflow-y-hidden"
        />
        <div className="flex items-center gap-2 lg:w-110">
          <Button variant="secondary" icon={<Icon icon={Palette} />} onClick={() => setDrawer(true)}>
            Browse styles
          </Button>
          <SearchInput aria-label="Search workflows" placeholder="Search workflows" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      <div {...tabPanelProps(ID, tab)} className="flex flex-col gap-10 outline-none">
        {category ? (
          <Button variant="link" className="w-fit" onClick={() => setCategory(null)}>
            ← All {HUB_TAB_LABELS[tab].toLowerCase()} workflows
          </Button>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState icon={<Icon icon={SearchX} size={22} />} title="No workflow matches" action={<Button variant="secondary" onClick={() => setSearch("")}>Clear the search</Button>}>
            Nothing in {HUB_TAB_LABELS[tab]} matches “{search.trim()}”.
          </EmptyState>
        ) : (
          rows.map((row) => {
            const all = viewAllOf(row.id);
            return <Row key={row.id} id={row.id} title={all ? CATEGORY_LABELS[all] : row.title} workflows={row.workflows} onViewAll={all && category === null ? () => setCategory(all) : null} />;
          })
        )}
      </div>
      <BrowseStyles open={drawer} onClose={() => setDrawer(false)} styles={styles} />
    </section>
  );
}
