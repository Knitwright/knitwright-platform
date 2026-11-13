"use client";

import { Redo2, Share, Undo2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { MouseEvent } from "react";
import { FileMenu } from "@/components/studio/editor/FileMenu";
import { SaveStatus } from "@/components/studio/EditorParts";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Chips";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { KwCoin } from "@/components/ui/Marks";
import type { EditorData } from "@/lib/projects/editor-data";
import { toolHref, type ToolId } from "@/lib/workspace/tools";

type Props = Readonly<{
  data: EditorData;
  version: number;
  busy: boolean;
  status: string | null;
  autoName: string | null;
  /** The canvas the garment sits on, which the KW logo goes back to. */
  backHref: Route;
  canvasName: string;
  credits: number | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTool: (tool: ToolId) => void;
  onExport: () => void;
  exportOpen: boolean;
}>;

/**
 * THE STUDIO'S TOP BAR (plan v6 G1, decision 0150; `08` v3.6, s02; `10` §4: 64 px). The KW logo goes
 * back to the canvas, then the design's name with the line its form reads and its version, File and
 * BETA; undo and redo in the centre; the credit balance, Share and Export on the right.
 *
 * Share opens the committee panel in place, as the editor's Share always has; the link is real, so it
 * also opens in a new tab. The Validate findings moved to "Fit checked" on the stage.
 */
export function StudioTopBar(props: Props) {
  const { data, version, busy, status, autoName } = props;
  return (
    <header className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-bg px-4 py-2 lg:flex-nowrap lg:py-0 lg:pr-4.5" data-testid="studio-top-bar">
      <Link
        href={props.backHref}
        aria-label={`Back to canvas: ${props.canvasName}`}
        title="Back to canvas"
        data-testid="canvas-focus-back"
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-navy text-body font-extrabold text-gold no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
      >
        KW
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none lg:basis-auto">
        <div className="min-w-0 lg:max-w-72">
          <h1 className="truncate text-title text-text">{data.name}</h1>
          <p className="truncate text-caption text-muted">
            {autoName ? <span data-testid="auto-name">{autoName}</span> : <span>{data.typeLabel}</span>}
            {" · "}
            <span data-testid="version">Version {version}</span>
          </p>
        </div>
        <FileMenu projectId={data.projectId} onTool={props.onTool} />
        <Tag tone="beta">BETA</Tag>
      </div>
      <div className="order-last flex w-full items-center justify-center gap-1 lg:order-none lg:w-auto lg:flex-1">
        <Button variant="ghost" iconOnly aria-label="Undo" title="Undo" icon={<Icon icon={Undo2} size={20} />} disabled={!props.canUndo || busy} onClick={props.onUndo} />
        <Button variant="ghost" iconOnly aria-label="Redo" title="Redo" icon={<Icon icon={Redo2} size={20} />} disabled={!props.canRedo || busy} onClick={props.onRedo} />
        <SaveStatus busy={busy} status={status} className="min-h-4 max-w-56 truncate text-caption text-muted" />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <Credits credits={props.credits} />
        <ShareLink projectId={data.projectId} onTool={props.onTool} />
        <Button
          variant="primary"
          onClick={props.onExport}
          aria-expanded={props.exportOpen}
          aria-controls="studio-export"
          data-testid="export-button"
        >
          Export
        </Button>
      </div>
    </header>
  );
}

/** The KW credit balance, linked to the credits page. Unknown credits draw nothing rather than a 0. */
function Credits({ credits }: Readonly<{ credits: number | null }>) {
  if (credits === null) return null;
  return (
    <Link href="/credits" className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-body font-semibold text-text no-underline live:hover:bg-soft md:inline-flex" data-testid="studio-credits">
      <KwCoin />
      <span className="tabular-nums">{credits.toLocaleString("en-GB")}</span>
      <span className="sr-only">credits</span>
    </Link>
  );
}

/** Share: a real link to the committee panel; a plain click opens it in place. */
function ShareLink({ projectId, onTool }: Readonly<{ projectId: string; onTool: (tool: ToolId) => void }>) {
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onTool("share");
  };
  return (
    <a href={toolHref(projectId, "share")} onClick={click} className={cx(buttonClasses("secondary"), "no-underline")}>
      Share
      <Icon icon={Share} size={20} />
    </a>
  );
}
