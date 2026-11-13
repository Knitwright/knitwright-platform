"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { fileMenu } from "@/lib/editor";
import type { ToolId } from "@/lib/workspace/tools";

type Props = Readonly<{ projectId: string; onTool: (tool: ToolId) => void }>;

/**
 * The File menu of the top bar (spec F-S4). Every item is a panel of this shell or a page of the
 * design, and every one is a real link, so it opens in a new tab too; a plain click on a panel's
 * item opens the panel in place.
 */
export function FileMenu({ projectId, onTool }: Props) {
  const [open, setOpen] = useState(false);
  const items = fileMenu(projectId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="file-menu"
        data-testid="file-menu-button"
        className={buttonClasses("ghost", false, "", "sm")}
      >
        File
      </button>
      {open ? (
        <ul id="file-menu" aria-label="File" className="absolute left-0 z-50 mt-2 flex w-56 flex-col rounded-2xl border border-border bg-bg p-2 shadow-e3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href as Route}
                onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                  setOpen(false);
                  if (item.kind !== "tool" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  onTool(item.tool);
                }}
                className="flex min-h-10 items-center rounded-md px-3 text-body-lg text-text-2 no-underline live:hover:bg-soft"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
