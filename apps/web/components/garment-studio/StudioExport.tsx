"use client";

import { Check, Download, FileText, Grid2x2, Image as ImageIcon, Layers, MessageSquare, Ruler, Shirt, Table2, Tag, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { PremiumMark } from "@/components/ui/Marks";
import type { EditorSlotProps } from "@/lib/editor";
import { NOTES_COMING, ORDER_NOTE, STUDIO_TABS, exportAccess, patternNote, studioTab, techPackChecklist, type ChecklistItem, type StudioExportTabId } from "@/lib/garment-studio/export";
import { openPlans } from "@/lib/plans/modal-store";
import { RECOMMENDED_IMAGE_SIZE, type ExportOutput } from "@/lib/techpack/exports/panel";
import { outputsFor } from "@/lib/techpack/exports/panel-outputs";
import { exportGate, reviewFromDesign } from "@/lib/techpack/exports/review-gate";

const ICONS: Readonly<Record<ChecklistItem["icon"], typeof Check>> = {
  grid: Grid2x2,
  layers: Layers,
  shirt: Shirt,
  ruler: Ruler,
  file: FileText,
  message: MessageSquare,
  image: ImageIcon,
  tag: Tag,
};

const OPTIONS = {
  images: { view: "all", type: "svg", size: RECOMMENDED_IMAGE_SIZE, withMannequin: false, withBackground: false },
  pattern: { format: "pdf-1-1", withArtwork: true, withMeasurements: false },
  everySize: false,
} as const;

type Props = Readonly<{ design: EditorSlotProps["design"]; onClose: () => void; onAllFiles: () => void }>;

/**
 * THE STUDIO'S EXPORT PANEL (plan v6 G1, decision 0150; `08` v3.6, s16). Fabra's six tabs over the
 * files the Export panel already makes (decision 0078), its review gate, and the "Export tech pack
 * (8)" checklist. Export ♛ makes the files when the brand's plan includes tech pack exports, and
 * opens "Upgrade to export tech packs" (P6, decision 0144) when it does not. Ordering never needs it.
 *
 * "Every export file" opens the full Export panel, with its options, in the right-hand panel.
 */
export function StudioExport({ design, onClose, onAllFiles }: Props) {
  const [tab, setTab] = useState<StudioExportTabId>("tech-pack");
  const gate = useMemo(() => exportGate(reviewFromDesign(design)), [design]);
  const input = { projectId: design.projectId, version: design.version, colourwayId: design.colourwayId, size: design.size, views: ["front", "back"] as const };
  const outputs = outputsFor(studioTab(tab).from, input, OPTIONS);
  return (
    <section id="studio-export" aria-labelledby="studio-export-title" className="flex max-h-[calc(100dvh-6rem)] w-[min(34.5rem,calc(100vw-2rem))] flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-bg p-5 shadow-e3 *:shrink-0" data-testid="studio-export">
      <header className="flex items-center justify-between">
        <h2 id="studio-export-title" className="text-h2 text-text">
          Export
        </h2>
        <Button variant="ghost" iconOnly aria-label="Close export" icon={<Icon icon={X} size={20} />} onClick={onClose} />
      </header>
      <div role="tablist" aria-label="Export" className="flex gap-0.5 overflow-x-auto rounded-md bg-soft p-1">
        {STUDIO_TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            id={`studio-export-tab-${one.id}`}
            aria-selected={tab === one.id}
            aria-controls="studio-export-panel"
            onClick={() => setTab(one.id)}
            className={cx("h-9 flex-1 rounded-sm px-3 text-small font-medium whitespace-nowrap", tab === one.id ? "bg-bg text-text shadow-e1" : "text-text-2 live:hover:text-text")}
          >
            {one.label}
          </button>
        ))}
      </div>
      <div id="studio-export-panel" role="tabpanel" aria-labelledby={`studio-export-tab-${tab}`} className="flex flex-col gap-3">
        <p className="text-small text-muted">{studioTab(tab).lead}</p>
        {tab === "tech-pack" ? <Checklist design={design} /> : null}
        {tab === "pattern" ? <p className="text-small text-text-2">{patternNote(design.article)}</p> : null}
        {gate.reason ? (
          <p role="status" className="text-small text-warn" data-testid="studio-export-gate">
            {gate.reason}
          </p>
        ) : null}
        {tab === "tech-pack" ? null : <Outputs outputs={outputs} open={gate.open} busy={design.busy} />}
      </div>
      <p className="rounded-lg bg-gold-soft px-3.5 py-2.5 text-small text-text" data-testid="studio-export-note">
        {ORDER_NOTE}
      </p>
      <Link href={`/studio/${encodeURIComponent(design.projectId)}/tech-pack` as Route} className={cx(buttonClasses("secondary"), "w-full no-underline")}>
        <Icon icon={Table2} size={20} />
        Preview the sheets
      </Link>
      <ExportButton outputs={outputsFor("tech-pack", input, OPTIONS)} open={gate.open} />
      <button type="button" onClick={onAllFiles} className="self-center text-small font-semibold text-link" data-testid="studio-export-all">
        Every export file and its options
      </button>
    </section>
  );
}

