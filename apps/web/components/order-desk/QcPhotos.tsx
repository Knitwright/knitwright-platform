"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";

/**
 * The factory's QC photos ops chose to share (screen 33). A photo is a file of the brand, reached only
 * through a link that lasts a minute (`/api/files/[id]/link`), so each tile asks for its link when
 * pressed and opens the photo in a new tab.
 */
export function QcPhotos({ fileIds }: Readonly<{ fileIds: readonly string[] }>) {
  const [problem, setProblem] = useState<string | null>(null);

  const open = async (fileId: string) => {
    setProblem(null);
    const response = await fetch(`/api/files/${fileId}/link`, { cache: "no-store" }).catch(() => null);
    const body = response?.ok ? ((await response.json()) as { url?: string }) : null;
    if (body?.url) window.open(body.url, "_blank", "noopener,noreferrer");
    else setProblem("That photo could not be opened. It may have been removed.");
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {fileIds.map((fileId, index) => (
          <li key={fileId}>
            <button
              type="button"
              onClick={() => void open(fileId)}
              className="grid aspect-square w-full place-items-center rounded-lg bg-soft text-muted transition-colors duration-fast live:hover:bg-soft-2 focus-visible:outline-2 focus-visible:outline-navy"
            >
              <Icon icon={ImageIcon} size={22} />
              <span className="sr-only">Open QC photo {index + 1}</span>
            </button>
          </li>
        ))}
      </ul>
      {problem ? <Notice tone="warn" role="alert">{problem}</Notice> : null}
    </div>
  );
}
