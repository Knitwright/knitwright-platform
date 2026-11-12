import { Mail } from "lucide-react";
import { Tag } from "@/components/ui/Chips";
import { Icon } from "@/components/ui/Icon";
import { formatDate } from "@/lib/projects/dates";
import { ACCESS_LABELS, type SharedItem } from "@/lib/projects-page/rows";
import { GRID } from "./GridTiles";

/**
 * Designs other brands invited this person to (d04). An invite opens from its own link, which is
 * never stored, so a card says where the link is rather than pretending to open the design.
 */
export function SharedGrid({ shared }: Readonly<{ shared: readonly SharedItem[] }>) {
  return (
    <ul aria-label="Shared with you" className={GRID}>
      {shared.map((item) => (
        <li key={item.inviteId} className="flex min-w-0 flex-col gap-2" data-testid="shared-tile">
          <span className="relative grid aspect-[4/3] place-items-center rounded-lg bg-soft text-muted">
            <Icon icon={Mail} size={22} />
            <Tag tone={item.opened ? "ok" : "info"} className="absolute bottom-2.5 left-2.5">
              {ACCESS_LABELS[item.access]}
            </Tag>
          </span>
          <h3 className="truncate text-body-lg font-semibold text-text" title={item.projectName}>
            {item.projectName}
          </h3>
          <p className="-mt-1.5 text-small text-muted">
            From {item.brandName} · open it from the invite email · until {formatDate(item.expiresAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}