/** The eight sections, ticked: both tech pack files carry all of them. */
function Checklist({ design }: Readonly<{ design: EditorSlotProps["design"] }>) {
  const items = techPackChecklist(design.article, design.sizes);
  return (
    <>
      <h3 className="text-title text-text">
        Export tech pack <span className="text-muted">({items.length})</span>
      </h3>
      <ul className="flex flex-col gap-2" aria-label="Tech pack sections" data-testid="studio-export-checklist">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5">
            <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-xs bg-navy text-on-dark">
              <Icon icon={Check} size={14} />
            </span>
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-soft text-text-2">
              <Icon icon={ICONS[item.icon]} size={20} />
            </span>
            <span className="flex flex-col">
              <span className="text-body font-semibold text-text">{item.label}</span>
              <span className="text-caption text-muted">{item.detail}</span>
            </span>
            <span className="sr-only">, included</span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-muted">Both files carry every section. {NOTES_COMING}</p>
    </>
  );
}

/** One tab's files: each a download, or the sentence saying why there is none yet. */
function Outputs({ outputs, open, busy }: Readonly<{ outputs: readonly ExportOutput[]; open: boolean; busy: boolean }>) {
  if (!open) return <p className="text-small text-muted">No file is offered while export is blocked.</p>;
  return (
    <ul className="flex flex-col gap-2" data-testid="studio-export-outputs">
      {outputs.map((output) =>
        output.address === null ? (
          <li key={output.id} className="text-small text-muted">
            <span className="text-text">{output.label}:</span> {output.notYet}
          </li>
        ) : (
          <li key={output.id}>
            <a href={output.address} aria-disabled={busy} className={cx("inline-flex items-center gap-2 text-body font-semibold text-link", busy && "pointer-events-none opacity-40")}>
              <Icon icon={Download} size={16} />
              {output.label}
            </a>
          </li>
        ),
      )}
    </ul>
  );
}

/**
 * Export ♛: the tech pack workbook when the plan includes exports, else the upgrade modal. A shut
 * review gate offers nothing, whatever the plan.
 */
function ExportButton({ outputs, open }: Readonly<{ outputs: readonly ExportOutput[]; open: boolean }>) {
  const access = exportAccess();
  const workbook = outputs.find((output) => output.id === "xlsx")?.address ?? null;
  const label = (
    <>
      <Icon icon={Download} size={20} />
      Export
      {access.allowed ? null : <PremiumMark label={`Needs a plan with tech pack exports; you are on ${access.planName}`} />}
    </>
  );
  if (access.allowed && open && workbook) {
    return (
      <a href={workbook} className={cx(buttonClasses("primary", false, "w-full", "lg"), "no-underline")} data-testid="studio-export-go">
        {label}
      </a>
    );
  }
  if (access.allowed) {
    return (
      <Button size="lg" className="w-full" disabledReason="Export is blocked until the checks above are cleared." data-testid="studio-export-go">
        {label}
      </Button>
    );
  }
  return (
    <Button size="lg" className="w-full" onClick={() => openPlans({ kind: "techpack" })} data-testid="studio-export-go">
      {label}
    </Button>
  );
}
