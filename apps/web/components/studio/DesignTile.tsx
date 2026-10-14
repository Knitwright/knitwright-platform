import Link from "next/link";
import { formatDate } from "@/lib/projects/dates";
import type { ProjectSummary } from "@/lib/projects/service";

/** A plain garment outline that stands in for the design's own drawing on the studio home. */
function GarmentOutline() {
  return (
    <svg className="lift-art" width="96" height="104" viewBox="0 0 96 104" aria-hidden="true" focusable="false">
      <path
        d="M30 4 L18 8 L2 30 L16 40 L22 32 L22 100 L74 100 L74 32 L80 40 L94 30 L78 8 L66 4 Q48 18 30 4 Z"
        fill="rgba(233,234,238,0.08)"
        stroke="rgba(255,255,255,0.4)"
      />
      <path d="M30 4 Q48 18 66 4" fill="none" stroke="var(--cobalt-soft)" strokeWidth="4" />
    </svg>
  );
}

/** One design on the studio home: a glass tile that lifts on hover and opens the editor. */
export function DesignTile({ project }: Readonly<{ project: ProjectSummary }>) {
  const details = [project.styleNumber && `Style ${project.styleNumber}`, project.season].filter(Boolean).join(", ");

  return (
    <Link
      href={`/studio/${project.id}`}
      className="glass lift flex h-full flex-col overflow-hidden rounded-[2rem] text-ink no-underline"
    >
      <span className="dot-grid grid h-36 place-items-center border-b border-white/8">
        <GarmentOutline />
      </span>
      <span className="lift-caption flex flex-1 flex-col gap-1.5 px-5 pb-5 pt-4">
        <span className="text-[15.5px] font-medium leading-snug">{project.name}</span>
        <span className="text-[13px] text-ink-2">{project.garmentLabel}</span>
        {details ? <span className="text-[13px] text-muted">{details}</span> : null}
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-muted">
          <span className="rounded-full bg-cobalt-wash px-2.5 py-0.5 font-mono text-[#c9d2ff]">
            Version {project.currentVersion}
          </span>
          <span>Changed {formatDate(project.updatedAt)}</span>
        </span>
      </span>
    </Link>
  );
}
