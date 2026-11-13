"use client";

import type { Route } from "next";
import Link from "next/link";
import { TechPackEditor } from "@/components/techpack-editor/TechPackEditor";
import { autoDesignName, type EditorSlotProps } from "@/lib/editor";
import { sheetDate } from "@/lib/techpack/editor/from-project";
import { canExportTechPacks, sheetsDownloads } from "@/lib/techpack/editor/plan";
import type { OverviewHeader } from "@/lib/techpack/view";

/**
 * The **tech pack view**, the slot `tech-pack` of the editor shell's contract: since v3.9 it is the
 * tech pack editor of plan v6 G2 (decision 0151), the same component the `/studio/<id>/tech-pack`
 * page mounts, with its seven tabs, mm / cm / in, points and callouts on the garment, Check fit and
 * Preview sheets. The eleven v2.2 tabs fold into the seven (`lib/techpack/editor/tabs.ts`).
 *
 * It fetches nothing. A callout added on the stage, and one taken off, is saved through the shell's
 * own `save`, the stored-design action the Specs toolbar uses, so a reload shows it again.
 */

/**
 * What the Overview tab's header fields can be read from the slot contract. Only the form's own line
 * can: the brand, the collection, the season, the design's typed name and the factory are not part of
 * `EditorDesign`, so they are left empty and the tab asks for them rather than guessing at one.
 */
const headerOf = (design: EditorSlotProps["design"]): OverviewHeader => ({
  styleName: null,
  formName: autoDesignName(design.article, design.form),
  brand: null,
  collection: null,
  season: null,
  factory: null,
});

export default function TechPackView({ design, commands }: EditorSlotProps) {
  const address = `/studio/${design.projectId}/tech-pack`;
  return (
    <div className="flex min-h-0 flex-col gap-3" data-testid="techpack-view">
      <TechPackEditor
        spec={design.spec}
        article={design.article}
        header={headerOf(design)}
        sizes={design.sizes}
        size={design.size}
        colourwayId={design.colourwayId}
        onSave={commands.save}
        busy={design.busy}
        onSize={commands.setSize}
        sheets={{ date: sheetDate(new Date()), openIn: address, downloads: sheetsDownloads(design.projectId), canExport: canExportTechPacks() }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => commands.showView("tech-pack")}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-body font-medium text-text"
          data-testid="techpack-only"
        >
          Show the tech pack on its own
        </button>
        <Link href={address as Route} className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-body font-medium text-text" data-testid="techpack-page-link">
          Open the tech pack page
        </Link>
      </div>
    </div>
  );
}
