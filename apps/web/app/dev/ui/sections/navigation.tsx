"use client";

import { useState } from "react";
import { Badge, FilterChip, StatusPill, Tag } from "@/components/ui/Chips";
import { KwCoin, LockMark, LogoTile, PremiumMark } from "@/components/ui/Marks";
import { Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { Row, Section } from "../frame";

const PAGE_TABS = [
  { id: "recent", label: "Recent" },
  { id: "projects", label: "Projects" },
  { id: "ai", label: "AI creations" },
  { id: "archived", label: "Archived", disabled: true },
] as const;

const PACK_TABS = [
  { id: "overview", label: "Overview" },
  { id: "measurements", label: "Measurements" },
  { id: "bom", label: "BOM" },
  { id: "colourways", label: "Colourways" },
] as const;

function TabRows() {
  const [page, setPage] = useState("projects");
  const [pack, setPack] = useState("measurements");
  return (
    <>
      <Row label="Underline tabs (arrow keys move and choose; a disabled tab is skipped)">
        <div className="flex w-full flex-col gap-3">
          <Tabs idBase="dev-page" label="Projects" items={PAGE_TABS} value={page} onChange={setPage} />
          <p {...tabPanelProps("dev-page", page)} className="text-body text-muted">
            Showing the {page} tab.
          </p>
        </div>
      </Row>
      <Row label="Pill tabs">
        <div className="flex w-full flex-col gap-3">
          <Tabs idBase="dev-pack" label="Tech pack" variant="pill" items={PACK_TABS} value={pack} onChange={setPack} />
          <p {...tabPanelProps("dev-pack", pack)} className="text-body text-muted">
            Showing the {pack} page.
          </p>
        </div>
      </Row>
    </>
  );
}

function ChipRows() {
  const [chosen, setChosen] = useState<readonly string[]>(["football"]);
  const flip = (id: string) => setChosen((was) => (was.includes(id) ? was.filter((entry) => entry !== id) : [...was, id]));
  return (
    <>
      <Row label="Filter chips: chosen, not chosen, with a count, disabled">
        {["football", "cricket", "rugby"].map((id) => (
          <FilterChip key={id} label={id[0].toUpperCase() + id.slice(1)} selected={chosen.includes(id)} onClick={() => flip(id)} />
        ))}
        <FilterChip label="Size" count={3} selected />
        <FilterChip label="Training" disabled />
      </Row>
      <Row label="Status pills">
        <StatusPill tone="ok">Approved</StatusPill>
        <StatusPill tone="warn">Sampling</StatusPill>
        <StatusPill tone="bad">Out of tolerance</StatusPill>
        <StatusPill tone="info">In production</StatusPill>
        <StatusPill>Draft</StatusPill>
      </Row>
      <Row label="Tags and badges">
        <Tag tone="ok">Kit-safe</Tag>
        <Tag tone="beta">Beta</Tag>
        <Tag>Class B</Tag>
        <Badge># 8</Badge>
        <Badge tone="gold">New</Badge>
        <Badge tone="neutral">12</Badge>
      </Row>
    </>
  );
}

export function NavigationSection() {
  return (
    <Section id="navigation" title="Tabs, chips and marks">
      <TabRows />
      <ChipRows />
      <Row label="Marks: KW coin, ♛ premium, 🔒 factory lock, logo tile">
        <KwCoin label="Credits" />
        <PremiumMark />
        <LockMark label="Set by Knitwright QC" />
        <LogoTile />
      </Row>
    </Section>
  );
}
